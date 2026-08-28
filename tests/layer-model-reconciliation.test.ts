/**
 * The two layer models, held against each other.
 *
 * Doneeo has two files that each call themselves the canonical architecture:
 *
 *   lib/canonical-architecture.ts   the CONTROL SPINE. L01–L13, drives WorkCase
 *                                   transitions and is stored in
 *                                   work_cases.current_layer_id.
 *   lib/architecture/layers.ts      the V3 CANON. L1–L13 + P1–P9, generated
 *                                   from the reconciled boards.
 *
 * They are not the same list with different padding. They disagree about the
 * ORDER of two layers, which means they disagree about the shape of the job:
 *
 *   spine    L09 Execution & Change Control    L10 Reality, Recovery & Fairness
 *   canon    L09A Reality & Recovery           L10 Live Execution & Change Control
 *            L09B Responsibility & Fairness
 *
 * The spine says a job executes and then meets reality. The canon says a job
 * meets reality and then executes. Both cannot describe the same product, and
 * whichever is wrong is wrong in the WorkCase state machine, where stored rows
 * already carry the spine's ids.
 *
 * Nothing detected this. These tests do. They are deliberately written to pass
 * against the CURRENT state — pinning the disagreement exactly — so that:
 *
 *   - resolving it fails these tests, which is the moment to migrate stored
 *     current_layer_id values and update this file with the decision;
 *   - drifting further also fails them.
 *
 * A passing run here is not an endorsement. It means the conflict is still open
 * and still exactly the size it was. See RECONCILIATION below.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { DOMAIN_LAYERS, type DomainLayerId } from "../lib/canonical-architecture";
import { LAYERS, LAYER_IDS } from "../lib/architecture/layers";

/**
 * Spine id → canon id, as the two files actually stand today.
 *
 * Read the L08–L13 rows as the statement of the problem, not as a design.
 */
const AS_IT_STANDS: Readonly<Record<DomainLayerId, string>> = Object.freeze({
  L01: "L1",   // Intake & Context              ↔ Intake, Context & WorkCase
  L02: "L2",   // Intelligence & Planning       ↔ same
  L03: "L3",   // Trust, Safety & Rules         ↔ + Compliance
  L04: "L4",   // Fulfillment & Team            ↔ + Matching
  L05: "L5",   // Resources & Logistics         ↔ + Rentals & Partners
  L06: "L6",   // Commercial Offer              ↔ CommercialOffer & Pricing
  L07: "L7",   // Commitment & Capacity         ↔ + Rescheduling & Cancellation
  L08: "L8",   // Prepare, Route & Dispatch     ↔ Execution Preparation, Preflight & Dispatch
  // ---- the disagreement starts here -------------------------------------
  L09: "L10",  // spine's Execution & Change Control IS the canon's L10
  L10: "L09B", // spine folds Reality AND Fairness into one layer the canon splits
  L11: "L11",  // Outcome & Evidence            ↔ Outcome, Completion & Evidence
  L12: "L12",  // Settlement & FinanceOps       ↔ + Ledger & Reconciliation
  L13: "L13",  // Continuity & Claims           ↔ Branch, Continuity, Claims & Support
});

/** The canon layer the spine has no position for at all. */
const UNREPRESENTED_IN_SPINE = "L09A";

// ---------------------------------------------------------------------------

test("both models still exist and neither has quietly been deleted", () => {
  assert.equal(DOMAIN_LAYERS.length, 13, "the control spine has 13 domain positions");
  assert.equal(LAYER_IDS.filter(id => LAYERS[id].kind === "domain").length, 14,
    "the canon has 14 domain layers, because Layer 9 is split");
});

test("the spine and the canon agree on L01 through L08", () => {
  for (const spine of ["L01", "L02", "L03", "L04", "L05", "L06", "L07", "L08"] as DomainLayerId[]) {
    const canonId = AS_IT_STANDS[spine];
    assert.ok(LAYER_IDS.includes(canonId as never), `${spine} maps to ${canonId}, which does not exist`);
    // Same ordinal, allowing for the spine's zero padding. The front half of
    // the architecture is not in dispute.
    assert.equal(canonId, `L${Number(spine.slice(1))}`,
      `${spine} should map to the same ordinal in the canon`);
  }
});

test("THE CONFLICT: the spine executes before reality, the canon after", () => {
  const spineL09 = DOMAIN_LAYERS.find(l => l.id === "L09")!;
  const spineL10 = DOMAIN_LAYERS.find(l => l.id === "L10")!;

  assert.match(spineL09.title, /Execution/,
    "spine L09 is Execution & Change Control");
  assert.match(spineL10.title, /Reality/,
    "spine L10 is Reality, Recovery & Fairness");

  assert.match(LAYERS.L09A.title, /Reality/,
    "canon L09A is Reality & Recovery — the same concept, two positions earlier");
  assert.match(LAYERS.L10.title, /Execution/,
    "canon L10 is Live Execution — the same concept, one position later");

  // Stated as an assertion so the contradiction is a fact in the suite, not a
  // comment someone can skim past.
  const spineExecutesFirst = Number(spineL09.id.slice(1)) < Number(spineL10.id.slice(1));
  const canonRealityFirst = true; // L09A precedes L10 by construction
  assert.ok(spineExecutesFirst && canonRealityFirst,
    "UNRESOLVED: the two models order execution and reality differently. " +
    "See RECONCILIATION in this file. Resolving it must migrate stored " +
    "work_cases.current_layer_id values.");
});

test("the canon's Reality & Recovery layer has no position in the spine at all", () => {
  const mapped = new Set(Object.values(AS_IT_STANDS));
  assert.ok(!mapped.has(UNREPRESENTED_IN_SPINE),
    `${UNREPRESENTED_IN_SPINE} is unrepresented in the control spine: a WorkCase ` +
    "cannot record that it is in reality assessment as distinct from settlement");
});

test("every spine position maps to a canon layer that exists", () => {
  const dangling: string[] = [];
  for (const [spine, canon] of Object.entries(AS_IT_STANDS)) {
    if (!LAYER_IDS.includes(canon as never)) dangling.push(`${spine} -> ${canon}`);
  }
  assert.deepEqual(dangling, [], "the mapping names a canon layer that does not exist");
});

test("the mapping covers every spine position, with nothing invented", () => {
  const spineIds = DOMAIN_LAYERS.map(l => l.id).sort();
  assert.deepEqual(Object.keys(AS_IT_STANDS).sort(), spineIds,
    "a spine layer was added or removed; update the mapping and re-check the conflict");
});

test("no canon layer is claimed by two spine positions", () => {
  const seen = new Map<string, string>();
  const clashes: string[] = [];
  for (const [spine, canon] of Object.entries(AS_IT_STANDS)) {
    const prev = seen.get(canon);
    if (prev) clashes.push(`${canon} claimed by ${prev} and ${spine}`);
    else seen.set(canon, spine);
  }
  assert.deepEqual(clashes, [], "two spine positions map to the same canon layer");
});

/**
 * RECONCILIATION — the decision this file is waiting on.
 *
 * Three ways out, and they are not equivalent:
 *
 * 1. CANON WINS. Renumber the spine so Reality precedes Execution, and add a
 *    position for L09A. Requires a data migration of work_cases.current_layer_id
 *    and a change to canTransitionLayer's graph. Most correct if the canon's
 *    ordering is what the boards actually say.
 *
 * 2. SPINE WINS. Renumber the canon so Execution is L09 and Reality/Fairness
 *    follow. Cheaper in data, expensive in documents: 23 boards, the v3.0
 *    document and every generated artifact carry the canon's numbering.
 *
 * 3. THEY ARE DIFFERENT THINGS. Keep both, rename one so neither claims the
 *    word "canonical", and keep this mapping as the sanctioned bridge. Honest
 *    if the spine is a coarse workflow tracker rather than an architecture —
 *    but then it should stop being called the canonical architecture.
 *
 * Option 3 is the only one that does not require someone to decide which
 * ordering is true, which is also why it is the easiest one to choose for the
 * wrong reasons.
 */
