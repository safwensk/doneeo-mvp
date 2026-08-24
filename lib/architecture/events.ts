/**
 * The event catalog. Generated — do not edit by hand.
 *
 * This is the coherence test the architecture never had. Before the rulings,
 * 52 of 73 consumed events had no producer anywhere in the set. Every entry
 * here now names exactly one producer, or is declared as arriving from outside
 * Doneeo. tests/architecture-conformance.test.ts enforces both.
 */

import type { LayerId } from "./layers";

export type DomainEvent = {
  name: string;
  /** The single layer authorised to emit this. */
  producer: LayerId;
  consumers: readonly LayerId[];
  /** True when the event was granted to its owner by a v3.0 ruling. */
  addedByRuling?: true;
};

export type ExternalEvent = {
  name: string;
  /** Where it enters the system from. Never produced by a Doneeo layer. */
  origin: string;
  consumers: readonly LayerId[];
};

export const EVENTS: readonly DomainEvent[] = [
  { name: "Abuse.CaseOpened", producer: "P4", consumers: [] },
  { name: "Access.Denied", producer: "P3", consumers: [] },
  { name: "AdjustmentInstruction.Approved", producer: "L09B", consumers: [] },
  { name: "ArchitectureSimulation.Completed", producer: "L2", consumers: [] },
  { name: "Artifact.Versioned", producer: "P2", consumers: [] },
  { name: "Availability.Confirmed", producer: "L4", consumers: [] },
  { name: "Branch.BlockedParent", producer: "L13", consumers: [] },
  { name: "Branch.Completed", producer: "L13", consumers: [] },
  { name: "Branch.Created", producer: "L13", consumers: [] },
  { name: "Branch.Requested", producer: "L09A", consumers: ["L13"] },
  { name: "Cancellation.Reconciled", producer: "L7", consumers: ["L12"] },
  { name: "Cancellation.Requested", producer: "L7", consumers: ["L09B", "L5", "L8"] },
  { name: "CandidateSet.Retrieved", producer: "L4", consumers: [] },
  { name: "Capacity.Held", producer: "L7", consumers: [] },
  { name: "CapacityRecovery.Completed", producer: "L7", consumers: ["L09B"] },
  { name: "Claim.Opened", producer: "L13", consumers: ["P3"] },
  { name: "Claim.Resolved", producer: "L13", consumers: [] },
  { name: "Command.RejectedStaleVersion", producer: "P1", consumers: [] },
  { name: "CommercialDelta.Priced", producer: "L6", consumers: ["L09B"], addedByRuling: true },
  { name: "CommercialOffer.Created", producer: "L6", consumers: [] },
  { name: "CommercialOffer.Expired", producer: "L6", consumers: [] },
  { name: "CommercialOffer.Selected", producer: "L6", consumers: ["L7"], addedByRuling: true },
  { name: "Commitment.Hardened", producer: "L7", consumers: [] },
  { name: "Completion.Submitted", producer: "L10", consumers: ["L11"] },
  { name: "Compliance.FindingRaised", producer: "P8", consumers: [] },
  { name: "Consent.ContextUpdated", producer: "P3", consumers: ["P8"], addedByRuling: true },
  { name: "Consent.Granted", producer: "P3", consumers: [] },
  { name: "Consent.Revoked", producer: "P3", consumers: [] },
  { name: "Context.Updated", producer: "L1", consumers: ["L8"] },
  { name: "CustomerAdjustment.Calculated", producer: "L09B", consumers: [] },
  { name: "DLQ.ItemCreated", producer: "P6", consumers: [] },
  { name: "DSR.Opened", producer: "P8", consumers: [] },
  { name: "Data.ProcessingRegistered", producer: "P2", consumers: ["P8"], addedByRuling: true },
  { name: "DecisionTrace.Created", producer: "P2", consumers: [] },
  { name: "Dispatch.Ready", producer: "L8", consumers: ["L10"] },
  { name: "Dispute.Decided", producer: "L13", consumers: [] },
  { name: "Domain.OutboxReady", producer: "P2", consumers: ["P6"], addedByRuling: true },
  { name: "Eligibility.Blocked", producer: "L3", consumers: [] },
  { name: "Eligibility.PassWithControls", producer: "L3", consumers: [] },
  { name: "Eligibility.Passed", producer: "L3", consumers: [] },
  { name: "Event.Delivered", producer: "P6", consumers: [] },
  { name: "Evidence.Uploaded", producer: "L1", consumers: ["L2"] },
  { name: "Execution.IssueDetected", producer: "L10", consumers: ["L09A"], addedByRuling: true },
  { name: "Execution.ResumeRequested", producer: "L09A", consumers: [] },
  { name: "Execution.Started", producer: "L10", consumers: ["L7"] },
  { name: "Fact.Appended", producer: "P2", consumers: [] },
  { name: "FactLedger.FieldUpdated", producer: "L09A", consumers: ["L2"] },
  { name: "FactLedger.Updated", producer: "L2", consumers: [] },
  { name: "FinanceException.Opened", producer: "L12", consumers: [] },
  { name: "Fraud.SignalRaised", producer: "P4", consumers: [] },
  { name: "Fulfillment.Failed", producer: "L4", consumers: [] },
  { name: "Fulfillment.TeamSelected", producer: "L4", consumers: ["L5"], addedByRuling: true },
  { name: "FulfillmentOption.Generated", producer: "L4", consumers: ["L6"] },
  { name: "FulfillmentSimulation.Passed", producer: "L4", consumers: [] },
  { name: "Handoff.Completed", producer: "L10", consumers: [] },
  { name: "Identity.ContextResolved", producer: "P3", consumers: ["L1"], addedByRuling: true },
  { name: "Identity.Event", producer: "P3", consumers: ["P4"], addedByRuling: true },
  { name: "Issue.Detected", producer: "L10", consumers: [] },
  { name: "Ledger.Posted", producer: "L12", consumers: [] },
  { name: "MSI.Updated", producer: "L2", consumers: [] },
  { name: "Milestone.Reached", producer: "L10", consumers: [] },
  { name: "ModelInvocation.Completed", producer: "P6", consumers: [] },
  { name: "Operational.AlertRaised", producer: "P6", consumers: [] },
  { name: "Outcome.ActualsAvailable", producer: "L11", consumers: ["L09B"], addedByRuling: true },
  { name: "Outcome.Disputed", producer: "L11", consumers: [] },
  { name: "Outcome.JobOrderCompletionEligible", producer: "L11", consumers: [] },
  { name: "Outcome.RemediationRequired", producer: "L11", consumers: ["L13"] },
  { name: "Outcome.TaskBlockVerified", producer: "L11", consumers: [] },
  { name: "Payment.AuthorizationUpdated", producer: "L12", consumers: ["L7", "P4"], addedByRuling: true },
  { name: "Payment.Captured", producer: "L12", consumers: [] },
  { name: "Payment.Disputed", producer: "L12", consumers: ["L13"], addedByRuling: true },
  { name: "Planning.NeedsHumanReview", producer: "L2", consumers: [] },
  { name: "Preflight.Blocked", producer: "L8", consumers: [] },
  { name: "Preflight.Passed", producer: "L8", consumers: [] },
  { name: "Preflight.Started", producer: "L8", consumers: ["L3", "L5"] },
  { name: "PriceOption.Selected", producer: "L6", consumers: [] },
  { name: "PriorWorkCase.Linked", producer: "L13", consumers: ["L1"], addedByRuling: true },
  { name: "Privacy.PolicyUpdated", producer: "P8", consumers: [] },
  { name: "Projection.Updated", producer: "P2", consumers: [] },
  { name: "Provider.Accepted", producer: "L7", consumers: ["L3", "L8", "P3"] },
  { name: "Provider.Declined", producer: "L4", consumers: ["L7"], addedByRuling: true },
  { name: "Provider.EnRoute", producer: "L8", consumers: [] },
  { name: "Provider.FieldObservation", producer: "L10", consumers: ["L09A"], addedByRuling: true },
  { name: "ProviderCandidate.Proposed", producer: "L4", consumers: ["L3"], addedByRuling: true },
  { name: "ProviderPayable.Created", producer: "L12", consumers: [] },
  { name: "ProviderProtection.Calculated", producer: "L09B", consumers: [] },
  { name: "Question.Requested", producer: "L2", consumers: [] },
  { name: "Rail.CallbackNormalized", producer: "P9", consumers: [] },
  { name: "Rail.CommandAccepted", producer: "P9", consumers: [] },
  { name: "Rail.Failed", producer: "P9", consumers: [] },
  { name: "Rail.ResultReceived", producer: "P9", consumers: [] },
  { name: "RealityCase.Created", producer: "L09A", consumers: ["L3", "L5"] },
  { name: "RealityCase.Requested", producer: "L10", consumers: [] },
  { name: "RealityCase.Unrecoverable", producer: "L09A", consumers: ["L7"], addedByRuling: true },
  { name: "Recipient.Linked", producer: "L1", consumers: ["P3"], addedByRuling: true },
  { name: "RecipientGrant.Issued", producer: "P3", consumers: [] },
  { name: "Reconciliation.Completed", producer: "L12", consumers: [] },
  { name: "RecoveryCredit.Applied", producer: "L09B", consumers: [] },
  { name: "RecoveryDecision.Approved", producer: "L09A", consumers: ["L10", "L11"], addedByRuling: true },
  { name: "RecoveryOption.Selected", producer: "L09A", consumers: ["L09B"] },
  { name: "Refund.Issued", producer: "L12", consumers: [] },
  { name: "Remedy.Issued", producer: "L13", consumers: [] },
  { name: "RequirementContract.Compiled", producer: "L2", consumers: ["L3", "L4", "L5"] },
  { name: "RequirementContract.Superseded", producer: "L2", consumers: ["L10", "L11"], addedByRuling: true },
  { name: "Reschedule.Proposed", producer: "L7", consumers: ["L4"] },
  { name: "Resource.Collected", producer: "L5", consumers: [] },
  { name: "Resource.CostUpdated", producer: "L5", consumers: ["L6"] },
  { name: "Resource.Delivered", producer: "L5", consumers: [] },
  { name: "Resource.GapDetected", producer: "L5", consumers: [] },
  { name: "Resource.Ready", producer: "L5", consumers: ["L10"], addedByRuling: true },
  { name: "Resource.ReceiptUploaded", producer: "L5", consumers: [] },
  { name: "Resource.Reserved", producer: "L5", consumers: ["L8"] },
  { name: "Responsibility.Assessed", producer: "L09B", consumers: ["L12"] },
  { name: "Retention.Actioned", producer: "P8", consumers: [] },
  { name: "Review.Requested", producer: "P1", consumers: [] },
  { name: "Role.Changed", producer: "P3", consumers: [] },
  { name: "Rules.Classified", producer: "L3", consumers: ["L2", "L4"] },
  { name: "Rules.Updated", producer: "L3", consumers: ["L6"], addedByRuling: true },
  { name: "Safety.HoldRaised", producer: "L3", consumers: ["P4"], addedByRuling: true },
  { name: "SafetyHold.Cleared", producer: "L3", consumers: [] },
  { name: "SafetyHold.Placed", producer: "L3", consumers: [] },
  { name: "SafetySignal.Raised", producer: "L3", consumers: ["L09A"], addedByRuling: true },
  { name: "Saga.Compensated", producer: "P1", consumers: [] },
  { name: "ScopeContract.Created", producer: "L6", consumers: [] },
  { name: "Security.ControlApplied", producer: "P4", consumers: [] },
  { name: "Security.IncidentOpened", producer: "P4", consumers: ["P8"] },
  { name: "Security.RiskDetected", producer: "P4", consumers: [] },
  { name: "Settlement.Calculated", producer: "L12", consumers: [] },
  { name: "Settlement.FinancialCommand", producer: "L12", consumers: ["P9"], addedByRuling: true },
  { name: "SettlementInput.Ready", producer: "L11", consumers: ["L12"] },
  { name: "TargetedReanalysis.Requested", producer: "L09A", consumers: [] },
  { name: "TaskGraph.Created", producer: "L2", consumers: [] },
  { name: "Team.Assembled", producer: "L4", consumers: [] },
  { name: "WorkCase.Created", producer: "L1", consumers: ["L2", "P3"] },
  { name: "Workflow.Advanced", producer: "P1", consumers: [] },
];

export const EXTERNAL_EVENTS: readonly ExternalEvent[] = [
  { name: "Bank.SettlementReceived", origin: "bank, via P9", consumers: ["L12"] },
  { name: "Credential.Updated", origin: "provider or issuing authority, via P5", consumers: ["L8"] },
  { name: "Customer.Acknowledged", origin: "customer, via P7", consumers: ["L11"] },
  { name: "Customer.AnsweredQuestion", origin: "customer, via P7", consumers: ["L2"] },
  { name: "Customer.Complaint", origin: "customer, via P7", consumers: ["L13"] },
  { name: "Customer.FieldUpdate", origin: "customer, via P7", consumers: ["L09A"] },
  { name: "Customer.MessageReceived", origin: "customer, via P7", consumers: ["L1"] },
  { name: "Incident.Reported", origin: "user or operations", consumers: ["L13", "L3"] },
  { name: "Integration.ContractUpdated", origin: "operations", consumers: ["P8"] },
  { name: "Message.AbuseReport", origin: "user report, via P7", consumers: ["P4"] },
  { name: "PSP.CallbackReceived", origin: "payment service provider, via P9", consumers: ["L12"] },
  { name: "Promotion.Updated", origin: "operations or marketing, via P5", consumers: ["L6"] },
  { name: "ProviderProfile.Updated", origin: "provider", consumers: ["L4"] },
  { name: "ResourceAvailability.Changed", origin: "partner or supplier, via P5", consumers: ["L4"] },
  { name: "Telemetry.Anomaly", origin: "infrastructure, via P6", consumers: ["P4"] },
];

export const EVENT_NAMES = new Set(EVENTS.map(e => e.name));
export const EXTERNAL_NAMES = new Set(EXTERNAL_EVENTS.map(e => e.name));

/** Producer of an event, or null when it enters from outside Doneeo. */
export function producerOf(name: string): LayerId | null {
  return EVENTS.find(e => e.name === name)?.producer ?? null;
}
