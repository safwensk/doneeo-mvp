/**
 * Content digest for Requirement Contracts.
 *
 * WHY THIS IS A SEPARATE MODULE
 *
 * The domain (`requirement-contract.ts`) is pure and synchronous: no I/O, no clock,
 * no promises. Hashing is neither pure-domain concern nor cheap to do correctly in
 * synchronous JavaScript, so it lives here, at the application boundary, where async
 * is already normal — publishing a contract is an application operation, not a
 * domain calculation.
 *
 * The domain receives an already-computed digest and compares stored digests
 * synchronously. It never hashes anything itself.
 *
 * HISTORY — why this module exists at all
 *
 * The first implementation carried a hand-rolled 64-bit hash documented as FNV-1a.
 * It was not FNV-1a. Verified against reference vectors on 2026-08-18:
 *
 *   "foobar"  produced 01e596e1e43967e8; true FNV-1a 64-bit is 85944171f73967e8
 *
 * Only the empty string matched, because that is the offset basis before any
 * multiplication is applied. The low 32 bits were correct and the high half was not.
 * The function behaved acceptably as a change detector — no collisions across
 * 200,000 probes — but a doc comment asserting a named standard, attached to a value
 * persisted to a database, is a defect regardless of runtime behaviour. Anyone
 * reimplementing it in another language, cross-verifying a stored digest, or
 * migrating the store would have been misled.
 *
 * The lesson generalises: a custom hash cannot be verified by anyone else, so the
 * correct fix was not to repair the arithmetic but to use a standard nobody has to
 * take on trust. SHA-256 is available in both runtimes we target, via the same
 * Web Crypto API on Cloudflare Workers and Node.
 */

import { stableStringify } from "./requirement-contract";

/** Hex-encoded SHA-256 of the canonical serialization. 64 characters. */
export async function digestContent(content: unknown): Promise<string> {
  return sha256Hex(stableStringify(content));
}

/**
 * SHA-256 of a UTF-8 string, hex-encoded.
 *
 * Uses Web Crypto, which is available on Cloudflare Workers and on Node 18+ as
 * `globalThis.crypto`. No Node-only imports, so this runs unchanged in both.
 */
export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Constant-time-ish comparison of two hex digests.
 *
 * Not a security boundary — these digests are change detectors, not authentication
 * tags — but avoiding an early-exit compare costs nothing and stops the shape of a
 * timing leak from being copied into somewhere it would matter.
 */
export function digestsEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
