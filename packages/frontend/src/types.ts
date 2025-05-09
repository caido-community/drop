import { type Caido } from "@caido/sdk-frontend";
import { type ToastMessageOptions } from "primevue/toast";

export type FrontendSDK = Caido<any, any>;

export interface CustomToastMessageOptions extends ToastMessageOptions {
  data: {
    name: string;
    description: string;
    claim: () => void;
    delete: () => void;
  };
}

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
  timestamp: number;
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

export type DropType = "Tamper" | "Replay" | "Filter" | "Scope";

export interface DropPluginConfig {
  pgpKeyPair?: PGPKeyPair;
  connections: DropConnection[];
  apiServer: string;
  messages?: DropPayload[];
  alias?: string;
  firstOpen: boolean;
  keyServer: string;
}

export const defaultStorage: DropPluginConfig = {
  pgpKeyPair: undefined,
  connections: [],
  messages: [],
  alias: undefined,
  apiServer: "https://drop.cai.do",
  keyServer: "https://keys.openpgp.org/",
  firstOpen: true,
};
