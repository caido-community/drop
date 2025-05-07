import { Caido } from "@caido/sdk-frontend";

export type FrontendSDK = Caido<{}, {}>;

export interface PGPKeyPair {
  publicKey: string;
  privateKey: string;
  fingerprint: string;
}

export interface DropConnection {
  alias: string;
  fingerprint: string;
  publicKey: string;
}

export interface DropMessage {
  id: string;
  from_public_key: string;
  encrypted_data: string;
  created_at: string;
}

export interface DropSendMessage {
  to_public_key: string;
  encrypted_data: string;
  timestamp: string;
  signature: string;
}

export interface DropPayload {
  id: string;
  objects: Array<{
    type: string;
    value: any;
  }>;
  notes: string;
  sha256?: string;
  message_metadata?: {
    created_at: string;
    from_public_key: string;
  };
}

export interface DropPluginConfig {
  pgpKeyPair?: PGPKeyPair;
  connections: DropConnection[];
  messages?: DropPayload[];
  alias?: string;
  firstOpen: boolean;
}

export const defaultStorage: DropPluginConfig = {
  pgpKeyPair: undefined,
  connections: [],
  messages: [],
  alias: undefined,
  firstOpen: true
};