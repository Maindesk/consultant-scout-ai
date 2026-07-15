// Server-only: AES-256-GCM encryption for per-workspace API credentials.
// Never import this from client / route / *.functions.ts top level.
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

function key(): Buffer {
  const raw = process.env.WORKSPACE_ENCRYPTION_KEY;
  if (!raw) throw new Error("WORKSPACE_ENCRYPTION_KEY is not set");
  // Accept base64 or plain string; normalize to exactly 32 bytes via SHA-256.
  return createHash("sha256").update(raw).digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64");
}

export function decryptSecret(stored: string): string {
  const buf = Buffer.from(stored, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
