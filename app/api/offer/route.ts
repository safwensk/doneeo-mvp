/**
 * L6 — commercial offers.
 *
 * Separate from /api/execution deliberately. This is the commercial boundary
 * that happens BEFORE anything is committed: a customer sees priced options
 * here and, having chosen one, L7 begins holding capacity against it.
 *
 * Prices are returned in integer minor units with an explicit currency. There
 * is no formatted-currency string anywhere in this file — formatting is a
 * presentation decision, and a number that has been through a formatter is a
 * number that has been rounded by somebody.
 */

import { OfferService, OfferServiceError } from "../../../lib/application/offer-service";
import { PricingInvariantError } from "../../../lib/layers/l6/pricing";
import type { PriceableOption } from "../../../lib/application/offer-service";
import type { D1DatabaseLike } from "../../../lib/application/d1-requirement-contract-store";
import type { ScopeContract, RoleProfile } from "../../../lib/layers/l6/offer";
import { MONTREAL_PILOT } from "../../../lib/policy/montreal-pilot";

export const runtime = "edge";

type D1Statement = {
  bind(...values: unknown[]): D1Statement;
  run(): Promise<unknown>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
};
type D1Binding = { prepare(q: string): D1Statement; batch(s: D1Statement[]): Promise<unknown[]> };

function service(): OfferService {
  const db = (globalThis as typeof globalThis & { __DONEEO_DB__?: D1Binding }).__DONEEO_DB__;
  if (!db) throw new Error("Doneeo database binding is unavailable");
  return new OfferService(db as unknown as D1DatabaseLike, {
    name: MONTREAL_PILOT.name,
    pricing: MONTREAL_PILOT.pricing,
    tax: MONTREAL_PILOT.tax,
    topology: MONTREAL_PILOT.topology,
  });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const offerId = url.searchParams.get("offerId");
    const rcRef = url.searchParams.get("requirementContractRef");
    const now = new Date().toISOString();
    const svc = service();

    if (offerId) {
      const offer = await svc.read(offerId);
      if (!offer) return Response.json({ error: "No such offer" }, { status: 404 });
      return Response.json(offer);
    }
    if (rcRef) {
      // Expired offers are omitted rather than returned with a flag: canon says
      // the customer sees feasible options only, and a lapsed price is not one.
      return Response.json({ offers: await svc.liveOffersFor(rcRef, now) });
    }
    return Response.json({ error: "offerId or requirementContractRef is required" }, { status: 400 });
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

    switch (action) {
      case "create_offer": {
        const offer = await svc.createOffer({
          offerId: String(body.offerId ?? crypto.randomUUID()),
          workCaseId: body.workCaseId ? String(body.workCaseId) : null,
          requirementContractRef: String(body.requirementContractRef),
          requirementContractVersion: Number(body.requirementContractVersion),
          options: (body.options ?? []) as readonly PriceableOption[],
          scopeContract: body.scopeContract as ScopeContract,
          profile: body.profile as RoleProfile,
          riskProfile: String(body.riskProfile ?? "standard"),
          jurisdiction: String(body.jurisdiction ?? "QC"),
          validFrom: String(body.validFrom ?? now),
          validUntil: String(body.validUntil),
          now,
        });
        return Response.json({
          offerId: offer.offerId,
          options: offer.options.map(o => ({
            band: o.band,
            fulfillmentOptionRef: o.fulfillmentOptionRef,
            differsBy: o.differsBy,
            lines: o.breakdown.lines,
            subtotal: o.breakdown.subtotal,
            taxes: o.breakdown.taxes,
            total: o.breakdown.total,
            assumptions: o.breakdown.assumptions,
          })),
          paymentTopology: offer.paymentTopology,
          scopeContract: offer.scopeContract,
          validUntil: offer.validUntil,
          requiresHumanReview: offer.requiresHumanReview,
          reviewReason: offer.reviewReason,
          // Echoed so no consumer can mistake a quote for what will be owed.
          isFinalSettlement: offer.isFinalSettlement,
        }, { status: 201 });
      }

      case "select_offer": {
        const selected = await svc.select({
          offerId: String(body.offerId),
          band: body.band as never,
          now,
        });
        return Response.json({
          offerId: selected.offerId,
          band: selected.band,
          fulfillmentOptionRef: selected.fulfillmentOptionRef,
          total: selected.total,
          paymentTopology: selected.paymentTopology,
          scopeContract: selected.scopeContract,
          selectedAt: selected.selectedAt,
          isFinalSettlement: selected.isFinalSettlement,
          // What happens next, so a caller does not assume the job is committed.
          next: "hold_capacity via /api/execution",
        }, { status: 201 });
      }

      default:
        return Response.json({ error: `Unsupported action: ${action || "(none)"}` }, { status: 400 });
    }
  } catch (error) {
    return fail(error);
  }
}

/**
 * A refused price is the architecture working.
 *
 * An expired quote, a moved RequirementContract, a missing cost input and an
 * unresolved tax are all 409: the request was well formed, and the system is
 * declining to quote a number it cannot stand behind.
 */
function fail(error: unknown): Response {
  if (error instanceof PricingInvariantError) {
    return Response.json({ error: error.message, invariant: error.invariant }, { status: 409 });
  }
  if (error instanceof OfferServiceError) {
    return Response.json({ error: error.message, code: error.code }, { status: 422 });
  }
  return Response.json(
    { error: error instanceof Error ? error.message : "Offer service unavailable" },
    { status: 500 },
  );
}
