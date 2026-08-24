/**
 * Questions no source answers. Generated — do not edit by hand.
 *
 * These are carried in code deliberately. Each one is a decision that would
 * otherwise get made by accident, in an implementation, by whoever touches the
 * area first. A test asserts none has been silently dropped.
 */

export type OpenRuling = { id: string; question: string; why: string };

export const OPEN_RULINGS: readonly OpenRuling[] = [
  { id: "OR-1", question: "Who classifies R3 vs R5?",
    why: "R3 changes the job's scope; R5 must not be billed without consent. The difference decides whether the customer pays. L09A names a 'Semantic R0-R5 Classifier' and never says whether it is deterministic, model-advised or human. P6 requires deterministic authority for anything binding, and L09A's human-review list covers R4 but not the R3/R5 boundary. This is the most economically consequential unowned decision in the architecture." },
  { id: "OR-2", question: "Are Providers and Task Safety platform or domain concerns?",
    why: "One board files them as platform layers; canon makes them domain layers L4 and L3. That is a genuine difference of opinion about what is cross-cutting, not a naming slip. Mapped to L4/L3 in this document so references resolve, but the underlying question is untouched." },
  { id: "OR-3", question: "Do Customer Interface and Executor Interface exist as layers?",
    why: "The original twenty-document stack had both. Canon has neither; their responsibilities are implied inside L2, L8 and L10 without being named. References are mapped so nothing dangles, but a surface that no layer owns is how the frontend ends up owning progression, which anti-pattern 8 forbids." },
  { id: "OR-4", question: "What happens when an executor refuses?",
    why: "Canon covers the executor being unable - credential lapse, resource failure, physical impossibility. It does not cover an executor who arrives, judges the site unsafe and declines, where L3 later disagrees. It is neither a fact nor blame, so 'executor submits facts, not blame' does not route it. Capacity was reserved and mobilisation happened, so it has real economic consequence and no owner." },
  { id: "OR-5", question: "What bounds DoneeoAbsorption?",
    why: "When Doneeo's planning is wrong, ProtectedProviderPayable must still be paid and the customer must not be surcharged. Correct, and unbounded: no cap, no alert threshold, and no path from absorption events back into L2 planning quality. The exposure is set by how good the planner is and nothing measures it." },
  { id: "OR-6", question: "How long may an outcome wait on customer acknowledgement?",
    why: "L11 says non-response cannot leave a job open indefinitely when objective evidence suffices, but names no bound. The same reasoning that removed fixed cancellation windows from L7 leaves this window undefined too. Either both are configurable policy - say so - or the asymmetry needs a reason." },
  { id: "OR-7", question: "One authority for DecisionTrace.",
    why: "P2 owns it and its invariant calls it first-class, yet L2 and L3 both list it as an authoritative output. Most likely L2/L3 produce entries and P2 is the authority. Written that way below; confirm or correct." },
];
