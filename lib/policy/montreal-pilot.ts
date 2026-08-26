/**
 * Montréal pilot policy.
 *
 * L7, L09A and L09B contain no thresholds, no time windows and no percentages —
 * deliberately, and tests enforce it. Every such value the running system needs
 * lives here instead, in one file, as one named configuration.
 *
 * THIS FILE IS CONFIGURATION, NOT CANON.
 *
 * Nothing below is an architectural truth. It is what Doneeo has decided to do
 * in Montréal during the pilot, and a later region or a later commercial term
 * is a different object of the same shape. If you find yourself wanting to
 * reference a number from here inside a layer, the layer is wrong, not this file.
 */

import type {
  CommitmentPolicy, CommitmentStage, EligibleCostKind, CancellationCause,
} from "../layers/l7/commitment";
import type {
  ImpactClassifier, ImpactClass, ImpactClassification,
} from "../layers/l09a/reality";
import type { ReviewPolicy, Cause } from "../layers/l09b/responsibility";

// ---------------------------------------------------------------------------
// Every number in the system, in one place
// ---------------------------------------------------------------------------

/**
 * How long before the scheduled start capacity stops being free to release.
 *
 * Decided 26 Aug 2026 for the Montréal pilot. The reasoning: a trades provider
 * who has blocked a day can usually rebook it with a day's notice, and cannot
 * with less. Before this point a customer cancels for free; after it, evidenced
 * disruption becomes eligible for protection.
 */
export const CAPACITY_LOCK_LEAD_MINUTES = 24 * 60;

/**
 * Net lost capacity above which a cancellation is adjudicated rather than
 * settled by policy. One full working day across the whole team — past that,
 * the amount is large enough that a person should look at it.
 */
export const REVIEW_THRESHOLD_NET_LOST_MINUTES = 8 * 60;

const MINUTE_MS = 60_000;

// ---------------------------------------------------------------------------
// L7 — the commitment ladder
// ---------------------------------------------------------------------------

/** Which cost kinds are protected once a given stage is reached. Cumulative. */
const ELIGIBLE_AT: Readonly<Record<CommitmentStage, readonly EligibleCostKind[]>> = Object.freeze({
  // Nothing is committed yet, so nothing is owed. This is the whole point of
  // having a free stage: the customer can change their mind at no cost.
  FREE_OR_LOW: Object.freeze([]),
  // A provider has accepted and may have begun preparing. Preparation actually
  // performed is evidenced work; capacity is still releasable.
  COMMITMENT_BEGINS: Object.freeze(["PREPARATION"] as EligibleCostKind[]),
  // The slot can no longer be rebooked at short notice. Lost capacity becomes
  // real, and so do external costs already incurred against this job.
  CAPACITY_LOCKED: Object.freeze(["PREPARATION", "NET_LOST_CAPACITY", "EXTERNAL"] as EligibleCostKind[]),
  // Someone is travelling. Their time getting there is no longer speculative.
  MOBILIZED: Object.freeze(["PREPARATION", "MOBILIZATION", "NET_LOST_CAPACITY", "EXTERNAL"] as EligibleCostKind[]),
  // Work has begun. Everything performed counts.
  WORK_STARTED: Object.freeze([
    "PREPARATION", "MOBILIZATION", "ACTUAL_WORK", "NET_LOST_CAPACITY", "EXTERNAL",
  ] as EligibleCostKind[]),
});

export const MONTREAL_PILOT_COMMITMENT_POLICY: CommitmentPolicy = Object.freeze({
  /**
   * Read the ladder top down, so the furthest-reached stage wins.
   *
   * Only CAPACITY_LOCKED consults the clock. The other three are facts about
   * what has physically happened, which is why they cannot be gamed by moving
   * the scheduled date.
   */
  stageOf(input) {
    if (input.workStarted) return "WORK_STARTED";
    if (input.mobilizationStarted) return "MOBILIZED";

    const start = Date.parse(input.startsAt);
    const now = Date.parse(input.now);
    if (Number.isNaN(start) || Number.isNaN(now)) {
      throw new Error(`montreal-pilot: unparseable timestamps (now=${input.now}, startsAt=${input.startsAt})`);
    }
    const minutesUntilStart = (start - now) / MINUTE_MS;
    if (input.capacityHeld && minutesUntilStart <= CAPACITY_LOCK_LEAD_MINUTES) {
      return "CAPACITY_LOCKED";
    }

    if (input.providerAccepted) return "COMMITMENT_BEGINS";
    return "FREE_OR_LOW";
  },

  isCostEligible(kind: EligibleCostKind, stage: CommitmentStage) {
    return ELIGIBLE_AT[stage].includes(kind);
  },

  requiresResponsibilityReview(input) {
    // A contested case is never settled by a rule.
    if (input.disputed) return true;
    // Safety and regulatory cancellations carry consequences beyond this job.
    if (input.cause === "SAFETY_OR_REGULATORY") return true;
    // Large enough to be worth a person's time.
    if (input.netLostMinutes > REVIEW_THRESHOLD_NET_LOST_MINUTES) return true;
    // A provider walking away after mobilisation is a relationship question,
    // not just an accounting one.
    if (input.cause === "PROVIDER_WITHDRAWAL" &&
        (input.stage === "MOBILIZED" || input.stage === "WORK_STARTED")) return true;
    return false;
  },
});

// ---------------------------------------------------------------------------
// L09B — when responsibility goes to a human
// ---------------------------------------------------------------------------

/**
 * MIXED and UNDETERMINED are already forced to review inside the layer, and so
 * is any disputed case. This adds the pilot's own caution: while the pilot is
 * small, a case where both the customer and Doneeo are independently
 * responsible is reviewed rather than allocated, because the allocation rules
 * have not yet been exercised against real disputes.
 */
export const MONTREAL_PILOT_REVIEW_POLICY: ReviewPolicy = Object.freeze({
  requiresReview(input: {
    cause: Cause; disputed: boolean; customerEstablished: boolean; doneeoEstablished: boolean;
  }) {
    if (input.customerEstablished && input.doneeoEstablished) {
      return {
        required: true,
        reason: "customer and Doneeo are both independently responsible; pilot policy reviews these by hand",
      };
    }
    return { required: false, reason: null };
  },
});

// ---------------------------------------------------------------------------
// L09A — the provisional impact classifier (OPEN RULING OR-1)
// ---------------------------------------------------------------------------

/**
 * A deterministic, conservative stand-in. NOT an answer to OR-1.
 *
 * OR-1 asks who decides whether a discovered condition is R3 (this job's
 * requirements changed, so the customer may be asked to bear it) or R5
 * (unrelated new work, which never enters current scope without consent). That
 * boundary decides whether someone can be billed, and the architecture has not
 * said who owns it.
 *
 * So this classifier refuses to answer it silently. It reads the *structured*
 * fact keys rather than parsing the executor's free text — a keyword match on
 * "looks like mould" is not a basis for a charge — and any classification that
 * lands on R3 or R5 is returned with needsHumanReview set unless the fact key
 * is namespaced unambiguously. Being unsure is a legitimate output here.
 *
 * Replace this wholesale when OR-1 is decided. Do not tune it into a de facto
 * answer.
 */

/** Fact-key namespace → what kind of mismatch it represents. */
const NAMESPACE: readonly { prefix: string; impact: ImpactClass; certain: boolean; why: string }[] =
  Object.freeze([
    { prefix: "safety.", impact: "R4", certain: true,
      why: "fact is namespaced safety; safety changes hold affected scope regardless of convenience" },
    { prefix: "regulatory.", impact: "R4", certain: true,
      why: "fact is namespaced regulatory; permit and code changes route to L3" },
    { prefix: "resource.", impact: "R2", certain: true,
      why: "fact is namespaced resource; the requirement still holds, the means of meeting it changed" },
    { prefix: "equipment.", impact: "R2", certain: true,
      why: "fact is namespaced equipment; requirement unchanged, fulfilment changed" },
    { prefix: "provider.", impact: "R2", certain: true,
      why: "fact is namespaced provider; requirement unchanged, who performs it changed" },
    { prefix: "access.", impact: "R1", certain: true,
      why: "fact is namespaced access; a local operational variance, adjusted on site" },
    { prefix: "requirement.", impact: "R3", certain: true,
      why: "fact is namespaced requirement; what successful work means has changed" },
    { prefix: "condition.", impact: "R3", certain: true,
      why: "fact is namespaced condition; the discovered state changes what this task requires" },
    { prefix: "independent.", impact: "R5", certain: true,
      why: "fact is namespaced independent; observed work unrelated to the current requirement" },
  ]);

export const MONTREAL_PILOT_IMPACT_CLASSIFIER: ImpactClassifier = Object.freeze({
  classify(input): ImpactClassification {
    const taskId = input.observation.taskId;

    // Nothing changed. The plan stands.
    if (input.changedFacts.length === 0) {
      return Object.freeze({
        taskId, impact: "R0" as ImpactClass, needsHumanReview: false,
        rationale: "no facts changed; observation confirms the approved plan",
      });
    }

    const matches = input.changedFacts.map(f => ({
      fact: f,
      rule: NAMESPACE.find(n => f.factKey.startsWith(n.prefix)) ?? null,
    }));

    // An unrecognised namespace is not a licence to guess. R1 is the least
    // consequential class — it routes nowhere and bills nobody — so an unknown
    // fact parks there and asks for a person.
    const unknown = matches.filter(m => m.rule === null);
    if (unknown.length > 0) {
      return Object.freeze({
        taskId, impact: "R1" as ImpactClass, needsHumanReview: true,
        rationale: `unrecognised fact ${unknown.map(u => u.fact.factKey).join(", ")}; ` +
          "classifier will not infer impact from free text (OR-1 undecided)",
      });
    }

    // Safety wins on presence, not on rank. R4 is not "more severe" than the
    // others — it is the one class that must hold scope before anything else
    // is considered, so if any changed fact is a safety fact, that is the
    // classification the case carries.
    const safety = matches.find(m => m.rule!.impact === "R4");
    if (safety) {
      return Object.freeze({
        taskId, impact: "R4" as ImpactClass, needsHumanReview: false,
        rationale: safety.rule!.why,
      });
    }

    // A single mismatch kind: take it.
    const kinds = new Set(matches.map(m => m.rule!.impact));
    if (kinds.size === 1) {
      const only = matches[0].rule!;
      const billingBoundary = only.impact === "R3" || only.impact === "R5";
      return Object.freeze({
        taskId, impact: only.impact, needsHumanReview: !only.certain,
        rationale: billingBoundary
          ? `${only.why} — R3/R5 decides who may be charged; recorded under OR-1 as provisional`
          : only.why,
      });
    }

    // Facts of different kinds arrived together. Choosing between them IS the
    // open ruling. Park it and ask.
    return Object.freeze({
      taskId, impact: "R1" as ImpactClass, needsHumanReview: true,
      rationale: `changed facts span ${[...kinds].join(" and ")}; ` +
        "selecting between mismatch kinds is exactly what OR-1 leaves undecided",
    });
  },
});

/** The pilot configuration, as one object. */
export const MONTREAL_PILOT = Object.freeze({
  name: "montreal-pilot",
  commitment: MONTREAL_PILOT_COMMITMENT_POLICY,
  review: MONTREAL_PILOT_REVIEW_POLICY,
  classifier: MONTREAL_PILOT_IMPACT_CLASSIFIER,
  capacityLockLeadMinutes: CAPACITY_LOCK_LEAD_MINUTES,
  reviewThresholdNetLostMinutes: REVIEW_THRESHOLD_NET_LOST_MINUTES,
});
