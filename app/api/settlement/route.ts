/**
 * L12 — settlement, the ledger, and payment effects.
 *
 * The end of the chain. Everything upstream produced minutes, prices and
 * responsibility findings; this is where they become money owed and money
 * moved.
 *
 * TWO THINGS THIS ROUTE WILL NOT DO
 *
 * It will not settle a case L09B sent to review. A provisional posting is
 * indistinguishable from a decided one once it is in the ledger.
 *
 * It will not treat a replayed payment callback as a new one. The idempotency
 * key must come from the PSP's event id, and the ledger's primary key is
 * derived from it, so a replay collides at the database and moves nothing. A
 * replay returns 200 with replayed: true, not an error — the caller did
 * nothing wrong and should not retry.
 */

import {
  LedgerService, LedgerServiceError, AlreadyAppliedError,
} from "../../../lib/application/ledger-service";
import { LedgerInvariantError } from "../../../lib/layers/l12/ledger";
import { SettlementInvariantError, type SettlementInput } from "../../../lib/layers/l12/settlement";
import { PaymentInvariantError, callbackKey } from "../../../lib/layers/l12/payments";
import { money } from "../../../lib/layers/l6/pricing";
import type { D1DatabaseLike } from "../../../lib/application/d1-requirement-contract-store";
import type { Account } from "../../../lib/layers/l12/ledger";
import { MONTREAL_PILOT } from "../../../lib/policy/montreal-pilot";

export const runtime = "edge";

type D1Statement = {
  bind(...values: unknown[]): D1Statement;
  run(): Promise<unknown>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
};
type D1Binding = { prepare(q: string): D1Statement; batch(s: D1Statement[]): Promise<unknown[]> };

function service(): LedgerService {
  const db = (globalThis as typeof globalThis & { __DONEEO_DB__?: D1Binding }).__DONEEO_DB__;
  if (!db) throw new Error("Doneeo database binding is unavailable");
  return new LedgerService(db as unknown as D1DatabaseLike, {
    name: MONTREAL_PILOT.name,
    rates: MONTREAL_PILOT.rates,
  });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const jobOrderId = url.searchParams.get("jobOrderId");
    if (!jobOrderId) return Response.json({ error: "jobOrderId is required" }, { status: 400 });

    const svc = service();
    const transactions = await svc.transactionsFor(jobOrderId);
    return Response.json({
      jobOrderId,
      transactions,
      // Folded from entries on every read. There is no stored balance to drift.
      trialBalance: await svc.trialBalanceFor(jobOrderId),
      customerOutstanding: await svc.balance(jobOrderId, "CUSTOMER_RECEIVABLE" as Account),
      providerOutstanding: await svc.balance(jobOrderId, "PROVIDER_PAYABLE" as Account),
    });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, never> & Record<string, unknown>;
    const action = String(body.action ?? "");
    const svc = service();
    const now = typeof body.now === "string" ? body.now : new Date().toISOString();
    const jobOrderId = String(body.jobOrderId ?? "");

    switch (action) {
      case "settle": {
        const result = await svc.settleJob({
          settlementInput: body.settlementInput as SettlementInput,
          providerShareOfCompleted: Number(body.providerShareOfCompleted ?? 0.7),
          transactionId: String(body.transactionId ?? `SETTLE-${jobOrderId}`),
          now,
        });
        return Response.json({
          jobOrderId: result.jobOrderId,
          // Two figures, computed independently. Returned side by side so a
          // reader can see they are not derived from one another.
          customerCharge: {
            lines: result.customerCharge.lines,
            netBeforeTax: result.customerCharge.netBeforeTax,
            taxes: result.customerCharge.taxes,
            total: result.customerCharge.total,
          },
          providerPayable: {
            completedWork: result.providerPayable.completedWork,
            protectedCapacity: result.providerPayable.protectedCapacity,
            externalCosts: result.providerPayable.externalCosts,
            total: result.providerPayable.total,
          },
          doneeoPosition: result.doneeoPosition,
          nothingOwed: result.nothingOwed,
          transactionId: result.transaction?.transactionId ?? null,
          entries: result.transaction?.entries ?? [],
        }, { status: 201 });
      }

      case "authorize": {
        const auth = await svc.authorizePayment({
          authorizationId: String(body.authorizationId),
          jobOrderId,
          amount: money(Number(body.amountMinorUnits)),
          pspRef: String(body.pspRef),
          now,
        });
        return Response.json({
          authorizationId: auth.authorizationId,
          authorized: auth.authorized,
          status: auth.status,
        }, { status: 201 });
      }

      case "capture":
      case "release":
      case "refund": {
        // The key is built from the PSP event, never generated here. A
        // generated key would make every replay look new.
        const key = body.pspEventId
          ? callbackKey({
              pspEventId: String(body.pspEventId),
              jobOrderId,
              kind: action === "capture" ? "CAPTURE" : action === "release" ? "RELEASE" : "REFUND",
            })
          : String(body.idempotencyKey ?? "");
        if (!key) {
          return Response.json(
            { error: "pspEventId or idempotencyKey is required; a payment effect must be replay-safe" },
            { status: 400 },
          );
        }

        const { effect, replayed } = await svc.applyPaymentEffect({
          authorizationId: String(body.authorizationId),
          kind: action === "capture" ? "CAPTURE" : action === "release" ? "RELEASE" : "REFUND",
          amount: body.amountMinorUnits === undefined ? undefined : money(Number(body.amountMinorUnits)),
          idempotencyKey: key,
          pspRef: String(body.pspRef ?? key),
          reason: body.reason === undefined ? undefined : String(body.reason),
          now,
        });

        return Response.json({
          transactionId: effect.transaction.transactionId,
          amount: effect.command.amount,
          authorization: {
            captured: effect.authorization.captured,
            released: effect.authorization.released,
            status: effect.authorization.status,
          },
          // 200 with replayed: true, not an error — the caller did nothing
          // wrong, and telling them to retry would be the wrong advice.
          replayed,
        }, { status: replayed ? 200 : 201 });
      }

      case "pay_provider": {
        const key = body.pspEventId
          ? callbackKey({ pspEventId: String(body.pspEventId), jobOrderId, kind: "PAYOUT" })
          : String(body.idempotencyKey ?? "");
        if (!key) return Response.json({ error: "pspEventId or idempotencyKey is required" }, { status: 400 });

        const { transaction, replayed } = await svc.payProvider({
          jobOrderId,
          amount: money(Number(body.amountMinorUnits)),
          idempotencyKey: key,
          pspRef: String(body.pspRef ?? key),
          now,
        });
        return Response.json({
          transactionId: transaction.transactionId, replayed,
        }, { status: replayed ? 200 : 201 });
      }

      default:
        return Response.json({ error: `Unsupported action: ${action || "(none)"}` }, { status: 400 });
    }
  } catch (error) {
    return fail(error);
  }
}

/**
 * A refused posting is the architecture working.
 *
 * An unbalanced transaction, a case awaiting review, an over-capture — all 409.
 * The request was well formed and the system is declining to move money it
 * cannot justify.
 */
function fail(error: unknown): Response {
  if (error instanceof AlreadyAppliedError) {
    return Response.json({ replayed: true, transactionId: error.transactionId }, { status: 200 });
  }
  if (error instanceof LedgerInvariantError || error instanceof SettlementInvariantError ||
      error instanceof PaymentInvariantError) {
    return Response.json({ error: error.message, invariant: error.invariant }, { status: 409 });
  }
  if (error instanceof LedgerServiceError) {
    return Response.json({ error: error.message, code: error.code }, { status: 422 });
  }
  return Response.json(
    { error: error instanceof Error ? error.message : "Settlement unavailable" },
    { status: 500 },
  );
}
