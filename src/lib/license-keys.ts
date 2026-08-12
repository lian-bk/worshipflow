// Helpers shared between the Owner Console and the dashboard's license check.
import { randomInt } from "crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I — easy to read aloud

function randomSegment(length: number) {
  let s = "";
  for (let i = 0; i < length; i++) {
    s += ALPHABET[randomInt(ALPHABET.length)];
  }
  return s;
}

/** Produces keys like WFLW-7K2P-9QXR-3MZC */
export function generateKeyCode() {
  return `WFLW-${randomSegment(4)}-${randomSegment(4)}-${randomSegment(4)}`;
}

/** Whole days left until expiry. null = never expires (Lifetime). */
export function daysRemaining(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

type KeyLike = {
  status: "unused" | "active" | "expired" | "revoked";
  expires_at: string | null;
};

/**
 * True if this key should currently block access — checked live against
 * expires_at, not just the `status` column, so a church locks out
 * immediately even before the once-a-day expiration job has run.
 */
export function isKeyLocked(key: KeyLike): boolean {
  if (key.status === "revoked" || key.status === "expired") return true;
  if (key.status === "active" && key.expires_at && new Date(key.expires_at).getTime() < Date.now()) {
    return true;
  }
  return false;
}
