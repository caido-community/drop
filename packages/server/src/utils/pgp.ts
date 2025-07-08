import * as openpgp from "openpgp";
import type { PrimaryUser } from "openpgp";

import { type KeyValidationResult } from "../types";

import db from "./db";
import logger from "./logger";

const VKS_API_URL = "https://keys.openpgp.org/vks/v1/by-fingerprint/";
const CACHE_TTL = 600; // 10 minutes

export async function validatePublicKey(
  fingerprint: string | undefined,
): Promise<KeyValidationResult> {
  let armoredKey = "";
  let key = null;
  let status: "valid" | "not_found" | "revoked" = "not_found";

  // Format fingerprint (uppercase, no 0x)
  logger.info({ fingerprint }, "Validating public key");
  const formattedFingerprint = fingerprint
    ? fingerprint.toUpperCase().replace("0X", "")
    : null;
  logger.debug({ formattedFingerprint }, "Formatted fingerprint");

  if (!formattedFingerprint) {
    return { status: "not_found" };
  }

  try {
    // Check cache first
    const cachedResult = db
      .prepare(
        "SELECT status, validated_at, key FROM key_cache WHERE fingerprint = ?",
      )
      .get(formattedFingerprint) as
      | { status: string; validated_at: string; key: string }
      | undefined;
    if (cachedResult) {
      const cacheAge = Math.floor(
        (Date.now() - new Date(cachedResult.validated_at).getTime()) / 1000,
      );
      if (cacheAge < CACHE_TTL) {
        logger.info(
          { fingerprint: formattedFingerprint },
          "Using cached validation result",
        );
        armoredKey = cachedResult?.key || "";
        key = await openpgp.readKey({ armoredKey });
        return {
          status: cachedResult.status as "valid" | "not_found" | "revoked",
          key: key,
        };
      }
    }

    // If not in cache or expired, fetch from VKS API
    const url = `${VKS_API_URL}${formattedFingerprint}`;
    logger.debug({ url }, "Fetching from VKS API");
    const response = await fetch(url);

    if (response.status === 404) {
      status = "not_found";
    } else if (response.status === 429) {
      throw new Error("Rate limit exceeded");
    } else if (response.ok) {
      armoredKey = await response.text();
      key = await openpgp.readKey({ armoredKey });

      if (await key.isRevoked()) {
        status = "revoked";
      } else {
        status = "valid";
      }
    } else {
      throw new Error(`VKS API error: ${response.status}`);
    }

    // Update cache
    if (armoredKey) {
      db.prepare(
        "INSERT OR REPLACE INTO key_cache (fingerprint, status, validated_at, key) VALUES (?, ?, CURRENT_TIMESTAMP, ?)",
      ).run(formattedFingerprint, status, armoredKey);
    }

    return { status, key: key || undefined };
  } catch (error) {
    logger.error(
      { error, fingerprint: formattedFingerprint },
      "Error validating public key",
    );
    throw error;
  }
}

export async function verifySignature(
  signature: string,
  data: string,
  timestamp: number,
): Promise<string> {
  try {
    logger.debug({ signature, data }, "Verifying signature");
    const message = await openpgp.createMessage({ text: data });
    logger.debug({ message }, "Message created");
    const signatureObj = await openpgp.readSignature({
      armoredSignature: signature,
    });
    logger.debug({ signatureObj }, "Signature object created");

    const fingerprint = await getFingerprint(signature);
    logger.debug({ fingerprint }, "Extracted fingerprint");

    // Validate the public key first
    const keyValidation = await validatePublicKey(fingerprint);
    logger.debug({ keyValidation }, "Key validation result");
    if (keyValidation.status !== "valid" || !keyValidation.key) {
      throw new Error(`Invalid or missing public key: ${keyValidation.status}`);
    }

    // Use the key object directly since it's already been read
    const key = keyValidation.key;
    logger.debug(
      {
        keyID: key.getKeyID().toHex(),
        creationTime: key.getCreationTime(),
        algorithm: key.getAlgorithmInfo(),
      },
      "Key details",
    );

    key.getPrimaryUser = () =>
      Promise.resolve({
        user: {},
        selfCertification: {},
        index: 0,
      }) as Promise<PrimaryUser>; // Hack to force validation on userId-less object.

    const verification = await openpgp.verify({
      message,
      signature: signatureObj,
      config: { allowMissingKeyFlags: true },
      verificationKeys: key,
    });
    logger.debug({ verification }, "Verification object created");

    const { verified, keyID } = verification.signatures[0]!;
    logger.debug({ verified, keyID }, "Verification result");
    await verified;

    if (!verified) {
      throw new Error("Signature verification failed");
    }

    // Verify timestamp is within 300 seconds
    const currentTime = Math.floor(Date.now() / 1000);
    if (Math.abs(currentTime - timestamp) > 300) {
      throw new Error("Timestamp validation failed");
    }

    return fingerprint;
  } catch (error) {
    logger.error(
      { error: (error as Error).message },
      "Error verifying signature",
    );
    throw error;
  }
}

export async function getFingerprint(
  signatureArmored: string,
): Promise<string> {
  const signature = await openpgp.readSignature({
    armoredSignature: signatureArmored,
  });
  const fp = signature.packets[0]!.issuerFingerprint;
  return fp
    ? Array.from(fp)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase()
    : "";
}
