/**
 * L12 — final settlement.
 *
 * Turns what L09B allocated in minutes and what L6 priced into what is actually
 * owed, then posts it. This is the last layer in the chain and the only one
 * permitted to make a payment happen.
 *
 * THE INVARIANT EVERYTHING ELSE DEPENDS ON
 *
 * "Customer charge != provider payable."
 *
 * Canon's operating path computes them as steps 2 and 3 — two separate
 * calculations over the same inputs, not one number and a split. That is the
 * same shape L09B holds for PPP / CRA / DoneeoAbsorption, and it survives here
 * or it was never real: a settlement that derives the provider's payment by
 * subtracting a fee from the customer's charge has quietly reintroduced the
 * weighted blame engine three layers of work removed.
 *
 * So each function below reads only its own inputs. Neither takes the other's
 * result as an argument, which makes the wrong version awkward to write rather
 * than merely discouraged.
 *
 * WHAT MAKES UP THE DIFFERENCE
 *
 * The two figures rarely match, and the gap is not an error — it is Doneeo's
 * position on the job: margin when things went well, absorption when they did
 * not. `doneeoPosition` names it rather than leaving it implicit.
 */

import { type Money, money, sumMoney, type Currency } from "../l6/pricing";
import {
  postTransaction, debit, credit,
  type LedgerTransaction, type LedgerEntry, LedgerInvariantError,
} from "./ledger";

export class SettlementInvariantError extends Error {
  constructor(readonly invariant: string, message: string) {
    super(message);
    this.name = "SettlementInvariantError";
  }
}

/**
 * Minutes to money.
 *
 * L09B deals only in minutes and roles. Applying a rate is final settlement
 * calculation, which canon puts here — but the rates themselves are commercial
 * configuration, so they arrive through a port like every other threshold.
 */
export type RateCard = {
  /** What the provider earns per minute in this role. */
  providerRatePerMinute(role: string): Money;
  /** What the customer is charged per minute of eligible disruption. */
  customerRatePerMinute(role: string): Money;
};

function applyRate(byRole: Readonly<Record<string, number>>, rate: (role: string) => Money): Money {
  const parts: Money[] = [];
  for (const [role, minutes] of Object.entries(byRole)) {
    if (minutes <= 0) continue;
    const r = rate(role);
    parts.push(money(r.minorUnits * minutes, r.currency));
  }
  return sumMoney(parts);
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/**
 * Everything settlement needs, gathered before any calculation runs.
 *
 * Canon step 1: "load immutable commercial/outcome/responsibility inputs". They
 * are immutable because a settlement recomputed against inputs that moved is a
 * different settlement wearing the same id.
 */
export type SettlementInput = {
  readonly jobOrderId: string;
  /** From L6. What was agreed for the work as planned. */
  readonly contractedPrice: Money;
  /** From L11/L10. The portion of contracted work actually completed. */
  readonly completedFraction: number;
  /** Additions the customer approved during execution. */
  readonly approvedAdditions: readonly { label: string; amount: Money }[];
  /** From L09B, in minutes per role. Never money — L09B does not price. */
  readonly customerAdjustmentByRole: Readonly<Record<string, number>>;
  readonly protectedProviderByRole: Readonly<Record<string, number>>;
  readonly doneeoAbsorptionByRole: Readonly<Record<string, number>>;
  readonly recoveryCreditByRole: Readonly<Record<string, number>>;
  /** Receipts and partner invoices already evidenced. */
  readonly eligibleExternalCosts: readonly { ref: string; amount: Money }[];
  /** Tax on the customer-facing total, determined by L6, referenced here. */
  readonly taxes: readonly { label: string; amount: Money }[];
  readonly taxDecisionRef: string;
  /** True when L09B routed the case to review. Blocks automatic settlement. */
  readonly requiresReview: boolean;
};

// ---------------------------------------------------------------------------
// The two independent calculations
// ---------------------------------------------------------------------------

export type CustomerCharge = {
  readonly completedWork: Money;
  readonly approvedAdditions: Money;
  readonly eligibleDisruption: Money;
  readonly credits: Money;
  readonly netBeforeTax: Money;
  readonly taxes: Money;
  readonly total: Money;
  /** Every line, so a customer can be shown why. */
  readonly lines: readonly { label: string; amount: Money; sign: "CHARGE" | "CREDIT" }[];
};

/**
 * Canon step 2, read literally:
 *
 *   completed contracted work
 *   + approved additions
 *   + eligible customer-responsible disruption
 *   + approved resource actuals
 *   - credits
 *   - unperformed amounts
 *
 * "Unperformed amounts" is not a subtraction here — it is the reason
 * completedWork is the contracted price times the completed fraction rather
 * than the contracted price. Work that did not happen is never charged and then
 * refunded; it is never charged.
 */
export function calculateCustomerCharge(input: SettlementInput, rates: RateCard): CustomerCharge {
  if (input.completedFraction < 0 || input.completedFraction > 1) {
    throw new SettlementInvariantError(
      "IMPOSSIBLE_COMPLETION",
      `completed fraction ${input.completedFraction} is outside 0..1`,
    );
  }

  const completedWork = money(
    Math.round(input.contractedPrice.minorUnits * input.completedFraction),
    input.contractedPrice.currency,
  );
  const additions = sumMoney(input.approvedAdditions.map(a => a.amount));
  const disruption = applyRate(input.customerAdjustmentByRole, r => rates.customerRatePerMinute(r));
  const credits = applyRate(input.recoveryCreditByRole, r => rates.customerRatePerMinute(r));

  const gross = completedWork.minorUnits + additions.minorUnits + disruption.minorUnits;
  const netBeforeTax = money(Math.max(0, gross - credits.minorUnits), input.contractedPrice.currency);

  const taxes = sumMoney(input.taxes.map(t => t.amount), input.contractedPrice.currency);
  const total = money(netBeforeTax.minorUnits + taxes.minorUnits, input.contractedPrice.currency);

  const lines: { label: string; amount: Money; sign: "CHARGE" | "CREDIT" }[] = [];
  if (completedWork.minorUnits > 0) lines.push({ label: "Work completed", amount: completedWork, sign: "CHARGE" });
  for (const a of input.approvedAdditions) lines.push({ label: a.label, amount: a.amount, sign: "CHARGE" });
  if (disruption.minorUnits > 0) lines.push({ label: "Evidenced disruption", amount: disruption, sign: "CHARGE" });
  if (credits.minorUnits > 0) lines.push({ label: "Recovery credit", amount: credits, sign: "CREDIT" });

  return Object.freeze({
    completedWork, approvedAdditions: additions, eligibleDisruption: disruption,
    credits, netBeforeTax, taxes, total, lines: Object.freeze(lines),
  });
}

export type ProviderPayable = {
  readonly completedWork: Money;
  readonly protectedCapacity: Money;
  readonly externalCosts: Money;
  readonly total: Money;
  readonly byRole: Readonly<Record<string, number>>;
};

/**
 * Canon step 3, computed from its own inputs only.
 *
 * Note what is NOT a parameter: the customer charge. A provider is paid for
 * what they did and what they were protected for. Whether the customer paid,
 * paid less, or paid nothing is a different question with a different answer.
 * That is the whole content of "customer charge != provider payable".
 */
export function calculateProviderPayable(
  input: SettlementInput,
  rates: RateCard,
  providerShareOfCompleted: number,
): ProviderPayable {
  if (providerShareOfCompleted < 0 || providerShareOfCompleted > 1) {
    throw new SettlementInvariantError(
      "IMPOSSIBLE_SHARE",
      `provider share ${providerShareOfCompleted} is outside 0..1`,
    );
  }

  const completedWork = money(
    Math.round(input.contractedPrice.minorUnits * input.completedFraction * providerShareOfCompleted),
    input.contractedPrice.currency,
  );
  const protectedCapacity = applyRate(input.protectedProviderByRole, r => rates.providerRatePerMinute(r));
  const external = sumMoney(input.eligibleExternalCosts.map(c => c.amount), input.contractedPrice.currency);

  return Object.freeze({
    completedWork,
    protectedCapacity,
    externalCosts: external,
    total: money(
      completedWork.minorUnits + protectedCapacity.minorUnits + external.minorUnits,
      input.contractedPrice.currency,
    ),
    byRole: input.protectedProviderByRole,
  });
}

// ---------------------------------------------------------------------------
// The settlement
// ---------------------------------------------------------------------------

export type Settlement = {
  readonly jobOrderId: string;
  readonly customerCharge: CustomerCharge;
  readonly providerPayable: ProviderPayable;
  /**
   * What Doneeo is left holding. Positive is margin, negative is absorption.
   *
   * Derived LAST, from the two independent figures, and never used to compute
   * either of them. Naming it is what stops it becoming an unexplained residue.
   */
  readonly doneeoPosition: Money;
  /**
   * Null when nobody owes anybody anything.
   *
   * A job cancelled while still free, with nothing completed and no capacity
   * protected, settles to nothing — and that is a correct outcome, not an
   * error. It is modelled rather than thrown because the alternative is every
   * caller checking first, and a caller who forgets gets an exception for a
   * case that was always going to happen.
   */
  readonly transaction: LedgerTransaction | null;
  readonly nothingOwed: boolean;
  readonly calculatedAt: string;
};

/**
 * Calculate both sides, then post one balanced transaction.
 *
 * A case L09B sent to review is refused outright rather than settled
 * provisionally — the same rule L09B applies to allocation, for the same
 * reason: a provisional figure in a ledger is indistinguishable from a decided
 * one once it is posted.
 */
export function settle(input: {
  settlementInput: SettlementInput;
  rates: RateCard;
  providerShareOfCompleted: number;
  transactionId: string;
  now: string;
}): Settlement {
  const si = input.settlementInput;

  if (si.requiresReview) {
    throw new SettlementInvariantError(
      "REVIEW_REQUIRED",
      `${si.jobOrderId} was routed to review by L09B and cannot be settled automatically; ` +
      "a provisional posting is indistinguishable from a decided one",
    );
  }

  const customer = calculateCustomerCharge(si, input.rates);
  const provider = calculateProviderPayable(si, input.rates, input.providerShareOfCompleted);
  const absorption = applyRate(si.doneeoAbsorptionByRole, r => input.rates.providerRatePerMinute(r));
  const recoveryCredit = applyRate(si.recoveryCreditByRole, r => input.rates.customerRatePerMinute(r));

  const currency: Currency = si.contractedPrice.currency;
  const entries: LedgerEntry[] = [];

  // Customer side.
  if (customer.total.minorUnits > 0) {
    entries.push(debit("CUSTOMER_RECEIVABLE", customer.total, "customer charge for this job"));
  }
  // Provider side, independent of the above.
  if (provider.total.minorUnits > 0) {
    entries.push(credit("PROVIDER_PAYABLE", provider.total, "provider earnings and protected capacity"));
  }
  // Tax is collected for an authority and is never ours.
  if (customer.taxes.minorUnits > 0) {
    entries.push(credit("TAX_PAYABLE", customer.taxes, `tax per ${si.taxDecisionRef}`));
  }
  // Goodwill Doneeo funds, kept apart from absorbing its own error.
  if (recoveryCredit.minorUnits > 0) {
    entries.push(debit("RECOVERY_CREDIT", recoveryCredit, "Doneeo-funded recovery credit"));
  }
  if (absorption.minorUnits > 0) {
    entries.push(debit("DONEEO_ABSORPTION", absorption, "cost the platform carries itself"));
  }

  // Whatever is left over is Doneeo's position, posted explicitly so the
  // transaction balances without anyone inventing a plug figure.
  const debits = entries.filter(e => e.direction === "DEBIT").reduce((s, e) => s + e.amount.minorUnits, 0);
  const credits = entries.filter(e => e.direction === "CREDIT").reduce((s, e) => s + e.amount.minorUnits, 0);
  const gap = debits - credits;

  if (gap > 0) {
    // More owed to us than out: the remainder is revenue.
    entries.push(credit("DONEEO_REVENUE", money(gap, currency), "Doneeo margin on this job"));
  } else if (gap < 0) {
    // More out than in: the platform is carrying the difference.
    entries.push(debit("DONEEO_ABSORPTION", money(-gap, currency), "net platform cost on this job"));
  }

  // No charge, no payable, no absorption: a free cancellation with nothing
  // done. Posting a transaction here would mean inventing entries to balance,
  // which is precisely the plug figure this layer exists to prevent.
  const transaction = entries.length === 0 ? null : postTransaction({
    transactionId: input.transactionId,
    jobOrderId: si.jobOrderId,
    kind: "SETTLEMENT",
    entries,
    postedAt: input.now,
    sourceRef: si.taxDecisionRef,
  });

  return Object.freeze({
    jobOrderId: si.jobOrderId,
    customerCharge: customer,
    providerPayable: provider,
    doneeoPosition: Object.freeze({
      minorUnits: customer.total.minorUnits - customer.taxes.minorUnits - provider.total.minorUnits,
      currency,
    }),
    transaction,
    nothingOwed: transaction === null,
    calculatedAt: input.now,
  });
}

export { LedgerInvariantError };
