// New for the frontend redesign. Stage 2 — the largest, most investor-relevant
// screen (plan/price comparison). Presentation-only: every value/handler is
// computed in page.tsx exactly as before and passed straight through. Pure
// helpers (formatting, lookups) are imported directly rather than threaded as
// props, to keep the prop list to genuine state/derived-data.
import type { Dispatch, SetStateAction } from "react";
import type {
  PlannerAnalysis,
  PreparationStep,
  RouteNode,
  ScheduleWindow,
} from "../../lib/planner";
import type { Answers, GoogleRoute, PlanKey, PlanOption, ServiceAssignment } from "../_domain/plan-types";
import { serviceForTask } from "../_domain/plan-options";
import { addMinutesToSchedule } from "../_domain/schedule-format";
import { EXECUTOR_PORTRAITS } from "../_domain/executor-pool";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Disclosure } from "./ui/Disclosure";

type Operational = {
  teamSize: number;
  routeMinutes: number;
  handlingMinutes: number;
  accessMinutes: number;
  changes: string[];
  accessByStop: Array<{ floor: string; elevator: string; vehicle: string; minutes: number }>;
};
type ExecutionStep = {
  stepId: string;
  taskSequence: number | null;
  taskTitle: string;
  isGate: boolean;
  title: string;
  description: string;
  minutes: number;
  lowMinutes: number;
  highMinutes: number;
  qualification: string;
  startOffset: number;
  finishOffset: number;
};
type AssignmentWindow = { startOffset: number; finishOffset: number; startLocation?: string; finishLocation?: string };

function SectionHead({ eyebrow, title, badge }: { eyebrow: string; title: string; badge?: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <small className="block text-[9px] font-bold tracking-[0.1em] text-brand-600-r">{eyebrow}</small>
        <h3 className="mt-1 text-base font-bold text-ink-r">{title}</h3>
      </div>
      {badge && <Badge tone="neutral">{badge}</Badge>}
    </div>
  );
}

function MatchingIntro({ selected }: { selected: PlanKey }) {
  const score = selected === "recommended" ? 94 : selected === "complete" ? 96 : 82;
  return (
    <div className="mb-2">
      <div className="text-xs font-bold tracking-[0.17em] text-brand-600-r">YOUR JOB, ARCHITECTED</div>
      <h2 className="mt-2 text-[clamp(28px,4.5vw,42px)] font-extrabold leading-tight text-ink-r">
        Three transparent ways to get it done.
      </h2>
      <div className="mt-3 text-sm text-muted-r">Fit score for the highlighted plan: <strong className="text-brand-600-r">{score}/100</strong></div>
    </div>
  );
}

function IntelligenceWorkbench({ analysis }: { analysis: PlannerAnalysis }) {
  const intelligence = analysis.intelligence;
  if (!intelligence) return null;
  return (
    <Disclosure
      summary={
        <span className="flex flex-1 items-center justify-between gap-3">
          <span>
            <small className="block text-[9px] font-bold tracking-[0.1em] text-muted-r">
              DONEEO JOB INTELLIGENCE · {intelligence.version}
            </small>
            <span className="mt-0.5 block text-sm font-bold text-ink-r">How the work was calculated</span>
          </span>
          <Badge tone="brand">{intelligence.confidence.score}% confidence</Badge>
        </span>
      }
    >
      {intelligence.domains?.length ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {intelligence.domains.map(domain => (
            <span key={domain.id} className="rounded-lg-r border border-line-r bg-canvas-r px-3 py-2 text-xs">
              <b className="block font-bold text-ink-r">{domain.label}</b>
              <small className="text-muted-r">
                {domain.phaseCount} phase{domain.phaseCount === 1 ? "" : "s"} · {domain.qualification.replaceAll("_", " ")}
              </small>
            </span>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <small className="block text-[8px] font-bold tracking-[0.08em] text-muted-r">PERSON-WORK</small>
          <strong className="mt-1 block text-sm text-ink-r">{intelligence.estimate.personMinutes} min</strong>
        </div>
        <div>
          <small className="block text-[8px] font-bold tracking-[0.08em] text-muted-r">RECOMMENDED TEAM</small>
          <strong className="mt-1 block text-sm text-ink-r">{intelligence.manpower.recommended}</strong>
        </div>
        <div>
          <small className="block text-[8px] font-bold tracking-[0.08em] text-muted-r">EXECUTION RANGE</small>
          <strong className="mt-1 block text-sm text-ink-r">
            {intelligence.estimate.rangeLow}–{intelligence.estimate.rangeHigh} min
          </strong>
        </div>
        <div>
          <small className="block text-[8px] font-bold tracking-[0.08em] text-muted-r">RESOURCE REQUIREMENTS</small>
          <strong className="mt-1 block text-sm text-ink-r">{intelligence.resources.length}</strong>
        </div>
      </div>

      <div className="mt-4 rounded-lg-r bg-canvas-r p-3">
        <small className="block text-[9px] font-bold tracking-[0.08em] text-brand-600-r">TRANSPARENT EQUATION</small>
        <strong className="mt-1 block text-sm text-ink-r">{intelligence.estimate.equation}</strong>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-r">
          Each phase has its own low, likely and high duration. Extra people shorten only genuinely parallel work;
          licensing and safe crew minimums cannot be traded for speed.
        </p>
      </div>

      <details open className="mt-4 border-t border-line-r pt-3">
        <summary className="cursor-pointer text-xs font-bold text-brand-600-r">
          {intelligence.primitives.length} execution operations
        </summary>
        <div className="mt-2 grid gap-2">
          {intelligence.primitives.map(item => (
            <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg-r border border-line-r p-2.5">
              <span>
                <b className="block text-xs text-ink-r">{item.label}</b>
                <small className="mt-0.5 block text-[10px] text-muted-r">
                  {item.domain?.replaceAll("_", " ")} · likely {item.unitMinutes} min · range{" "}
                  {item.lowMinutes || Math.round(item.unitMinutes * 0.75)}–{item.highMinutes || Math.round(item.unitMinutes * 1.5)} min
                </small>
                <small className="mt-0.5 block text-[10px] text-muted-r">
                  {(item.qualification || "general_helper").replaceAll("_", " ")} · crew {item.minimumCrew || 1} minimum /{" "}
                  {item.recommendedCrew || 1} recommended
                  {item.dependencies.length ? ` · Requires ${item.dependencies.join(", ")}` : ""}
                </small>
              </span>
              <strong className="flex-none text-xs text-ink-r">{item.personMinutes} person-min</strong>
            </div>
          ))}
        </div>
      </details>

      <details open className="mt-3 border-t border-line-r pt-3">
        <summary className="cursor-pointer text-xs font-bold text-brand-600-r">Equipment and material resolution</summary>
        <div className="mt-2 grid gap-2">
          {intelligence.resources.map(item => (
            <div key={item.id} className="rounded-lg-r border border-line-r p-2.5">
              <div className="flex items-center justify-between gap-3">
                <span>
                  <b className="block text-xs text-ink-r">{item.name}</b>
                  <small className="text-[10px] text-muted-r">{item.kind}</small>
                </span>
                <em className="rounded-full bg-canvas-r px-2 py-1 text-[10px] font-bold not-italic text-brand-600-r">
                  {item.status.replaceAll("_", " ")}
                </em>
              </div>
              <p className="mt-1.5 text-[11px] text-muted-r">
                {item.resolution}
                {item.estimatedCost ? ` · Approx. $${item.estimatedCost}` : ""}
              </p>
            </div>
          ))}
        </div>
      </details>

      <div className="mt-4 grid gap-2 border-t border-line-r pt-3">
        <div>
          <small className="block text-[9px] font-bold tracking-[0.08em] text-brand-600-r">WHY THIS TEAM</small>
          <strong className="mt-1 block text-xs text-ink-r">{intelligence.manpower.reason}</strong>
        </div>
        <div className="flex flex-wrap gap-2">
          {intelligence.manpower.alternatives.map(option => (
            <span key={`${option.people}-${option.label}`} className="rounded-lg-r border border-line-r px-3 py-2 text-xs">
              <b className="block text-ink-r">
                {option.people} executor{option.people > 1 ? "s" : ""}
              </b>
              <strong className="block text-ink-r">{option.estimatedMinutes} min work</strong>
              <small className="text-muted-r">{option.label}</small>
            </span>
          ))}
        </div>
      </div>

      <details className="mt-3 border-t border-line-r pt-3">
        <summary className="cursor-pointer text-xs font-bold text-brand-600-r">
          {intelligence.facts.length} facts locked in the work order
        </summary>
        <div className="mt-2 grid gap-1.5">
          {intelligence.facts.slice(0, 24).map(fact => (
            <div key={`${fact.key}-${fact.value}`} className="flex items-center justify-between gap-3 text-xs">
              <span className="text-muted-r">{fact.label}</span>
              <strong className="text-ink-r">{fact.value}</strong>
              <small className="text-[10px] text-subtle-r">{fact.confidence}</small>
            </div>
          ))}
        </div>
      </details>
    </Disclosure>
  );
}

function RouteSection({
  exactRouteAddresses,
  googleRoute,
  calculateGoogleRoute,
  googleMapsUrl,
  routeState,
  operational,
  hasDrivingRoute,
  analysis,
  routeStops,
  routeNodes,
  totalLow,
  totalHigh,
}: {
  exactRouteAddresses: string[];
  googleRoute: GoogleRoute | null;
  calculateGoogleRoute: (addresses?: string[]) => void | Promise<void>;
  googleMapsUrl: string;
  routeState: "idle" | "loading" | "ready" | "error";
  operational: Operational | null;
  hasDrivingRoute: boolean;
  analysis: PlannerAnalysis;
  routeStops: string[];
  routeNodes: RouteNode[];
  totalLow: number;
  totalHigh: number;
}) {
  return (
    <div className="grid gap-4">
      {exactRouteAddresses.length >= 2 && (
        <Card className="bg-[#f4f8ff]">
          <small className="text-[9px] font-bold tracking-[0.08em] text-[#3866b1]">GOOGLE ROUTES · LIVE DEMO</small>
          <h3 className="mt-1 text-sm font-bold text-ink-r">Real driving route and traffic estimate</h3>
          <p className="mt-1 text-xs text-[#5c6877]">{exactRouteAddresses.join(" → ")}</p>
          {googleRoute ? (
            <div className="mt-3">
              <strong className="block text-xl text-ink-r">{googleRoute.distanceKm} km</strong>
              <span className="mt-1 block text-xs text-[#28745b]">
                {googleRoute.trafficMinutes} min across {googleRoute.legs.length} driving leg
                {googleRoute.legs.length === 1 ? "" : "s"}
              </span>
            </div>
          ) : (
            <button
              onClick={() => calculateGoogleRoute()}
              disabled={exactRouteAddresses.length < 2 || routeState === "loading"}
              className="mt-3 rounded-lg-r bg-[#28745b] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {routeState === "loading" ? "Calculating…" : "Calculate with Google"}
            </button>
          )}
          {googleMapsUrl && (
            <a href={googleMapsUrl} target="_blank" rel="noreferrer" className="ml-2 mt-3 inline-block text-xs font-semibold text-[#2458a6]">
              Open route in Google Maps ↗
            </a>
          )}
          {routeState === "error" && <span className="mt-2 block text-xs text-[#a44a32]">Check that Routes API is enabled for this key.</span>}
        </Card>
      )}

      {operational && (
        <Card>
          <SectionHead eyebrow="PLAN RECALCULATED FROM YOUR ANSWERS" title="The answers now change the job" badge="Updated live" />
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div>
              <small className="block text-[8px] font-bold tracking-[0.08em] text-brand-600-r">TEAM</small>
              <strong className="mt-1 block text-sm text-ink-r">
                {operational.teamSize} executor{operational.teamSize > 1 ? "s" : ""}
              </strong>
            </div>
            <div>
              <small className="block text-[8px] font-bold tracking-[0.08em] text-brand-600-r">
                {hasDrivingRoute ? "DRIVING ROUTE" : "BETWEEN-STOP TRAVEL"}
              </small>
              <strong className="mt-1 block text-sm text-ink-r">
                {hasDrivingRoute ? `${operational.routeMinutes} min` : "Not required"}
              </strong>
            </div>
            <div>
              <small className="block text-[8px] font-bold tracking-[0.08em] text-brand-600-r">ON-SITE WORK</small>
              <strong className="mt-1 block text-sm text-ink-r">{operational.handlingMinutes} min</strong>
            </div>
            <div>
              <small className="block text-[8px] font-bold tracking-[0.08em] text-brand-600-r">ACCESS IMPACT</small>
              <strong className="mt-1 block text-sm text-ink-r">+{operational.accessMinutes} min</strong>
            </div>
          </div>
          {operational.changes.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {operational.changes.map(change => (
                <span key={change} className="rounded-full bg-brand-50-r px-2.5 py-1 text-xs text-brand-600-r">
                  ✓ {change}
                </span>
              ))}
            </div>
          )}
          {hasDrivingRoute ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {operational.accessByStop.map((stop, index) => (
                <div key={index} className="rounded-lg-r border border-line-r p-3">
                  <small className="block text-[9px] font-bold text-brand-600-r">
                    {index === 0 ? "PICKUP" : index === operational.accessByStop.length - 1 ? "FINAL DELIVERY" : `STOP ${index + 1}`}
                  </small>
                  <strong className="mt-1 block text-xs text-ink-r">
                    {stop.floor} · {stop.elevator}
                  </strong>
                  <span className="mt-0.5 block text-[11px] text-muted-r">{stop.vehicle}</span>
                  <em className="mt-1 block text-[10px] not-italic text-[#9a5d2b]">
                    {stop.minutes ? `+${stop.minutes} min handling` : "No confirmed delay"}
                  </em>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 rounded-lg-r bg-canvas-r p-3">
              <strong className="block text-xs text-ink-r">One-property execution</strong>
              <span className="mt-1 block text-xs text-muted-r">
                No pickup route, delivery route, vehicle-access estimate or Google driving leg is added. Only the
                internal carrying path and work phases affect execution time.
              </span>
            </div>
          )}
        </Card>
      )}

      {hasDrivingRoute ? (
        <Card padding="none" className="overflow-hidden">
          <div className="flex items-center justify-between gap-4 bg-canvas-r p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-lg-r bg-brand-50-r text-lg text-brand-600-r">⌁</span>
              <div>
                <small className="block text-[9px] font-bold tracking-[0.08em] text-brand-600-r">EXECUTION ROUTE</small>
                <strong className="mt-0.5 block text-sm text-ink-r">
                  {routeStops.length} locations · {Math.max(0, routeStops.length - 1)} driving legs
                </strong>
              </div>
            </div>
            <Badge tone="brand">{routeState === "loading" ? "Calculating…" : googleRoute ? "Google verified" : "Sequence verified"}</Badge>
          </div>
          {googleRoute && (
            <div className="grid grid-cols-3 gap-2 border-b border-line-r bg-[#eff8f5] p-4">
              <div>
                <small className="block text-[10px] font-bold text-[#28745b]">GOOGLE DISTANCE</small>
                <strong className="mt-1 block text-base text-ink-r">{googleRoute.distanceKm} km</strong>
              </div>
              <div>
                <small className="block text-[10px] font-bold text-[#28745b]">TRAFFIC-AWARE DRIVE</small>
                <strong className="mt-1 block text-base text-ink-r">{googleRoute.trafficMinutes} min</strong>
              </div>
              <div>
                <small className="block text-[10px] font-bold text-[#28745b]">DRIVE + HANDLING + WORK</small>
                <strong className="mt-1 block text-base text-ink-r">{totalLow}–{totalHigh} min</strong>
              </div>
            </div>
          )}
          <div className="grid gap-3 p-4">
            {routeNodes.map((node, index) => (
              <div key={`${node.location}-${index}`} className="flex gap-3">
                <b className="grid h-7 w-7 flex-none place-items-center rounded-full bg-brand-500-r text-xs font-bold text-white">
                  {index + 1}
                </b>
                <div>
                  <small className="block text-[9px] font-bold text-muted-r">
                    {index === 0 ? "START / PICKUP" : index === routeNodes.length - 1 ? "FINAL DROP / SERVICE" : `STOP ${index + 1}`}
                  </small>
                  <strong className="mt-0.5 block text-sm text-ink-r">{node.location}</strong>
                  <ul className="mt-1 list-disc pl-4 text-xs text-muted-r">
                    {node.actions.map(action => (
                      <li key={action}>{action}</li>
                    ))}
                  </ul>
                  {operational?.accessByStop[index] && (
                    <em className="mt-1 block text-[10px] not-italic text-[#9a5d2b]">
                      Handling at this location: +{operational.accessByStop[index].minutes} min
                    </em>
                  )}
                  {googleRoute?.legs[index] && (
                    <div className="mt-2 rounded-r-lg border-l-[3px] border-[#4386db] bg-[#f1f6fd] p-2.5">
                      <span className="block text-[11px] font-bold text-[#3866b1]">↓ LEG {index + 1}</span>
                      <strong className="mt-0.5 block text-xs text-ink-r">
                        {googleRoute.legs[index].distanceKm} km · {googleRoute.legs[index].trafficMinutes} min with traffic
                      </strong>
                      <small className="text-[10px] text-muted-r">Next: {googleRoute.legs[index].to}</small>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 border-t border-line-r bg-canvas-r p-3 text-xs text-muted-r">
            <span>{googleRoute?.trafficMinutes || operational?.routeMinutes || 0} min driving</span>
            <b className="text-brand-600-r">+</b>
            <span>{operational?.accessMinutes || 0} min access</span>
            <b className="text-brand-600-r">+</b>
            <span>{analysis.intelligence?.estimate.executionMinutes || operational?.handlingMinutes || 0} min phase-based work</span>
            <b className="text-brand-600-r">+</b>
            <span>{analysis.intelligence?.estimate.bufferMinutes || 0} min transparent reserve</span>
            <b className="text-brand-600-r">=</b>
            <strong className="text-ink-r">{totalLow}–{totalHigh} min estimated range</strong>
          </div>
        </Card>
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="flex items-center justify-between gap-4 bg-canvas-r p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-lg-r bg-brand-50-r text-lg text-brand-600-r">⌂</span>
              <div>
                <small className="block text-[9px] font-bold tracking-[0.08em] text-brand-600-r">ON-SITE EXECUTION</small>
                <strong className="mt-0.5 block text-sm text-ink-r">One property · no driving route</strong>
              </div>
            </div>
            <Badge tone="brand">Scope verified</Badge>
          </div>
          <div className="grid gap-3 p-4">
            {routeNodes.map((node, index) => (
              <div key={`${node.location}-${index}`} className="flex gap-3">
                <b className="grid h-7 w-7 flex-none place-items-center rounded-full bg-brand-500-r text-xs font-bold text-white">
                  {index + 1}
                </b>
                <div>
                  <small className="block text-[9px] font-bold text-muted-r">SERVICE LOCATION</small>
                  <strong className="mt-0.5 block text-sm text-ink-r">{node.location}</strong>
                  <ul className="mt-1 list-disc pl-4 text-xs text-muted-r">
                    {(analysis.intelligence?.primitives.map(item => item.label) || node.actions).map(action => (
                      <li key={action}>{action}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 border-t border-line-r bg-canvas-r p-3 text-xs text-muted-r">
            <span>{operational?.accessMinutes || 0} min access adjustment</span>
            <b className="text-brand-600-r">+</b>
            <span>{analysis.intelligence?.estimate.executionMinutes || operational?.handlingMinutes || 0} min phase-based work</span>
            <b className="text-brand-600-r">+</b>
            <span>{analysis.intelligence?.estimate.bufferMinutes || 0} min transparent reserve</span>
            <b className="text-brand-600-r">=</b>
            <strong className="text-ink-r">{totalLow}–{totalHigh} min estimated range</strong>
          </div>
        </Card>
      )}
    </div>
  );
}

function PlanGrid({
  plans,
  selected,
  setSelected,
  analysis,
  requestedSchedule,
  assignmentWindow,
}: {
  plans: PlanOption[];
  selected: PlanKey;
  setSelected: Dispatch<SetStateAction<PlanKey>>;
  analysis: PlannerAnalysis;
  requestedSchedule: string;
  assignmentWindow: (assignment: ServiceAssignment, index: number, count: number) => AssignmentWindow;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {plans.map(plan => {
        const isSelected = selected === plan.key;
        return (
          <button
            key={plan.key}
            onClick={() => setSelected(plan.key)}
            className={`relative rounded-2xl-r border p-5 text-left transition-all ${
              isSelected ? "border-brand-500-r bg-brand-50-r/30 shadow-raised-r" : "border-line-r bg-surface-r shadow-card-r hover:-translate-y-0.5"
            }`}
          >
            {isSelected && (
              <span className="absolute -top-2.5 left-4 rounded px-2 py-1 text-[7px] font-black tracking-[0.11em] text-white" style={{ background: "var(--color-ink-r)" }}>
                SELECTED PLAN
              </span>
            )}
            <Badge tone="brand">{plan.badge}</Badge>
            <h3 className="mt-3 text-lg font-bold text-ink-r">{plan.name}</h3>
            <div className="mt-1 text-xs font-semibold text-brand-600-r">{plan.strategy}</div>
            <div className="mt-2 font-sans-r text-3xl font-extrabold text-ink-r">
              ${plan.price}
              <small className="ml-1 text-xs font-normal text-muted-r">CAD estimate</small>
            </div>

            <div className="mt-3 flex items-center gap-2 border-y border-line-r py-3">
              <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-brand-50-r text-xs font-bold text-brand-600-r">✓</span>
              <div>
                <small className="block text-[8px] font-bold tracking-[0.08em] text-brand-600-r">{plan.formationType.toUpperCase()}</small>
                <strong className="block text-xs text-ink-r">{plan.provider}</strong>
                <em className="text-[10px] not-italic text-muted-r">{plan.providerRating}</em>
              </div>
            </div>

            <div className="mt-3">
              <small className="block text-[9px] font-bold tracking-[0.08em] text-brand-600-r">WHO HANDLES EACH PART</small>
              <div className="mt-1.5 grid gap-2">
                {plan.serviceAssignments.map((assignment, index) => {
                  const window = assignmentWindow(assignment, index, plan.serviceAssignments.length);
                  return (
                    <div key={`${plan.key}-${assignment.title}`}>
                      <b className="block text-[9px] font-bold text-muted-r">
                        {plan.serviceAssignments.length > 1 ? `TEAM ${String.fromCharCode(65 + index)}` : "ONE TEAM"}
                      </b>
                      <strong className="block text-xs text-ink-r">{assignment.executors}</strong>
                      <em className="block text-[10px] not-italic text-muted-r">{assignment.tasks}</em>
                      <small className="block text-[10px] text-subtle-r">
                        {addMinutesToSchedule(requestedSchedule, window.startOffset)} at {window.startLocation} →{" "}
                        {addMinutesToSchedule(requestedSchedule, window.finishOffset)} at {window.finishLocation}
                      </small>
                    </div>
                  );
                })}
              </div>
              {plan.serviceAssignments.length > 1 && (
                <p className="mt-2 text-[10px] text-muted-r">
                  Doneeo releases Team B only after Team A’s delivery is approved. Same order, price and tracker.
                </p>
              )}
            </div>

            <div className="mt-3">
              <small className="block text-[9px] font-bold tracking-[0.08em] text-brand-600-r">ESTIMATED PRICE DECOMPOSITION</small>
              <div className="mt-1.5 grid gap-1">
                {plan.breakdown.map(line => {
                  const [label, value] = line.split(" $");
                  return (
                    <div key={`${plan.key}-${line}`} className="flex justify-between text-[11px] text-muted-r">
                      <span>{label}</span>
                      <strong className="text-ink-r">${value || 0}</strong>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-3 border-t border-line-r pt-2.5">
              <small className="block text-[9px] font-bold tracking-[0.08em] text-brand-600-r">SCREENING / CREDENTIALS</small>
              <strong className="mt-1 block text-xs text-ink-r">{plan.credential}</strong>
            </div>

            <div className="mt-3 grid gap-1.5">
              {plan.teamFormation.map(member => (
                <div key={member.name} className="flex items-center gap-2">
                  <b className="grid h-7 w-7 flex-none place-items-center overflow-hidden rounded-full bg-brand-50-r text-[9px] font-bold text-brand-600-r">
                    {EXECUTOR_PORTRAITS[member.name] ? (
                      <img src={EXECUTOR_PORTRAITS[member.name]} alt={member.name} className="h-full w-full object-cover" />
                    ) : (
                      member.name.slice(0, 1)
                    )}
                  </b>
                  <span>
                    <strong className="block text-xs text-ink-r">{member.name}</strong>
                    <small className="block text-[10px] text-muted-r">{member.role}</small>
                    <em className="block text-[10px] not-italic text-muted-r">{member.rating}</em>
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
              <div>
                <small className="block font-bold text-brand-600-r">TOTAL TIME</small>
                <strong className="block text-ink-r">{plan.duration}</strong>
              </div>
              <div>
                <small className="block font-bold text-brand-600-r">TEAM</small>
                <strong className="block text-ink-r">
                  {plan.teamFormation.length} · {plan.formationType}
                </strong>
              </div>
              <div>
                <small className="block font-bold text-brand-600-r">FREQUENCY</small>
                <strong className="block text-ink-r">
                  {analysis.recurrence.recurring ? analysis.recurrence.frequency : "One-time"}
                </strong>
              </div>
            </div>

            <div className="mt-3">
              <small className="block text-[9px] font-bold tracking-[0.08em] text-brand-600-r">EQUIPMENT AVAILABILITY</small>
              <div className="mt-1.5 grid gap-1.5">
                {plan.equipmentRows.map(row => (
                  <div
                    key={row.name}
                    className={`flex items-center justify-between gap-2 rounded-md-r px-2 py-1.5 text-[10px] ${
                      row.source === "Rental" || row.source === "Purchase" ? "bg-[#fff3e8]" : "bg-canvas-r"
                    }`}
                  >
                    <b className="text-ink-r">{row.name}</b>
                    <em className={`not-italic ${row.source === "Rental" || row.source === "Purchase" ? "font-bold text-[#9c4b22]" : "text-muted-r"}`}>
                      {row.source}
                      {row.cost ? ` · +$${row.cost}` : " · included"}
                    </em>
                  </div>
                ))}
              </div>
            </div>

            <div className={`mt-3 rounded-lg-r p-2.5 ${plan.rentalTotal ? "bg-[#fff3e8]" : "bg-brand-50-r"}`}>
              <small className="block text-[9px] font-bold tracking-[0.08em] text-brand-600-r">RENTAL COORDINATION</small>
              <strong className="mt-0.5 block text-xs text-ink-r">{plan.rentalLogistics}</strong>
              <span className="mt-0.5 block text-[10px] text-muted-r">
                {plan.rentalTotal ? `$${plan.rentalTotal} resource cost · ${plan.rentalMinutes} min sourcing impact` : "No additional rental or purchase cost"}
              </span>
            </div>

            <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-ink-r/80">
              {plan.inclusions.map(item => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <div className="mt-3 border-t border-line-r pt-2.5">
              {plan.breakdown.map(line => {
                const [label, value] = line.split(" $");
                return (
                  <div key={line} className="flex justify-between py-0.5 text-[11px] text-muted-r">
                    <span>{label}</span>
                    <strong className="text-ink-r">{value ? `$${value}` : "Included"}</strong>
                  </div>
                );
              })}
              <div className="mt-1.5 flex justify-between text-sm">
                <span className="text-ink-r">Estimated total</span>
                <strong className="text-ink-r">${plan.price} CAD</strong>
              </div>
            </div>

            <div className="mt-3 rounded-lg-r bg-[#fff3e8] p-2.5">
              <strong className="block text-xs text-[#9c4b22]">Why this option</strong>
              <span className="mt-0.5 block text-[11px] text-[#805338]">{plan.why}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function TransparencyCard({ chosen, selected, hasDrivingRoute }: { chosen: PlanOption | undefined; selected: PlanKey; hasDrivingRoute: boolean }) {
  const score = selected === "recommended" ? 94 : selected === "complete" ? 96 : 82;
  return (
    <Card className="flex items-center justify-between gap-6 bg-canvas-r">
      <div>
        <small className="block text-[9px] font-bold tracking-[0.08em] text-brand-600-r">WHY DONEEO RECOMMENDS THIS MATCH</small>
        <h3 className="mt-1 text-base font-bold text-ink-r">{chosen?.provider}</h3>
        <p className="mt-1.5 max-w-[560px] text-xs leading-relaxed text-muted-r">
          Selected from a simulated database of individual executors and established teams. Ranked job-fit
          first—not highest price: <strong className="text-ink-r">35% expertise and task history</strong>,{" "}
          <strong className="text-ink-r">25% {hasDrivingRoute ? "equipment and vehicle" : "equipment"} coverage</strong>,{" "}
          <strong className="text-ink-r">20% rating and reliability</strong>, <strong className="text-ink-r">10% availability</strong>,
          and <strong className="text-ink-r">10% total customer cost</strong>. If no complete team is available, Doneeo combines
          compatible solo executors, assigns one lead, and verifies that their combined skills and equipment cover the full work order.
        </p>
      </div>
      <div className="grid h-20 w-20 flex-none place-items-center rounded-full border-[6px] border-brand-500-r text-center">
        <span className="text-xl font-extrabold text-brand-600-r">
          {score}
          <br />
          <small className="text-[8px] font-normal">/100 fit</small>
        </span>
      </div>
    </Card>
  );
}

function ExecutionSummary({
  requestedSchedule,
  scheduleWindow,
  completionDeadline,
  plannedExecutionMinutes,
  totalLow,
  totalHigh,
  deadlineFeasible,
  deadlineMargin,
  billablePreparation,
  executionTimeline,
  hasDrivingRoute,
}: {
  requestedSchedule: string;
  scheduleWindow: ScheduleWindow | null;
  completionDeadline: string;
  plannedExecutionMinutes: number;
  totalLow: number;
  totalHigh: number;
  deadlineFeasible: boolean | null;
  deadlineMargin: number | null;
  billablePreparation: PreparationStep[];
  executionTimeline: ExecutionStep[];
  hasDrivingRoute: boolean;
}) {
  return (
    <Card>
      <SectionHead
        eyebrow="EXECUTION PLAN · BEFORE PAYMENT"
        title={`Arrive ${requestedSchedule}${scheduleWindow?.deadlineTime ? ` · complete before ${completionDeadline}` : " · completion time estimated below"}`}
        badge="Included with selected offer"
      />
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <small className="block text-[8px] font-bold tracking-[0.08em] text-brand-600-r">PLANNED ARRIVAL</small>
          <strong className="mt-1 block text-sm text-ink-r">{addMinutesToSchedule(requestedSchedule, 0)}</strong>
        </div>
        <div>
          <small className="block text-[8px] font-bold tracking-[0.08em] text-brand-600-r">LIKELY COMPLETION</small>
          <strong className="mt-1 block text-sm text-ink-r">{addMinutesToSchedule(requestedSchedule, plannedExecutionMinutes)}</strong>
        </div>
        <div>
          <small className="block text-[8px] font-bold tracking-[0.08em] text-brand-600-r">CUSTOMER DEADLINE</small>
          <strong className="mt-1 block text-sm text-ink-r">{scheduleWindow?.deadlineTime || "Not fixed"}</strong>
        </div>
        <div>
          <small className="block text-[8px] font-bold tracking-[0.08em] text-brand-600-r">ESTIMATED RANGE</small>
          <strong className="mt-1 block text-sm text-ink-r">{totalLow}–{totalHigh} min</strong>
        </div>
      </div>

      {deadlineFeasible !== null && (
        <div className={`mt-3 rounded-lg-r p-3 ${deadlineFeasible ? "bg-brand-50-r" : "bg-[#ffe9e6]"}`}>
          <strong className={`block text-xs ${deadlineFeasible ? "text-brand-600-r" : "text-[#9f2f25]"}`}>
            {deadlineFeasible ? "✓ Likely plan fits the customer deadline" : "! Current likely plan misses the customer deadline"}
          </strong>
          <span className="mt-1 block text-xs text-muted-r">
            {deadlineFeasible
              ? `${deadlineMargin} minutes of planned margin before ${scheduleWindow?.deadlineTime}.`
              : `The likely estimate is ${Math.abs(deadlineMargin || 0)} minutes late. Doneeo must offer a faster eligible team or a different schedule before payment.`}
          </span>
        </div>
      )}

      {billablePreparation.length > 0 && (
        <div className="mt-3 rounded-lg-r border border-line-r p-3">
          <small className="block text-[9px] font-bold tracking-[0.08em] text-brand-600-r">BEFORE ARRIVAL · EXECUTOR PREPARATION</small>
          <strong className="mt-1 block text-xs text-ink-r">
            {scheduleWindow?.preparationStartTime
              ? `Starts ${scheduleWindow.preparationStartTime} so your arrival stays ${scheduleWindow.arrivalTime}`
              : "Scheduled before your arrival time"}
          </strong>
          <div className="mt-2 grid gap-1.5">
            {billablePreparation.map((step, index) => (
              <div key={`${step.step}-${index}`} className="flex gap-2">
                <b className="grid h-6 w-6 flex-none place-items-center rounded-full bg-brand-50-r text-[10px] font-bold text-brand-600-r">
                  {step.kind === "rental" ? "R" : step.kind === "materials" ? "M" : "E"}
                </b>
                <span>
                  <strong className="block text-xs text-ink-r">{step.step}</strong>
                  <small className="block text-[10px] text-muted-r">
                    {step.kind === "rental" ? "Rental pickup you requested" : step.kind === "materials" ? "Materials purchase you requested" : "Equipment collection"} ·{" "}
                    {step.durationMinutes} min
                  </small>
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-muted-r">Happens before your appointment. Your arrival time is unchanged.</p>
        </div>
      )}

      <div className="mt-3 grid gap-0">
        {executionTimeline.map((step, index) => (
          <div key={`${step.title}-${index}`} className={`flex gap-3 py-2.5 ${step.isGate ? "border-l-2 border-brand-500-r pl-2" : ""}`}>
            <b className="grid h-7 w-7 flex-none place-items-center rounded-full bg-brand-500-r text-xs font-bold text-white">{index + 1}</b>
            <div>
              {step.taskSequence ? (
                <em className="block text-[9px] font-bold not-italic text-brand-600-r">
                  TASK {step.taskSequence} · {step.taskTitle}
                </em>
              ) : null}
              <strong className="block text-sm text-ink-r">{step.title}</strong>
              <p className="mt-0.5 text-xs text-muted-r">{step.description}</p>
              <small className="mt-0.5 block text-[10px] text-subtle-r">
                {addMinutesToSchedule(requestedSchedule, step.startOffset)} → {addMinutesToSchedule(requestedSchedule, step.finishOffset)} · likely{" "}
                {step.minutes} min · range {step.lowMinutes}–{step.highMinutes} min · {step.qualification}
              </small>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 rounded-lg-r bg-canvas-r p-3 text-[11px] leading-relaxed text-muted-r">
        This is an operational estimate, not a guaranteed completion time. Every phase uses a low, likely and high
        duration. {hasDrivingRoute ? "Traffic, " : ""}access, product fit, site conditions, parts, drying or test
        cycles, recipient readiness and unexpected execution problems can change individual milestones and the final
        completion time.
      </p>
    </Card>
  );
}

function CustomerJourneyPlan({
  chosen,
  analysis,
  routeNodes,
  requestedSchedule,
  plannedExecutionMinutes,
  finalTotal,
  protectionCost,
  assignmentWindow,
  resourcesApproved,
  resourcesRequiringApproval,
  resourceApprovalKey,
  resourceTask,
  answers,
  setAnswers,
  billablePreparation,
  executionTimeline,
}: {
  chosen: PlanOption;
  analysis: PlannerAnalysis;
  routeNodes: RouteNode[];
  requestedSchedule: string;
  plannedExecutionMinutes: number;
  finalTotal: number;
  protectionCost: number;
  assignmentWindow: (assignment: ServiceAssignment, index: number, count: number) => AssignmentWindow;
  resourcesApproved: boolean;
  resourcesRequiringApproval: PlanOption["equipmentRows"];
  resourceApprovalKey: (name: string) => string;
  resourceTask: (name: string) => { sequence: number; title: string };
  answers: Answers;
  setAnswers: Dispatch<SetStateAction<Answers>>;
  billablePreparation: PreparationStep[];
  executionTimeline: ExecutionStep[];
}) {
  const split = chosen.serviceAssignments.length > 1;
  return (
    <Card raised>
      <div className="flex items-start justify-between gap-4">
        <div>
          <small className="block text-[9px] font-bold tracking-[0.1em] text-brand-600-r">YOUR CONNECTED PLAN · BEFORE PAYMENT</small>
          <h3 className="mt-1 text-lg font-bold text-ink-r">
            {chosen.name} · {chosen.fulfillmentLabel}
          </h3>
          <p className="mt-1 max-w-[520px] text-xs text-muted-r">
            This is the exact plan that continues after payment. One reference, one price and one tracker—no need
            to return to an earlier page.
          </p>
        </div>
        <Badge tone="brand">Selected · ${finalTotal} CAD</Badge>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-r">
        <b className="text-ink-r">ONE WORK ORDER</b>
        <span>Request confirmed</span>
        <i className="text-brand-500-r">→</i>
        <span>Resources approved</span>
        <i className="text-brand-500-r">→</i>
        <span>{split ? "Team A executes" : "Team executes"}</span>
        <i className="text-brand-500-r">→</i>
        {split && (
          <>
            <span>Doneeo handoff</span>
            <i className="text-brand-500-r">→</i>
            <span>Team B executes</span>
            <i className="text-brand-500-r">→</i>
          </>
        )}
        <span>Customer approves</span>
        <i className="text-brand-500-r">→</i>
        <span>Completion report</span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div>
          <small className="block text-[9px] font-bold tracking-[0.08em] text-brand-600-r">START</small>
          <strong className="mt-1 block text-sm text-ink-r">{routeNodes[0]?.location}</strong>
          <span className="text-xs text-muted-r">{requestedSchedule}</span>
        </div>
        <div>
          <small className="block text-[9px] font-bold tracking-[0.08em] text-brand-600-r">FINISH</small>
          <strong className="mt-1 block text-sm text-ink-r">{routeNodes.at(-1)?.location}</strong>
          <span className="text-xs text-muted-r">{addMinutesToSchedule(requestedSchedule, plannedExecutionMinutes)} likely</span>
        </div>
        <div>
          <small className="block text-[9px] font-bold tracking-[0.08em] text-brand-600-r">TEAM MODEL</small>
          <strong className="mt-1 block text-sm text-ink-r">{split ? "Specialist handoff" : "Same team throughout"}</strong>
          <span className="text-xs text-muted-r">{split ? "Doneeo coordinates the transition" : "No executor change"}</span>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        {chosen.serviceAssignments.map((assignment, index) => {
          const window = assignmentWindow(assignment, index, chosen.serviceAssignments.length);
          return (
            <div key={assignment.title}>
              <div className="rounded-lg-r border border-line-r p-3">
                <b className="block text-[9px] font-bold text-brand-600-r">
                  {split ? `TEAM ${String.fromCharCode(65 + index)}` : "ONE TEAM"}
                </b>
                <small className="block text-[10px] text-muted-r">{assignment.tasks}</small>
                <h4 className="mt-1 text-sm font-bold text-ink-r">{assignment.title}</h4>
                <strong className="block text-xs text-ink-r">{assignment.executors}</strong>
                <span className="mt-1 block text-[10px] text-muted-r">
                  START · {addMinutesToSchedule(requestedSchedule, window.startOffset)} at {window.startLocation}
                </span>
                <span className="block text-[10px] text-muted-r">
                  FINISH · {addMinutesToSchedule(requestedSchedule, window.finishOffset)} at {window.finishLocation}
                </span>
                <span className="block text-[10px] text-muted-r">RESPONSIBILITY · {assignment.handoff}</span>
              </div>
              {index < chosen.serviceAssignments.length - 1 && (
                <div className="my-2 rounded-lg-r bg-canvas-r p-3">
                  <b className="block text-[10px] font-bold text-ink-r">
                    FULL STOP · {addMinutesToSchedule(requestedSchedule, window.finishOffset)}
                  </b>
                  <strong className="mt-1 block text-xs text-ink-r">Team A finishes and leaves</strong>
                  <span className="mt-0.5 block text-[10px] text-muted-r">Delivery approval → Doneeo releases Team B → Team B takes over</span>
                  <small className="mt-1 block text-[10px] text-subtle-r">No customer rematching, second payment or separate order.</small>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between">
          <small className="text-[9px] font-bold tracking-[0.08em] text-brand-600-r">WHO DOES WHAT · IN THE ORDER IT HAPPENS</small>
          <strong className="text-xs text-ink-r">{analysis.tasks.length} requested tasks, all preserved</strong>
        </div>
        <div className="mt-2 grid gap-2">
          {analysis.tasks.map((task, index) => {
            const assignment = serviceForTask(chosen.serviceAssignments, index + 1);
            return (
              <div key={`${task}-${index}`} className="flex gap-3 rounded-lg-r border border-line-r p-2.5">
                <b className="grid h-6 w-6 flex-none place-items-center rounded-full bg-canvas-r text-[10px] font-bold text-ink-r">
                  {index + 1}
                </b>
                <div>
                  <small className="block text-[9px] font-bold text-brand-600-r">{assignment?.title || "Assigned team"}</small>
                  <strong className="block text-xs text-ink-r">{task}</strong>
                  <span className="block text-[10px] text-muted-r">{assignment?.executors}</span>
                  <em className="block text-[10px] not-italic text-muted-r">
                    {index < analysis.tasks.length - 1 ? `Complete and approve before Task ${index + 2}` : "Final approval creates the completion report"}
                  </em>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between">
          <small className="text-[9px] font-bold tracking-[0.08em] text-brand-600-r">CONNECTED LOCATION PATH</small>
          <strong className="text-xs text-ink-r">
            {routeNodes.length} location{routeNodes.length === 1 ? "" : "s"}
          </strong>
        </div>
        <div className="mt-2 grid gap-2">
          {routeNodes.map((node, index) => (
            <div key={`${node.location}-journey`} className="flex gap-3">
              <b className="grid h-6 w-6 flex-none place-items-center rounded-full bg-canvas-r text-[10px] font-bold text-ink-r">{index + 1}</b>
              <div>
                <strong className="block text-xs text-ink-r">{node.location}</strong>
                <span className="block text-[10px] text-muted-r">{node.actions.join(" · ")}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-2xl-r border border-line-r p-4">
        <div className="flex items-baseline justify-between">
          <small className="text-[9px] font-bold tracking-[0.08em] text-brand-600-r">TOOLS & MATERIALS · CONFIRMATION AND ORDERING</small>
          <strong className="text-xs text-ink-r">
            {resourcesApproved
              ? "Ready for plan confirmation"
              : `${resourcesRequiringApproval.filter(row => answers[resourceApprovalKey(row.name)] !== true).length} approval needed`}
          </strong>
        </div>
        <p className="mt-1.5 text-[11px] text-muted-r">
          Every resource is tied to the task and team that uses it. Provider-owned items are verified automatically;
          Doneeo books rentals or purchases only after your approval.
        </p>
        <div className="mt-3 grid gap-2">
          {chosen.equipmentRows.length ? (
            chosen.equipmentRows.map(row => {
              const task = resourceTask(row.name);
              const team = serviceForTask(chosen.serviceAssignments, task.sequence);
              const approvalRequired = row.source === "Rental" || row.source === "Purchase";
              const approved = !approvalRequired || answers[resourceApprovalKey(row.name)] === true;
              return (
                <div
                  key={`${row.name}-resolution`}
                  className={`grid gap-2 rounded-lg-r border p-3 sm:grid-cols-3 sm:items-center ${
                    approved ? "border-brand-200-r bg-brand-50-r/40" : "border-[#efc9a7] bg-[#fff9f2]"
                  }`}
                >
                  <div>
                    <small className="block text-[9px] font-bold text-brand-600-r">
                      TASK {task.sequence} · {team?.title}
                    </small>
                    <strong className="mt-0.5 block text-xs text-ink-r">{row.name}</strong>
                    <span className="block text-[10px] text-muted-r">{team?.executors}</span>
                  </div>
                  <div>
                    <small className="block text-[9px] font-bold text-brand-600-r">HOW IT IS SUPPLIED</small>
                    <strong className="mt-0.5 block text-xs text-ink-r">
                      {row.source}
                      {row.cost ? ` · $${row.cost}` : " · included"}
                    </strong>
                    <span className="block text-[10px] text-muted-r">{row.availability}</span>
                  </div>
                  <div>
                    <small className="block text-[9px] font-bold text-brand-600-r">ORDER STATUS</small>
                    {approvalRequired ? (
                      <button
                        onClick={() => setAnswers(current => ({ ...current, [resourceApprovalKey(row.name)]: true }))}
                        className={`mt-1 rounded-lg-r border px-3 py-2 text-xs font-semibold ${
                          approved ? "border-brand-500-r bg-brand-50-r text-brand-600-r" : "border-line-r bg-surface-r text-ink-r"
                        }`}
                      >
                        {approved ? "✓ Approved · Doneeo will arrange" : `Approve ${row.source.toLowerCase()} · $${row.cost}`}
                      </button>
                    ) : (
                      <strong className="mt-1 block text-xs text-brand-600-r">
                        ✓ {row.source === "Provider" ? "Provider inventory verified" : "Customer supply confirmed"}
                      </strong>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-lg-r bg-brand-50-r p-3">
              <strong className="block text-xs text-brand-600-r">✓ No additional tools or materials identified</strong>
              <span className="mt-0.5 block text-[11px] text-muted-r">The selected team still completes a readiness check before departure.</span>
            </div>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-r">
          <span>
            <b className="text-ink-r">1</b> Customer approves gaps
          </span>
          <i className="text-brand-500-r">→</i>
          <span>
            <b className="text-ink-r">2</b> Doneeo reserves or orders
          </span>
          <i className="text-brand-500-r">→</i>
          <span>
            <b className="text-ink-r">3</b> Team confirms loaded
          </span>
          <i className="text-brand-500-r">→</i>
          <span>
            <b className="text-ink-r">4</b> Departure released
          </span>
        </div>
      </div>

      <div className="mt-4 rounded-2xl-r bg-canvas-r p-4">
        <div className="flex items-baseline justify-between">
          <small className="text-[9px] font-bold tracking-[0.08em] text-brand-600-r">COMPLETE PRICE · SAME WORK ORDER</small>
          <strong className="text-sm text-ink-r">${finalTotal} CAD estimated total</strong>
        </div>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            {chosen.serviceAssignments.map((assignment, index) => {
              const window = assignmentWindow(assignment, index, chosen.serviceAssignments.length);
              return (
                <div key={`${assignment.title}-price`} className="mb-2">
                  <b className="block text-[9px] font-bold text-brand-600-r">
                    {chosen.serviceAssignments.length > 1 ? `TEAM ${String.fromCharCode(65 + index)}` : "ONE TEAM"}
                  </b>
                  <strong className="block text-xs text-ink-r">{assignment.executors}</strong>
                  <span className="block text-[10px] text-muted-r">
                    {assignment.tasks} · {addMinutesToSchedule(requestedSchedule, window.startOffset)}–
                    {addMinutesToSchedule(requestedSchedule, window.finishOffset)}
                  </span>
                </div>
              );
            })}
            <p className="mt-1 text-[10px] text-muted-r">
              {chosen.serviceAssignments.length > 1
                ? "Doneeo coordinates the team transition, shared evidence and second-team release inside this price."
                : "One lead remains responsible from the first location through final approval."}
            </p>
          </div>
          <div>
            {chosen.breakdown.map(line => {
              const [label, value] = line.split(" $");
              return (
                <div key={`${line}-contract`} className="flex justify-between py-0.5 text-xs text-muted-r">
                  <span>{label}</span>
                  <strong className="text-ink-r">${value || 0}</strong>
                </div>
              );
            })}
            <div className="flex justify-between py-0.5 text-xs text-muted-r">
              <span>Optional protection</span>
              <strong className="text-ink-r">${protectionCost}</strong>
            </div>
            <div className="mt-1 flex justify-between border-t border-line-r pt-2 text-sm">
              <span className="text-ink-r">Estimated total</span>
              <strong className="text-ink-r">${finalTotal} CAD</strong>
            </div>
          </div>
        </div>
      </div>

      <details className="mt-4 border-t border-line-r pt-3">
        <summary className="cursor-pointer text-xs font-bold text-brand-600-r">See exact step-by-step timing and completion gates</summary>
        {billablePreparation.length > 0 && (
          <div className="mt-3 rounded-lg-r border border-line-r p-3">
            <small className="block text-[9px] font-bold tracking-[0.08em] text-brand-600-r">BEFORE ARRIVAL · EXECUTOR PREPARATION</small>
            <div className="mt-2 grid gap-1.5">
              {billablePreparation.map((step, index) => (
                <div key={`${step.step}-${index}`} className="flex gap-2">
                  <b className="grid h-6 w-6 flex-none place-items-center rounded-full bg-brand-50-r text-[10px] font-bold text-brand-600-r">
                    {step.kind === "rental" ? "R" : step.kind === "materials" ? "M" : "E"}
                  </b>
                  <span>
                    <strong className="block text-xs text-ink-r">{step.step}</strong>
                    <small className="block text-[10px] text-muted-r">
                      {step.kind === "rental" ? "Rental pickup you requested" : step.kind === "materials" ? "Materials purchase you requested" : "Equipment collection"} ·{" "}
                      {step.durationMinutes} min
                    </small>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="mt-2 grid gap-0">
          {executionTimeline.map((step, index) => (
            <div key={`${step.title}-connected-${index}`} className="flex gap-3 py-2">
              <b className="grid h-6 w-6 flex-none place-items-center rounded-full bg-brand-500-r text-[10px] font-bold text-white">{index + 1}</b>
              <div>
                {step.taskSequence ? (
                  <em className="block text-[9px] font-bold not-italic text-brand-600-r">
                    TASK {step.taskSequence} · {step.taskTitle}
                  </em>
                ) : null}
                <strong className="block text-xs text-ink-r">{step.title}</strong>
                <p className="mt-0.5 text-[11px] text-muted-r">{step.description}</p>
                <small className="mt-0.5 block text-[10px] text-subtle-r">
                  {addMinutesToSchedule(requestedSchedule, step.startOffset)} → {addMinutesToSchedule(requestedSchedule, step.finishOffset)} · likely {step.minutes}{" "}
                  min · range {step.lowMinutes}–{step.highMinutes} min
                </small>
              </div>
            </div>
          ))}
        </div>
      </details>
    </Card>
  );
}

function ProtectionCard({ protection, setProtection }: { protection: "none" | "standard"; setProtection: Dispatch<SetStateAction<"none" | "standard">> }) {
  return (
    <Card className="flex items-start gap-4">
      <span className="grid h-10 w-10 flex-none place-items-center rounded-xl-r bg-brand-50-r text-xl text-brand-600-r">◇</span>
      <div className="flex-1">
        <small className="block text-[9px] font-bold tracking-[0.08em] text-brand-600-r">OPTIONAL SERVICE PROTECTION</small>
        <h3 className="mt-1 text-sm font-bold text-ink-r">Protection for accidental damage</h3>
        <p className="mt-1 text-xs text-muted-r">
          A future licensed partner could cover eligible accidental damage during the service, subject to terms,
          limits, exclusions and a claims review.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => setProtection("none")}
            className={`flex justify-between rounded-lg-r border p-3 text-sm ${
              protection === "none" ? "border-brand-500-r bg-brand-50-r text-brand-600-r" : "border-line-r text-ink-r"
            }`}
          >
            <strong>No protection</strong>
            <span>$0</span>
          </button>
          <button
            onClick={() => setProtection("standard")}
            className={`flex justify-between rounded-lg-r border p-3 text-sm ${
              protection === "standard" ? "border-brand-500-r bg-brand-50-r text-brand-600-r" : "border-line-r text-ink-r"
            }`}
          >
            <strong>Standard protection</strong>
            <span>+$15 estimate</span>
          </button>
        </div>
        <small className="mt-2 block text-[9px] text-subtle-r">
          Prototype only—not an insurance policy or offer. Launch requires a licensed insurance partner and approved terms.
        </small>
      </div>
    </Card>
  );
}

function StopCoordination({
  routeNodes,
  answers,
  setAnswers,
}: {
  routeNodes: RouteNode[];
  answers: Answers;
  setAnswers: Dispatch<SetStateAction<Answers>>;
}) {
  return (
    <Card>
      <SectionHead eyebrow="FINAL COORDINATION · AFTER PLAN CONFIRMATION" title="Who receives the service at each stop?" badge="Private by default" />
      <p className="mt-2 text-xs leading-relaxed text-muted-r">
        The requester does not have to be present. Add a recipient, building contact, family member, business, pickup
        contact or any other person involved at each location. Each contact receives only the part of the plan needed
        for their stop unless you explicitly allow more.
      </p>
      <div className="mt-3 grid gap-3">
        {routeNodes.map((node, index) => {
          const invited = answers[`stop_contact_${index + 1}_invite`] === true;
          return (
            <div key={`${node.location}-contact`} className="rounded-lg-r border border-line-r bg-canvas-r/40 p-4">
              <div className="flex items-center gap-3">
                <b className="grid h-7 w-7 flex-none place-items-center rounded-full bg-brand-500-r text-xs font-bold text-white">{index + 1}</b>
                <span>
                  <small className="block text-[9px] font-bold text-brand-600-r">STOP {index + 1}</small>
                  <strong className="block text-sm text-ink-r">{node.location}</strong>
                  <em className="block text-[10px] not-italic text-muted-r">{node.actions.join(" · ")}</em>
                </span>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <label className="block rounded-lg-r border border-line-r bg-surface-r p-3">
                  <span className="block text-[10px] font-bold uppercase tracking-wide text-brand-600-r">Contact or recipient name</span>
                  <input
                    value={String(answers[`stop_contact_${index + 1}_name`] || "")}
                    onChange={event => setAnswers(current => ({ ...current, [`stop_contact_${index + 1}_name`]: event.target.value }))}
                    placeholder="Person or organization"
                    className="mt-1 w-full border-0 bg-transparent text-sm text-ink-r outline-none"
                  />
                </label>
                <label className="block rounded-lg-r border border-line-r bg-surface-r p-3">
                  <span className="block text-[10px] font-bold uppercase tracking-wide text-brand-600-r">Phone</span>
                  <input
                    inputMode="tel"
                    value={String(answers[`stop_contact_${index + 1}_phone`] || "")}
                    onChange={event => setAnswers(current => ({ ...current, [`stop_contact_${index + 1}_phone`]: event.target.value }))}
                    placeholder="Test number"
                    className="mt-1 w-full border-0 bg-transparent text-sm text-ink-r outline-none"
                  />
                </label>
              </div>
              <button
                onClick={() =>
                  setAnswers(current => ({ ...current, [`stop_contact_${index + 1}_invite`]: current[`stop_contact_${index + 1}_invite`] !== true }))
                }
                className={`mt-3 flex w-full items-center gap-3 rounded-lg-r border p-3 text-left ${
                  invited ? "border-brand-500-r bg-brand-50-r" : "border-line-r bg-surface-r"
                }`}
              >
                <span className={`grid h-7 w-7 flex-none place-items-center rounded-full text-xs font-bold ${invited ? "bg-brand-500-r text-white" : "bg-canvas-r text-muted-r"}`}>
                  {invited ? "✓" : "+"}
                </span>
                <span>
                  <strong className="block text-xs text-ink-r">Share the limited Stop {index + 1} plan</strong>
                  <small className="block text-[10px] text-muted-r">
                    Can view timing, assigned provider, arrival, actions and validation for this stop only. Cannot view
                    price, other contacts or unrelated stops.
                  </small>
                </span>
              </button>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[9px] text-subtle-r">
        Test contacts only. Secure links, consent, verified messaging and configurable permissions are required for production.
      </p>
    </Card>
  );
}

export function MatchingScreen({
  analysis,
  setStage,
  selected,
  setSelected,
  chosen,
  plans,
  providerClassLabel,
  serviceLocation,
  exactRouteAddresses,
  googleRoute,
  calculateGoogleRoute,
  googleMapsUrl,
  routeState,
  operational,
  hasDrivingRoute,
  routeStops,
  routeNodes,
  totalLow,
  totalHigh,
  assignmentWindow,
  requestedSchedule,
  scheduleWindow,
  completionDeadline,
  deadlineFeasible,
  deadlineMargin,
  billablePreparation,
  executionTimeline,
  plannedExecutionMinutes,
  finalTotal,
  protectionCost,
  protection,
  setProtection,
  resourcesApproved,
  resourcesRequiringApproval,
  resourceApprovalKey,
  resourceTask,
  answers,
  setAnswers,
  setProviderStatus,
  setActiveCheckpoint,
}: {
  analysis: PlannerAnalysis;
  setStage: (stage: number) => void;
  selected: PlanKey;
  setSelected: Dispatch<SetStateAction<PlanKey>>;
  chosen: PlanOption | undefined;
  plans: PlanOption[];
  providerClassLabel: string;
  serviceLocation: string;
  exactRouteAddresses: string[];
  googleRoute: GoogleRoute | null;
  calculateGoogleRoute: (addresses?: string[]) => void | Promise<void>;
  googleMapsUrl: string;
  routeState: "idle" | "loading" | "ready" | "error";
  operational: Operational | null;
  hasDrivingRoute: boolean;
  routeStops: string[];
  routeNodes: RouteNode[];
  totalLow: number;
  totalHigh: number;
  assignmentWindow: (assignment: ServiceAssignment, index: number, count: number) => AssignmentWindow;
  requestedSchedule: string;
  scheduleWindow: ScheduleWindow | null;
  completionDeadline: string;
  deadlineFeasible: boolean | null;
  deadlineMargin: number | null;
  billablePreparation: PreparationStep[];
  executionTimeline: ExecutionStep[];
  plannedExecutionMinutes: number;
  finalTotal: number;
  protectionCost: number;
  protection: "none" | "standard";
  setProtection: Dispatch<SetStateAction<"none" | "standard">>;
  resourcesApproved: boolean;
  resourcesRequiringApproval: PlanOption["equipmentRows"];
  resourceApprovalKey: (name: string) => string;
  resourceTask: (name: string) => { sequence: number; title: string };
  answers: Answers;
  setAnswers: Dispatch<SetStateAction<Answers>>;
  setProviderStatus: (status: "not_sent" | "awaiting" | "accepted") => void;
  setActiveCheckpoint: (checkpoint: number) => void;
}) {
  return (
    <section className="mx-auto max-w-[1040px] px-[6%] pb-16 pt-10">
      <button onClick={() => setStage(1)} className="mb-6 text-sm text-muted-r transition-colors hover:text-ink-r">
        ← Back
      </button>

      <div className="grid gap-5">
        <MatchingIntro selected={selected} />

        {chosen && (
          <Card className="bg-canvas-r">
            <small className="block text-[9px] font-bold tracking-[0.08em] text-brand-600-r">HOW THE SELECTED OPTION WILL BE FULFILLED</small>
            <h3 className="mt-1 text-sm font-bold text-ink-r">{chosen.fulfillmentLabel}</h3>
            <p className="mt-1 text-xs text-muted-r">The customer keeps one Doneeo work order, one combined price and one completion tracker.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {chosen.serviceAssignments.map(assignment => (
                <article key={assignment.title} className="rounded-lg-r border border-line-r bg-surface-r p-3">
                  <strong className="block text-xs text-ink-r">{assignment.title}</strong>
                  <span className="mt-0.5 block text-[10px] text-muted-r">
                    {assignment.executors} · {assignment.tasks}
                  </span>
                  <small className="mt-0.5 block text-[10px] text-subtle-r">{assignment.handoff}</small>
                </article>
              ))}
            </div>
          </Card>
        )}

        <div className="grid grid-cols-3 divide-x divide-line-r rounded-2xl-r border border-line-r bg-canvas-r">
          <div className="p-4">
            <small className="block text-[9px] font-bold tracking-[0.08em] text-brand-600-r">JOB TYPE</small>
            <strong className="mt-1 block text-sm text-ink-r">{analysis.title}</strong>
          </div>
          <div className="p-4">
            <small className="block text-[9px] font-bold tracking-[0.08em] text-brand-600-r">RULES-GATE ELIGIBILITY</small>
            <strong className="mt-1 block text-sm text-ink-r">{providerClassLabel}</strong>
          </div>
          <div className="p-4">
            <small className="block text-[9px] font-bold tracking-[0.08em] text-brand-600-r">LOCATION</small>
            <strong className="mt-1 block text-sm text-ink-r">{serviceLocation}</strong>
          </div>
        </div>

        <IntelligenceWorkbench analysis={analysis} />

        <RouteSection
          exactRouteAddresses={exactRouteAddresses}
          googleRoute={googleRoute}
          calculateGoogleRoute={calculateGoogleRoute}
          googleMapsUrl={googleMapsUrl}
          routeState={routeState}
          operational={operational}
          hasDrivingRoute={hasDrivingRoute}
          analysis={analysis}
          routeStops={routeStops}
          routeNodes={routeNodes}
          totalLow={totalLow}
          totalHigh={totalHigh}
        />

        <PlanGrid
          plans={plans}
          selected={selected}
          setSelected={setSelected}
          analysis={analysis}
          requestedSchedule={requestedSchedule}
          assignmentWindow={assignmentWindow}
        />

        <TransparencyCard chosen={chosen} selected={selected} hasDrivingRoute={hasDrivingRoute} />

        <ExecutionSummary
          requestedSchedule={requestedSchedule}
          scheduleWindow={scheduleWindow}
          completionDeadline={completionDeadline}
          plannedExecutionMinutes={plannedExecutionMinutes}
          totalLow={totalLow}
          totalHigh={totalHigh}
          deadlineFeasible={deadlineFeasible}
          deadlineMargin={deadlineMargin}
          billablePreparation={billablePreparation}
          executionTimeline={executionTimeline}
          hasDrivingRoute={hasDrivingRoute}
        />

        {chosen && (
          <CustomerJourneyPlan
            chosen={chosen}
            analysis={analysis}
            routeNodes={routeNodes}
            requestedSchedule={requestedSchedule}
            plannedExecutionMinutes={plannedExecutionMinutes}
            finalTotal={finalTotal}
            protectionCost={protectionCost}
            assignmentWindow={assignmentWindow}
            resourcesApproved={resourcesApproved}
            resourcesRequiringApproval={resourcesRequiringApproval}
            resourceApprovalKey={resourceApprovalKey}
            resourceTask={resourceTask}
            answers={answers}
            setAnswers={setAnswers}
            billablePreparation={billablePreparation}
            executionTimeline={executionTimeline}
          />
        )}

        <ProtectionCard protection={protection} setProtection={setProtection} />
        <StopCoordination routeNodes={routeNodes} answers={answers} setAnswers={setAnswers} />

        <Button
          variant="primary"
          size="lg"
          disabled={!resourcesApproved}
          onClick={() => {
            if (!resourcesApproved) return;
            setProviderStatus("not_sent");
            setActiveCheckpoint(0);
            setStage(3);
          }}
        >
          {resourcesApproved ? `Confirm complete work order · $${finalTotal}` : "Approve rental and purchase items to continue"}
          <span aria-hidden="true">→</span>
        </Button>
      </div>
    </section>
  );
}
