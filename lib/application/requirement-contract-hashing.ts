import { stableStringify, type RequirementTaskBlock } from "../requirement-contract";

export type TaskBlockAcceptanceProjection = {
  requirementId: string;
  scope: unknown;
  qualification: unknown;
  crew: unknown;
  duration: unknown;
  equipmentAndMaterials: unknown;
  accessAndLocations: unknown;
  temporalConstraints: unknown;
  dependencies: unknown;
  completionCriteria: unknown;
  ruleDecisions: unknown;
};

/** SHA-256 over canonical stable JSON; works in Workers and Node 22+. */
export async function sha256Stable(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(stableStringify(value));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function fingerprintTaskBlocks(
  projections: readonly TaskBlockAcceptanceProjection[],
): Promise<RequirementTaskBlock[]> {
  const ids = new Set<string>();
  const blocks: RequirementTaskBlock[] = [];
  for (const projection of projections) {
    if (!projection.requirementId || ids.has(projection.requirementId)) {
      throw new Error(`invalid or duplicate requirementId: ${projection.requirementId}`);
    }
    ids.add(projection.requirementId);
    blocks.push({
      requirementId: projection.requirementId,
      acceptanceFingerprint: await sha256Stable(projection),
    });
  }
  return blocks;
}
