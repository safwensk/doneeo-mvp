/**
 * L12 — the append-only double-entry ledger.
 *
 * WHY DOUBLE ENTRY, AND WHY IT IS ENFORCED RATHER THAN INTENDED
 *
 * Canon's invariant is "append-only balanced postings" and "no direct balance
 * edits". Both are here as structure, not as discipline:
 *
 *   A LedgerTransaction cannot be constructed unbalanced. postTransaction()
 *   throws before returning anything, so an unbalanced posting has no
 *   representation that could reach storage.
 *
 *   There is no balance field anywhere. balanceOf() folds the entries every
 *   time it is asked. A stored balance is a second copy of the truth, and the
 *   moment it disagrees with the entries nobody can tell which one is wrong.
 *
 *   Nothing amends. There is no update, no delete, no correction-in-place —
 *   only reverse(), which posts the mirror image and leaves both halves
 *   visible. "FinanceOps cannot rewrite physical truth or ledger history."
 *
 * The reason to be this strict: every other layer's fairness guarantees end up
 * expressed here. If the ledger can drift, PPP != CRA != DoneeoAbsorption stops
 * being checkable, and the careful separation L09B maintains becomes decorative.
 */

import { type Money, money, sumMoney, type Currency } from "../l6/pricing";

export class LedgerInvariantError extends Error {
  constructor(readonly invariant: string, message: string) {
    super(message);
    this.name = "LedgerInvariantError";
  }
}

/**
 * The chart of accounts.
 *
 * Deliberately small. Each account answers one question, and the three that
 * matter most mirror L09B's three independent quantities — which is the point:
 * the ledger has to be able to express "the provider was paid and the customer
 * was charged nothing" without that looking like an error.
 */
export type Account =
  /** What the customer owes us. */
  | "CUSTOMER_RECEIVABLE"
  /** What we owe the provider. */
  | "PROVIDER_PAYABLE"
  /** Our margin on completed work. */
  | "DONEEO_REVENUE"
  /** Cost the platform carries itself — its own errors, no-fault outcomes. */
  | "DONEEO_ABSORPTION"
  /** Goodwill funded by Doneeo, kept separate from absorption of its own error. */
  | "RECOVERY_CREDIT"
  /** Tax collected on behalf of an authority. Never ours. */
  | "TAX_PAYABLE"
  /** Money in flight at the payment provider. */
  | "PSP_CLEARING";

export type Direction = "DEBIT" | "CREDIT";

export type LedgerEntry = {
  readonly account: Account;
  readonly direction: Direction;
  readonly amount: Money;
  /** What this line is for, in words. An unexplained posting is not auditable. */
  readonly narrative: string;
};

export type LedgerTransaction = {
  readonly transactionId: string;
  readonly jobOrderId: string;
  readonly kind: TransactionKind;
  readonly entries: readonly LedgerEntry[];
  readonly postedAt: string;
  /** Set only on a reversal, naming the transaction it mirrors. */
  readonly reverses: string | null;
  /** What caused this. Feeds DecisionTrace and reconciliation. */
  readonly sourceRef: string;
};

export type TransactionKind =
  | "SETTLEMENT"
  | "CAPTURE"
  | "REFUND"
  | "PAYOUT"
  | "AUTHORIZATION_RELEASE"
  | "REVERSAL"
  | "ADJUSTMENT";

// ---------------------------------------------------------------------------
// Posting
// ---------------------------------------------------------------------------

function totalFor(entries: readonly LedgerEntry[], direction: Direction, currency: Currency): Money {
  return sumMoney(entries.filter(e => e.direction === direction).map(e => e.amount), currency);
}

/**
 * Post a transaction, or refuse to.
 *
 * Every check below is a throw rather than a returned error, because a caller
 * that can ignore an unbalanced posting will eventually ignore one.
 */
export function postTransaction(input: {
  transactionId: string;
  jobOrderId: string;
  kind: TransactionKind;
  entries: readonly LedgerEntry[];
  postedAt: string;
  sourceRef: string;
  reverses?: string;
}): LedgerTransaction {
  const { entries } = input;

  if (entries.length === 0) {
    throw new LedgerInvariantError("EMPTY_TRANSACTION", "a transaction with no entries records nothing");
  }
  if (entries.length < 2) {
    throw new LedgerInvariantError(
      "SINGLE_ENTRY",
      "double entry means at least two lines; a single-sided posting cannot balance",
    );
  }

  const currencies = new Set(entries.map(e => e.amount.currency));
  if (currencies.size > 1) {
    throw new LedgerInvariantError(
      "MIXED_CURRENCY",
      `a transaction cannot mix ${[...currencies].join(" and ")}; convert first and post the conversion`,
    );
  }
  const currency = entries[0]!.amount.currency;

  for (const e of entries) {
    if (e.amount.minorUnits === 0) {
      throw new LedgerInvariantError(
        "ZERO_ENTRY",
        `zero-value line on ${e.account}; omit it rather than posting a line that moves nothing`,
      );
    }
    if (!e.narrative.trim()) {
      throw new LedgerInvariantError("NO_NARRATIVE", `entry on ${e.account} has no narrative`);
    }
  }

  const debits = totalFor(entries, "DEBIT", currency);
  const credits = totalFor(entries, "CREDIT", currency);
  if (debits.minorUnits !== credits.minorUnits) {
    throw new LedgerInvariantError(
      "UNBALANCED",
      `debits ${debits.minorUnits} != credits ${credits.minorUnits}; ` +
      "an unbalanced posting has no valid representation and cannot be stored",
    );
  }

  if (input.kind === "REVERSAL" && !input.reverses) {
    throw new LedgerInvariantError("REVERSAL_WITHOUT_TARGET", "a reversal must name the transaction it mirrors");
  }
  if (input.reverses && input.kind !== "REVERSAL") {
    throw new LedgerInvariantError("NOT_A_REVERSAL", "only a REVERSAL may name a transaction it reverses");
  }

  return Object.freeze({
    transactionId: input.transactionId,
    jobOrderId: input.jobOrderId,
    kind: input.kind,
    entries: Object.freeze(entries.map(e => Object.freeze({ ...e }))),
    postedAt: input.postedAt,
    reverses: input.reverses ?? null,
    sourceRef: input.sourceRef,
  });
}

/**
 * Reverse a transaction by posting its mirror.
 *
 * Both halves stay visible forever. This is the ONLY way to undo anything in
 * this module, and it is why there is no delete: a ledger where a mistake can
 * disappear is a ledger nobody can be held to.
 */
export function reverse(input: {
  original: LedgerTransaction;
  transactionId: string;
  postedAt: string;
  reason: string;
}): LedgerTransaction {
  if (input.original.kind === "REVERSAL") {
    throw new LedgerInvariantError(
      "REVERSING_A_REVERSAL",
      "reversing a reversal re-applies the original; post the original again with a fresh id and say why",
    );
  }
  if (!input.reason.trim()) {
    throw new LedgerInvariantError("NO_REASON", "a reversal without a stated reason is not auditable");
  }

  const mirrored = input.original.entries.map(e => Object.freeze({
    account: e.account,
    direction: (e.direction === "DEBIT" ? "CREDIT" : "DEBIT") as Direction,
    amount: e.amount,
    narrative: `reversal: ${e.narrative}`,
  }));

  return postTransaction({
    transactionId: input.transactionId,
    jobOrderId: input.original.jobOrderId,
    kind: "REVERSAL",
    entries: mirrored,
    postedAt: input.postedAt,
    sourceRef: input.reason,
    reverses: input.original.transactionId,
  });
}

// ---------------------------------------------------------------------------
// Derived balances
// ---------------------------------------------------------------------------

/**
 * Whether an account increases on the debit or the credit side.
 *
 * Assets and expenses rise with debits; liabilities and revenue rise with
 * credits. Getting this wrong flips a sign silently, so it is a table rather
 * than a convention someone has to remember.
 */
const NORMAL_SIDE: Readonly<Record<Account, Direction>> = Object.freeze({
  CUSTOMER_RECEIVABLE: "DEBIT",   // asset — they owe us
  PSP_CLEARING: "DEBIT",          // asset — in flight to us
  DONEEO_ABSORPTION: "DEBIT",     // expense — we carry it
  RECOVERY_CREDIT: "DEBIT",       // expense — goodwill we fund
  PROVIDER_PAYABLE: "CREDIT",     // liability — we owe them
  TAX_PAYABLE: "CREDIT",          // liability — owed to an authority
  DONEEO_REVENUE: "CREDIT",       // revenue
});

/**
 * The balance of one account, folded from entries every time.
 *
 * Never cached, never stored. A stored balance is a second copy of the truth,
 * and when the two disagree there is no way to tell which is right.
 */
export function balanceOf(
  transactions: readonly LedgerTransaction[],
  account: Account,
  currency: Currency = "CAD",
): Money {
  const normal = NORMAL_SIDE[account];
  let net = 0;
  for (const t of transactions) {
    for (const e of t.entries) {
      if (e.account !== account) continue;
      net += e.direction === normal ? e.amount.minorUnits : -e.amount.minorUnits;
    }
  }
  // A negative balance is meaningful — an over-refunded receivable, say — so it
  // is returned as a signed figure rather than forced through money(), which
  // rejects negatives for price components.
  return Object.freeze({ minorUnits: net, currency });
}

/** Every account touched, with its balance. Useful for reconciliation. */
export function trialBalance(
  transactions: readonly LedgerTransaction[],
  currency: Currency = "CAD",
): Readonly<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const account of Object.keys(NORMAL_SIDE) as Account[]) {
    const b = balanceOf(transactions, account, currency);
    if (b.minorUnits !== 0) out[account] = b.minorUnits;
  }
  return Object.freeze(out);
}

/**
 * The whole ledger balances, not just each transaction.
 *
 * Each posting is balanced by construction, so this can only fail if entries
 * were assembled somewhere other than postTransaction — which is exactly the
 * bug worth catching.
 */
export function ledgerBalances(transactions: readonly LedgerTransaction[]): boolean {
  let debits = 0, credits = 0;
  for (const t of transactions) {
    for (const e of t.entries) {
      if (e.direction === "DEBIT") debits += e.amount.minorUnits;
      else credits += e.amount.minorUnits;
    }
  }
  return debits === credits;
}

/** Convenience for building entries without repeating the shape. */
export function debit(account: Account, amount: Money, narrative: string): LedgerEntry {
  return Object.freeze({ account, direction: "DEBIT" as const, amount, narrative });
}
export function credit(account: Account, amount: Money, narrative: string): LedgerEntry {
  return Object.freeze({ account, direction: "CREDIT" as const, amount, narrative });
}

export { money, type Money };
