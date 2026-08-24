"""
The rulings applied to produce the clean canonical file.

Three kinds of correction are made here, and the distinction matters:

  MECHANICAL   one spelling or number is right and the others are drift. Applied
               silently, listed in the changelog.
  DECIDED      two readings were defensible; one is chosen and the reason is
               recorded so it can be overturned deliberately.
  OPEN         a real architectural decision that no source answers. NOT decided
               here. Carried into the document as an explicit open ruling,
               because inventing an answer would be exactly the speculative
               architecture the canon forbids.
"""

# ---------------------------------------------------------------------------
# 1. Numbering. Scheme E (L1-L13 + P1-P9) is canon; everything else is drift.
# ---------------------------------------------------------------------------
NUMBERING = [
    # (pattern, canonical, note)
    (r"\bLayer 14 \(Data & Intelligence\)", "L2 (Intelligence & Planning)", "scheme F"),
    (r"\bLayer 14 \(Intelligence\)",        "L2 (Intelligence & Planning)", "scheme B"),
    (r"\bP14 Intelligence",                 "L2 (Intelligence & Planning)", "scheme A"),
    (r"\bLayer 06 \(Planning\)",            "L2 (Intelligence & Planning)", "scheme B: NOT L6"),
    (r"\bLayer 06 \(Customer Interface\)",  "L2 customer surface (see open ruling OR-3)", "scheme F"),
    (r"\bLayer 07 \(Executor Interface\)",  "L8/L10 executor surface (see open ruling OR-3)", "scheme F"),
    (r"\bLayer 08 \(Execution & Monitoring\)", "L10 (Live Execution & Change Control)", "scheme F"),
    (r"\bLayer 05 \(Fulfillment & Routing\)",  "L4 (Fulfillment, Matching & Team Assembly)", "scheme F"),
    (r"\bLayer 04 \(Matching & Teams\)",       "L4 (Fulfillment, Matching & Team Assembly)", "scheme F"),
    (r"\bLayer 10 \(Execution\)",           "L10 (Live Execution & Change Control)", "scheme B"),
    (r"\bLayer 11 \(Outcome[^)]*\)",        "L11 (Outcome, Completion & Evidence)", ""),
    (r"\bLayer 12 \(Settlement[^)]*\)",     "L12 (Settlement, Ledger & Reconciliation)", ""),
    (r"\bLayer 13 \(Disputes\)",            "L13 (Branch, Continuity, Claims & Support)", "scheme B"),
    (r"\bLayer 13 \(Claims & Disputes\)",   "L13 (Branch, Continuity, Claims & Support)", "scheme F"),
    (r"\bP12 Settlement",                   "L12 (Settlement, Ledger & Reconciliation)", "scheme A"),
    (r"\bP13 Claims",                       "L13 (Branch, Continuity, Claims & Support)", "scheme A"),
    (r"\bP10 Execution",                    "L10 (Live Execution & Change Control)", "scheme A; P10 discarded as drift"),
    (r"\bP10 \(Execution\)",                "L10 (Live Execution & Change Control)", "scheme C"),
    (r"\bP6 Providers",                     "L4 (Fulfillment, Matching & Team Assembly)", "scheme A; see open ruling OR-2"),
    (r"\bP8 Task Safety",                   "L3 (Trust, Safety, Rules & Compliance)", "scheme A; see open ruling OR-2"),
    (r"\bP9 Messaging",                     "P7 (Notifications, Messaging & User Engagement)", "scheme A"),
    (r"\bP9 \(Finance\)",                   "L12 for settlement truth, P9 for rails only", "scheme C"),
    (r"\bP4 \(Event, AI, Obs\.\)",          "P6 (Event Backbone, Model Gateway & Observability)", "scheme D"),
    (r"\bP4 Event backbone",                "P6 (Event Backbone, Model Gateway & Observability)", "scheme D"),
    (r"\bLayer 01 \(WorkCase & Intake\)",   "L1 (Intake, Context & WorkCase)", "scheme F"),
    (r"\bLayer 02 \(Intelligence & Planning\)", "L2 (Intelligence & Planning)", "scheme F"),
    (r"\bLayer 03 \(Trust & Safety\)",      "L3 (Trust, Safety, Rules & Compliance)", "scheme F"),
    (r"\bLayer 09A[^)]*\)?",                "L09A (Reality & Recovery Decision)", "scheme F"),
    (r"\bLayer 09B[^)]*\)?",                "L09B (Responsibility & Fairness Economic)", "scheme F"),
    (r"\bLayers 06[-–]10\b",                "the domain layers L2-L11", "scheme B"),
    (r"\bLayers 11[-–]12\b",                "L12 (Settlement, Ledger & Reconciliation)", "scheme B"),
    (r"\bLayers 01[-–]10\b",                "the domain layers L1-L11", "scheme C"),
    (r"\bLayers 02[-–]03\b",                "P2 (Data & Fact Ledger) and P3 (Identity)", "scheme C"),
]

# ---------------------------------------------------------------------------
# 2. Artifact names. One spelling per artifact. CamelCase wins for anything that
#    is a typed object crossing a layer boundary; prose spacing is kept only in
#    running sentences, which the rewriter leaves alone.
# ---------------------------------------------------------------------------
NAMES = {
    "Requirement Contract": "RequirementContract",
    "Scope Contract": "ScopeContract",
    "Fact Ledger": "FactLedger",
    "Completion Specification": "CompletionSpecification",
    "Execution Journal": "ExecutionJournal",
    "Execution Ready": "ExecutionReady",
    "Provider Protected Payable": "ProtectedProviderPayable",
    "ProviderProtectedPayable": "ProtectedProviderPayable",
    "Customer Reality Adjustment": "CustomerRealityAdjustment",
    "Doneeo Absorption": "DoneeoAbsorption",
    "Recovery Credit": "RecoveryCredit",
    "Architecture Simulation": "ArchitectureSimulation",
    "Fulfillment Simulation": "FulfillmentSimulation",
    "Fulfillment Cost Snapshot": "FulfillmentCostSnapshot",
    "Commercial Offer": "CommercialOffer",
}

# ---------------------------------------------------------------------------
# 3. Events. Every consumed event must have exactly one producer.
#    RENAME  = a producer exists under another name; the consumer is corrected.
#    EMIT    = no producer existed; the owning layer is given the emission.
#    EXTERNAL= arrives from outside Doneeo; correct to have no internal producer,
#              but must be declared as a boundary event rather than left dangling.
# ---------------------------------------------------------------------------
RENAME = {
    "AccessContext.Updated":            ("Context.Updated", "L1", "access context is part of intake context"),
    "Cancellation.RescheduleRequested": ("Reschedule.Proposed", "L7", "L7 already emits the reschedule event"),
    "Payment.Signal":                   ("Payment.AuthorizationUpdated", "L12", "P4 wants authorization movement"),
    "Preflight.Requested":              ("Preflight.Started", "L8", "L8 owns preflight lifecycle"),
    "Execution.PreflightRequested":     ("Preflight.Started", "L8", "same event, L5 spelled it differently"),
    "Provider.Assigned":                ("Provider.Accepted", "L7", "assignment is the accepted state"),
    "RealityCase.BranchRequested":      ("Branch.Requested", "L09A", "L09A already emits it"),
    "RealityCase.RecoveryPathSelected": ("RecoveryOption.Selected", "L09A", "L09A already emits it"),
    "ResourceCost.Updated":             ("Resource.CostUpdated", "L5", "subject-first, matches L5's own spelling"),
    "Rules.MetadataUpdated":            ("Rules.Classified", "L3", "classification carries the metadata"),
    "Security.Incident":                ("Security.IncidentOpened", "P4", "P4's own spelling"),
    "Reality.NewFact":                  ("FactLedger.FieldUpdated", "L09A", "L09A already emits the field update"),
    "L3.SafetyHold":                    ("Safety.HoldRaised", "L3", "malformed: used a layer id as the event subject"),
    "RequirementContract.Updated":      ("RequirementContract.Superseded", "L2", "consumers mean a new version, which only supersede produces"),
}
EMIT = {
    # event                        owner  why it must exist
    "CommercialOffer.Selected":    ("L6",   "offer lifecycle belongs to L6; L7 cannot commit to an unselected offer"),
    "CommercialDelta.Priced":      ("L6",   "L09B consumes it and only L6 may price"),
    "Consent.ContextUpdated":      ("P3",   "P3 owns consent grants"),
    "Identity.Event":              ("P3",   "P3 owns identity"),
    "Identity.ContextResolved":    ("P3",   "L1 cannot open a WorkCase without it"),
    "Recipient.Linked":            ("L1",   "the recipient is captured at intake; P3 consumes it to scope access"),
    "Execution.IssueDetected":     ("L10",  "L10 detects; L09A reacts"),
    "Provider.FieldObservation":   ("L10",  "the executor reports through live execution"),
    "Fulfillment.TeamSelected":    ("L4",   "L5 cannot resolve resources for an unknown team"),
    "Provider.Declined":           ("L4",   "decline arrives at matching, not at commitment"),
    "ProviderCandidate.Proposed":  ("L4",   "L3 gates candidates it is never sent"),
    "Resource.Ready":              ("L5",   "readiness at site is distinct from reservation"),
    "Rules.Updated":               ("L3",   "a ruleset version change is not a classification"),
    "SafetySignal.Raised":         ("L3",   "L3 is the safety authority"),
    "RecoveryDecision.Approved":   ("L09A", "L09A owns RecoveryDecision and never published it"),
    "RealityCase.Unrecoverable":   ("L09A", "L7's cancellation path has no trigger without it"),
    "RequirementContract.Superseded": ("L2", "supersession emitted nothing; only initial compile did"),
    "Safety.HoldRaised":           ("L3",   "P4 and L09A both react to a safety hold nobody published"),
    "Outcome.ActualsAvailable":    ("L11",  "L09B needs verified actuals, not the settlement input"),
    "Payment.AuthorizationUpdated":("L12",  "L7 gates commitment on it"),
    "Payment.Disputed":            ("L12",  "L13 opens claims from it"),
    "Settlement.FinancialCommand": ("L12",  "the L12->P9 rail command was never emitted"),
    "PriorWorkCase.Linked":        ("L13",  "L13 owns WorkCase continuity across JobOrders; L1 consumes the link"),
    "Domain.OutboxReady":          ("P2",   "P6 transports what P2 stages; no outbox existed"),
    "Data.ProcessingRegistered":   ("P2",   "P8 audits processing it is never told about"),
}
EXTERNAL = {
    "Customer.MessageReceived":   "customer, via P7",
    "Customer.AnsweredQuestion":  "customer, via P7",
    "Customer.Acknowledged":      "customer, via P7",
    "Customer.Complaint":         "customer, via P7",
    "Customer.FieldUpdate":       "customer, via P7",
    "PSP.CallbackReceived":       "payment service provider, via P9",
    "Bank.SettlementReceived":    "bank, via P9",
    "Telemetry.Anomaly":          "infrastructure, via P6",
    "Message.AbuseReport":        "user report, via P7",
    "Incident.Reported":          "user or operations",
    "Credential.Updated":         "provider or issuing authority, via P5",
    "ProviderProfile.Updated":    "provider",
    "ResourceAvailability.Changed":"partner or supplier, via P5",
    "Integration.ContractUpdated":"operations",
    "Promotion.Updated":          "operations or marketing, via P5",
}

# ---------------------------------------------------------------------------
# 4. Open rulings. NOT decided here.
# ---------------------------------------------------------------------------
OPEN = [
 ("OR-1", "Who classifies R3 vs R5?",
  "R3 changes the job's scope; R5 must not be billed without consent. The "
  "difference decides whether the customer pays. L09A names a 'Semantic R0-R5 "
  "Classifier' and never says whether it is deterministic, model-advised or "
  "human. P6 requires deterministic authority for anything binding, and L09A's "
  "human-review list covers R4 but not the R3/R5 boundary. This is the most "
  "economically consequential unowned decision in the architecture."),
 ("OR-2", "Are Providers and Task Safety platform or domain concerns?",
  "One board files them as platform layers; canon makes them domain layers L4 "
  "and L3. That is a genuine difference of opinion about what is cross-cutting, "
  "not a naming slip. Mapped to L4/L3 in this document so references resolve, "
  "but the underlying question is untouched."),
 ("OR-3", "Do Customer Interface and Executor Interface exist as layers?",
  "The original twenty-document stack had both. Canon has neither; their "
  "responsibilities are implied inside L2, L8 and L10 without being named. "
  "References are mapped so nothing dangles, but a surface that no layer owns "
  "is how the frontend ends up owning progression, which anti-pattern 8 "
  "forbids."),
 ("OR-4", "What happens when an executor refuses?",
  "Canon covers the executor being unable - credential lapse, resource failure, "
  "physical impossibility. It does not cover an executor who arrives, judges "
  "the site unsafe and declines, where L3 later disagrees. It is neither a fact "
  "nor blame, so 'executor submits facts, not blame' does not route it. "
  "Capacity was reserved and mobilisation happened, so it has real economic "
  "consequence and no owner."),
 ("OR-5", "What bounds DoneeoAbsorption?",
  "When Doneeo's planning is wrong, ProtectedProviderPayable must still be paid "
  "and the customer must not be surcharged. Correct, and unbounded: no cap, no "
  "alert threshold, and no path from absorption events back into L2 planning "
  "quality. The exposure is set by how good the planner is and nothing measures "
  "it."),
 ("OR-6", "How long may an outcome wait on customer acknowledgement?",
  "L11 says non-response cannot leave a job open indefinitely when objective "
  "evidence suffices, but names no bound. The same reasoning that removed fixed "
  "cancellation windows from L7 leaves this window undefined too. Either both "
  "are configurable policy - say so - or the asymmetry needs a reason."),
 ("OR-7", "One authority for DecisionTrace.",
  "P2 owns it and its invariant calls it first-class, yet L2 and L3 both list "
  "it as an authoritative output. Most likely L2/L3 produce entries and P2 is "
  "the authority. Written that way below; confirm or correct."),
]
