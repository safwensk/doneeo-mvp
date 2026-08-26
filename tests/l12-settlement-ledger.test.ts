/**
 * L12 — Settlement, Ledger, Reconciliation & FinanceOps.
 *
 * The three golden scenarios, plus the invariants that make a ledger worth
 * having: it balances or it does not exist, it cannot be edited, and a replayed
 * payment callback moves no money twice.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  postTransaction, reverse, balanceOf, trialBalance, ledgerBalances,
  debit, credit, LedgerInvariantError,
  type LedgerTransaction,
} from "../lib/layers/l12/ledger";
import {
  settle, calculateCustomerCharge, calculateProviderPayable,
  SettlementInvariantError,
  type SettlementInput, type RateCard,
} from "../lib/layers/l12/settlement";
import {
  authorize, capture, releaseUnused, refund, payout,
  availableToCapture, callbackKey, alreadyApplied, PaymentInvariantError,
} from "../lib/layers/l12/payments";
import { money } from "../lib/layers/l6/pricing";

const NOW = "2026-09-10T18:00:00.000Z";

/** $1.00/min provider, $1.50/min customer. Round numbers keep the maths visible. */
const rates: RateCard = {
  providerRatePerMinute: () => money(100),
  customerRatePerMinute: () => money(150),
};

function input(over: Partial<SettlementInput> = {}): SettlementInput {
  return {
    jobOrderId: "JOB-1",
    contractedPrice: money(40000),        // $400
    completedFraction: 1,
    approvedAdditions: [],
    customerAdjustmentByRole: {},
    protectedProviderByRole: {},
    doneeoAbsorptionByRole: {},
    recoveryCreditByRole: {},
    eligibleExternalCosts: [],
    taxes: [{ label: "GST", amount: money(2000) }, { label: "QST", amount: money(3990) }],
    taxDecisionRef: "QC-2026",
    requiresReview: false,
    ...over,
  };
}

const run = (over: Partial<SettlementInput> = {}, share = 0.7) =>
  settle({ settlementInput: input(over), rates, providerShareOfCompleted: share, transactionId: "TXN-1", now: NOW });

// ---------------------------------------------------------------------------
// The ledger holds or it does not exist
// ---------------------------------------------------------------------------

test("an unbalanced posting cannot be constructed", () => {
  assert.throws(() => postTransaction({
    transactionId: "T", jobOrderId: "J", kind: "SETTLEMENT", postedAt: NOW, sourceRef: "x",
    entries: [debit("CUSTOMER_RECEIVABLE", money(1000), "a"), credit("PROVIDER_PAYABLE", money(900), "b")],
  }), (e: unknown) => e instanceof LedgerInvariantError && e.invariant === "UNBALANCED");
});

test("a single-sided posting is refused", () => {
  assert.throws(() => postTransaction({
    transactionId: "T", jobOrderId: "J", kind: "CAPTURE", postedAt: NOW, sourceRef: "x",
    entries: [debit("PSP_CLEARING", money(1000), "a")],
  }), (e: unknown) => e instanceof LedgerInvariantError && e.invariant === "SINGLE_ENTRY");
});

test("zero-value lines and unexplained lines are refused", () => {
  const base = { transactionId: "T", jobOrderId: "J", kind: "ADJUSTMENT" as const, postedAt: NOW, sourceRef: "x" };
  assert.throws(() => postTransaction({
    ...base,
    entries: [debit("PSP_CLEARING", money(0), "a"), credit("DONEEO_REVENUE", money(0), "b")],
  }), (e: unknown) => e instanceof LedgerInvariantError && e.invariant === "ZERO_ENTRY");
  assert.throws(() => postTransaction({
    ...base,
    entries: [debit("PSP_CLEARING", money(100), "  "), credit("DONEEO_REVENUE", money(100), "b")],
  }), (e: unknown) => e instanceof LedgerInvariantError && e.invariant === "NO_NARRATIVE");
});

test("a transaction cannot mix currencies", () => {
  assert.throws(() => postTransaction({
    transactionId: "T", jobOrderId: "J", kind: "ADJUSTMENT", postedAt: NOW, sourceRef: "x",
    entries: [
      debit("PSP_CLEARING", money(100, "CAD"), "a"),
      credit("DONEEO_REVENUE", { minorUnits: 100, currency: "USD" as never }, "b"),
    ],
  }), (e: unknown) => e instanceof LedgerInvariantError && e.invariant === "MIXED_CURRENCY");
});

test("history is never edited — only mirrored", () => {
  const original = postTransaction({
    transactionId: "T1", jobOrderId: "J", kind: "CAPTURE", postedAt: NOW, sourceRef: "psp-1",
    entries: [debit("PSP_CLEARING", money(5000), "capture"), credit("CUSTOMER_RECEIVABLE", money(5000), "paid")],
  });
  const rev = reverse({ original, transactionId: "T2", postedAt: NOW, reason: "captured in error" });

  assert.equal(rev.reverses, "T1");
  assert.equal(rev.kind, "REVERSAL");
  // Both halves remain, and together they net to nothing.
  assert.equal(balanceOf([original, rev], "PSP_CLEARING").minorUnits, 0);
  assert.equal(balanceOf([original], "PSP_CLEARING").minorUnits, 5000, "the original is untouched");
  assert.ok(rev.entries.every(e => e.narrative.startsWith("reversal:")));
});

test("a reversal cannot itself be reversed, and needs a reason", () => {
  const original = postTransaction({
    transactionId: "T1", jobOrderId: "J", kind: "CAPTURE", postedAt: NOW, sourceRef: "psp-1",
    entries: [debit("PSP_CLEARING", money(5000), "a"), credit("CUSTOMER_RECEIVABLE", money(5000), "b")],
  });
  assert.throws(() => reverse({ original, transactionId: "T2", postedAt: NOW, reason: "" }),
    (e: unknown) => e instanceof LedgerInvariantError && e.invariant === "NO_REASON");

  const rev = reverse({ original, transactionId: "T2", postedAt: NOW, reason: "error" });
  assert.throws(() => reverse({ original: rev, transactionId: "T3", postedAt: NOW, reason: "oops" }),
    (e: unknown) => e instanceof LedgerInvariantError && e.invariant === "REVERSING_A_REVERSAL");
});

test("there is no stored balance anywhere — balances are folded from entries", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../lib/layers/l12/ledger.ts", import.meta.url), "utf-8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  for (const bad of ["balance:", "balance =", "updateBalance", "setBalance", "DELETE", "UPDATE "]) {
    assert.ok(!src.includes(bad), `ledger contains ${bad}; a stored or edited balance is a second copy of the truth`);
  }
});

// ---------------------------------------------------------------------------
// Golden scenarios
// ---------------------------------------------------------------------------

test("L12-G1 · provider is paid while Doneeo absorbs a planning error", () => {
  // Nothing was completed and the customer is charged nothing, but the provider
  // held capacity that Doneeo's own error wasted.
  const s = run({
    completedFraction: 0,
    taxes: [],
    protectedProviderByRole: { lead: 240 },
    doneeoAbsorptionByRole: { lead: 240 },
  }, 0.7);

  assert.equal(s.customerCharge.total.minorUnits, 0, "a planning error is never a customer surcharge");
  assert.equal(s.providerPayable.total.minorUnits, 24000, "the provider is made whole: 240 min at $1.00");
  assert.ok(s.doneeoPosition.minorUnits < 0, "the platform is carrying it");

  // And the posting balances despite one side being zero.
  assert.ok(ledgerBalances([s.transaction!]));
  assert.equal(balanceOf([s.transaction!], "PROVIDER_PAYABLE").minorUnits, 24000);
  assert.equal(balanceOf([s.transaction!], "CUSTOMER_RECEIVABLE").minorUnits, 0);
  assert.ok(balanceOf([s.transaction!], "DONEEO_ABSORPTION").minorUnits > 0);
});

test("L12-G2 · unused authorization is released after a partial close", () => {
  const auth = authorize({
    authorizationId: "AUTH-1", jobOrderId: "JOB-1",
    amount: money(40000), pspRef: "psp-auth-1", now: NOW,
  });

  // Only half the work happened, so only half is taken.
  const captured = capture({
    authorization: auth, amount: money(20000),
    idempotencyKey: "cap-1", pspRef: "psp-cap-1", now: NOW,
  });
  assert.equal(captured.authorization.status, "PARTIALLY_CAPTURED");
  assert.equal(availableToCapture(captured.authorization).minorUnits, 20000);

  // The rest is given back rather than quietly kept.
  const released = releaseUnused({
    authorization: captured.authorization,
    idempotencyKey: "rel-1", pspRef: "psp-rel-1", now: NOW,
  });
  assert.equal(released.command.amount.minorUnits, 20000);
  assert.equal(released.authorization.status, "CLOSED");
  assert.equal(availableToCapture(released.authorization).minorUnits, 0);

  assert.throws(() => releaseUnused({
    authorization: released.authorization, idempotencyKey: "rel-2", pspRef: "p", now: NOW,
  }), (e: unknown) => e instanceof PaymentInvariantError && e.invariant === "NOTHING_TO_RELEASE");
});

test("L12-G3 · a replayed callback causes no duplicate financial effect", () => {
  const auth = authorize({
    authorizationId: "AUTH-1", jobOrderId: "JOB-1",
    amount: money(40000), pspRef: "psp-auth-1", now: NOW,
  });

  // The PSP delivers the same event twice. The key is built from the event,
  // never from a timestamp or a counter, so both deliveries agree.
  const key1 = callbackKey({ pspEventId: "evt_abc", jobOrderId: "JOB-1", kind: "CAPTURE" });
  const key2 = callbackKey({ pspEventId: "evt_abc", jobOrderId: "JOB-1", kind: "CAPTURE" });
  assert.equal(key1, key2, "one PSP event must produce one key");

  const first = capture({ authorization: auth, amount: money(20000), idempotencyKey: key1, pspRef: "p", now: NOW });
  const replay = capture({ authorization: auth, amount: money(20000), idempotencyKey: key2, pspRef: "p", now: NOW });

  // Both produce the SAME transaction id, so the store's uniqueness constraint
  // makes the second a no-op rather than a second movement of money.
  assert.equal(first.transaction.transactionId, replay.transaction.transactionId);
  assert.equal(alreadyApplied([first.transaction], key2), true);

  // The ledger as recorded holds one capture, not two.
  const posted = [first.transaction];
  assert.equal(balanceOf(posted, "PSP_CLEARING").minorUnits, 20000);
});

test("a different event on the same job produces a different key", () => {
  const a = callbackKey({ pspEventId: "evt_1", jobOrderId: "JOB-1", kind: "CAPTURE" });
  const b = callbackKey({ pspEventId: "evt_2", jobOrderId: "JOB-1", kind: "CAPTURE" });
  const c = callbackKey({ pspEventId: "evt_1", jobOrderId: "JOB-1", kind: "REFUND" });
  assert.notEqual(a, b, "two real captures must not collide");
  assert.notEqual(a, c, "a refund is not a capture");
});

// ---------------------------------------------------------------------------
// Customer charge is not provider payable
// ---------------------------------------------------------------------------

test("the two figures are computed from their own inputs, never from each other", () => {
  const si = input({
    completedFraction: 1,
    protectedProviderByRole: { lead: 60 },
    customerAdjustmentByRole: { lead: 30 },
  });
  const customer = calculateCustomerCharge(si, rates);
  const provider = calculateProviderPayable(si, rates, 0.7);

  // Neither function can see the other's result — they take different inputs.
  assert.equal(customer.eligibleDisruption.minorUnits, 4500);   // 30 × $1.50
  assert.equal(provider.protectedCapacity.minorUnits, 6000);    // 60 × $1.00
  assert.notEqual(customer.total.minorUnits, provider.total.minorUnits);
});

test("work that did not happen is never charged and then refunded — it is never charged", () => {
  const half = calculateCustomerCharge(input({ completedFraction: 0.5, taxes: [] }), rates);
  assert.equal(half.completedWork.minorUnits, 20000, "half of $400");
  assert.ok(!half.lines.some(l => l.sign === "CREDIT"),
    "a partial job needs no offsetting credit line; the charge was simply smaller");
});

test("a case L09B sent to review cannot be settled automatically", () => {
  assert.throws(() => run({ requiresReview: true }), (e: unknown) =>
    e instanceof SettlementInvariantError && e.invariant === "REVIEW_REQUIRED");
});

test("an impossible completion fraction is refused", () => {
  assert.throws(() => calculateCustomerCharge(input({ completedFraction: 1.5 }), rates), (e: unknown) =>
    e instanceof SettlementInvariantError && e.invariant === "IMPOSSIBLE_COMPLETION");
  assert.throws(() => calculateProviderPayable(input(), rates, 2), (e: unknown) =>
    e instanceof SettlementInvariantError && e.invariant === "IMPOSSIBLE_SHARE");
});

test("tax is a liability to an authority, never revenue", () => {
  const s = run();
  assert.equal(balanceOf([s.transaction!], "TAX_PAYABLE").minorUnits, 5990);
  assert.ok(balanceOf([s.transaction!], "DONEEO_REVENUE").minorUnits < s.customerCharge.total.minorUnits,
    "revenue must not include money collected for a tax authority");
});

test("recovery credit is posted separately from absorbing our own error", () => {
  const s = run({
    taxes: [],
    recoveryCreditByRole: { lead: 20 },
    doneeoAbsorptionByRole: { lead: 60 },
  });
  const tb = trialBalance([s.transaction!]);
  assert.ok(tb.RECOVERY_CREDIT > 0, "goodwill is its own account");
  assert.ok(tb.DONEEO_ABSORPTION > 0, "error absorption is its own account");
  assert.notEqual(tb.RECOVERY_CREDIT, tb.DONEEO_ABSORPTION);
});

test("every settlement posting balances, across a range of shapes", () => {
  const shapes: Partial<SettlementInput>[] = [
    {},
    { completedFraction: 0, taxes: [] },
    { completedFraction: 0.5 },
    { protectedProviderByRole: { lead: 120, helper: 90 } },
    { customerAdjustmentByRole: { lead: 45 }, doneeoAbsorptionByRole: { helper: 200 } },
    { approvedAdditions: [{ label: "Extra floor", amount: money(7500) }] },
    { eligibleExternalCosts: [{ ref: "RCPT-1", amount: money(3200) }] },
    { recoveryCreditByRole: { lead: 15 } },
  ];
  for (const [i, shape] of shapes.entries()) {
    const s = settle({
      settlementInput: input(shape), rates, providerShareOfCompleted: 0.7,
      transactionId: `TXN-${i}`, now: NOW,
    });
    // A shape where nobody owes anybody anything posts nothing at all, which
    // is a correct outcome — see the nothingOwed test below.
    if (s.transaction === null) { assert.equal(s.nothingOwed, true); continue; }
    assert.ok(ledgerBalances([s.transaction!]), `shape ${i} produced an unbalanced posting`);
  }
});

// ---------------------------------------------------------------------------
// Payment says nothing about the work
// ---------------------------------------------------------------------------

test("no payment type can express work status", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../lib/layers/l12/payments.ts", import.meta.url), "utf-8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  // Word boundaries matter: "already" contains "ready", and alreadyApplied is
  // a legitimate name. A naive substring check fails on its own helper.
  for (const bad of ["completed", "assigned", "ready", "safe", "workStatus"]) {
    assert.ok(!new RegExp(`\\b${bad}\\b`, "i").test(src),
      `payments references ${bad}; canon: payment never implies safe/assigned/ready/completed`);
  }
});

test("capturing more than remains available throws rather than clamping", () => {
  const auth = authorize({
    authorizationId: "A", jobOrderId: "J", amount: money(10000), pspRef: "p", now: NOW,
  });
  assert.throws(() => capture({
    authorization: auth, amount: money(15000), idempotencyKey: "k", pspRef: "p", now: NOW,
  }), (e: unknown) => e instanceof PaymentInvariantError && e.invariant === "OVER_CAPTURE");
});

test("refunding more than was captured is refused", () => {
  const auth = authorize({
    authorizationId: "A", jobOrderId: "J", amount: money(10000), pspRef: "p", now: NOW,
  });
  const cap = capture({ authorization: auth, amount: money(4000), idempotencyKey: "k1", pspRef: "p", now: NOW });
  assert.throws(() => refund({
    authorization: cap.authorization, amount: money(5000),
    idempotencyKey: "k2", pspRef: "p", reason: "goodwill", now: NOW,
  }), (e: unknown) => e instanceof PaymentInvariantError && e.invariant === "OVER_REFUND");
});

test("a full lifecycle leaves a ledger that balances", () => {
  const s = run({ taxes: [] });
  const auth = authorize({
    authorizationId: "A", jobOrderId: "JOB-1",
    amount: s.customerCharge.total, pspRef: "p", now: NOW,
  });
  const cap = capture({
    authorization: auth, amount: s.customerCharge.total,
    idempotencyKey: "cap", pspRef: "p", now: NOW,
  });
  const pay = payout({
    jobOrderId: "JOB-1", amount: s.providerPayable.total,
    idempotencyKey: "pay", pspRef: "p", now: NOW,
  });

  assert.ok(s.transaction);
  const all: LedgerTransaction[] = [s.transaction!, cap.transaction, pay];
  assert.ok(ledgerBalances(all), "the whole ledger must balance, not just each posting");
  assert.equal(balanceOf(all, "CUSTOMER_RECEIVABLE").minorUnits, 0, "the customer paid in full");
  assert.equal(balanceOf(all, "PROVIDER_PAYABLE").minorUnits, 0, "the provider was paid in full");
});
