export const CANONICAL_ARCHITECTURE_VERSION = "3.0.0" as const;

export type DomainLayerId =
  | "L01"
  | "L02"
  | "L03"
  | "L04"
  | "L05"
  | "L06"
  | "L07"
  | "L08"
  | "L09"
  | "L10"
  | "L11"
  | "L12"
  | "L13";

export type PlatformLayerId =
  | "P01"
  | "P02"
  | "P03"
  | "P04"
  | "P05"
  | "P06"
  | "P07"
  | "P08"
  | "P09";

export type LayerAuthority =
  | "CUSTOMER_INTAKE"
  | "INTELLIGENCE_PLANNING"
  | "TRUST_SAFETY_RULES"
  | "FULFILLMENT_TEAM"
  | "RESOURCES_LOGISTICS"
  | "COMMERCIAL_OFFER"
  | "COMMITMENT_CAPACITY"
  | "ROUTING_DISPATCH"
  | "EXECUTION_CHANGE_CONTROL"
  | "RECOVERY_FAIRNESS"
  | "OUTCOME_EVIDENCE"
  | "FINANCE_OPS"
  | "CONTINUITY_CLAIMS";

export type ArchitectureReadiness = "ACTIVE" | "CONTROL_SPINE_READY";

export type DomainLayerDefinition = Readonly<{
  id: DomainLayerId;
  title: string;
  purpose: string;
  authoritativeArtifact: string;
  decisionOwner: LayerAuthority;
  platforms: readonly PlatformLayerId[];
  readiness: ArchitectureReadiness;
}>;

export type PlatformLayerDefinition = Readonly<{
  id: PlatformLayerId;
  title: string;
  purpose: string;
}>;

/**
 * The one canonical registry for the Doneeo lifecycle. UI, APIs and domain
 * transitions all read this object; no second list of layers should be created.
 */
export const DOMAIN_LAYERS: readonly DomainLayerDefinition[] = Object.freeze([
  { id: "L01", title: "Intake & Context", purpose: "Capture the customer's outcome, context and confirmed facts.", authoritativeArtifact: "Intake Record", decisionOwner: "CUSTOMER_INTAKE", platforms: ["P01", "P02", "P03", "P07", "P08"], readiness: "ACTIVE" },
  { id: "L02", title: "Intelligence & Planning", purpose: "Translate the request into ordered work, constraints and a stable requirement contract.", authoritativeArtifact: "Requirement Contract", decisionOwner: "INTELLIGENCE_PLANNING", platforms: ["P01", "P02", "P04", "P06"], readiness: "ACTIVE" },
  { id: "L03", title: "Trust, Safety & Rules", purpose: "Apply eligibility, safety, policy and regulated-work gates before fulfillment.", authoritativeArtifact: "Rule Decision", decisionOwner: "TRUST_SAFETY_RULES", platforms: ["P01", "P02", "P03", "P04", "P08"], readiness: "CONTROL_SPINE_READY" },
  { id: "L04", title: "Fulfillment & Team", purpose: "Build a qualified team without changing the approved customer requirement.", authoritativeArtifact: "Fulfillment Plan", decisionOwner: "FULFILLMENT_TEAM", platforms: ["P01", "P02", "P03", "P05", "P06", "P07"], readiness: "CONTROL_SPINE_READY" },
  { id: "L05", title: "Resources & Logistics", purpose: "Resolve equipment, materials, vehicle, access and sourcing gaps.", authoritativeArtifact: "Resource Plan", decisionOwner: "RESOURCES_LOGISTICS", platforms: ["P01", "P02", "P05", "P06", "P07"], readiness: "CONTROL_SPINE_READY" },
  { id: "L06", title: "Commercial Offer", purpose: "Create one transparent, versioned offer for the complete outcome.", authoritativeArtifact: "Commercial Offer", decisionOwner: "COMMERCIAL_OFFER", platforms: ["P01", "P02", "P08", "P09"], readiness: "CONTROL_SPINE_READY" },
  { id: "L07", title: "Commitment & Capacity", purpose: "Bind customer approval, provider acceptance, capacity and payment authorization.", authoritativeArtifact: "Commitment Record", decisionOwner: "COMMITMENT_CAPACITY", platforms: ["P01", "P02", "P03", "P07", "P09"], readiness: "CONTROL_SPINE_READY" },
  { id: "L08", title: "Prepare, Route & Dispatch", purpose: "Verify departure readiness, route, handoffs and dispatch authorization.", authoritativeArtifact: "Dispatch Pack", decisionOwner: "ROUTING_DISPATCH", platforms: ["P01", "P02", "P04", "P05", "P06", "P07"], readiness: "CONTROL_SPINE_READY" },
  { id: "L09", title: "Execution & Change Control", purpose: "Run physical work forward-only with checkpoints and approved scope changes.", authoritativeArtifact: "Execution Journal", decisionOwner: "EXECUTION_CHANGE_CONTROL", platforms: ["P01", "P02", "P04", "P05", "P06", "P07"], readiness: "CONTROL_SPINE_READY" },
  { id: "L10", title: "Reality, Recovery & Fairness", purpose: "Reconcile observed reality, recover safely and allocate responsibility fairly.", authoritativeArtifact: "Recovery Decision", decisionOwner: "RECOVERY_FAIRNESS", platforms: ["P01", "P02", "P04", "P06", "P07", "P08", "P09"], readiness: "CONTROL_SPINE_READY" },
  { id: "L11", title: "Outcome & Evidence", purpose: "Prove the agreed outcome, exceptions and customer acceptance.", authoritativeArtifact: "Outcome Record", decisionOwner: "OUTCOME_EVIDENCE", platforms: ["P01", "P02", "P03", "P06", "P07", "P08"], readiness: "CONTROL_SPINE_READY" },
  { id: "L12", title: "Settlement & FinanceOps", purpose: "Settle the approved commercial result with an auditable financial trail.", authoritativeArtifact: "Settlement Record", decisionOwner: "FINANCE_OPS", platforms: ["P01", "P02", "P08", "P09"], readiness: "CONTROL_SPINE_READY" },
  { id: "L13", title: "Continuity & Claims", purpose: "Manage claims, follow-up obligations, recurrence and learning without rewriting history.", authoritativeArtifact: "Continuity Record", decisionOwner: "CONTINUITY_CLAIMS", platforms: ["P01", "P02", "P06", "P07", "P08", "P09"], readiness: "CONTROL_SPINE_READY" },
]);

export const PLATFORM_LAYERS: readonly PlatformLayerDefinition[] = Object.freeze([
  { id: "P01", title: "Orchestration", purpose: "Own state, commands, gates and idempotent progression." },
  { id: "P02", title: "Fact & Event Ledger", purpose: "Preserve authoritative facts, versions and append-only events." },
  { id: "P03", title: "Identity & Authority", purpose: "Resolve people, organizations, roles and decision rights." },
  { id: "P04", title: "Safety Enforcement", purpose: "Enforce policy, qualifications, stops and escalation." },
  { id: "P05", title: "Integrations", purpose: "Connect routing, inventory, partners and external services." },
  { id: "P06", title: "Events, AI & Observability", purpose: "Support intelligence, monitoring, diagnostics and learning." },
  { id: "P07", title: "Messaging", purpose: "Deliver contextual, attributable and durable communication." },
  { id: "P08", title: "Privacy & Compliance", purpose: "Apply consent, retention, access and regulatory controls." },
  { id: "P09", title: "Payments", purpose: "Authorize, capture, refund and reconcile funds." },
]);

const FORWARD_FLOW: Readonly<Record<DomainLayerId, readonly DomainLayerId[]>> = Object.freeze({
  L01: ["L02"],
  L02: ["L03"],
  L03: ["L04", "L02"],
  L04: ["L05", "L02"],
  L05: ["L06", "L04"],
  L06: ["L07", "L04", "L05"],
  L07: ["L08", "L04", "L06"],
  L08: ["L09", "L07"],
  L09: ["L10"],
  L10: ["L11", "L07", "L08", "L09"],
  L11: ["L12", "L10"],
  L12: ["L13", "L10", "L11"],
  L13: ["L10", "L12"],
});

const layerById = new Map(DOMAIN_LAYERS.map(layer => [layer.id, layer]));

export function domainLayer(id: DomainLayerId): DomainLayerDefinition {
  const layer = layerById.get(id);
  if (!layer) throw new Error(`Unknown canonical Doneeo layer: ${id}`);
  return layer;
}
export function allowedTargetLayers(id: DomainLayerId): readonly DomainLayerId[] {
  return FORWARD_FLOW[id];
}

export function canTransitionLayer(from: DomainLayerId, to: DomainLayerId): boolean {
  return FORWARD_FLOW[from].includes(to);
}

export function architecturePosition(currentLayerId: DomainLayerId) {
  const current = domainLayer(currentLayerId);
  return Object.freeze({
    version: CANONICAL_ARCHITECTURE_VERSION,
    currentLayerId,
    currentLayer: current,
    allowedNextLayerIds: allowedTargetLayers(currentLayerId),
  });
}
