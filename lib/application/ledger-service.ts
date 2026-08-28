/**
 * L12 in the running system.
 *
 * WHERE IDEMPOTENCY ACTUALLY LIVES
 *
 * Not here. `transaction_id` is the primary key of ledger_transactions and it
 * is derived from the payment provider's own event id, so a replayed callback
 * produces a duplicate-key collision at the database. This service catches that
 * collision and reports the effect as already applied.
 *
 * That ordering matters. An application-level "have we posted this?" check is a
 * race — two replays arriving together both look, both find nothing, both post.
 * Letting the write fail is the only version that holds under concurrency, so
 * the pre-check here is an optimisation and the constraint is the guarantee.
 */

import {
  postTransaction, balanceOf, trialBalance,
  type LedgerTransaction, type LedgerEntry, type Account,
  LedgerInvariantError,
} from "../layers/l12/ledger";
import {
  settle, type Settlement, type SettlementInput, type RateCard,
  SettlementInvariantError,
} from "../layers/l12/settlement";
import {
  authorize, capture, releaseUnused, refund, payout,
  type PaymentAuthorization, type PaymentEffect,
  PaymentInvariantError,
} from "../layers/l12/payments";
import { money, type Money, type Currency } from "../layers/l6/pricing";
import type { D1DatabaseLike, D1PreparedStatementLike } from "./d1-requirement-contract-store";

export type RateConfig = {
  readonly name: string;
  readonly rates: RateCard;
};

export class LedgerServiceError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "LedgerServiceError";
  }
}

/** Raised when a replay collided at the database. Not a failure — a no-op. */
export class AlreadyAppliedError extends Error {
  constructor(readonly transactionId: string) {
    super(`transaction ${transactionId} is already posted; the replay moved no money`);
    this.name = "AlreadyAppliedError";
  }
}

type TxnRow = {
  transaction_id: string; job_order_id: string; kind: LedgerTransaction["kind"];
  reverses: string | null; source_ref: string; posted_at: string;
};
type EntryRow = {
  transaction_id: string; account: Account; direction: "DEBIT" | "CREDIT";
  amount_minor_units: number; currency: string; narrative: string;
};
type AuthRow = {
  authorization_id: string; job_order_id: string;
  authorized_minor_units: number; captured_minor_units: number; released_minor_units: number;
  currency: string; status: PaymentAuthorization["status"]; psp_ref: string; authorized_at: string;
};

export class LedgerService {
  constructor(
    private readonly db: D1DatabaseLike,
    private readonly config: RateConfig,
  ) {}

  /** Calculate both sides and post one balanced transaction. */
  async settleJob(input: {
    settlementInput: SettlementInput;
    providerShareOfCompleted: number;
    transactionId: string;
    now: string;
  }): Promise<Settlement> {
    const result = settle({
      settlementInput: input.settlementInput,
      rates: this.config.rates,
      providerShareOfCompleted: input.providerShareOfCompleted,
      transactionId: input.transactionId,
      now: input.now,
    });

    const statements: D1PreparedStatementLike[] = [];
    if (result.transaction) statements.push(...this.writeTransaction(result.transaction));
    statements.push(this.db.prepare(
      `INSERT INTO settlements
       (job_order_id, transaction_id, customer_total_minor_units, provider_total_minor_units,
        doneeo_position_minor_units, currency, nothing_owed, rate_policy_name, calculated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(job_order_id) DO NOTHING`,
    ).bind(
      result.jobOrderId, result.transaction?.transactionId ?? null,
      result.customerCharge.total.minorUnits, result.providerPayable.total.minorUnits,
      result.doneeoPosition.minorUnits, result.doneeoPosition.currency,
      result.nothingOwed ? 1 : 0, this.config.name, result.calculatedAt,
    ));

    await this.run(statements, result.transaction?.transactionId ?? result.jobOrderId);
    return result;
  }

  async authorizePayment(input: {
    authorizationId: string; jobOrderId: string; amount: Money; pspRef: string; now: string;
  }): Promise<PaymentAuthorization> {
    const auth = authorize(input);
    await this.db.batch([this.db.prepare(
      `INSERT INTO payment_authorizations
       (authorization_id, job_order_id, authorized_minor_units, captured_minor_units,
        released_minor_units, currency, status, psp_ref, authorized_at)
       VALUES (?, ?, ?, 0, 0, ?, ?, ?, ?)`,
    ).bind(auth.authorizationId, auth.jobOrderId, auth.authorized.minorUnits,
      auth.authorized.currency, auth.status, auth.pspRef, auth.authorizedAt)]);
    return auth;
  }

  /**
   * Apply a payment effect, or report that it was already applied.
   *
   * `idempotencyKey` must come from the PSP event, never from this process —
   * a generated key makes every replay look new, which is the failure mode.
   */
  async applyPaymentEffect(input: {
    authorizationId: string;
    kind: "CAPTURE" | "RELEASE" | "REFUND";
    amount?: Money;
    idempotencyKey: string;
    pspRef: string;
    reason?: string;
    now: string;
  }): Promise<{ effect: PaymentEffect; replayed: boolean }> {
    const auth = await this.readAuthorization(input.authorizationId);
    if (!auth) throw new LedgerServiceError("NO_AUTHORIZATION", `no authorization ${input.authorizationId}`);

    let effect: PaymentEffect;
    switch (input.kind) {
      case "CAPTURE":
        if (!input.amount) throw new LedgerServiceError("AMOUNT_REQUIRED", "a capture needs an amount");
        effect = capture({ authorization: auth, amount: input.amount, idempotencyKey: input.idempotencyKey, pspRef: input.pspRef, now: input.now });
        break;
      case "RELEASE":
        effect = releaseUnused({ authorization: auth, idempotencyKey: input.idempotencyKey, pspRef: input.pspRef, now: input.now });
        break;
      case "REFUND":
        if (!input.amount) throw new LedgerServiceError("AMOUNT_REQUIRED", "a refund needs an amount");
        effect = refund({ authorization: auth, amount: input.amount, idempotencyKey: input.idempotencyKey, pspRef: input.pspRef, reason: input.reason ?? "", now: input.now });
        break;
    }

    const next = effect.authorization;
    try {
      await this.run([
        // A release posts nothing — an authorization is a memo, not an asset.
        ...(effect.transaction ? this.writeTransaction(effect.transaction) : []),
        this.db.prepare(
          `UPDATE payment_authorizations
           SET captured_minor_units = ?, released_minor_units = ?, status = ?
           WHERE authorization_id = ?`,
        ).bind(next.captured.minorUnits, next.released.minorUnits, next.status, next.authorizationId),
      ], effect.transaction?.transactionId ?? `RELEASE-${input.idempotencyKey}`);
      return { effect, replayed: false };
    } catch (e) {
      if (e instanceof AlreadyAppliedError) {
        // The replay collided at the primary key. Nothing moved, which is
        // exactly what L12-G3 requires.
        return { effect, replayed: true };
      }
      throw e;
    }
  }

  async payProvider(input: {
    jobOrderId: string; amount: Money; idempotencyKey: string; pspRef: string; now: string;
  }): Promise<{ transaction: LedgerTransaction; replayed: boolean }> {
    const transaction = payout(input);
    try {
      await this.run(this.writeTransaction(transaction), transaction.transactionId);
      return { transaction, replayed: false };
    } catch (e) {
      if (e instanceof AlreadyAppliedError) return { transaction, replayed: true };
      throw e;
    }
  }

  // -------------------------------------------------------------------------
  // Reads — every balance folded from entries, never stored
  // -------------------------------------------------------------------------

  async transactionsFor(jobOrderId: string): Promise<LedgerTransaction[]> {
    const txns = await this.db.prepare(
      `SELECT transaction_id, job_order_id, kind, reverses, source_ref, posted_at
       FROM ledger_transactions WHERE job_order_id = ? ORDER BY posted_at, transaction_id`,
    ).bind(jobOrderId).all<TxnRow>();
    const entries = await this.db.prepare(
      `SELECT e.transaction_id, e.account, e.direction, e.amount_minor_units, e.currency, e.narrative
       FROM ledger_entries e
       JOIN ledger_transactions t ON t.transaction_id = e.transaction_id
       WHERE t.job_order_id = ? ORDER BY e.id`,
    ).bind(jobOrderId).all<EntryRow>();

    const byTxn = new Map<string, LedgerEntry[]>();
    for (const r of entries.results ?? []) {
      const list = byTxn.get(r.transaction_id) ?? [];
      list.push(Object.freeze({
        account: r.account, direction: r.direction,
        amount: Object.freeze({ minorUnits: r.amount_minor_units, currency: r.currency as Currency }),
        narrative: r.narrative,
      }));
      byTxn.set(r.transaction_id, list);
    }

    return (txns.results ?? []).map(t => Object.freeze({
      transactionId: t.transaction_id,
      jobOrderId: t.job_order_id,
      kind: t.kind,
      entries: Object.freeze(byTxn.get(t.transaction_id) ?? []),
      postedAt: t.posted_at,
      reverses: t.reverses,
      sourceRef: t.source_ref,
    }));
  }

  async balance(jobOrderId: string, account: Account): Promise<Money> {
    return balanceOf(await this.transactionsFor(jobOrderId), account);
  }

  async trialBalanceFor(jobOrderId: string): Promise<Readonly<Record<string, number>>> {
    return trialBalance(await this.transactionsFor(jobOrderId));
  }

  async readAuthorization(authorizationId: string): Promise<PaymentAuthorization | null> {
    const row = await this.db.prepare(
      `SELECT authorization_id, job_order_id, authorized_minor_units, captured_minor_units,
              released_minor_units, currency, status, psp_ref, authorized_at
       FROM payment_authorizations WHERE authorization_id = ?`,
    ).bind(authorizationId).first<AuthRow>();
    if (!row) return null;
    const currency = row.currency as Currency;
    return Object.freeze({
      authorizationId: row.authorization_id,
      jobOrderId: row.job_order_id,
      authorized: money(row.authorized_minor_units, currency),
      captured: money(row.captured_minor_units, currency),
      released: money(row.released_minor_units, currency),
      status: row.status,
      authorizedAt: row.authorized_at,
      pspRef: row.psp_ref,
    });
  }

  // -------------------------------------------------------------------------

  private writeTransaction(t: LedgerTransaction): D1PreparedStatementLike[] {
    return [
      this.db.prepare(
        `INSERT INTO ledger_transactions (transaction_id, job_order_id, kind, reverses, source_ref, posted_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).bind(t.transactionId, t.jobOrderId, t.kind, t.reverses, t.sourceRef, t.postedAt),
      ...t.entries.map(e => this.db.prepare(
        `INSERT INTO ledger_entries
         (transaction_id, account, direction, amount_minor_units, currency, narrative)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).bind(t.transactionId, e.account, e.direction, e.amount.minorUnits, e.amount.currency, e.narrative)),
    ];
  }

  /** Run a batch, translating a primary-key collision into AlreadyApplied. */
  private async run(statements: D1PreparedStatementLike[], transactionId: string): Promise<void> {
    try {
      await this.db.batch(statements);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (/UNIQUE|PRIMARY KEY|constraint/i.test(message)) {
        throw new AlreadyAppliedError(transactionId);
      }
      throw e;
    }
  }
}

export { LedgerInvariantError, SettlementInvariantError, PaymentInvariantError };
