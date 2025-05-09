import { type Key } from "openpgp";

export interface Message {
  id: number;
  from_public_key: string;
  encrypted_data: string;
  created_at: string;
}

export interface KeyValidationResult {
  status: "valid" | "revoked" | "not_found";
  key?: Key;
}

export interface ErrorResponse {
  error: string;
}
