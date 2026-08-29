// New for the frontend redesign. Stage 1 — Doneeo's understanding of the
// request, the rules gate, and the adaptive question flow. Presentation-only:
// every value/handler below is computed in page.tsx exactly as before and
// passed straight through. Split into small internal sections rather than one
// slab, per the plan — none of these are reused outside this screen so they
// stay unexported in this file rather than becoming their own modules.
import type { Dispatch, SetStateAction } from "react";
import type { JobIntelligence, PlannerAnalysis, PlannerQuestion } from "../../lib/planner";
import type { Answers } from "../_domain/plan-types";
import { Question } from "./question";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Disclosure } from "./ui/Disclosure";

type Workstream = JobIntelligence["workstreams"][number];
type GateStatus = "blocked" | "cleared" | "needs_information";

function SectionLabel({ step, title }: { step?: string; title: string }) {
  return (
    <div className="mb-3 flex items-baseline gap-2">
      {step && (
        <span className="text-[10px] font-extrabold tracking-[0.1em] text-brand-600-r">{step}</span>
      )}
      <h3 className="text-base font-bold text-ink-r">{title}</h3>
    </div>
  );
}

function AnalysisIntro({ analysis }: { analysis: PlannerAnalysis }) {
  return (
    <div className="flex items-start gap-4">
      <img
        src="/brand/ai-engine.png"
        alt="Doneeo AI matching engine"
        className="mt-0.5 h-12 w-12 flex-none rounded-2xl-r bg-brand-50-r object-contain p-2"
      />
      <div>
        <div className="text-xs font-bold tracking-[0.17em] text-brand-600-r">
          DONEEO UNDERSTOOD THE REQUEST
        </div>
        <h2 className="mt-1 text-[clamp(26px,4vw,36px)] font-extrabold leading-tight text-ink-r">
          {analysis.title}
        </h2>
      </div>
    </div>
  );
}

function AuditCard({ audit }: { audit: PlannerAnalysis["audit"] }) {
  const corrected = audit.status === "corrected";
  return (
    <Card
      className={corrected ? "border-[#efc5a8] bg-[#fff8f2]" : "border-brand-200-r bg-brand-50-r"}
    >
      <div className="flex items-start gap-3">
        <span
          className={`grid h-9 w-9 flex-none place-items-center rounded-full text-white ${
            corrected ? "bg-accent-r" : "bg-brand-500-r"
          }`}
        >
          {corrected ? "↻" : "✓"}
        </span>
        <div>
          <small className="block text-[9px] font-bold tracking-[0.1em] text-brand-600-r">
            {audit.pipeline || "PLANNER AGENT → INDEPENDENT VALIDATOR → RULES GATE"}
          </small>
          <strong className="mt-1 block text-sm text-ink-r">
            {corrected
              ? "Questions corrected before display"
              : audit.status === "verified"
                ? "Every question verified before display"
                : "Deterministic validation completed"}
          </strong>
          <p className="mt-1.5 text-xs text-muted-r">{audit.checks.join(" · ")}</p>
          {audit.issues.length > 0 && (
            <em className="mt-1.5 block text-xs not-italic text-[#9c4b22]">
              {audit.issues.join("; ")}
            </em>
          )}
        </div>
      </div>
    </Card>
  );
}

function RulesGatePanel({
  analysis,
  liveGateStatus,
  hasDrivingRoute,
  providerClassLabel,
}: {
  analysis: PlannerAnalysis;
  liveGateStatus: GateStatus;
  hasDrivingRoute: boolean;
  providerClassLabel: string;
}) {
  const gate = analysis.rulesGate;
  if (!gate) return null;
  const tone = liveGateStatus === "blocked" ? "danger" : liveGateStatus === "cleared" ? "brand" : "warning";
  return (
    <Disclosure
      defaultOpen={liveGateStatus === "blocked"}
      summary={
        <span className="flex flex-1 items-center justify-between gap-3">
          <span>
            <small className="block text-[9px] font-bold tracking-[0.1em] text-muted-r">
              DONEEO RULES GATE · {gate.version}
            </small>
            <span className="mt-0.5 block text-sm font-bold text-ink-r">
              {liveGateStatus === "blocked"
                ? "Matching stopped"
                : liveGateStatus === "cleared"
                  ? "Intake gate cleared"
                  : "Resolve required details before matching"}
            </span>
          </span>
          <Badge tone={tone}>
            {liveGateStatus === "blocked" ? "BLOCKED" : liveGateStatus === "cleared" ? "CLEARED" : "COLLECTING"}
          </Badge>
        </span>
      }
    >
      <p className="text-xs leading-relaxed text-muted-r">
        {liveGateStatus === "cleared"
          ? `All required customer facts are complete. Doneeo may now calculate ${hasDrivingRoute ? "route, " : ""}time, price, provider equipment coverage and matching options.`
          : gate.summary}
      </p>

      <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-lg-r border border-line-r bg-line-r">
        <div className="bg-surface-r p-3">
          <small className="block text-[8px] font-bold tracking-[0.08em] text-muted-r">RISK LEVEL</small>
          <strong className="mt-1 block text-sm capitalize text-ink-r">{gate.riskLevel}</strong>
        </div>
        <div className="bg-surface-r p-3">
          <small className="block text-[8px] font-bold tracking-[0.08em] text-muted-r">PROVIDER CLASS</small>
          <strong className="mt-1 block text-sm text-ink-r">{providerClassLabel}</strong>
        </div>
        <div className="bg-surface-r p-3">
          <small className="block text-[8px] font-bold tracking-[0.08em] text-muted-r">RULE DOMAINS</small>
          <strong className="mt-1 block text-sm text-ink-r">{gate.domains.length} checked</strong>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {gate.domains.map(domain => (
          <div
            key={domain.id}
            className="flex items-start gap-2 rounded-lg-r border border-line-r p-2.5"
          >
            <span
              className={`grid h-6 w-6 flex-none place-items-center rounded-full text-[10px] font-bold ${
                domain.status === "pass"
                  ? "bg-brand-50-r text-brand-600-r"
                  : domain.status === "blocked"
                    ? "bg-[#ffe1dd] text-[#a52d25]"
                    : "bg-[#fff0df] text-[#a25a22]"
              }`}
            >
              {domain.status === "pass" ? "✓" : domain.status === "blocked" ? "×" : "!"}
            </span>
            <div>
              <strong className="block text-xs text-ink-r">{domain.label}</strong>
              <small className="mt-0.5 block text-[10px] leading-snug text-muted-r">{domain.detail}</small>
            </div>
          </div>
        ))}
      </div>

      {gate.issues.length > 0 && (
        <div className="mt-3 grid gap-2">
          <small className="text-[9px] font-bold tracking-[0.09em] text-[#9c4b22]">
            RULES REQUIRING ATTENTION
          </small>
          {gate.issues.map(issue => (
            <div
              key={issue.code}
              className={`rounded-r-lg border-l-[3px] p-2.5 ${
                issue.severity === "block"
                  ? "border-[#c94c43] bg-[#fff0ee]"
                  : "border-[#db9b67] bg-[#fff7ee]"
              }`}
            >
              <strong className="block text-xs text-ink-r">{issue.title}</strong>
              <span className="mt-0.5 block text-[11px] text-muted-r">{issue.detail}</span>
            </div>
          ))}
        </div>
      )}

      <details className="mt-3 border-t border-line-r pt-3">
        <summary className="cursor-pointer text-xs font-bold text-brand-600-r">
          {gate.safeguards.length} safeguards carried into booking and execution
        </summary>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-xs leading-relaxed text-ink-r/80">
          {gate.safeguards.map(safeguard => (
            <li key={safeguard}>{safeguard}</li>
          ))}
        </ol>
      </details>
    </Disclosure>
  );
}

function UnderstoodFacts({
  analysis,
  hasDrivingRoute,
  workstreams,
  householdCatalog,
}: {
  analysis: PlannerAnalysis;
  hasDrivingRoute: boolean;
  workstreams: Workstream[];
  householdCatalog: { items: number; families: number; jobRelations: number };
}) {
  const householdMatch = analysis.understoodFacts.some(fact => fact.startsWith("Household catalog match:"));
  return (
    <div className="grid gap-4">
      <Card>
        <div className="flex items-start justify-between gap-4">
          <SectionLabel step="1 · WHAT THE CUSTOMER REQUESTED" title="Facts already understood" />
          <Badge tone="brand">{analysis.understoodFacts.length} facts locked</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {analysis.understoodFacts.map(fact => (
            <span
              key={fact}
              className="rounded-full border border-brand-200-r bg-surface-r px-3 py-1.5 text-xs font-medium text-brand-600-r"
            >
              ✓ {fact}
            </span>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-r">
          These facts are locked. Doneeo will not ask you to provide them again.
        </p>
      </Card>

      {householdMatch && (
        <Card className="bg-brand-50-r">
          <small className="text-[9px] font-bold tracking-[0.1em] text-brand-600-r">
            HOUSEHOLD KNOWLEDGE MATCH
          </small>
          <strong className="mt-1 block text-sm text-ink-r">{analysis.items.join(", ")}</strong>
          <span className="mt-1 block text-xs text-muted-r">
            {householdCatalog.items} common household items across {householdCatalog.families} families ·{" "}
            {householdCatalog.jobRelations} item-to-job relationships
          </span>
          <p className="mt-2 text-xs leading-relaxed text-muted-r">
            Doneeo uses the identified item to select its possible work, handling risks, crew, vehicle,
            tools and only the still-missing questions.
          </p>
        </Card>
      )}

      <div className="rounded-2xl-r border border-line-r bg-canvas-r p-4">
        <strong className="block text-sm text-ink-r">Analysis first. Estimates after the missing facts.</strong>
        <span className="mt-1 block text-xs text-muted-r">
          Doneeo will calculate providers, {hasDrivingRoute ? "driving route, " : ""}manpower, equipment,
          time and price only after the required information below is complete.
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card padding="sm">
          <small className="block text-[9px] font-bold tracking-[0.08em] text-brand-600-r">
            {workstreams.length > 1 ? `${workstreams.length} TASKS PRESERVED · ORDER LOCKED` : "TASKS PRESERVED"}
          </small>
          <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs leading-relaxed text-ink-r/85">
            {analysis.tasks.map((task, index) => (
              <li key={`${task}-${index}`}>
                {task}
                {workstreams.length > 1 && index < analysis.tasks.length - 1 ? (
                  <em className="mt-0.5 block text-[10px] not-italic font-semibold text-[#b6532c]">
                    Complete and confirm before Task {index + 2}
                  </em>
                ) : null}
              </li>
            ))}
          </ol>
        </Card>
        <Card padding="sm">
          <small className="block text-[9px] font-bold tracking-[0.08em] text-brand-600-r">CONSTRAINTS LOCKED</small>
          <strong className="mt-2 block text-sm text-ink-r">
            {analysis.customerCanHelp === false
              ? "Customer cannot help — provider team handles all lifting"
              : "Only confirmed constraints are applied"}
          </strong>
          {analysis.items.length > 0 && (
            <span className="mt-1 block text-xs text-muted-r">Items: {analysis.items.join(", ")}</span>
          )}
        </Card>
      </div>
    </div>
  );
}

function ExecutionBlueprint({
  analysis,
  hasDrivingRoute,
  workstreams,
}: {
  analysis: PlannerAnalysis;
  hasDrivingRoute: boolean;
  workstreams: Workstream[];
}) {
  const fulfillment = analysis.intelligence?.fulfillment;
  return (
    <div className="grid gap-4">
      <Card className="bg-brand-50-r/40">
        <div className="flex items-start justify-between gap-4">
          <SectionLabel
            step="2 · REQUEST BREAKDOWN"
            title={workstreams.length > 1 ? `${workstreams.length} connected tasks identified` : "What Doneeo has identified"}
          />
          <Badge tone="neutral">Estimation pending</Badge>
        </div>
        <div className="rounded-lg-r bg-[#fff3e8] p-3">
          <small className="block text-[8px] font-bold tracking-[0.08em] text-[#9c4b22]">
            RESOURCES DONEEO WILL VERIFY
          </small>
          <strong className="mt-1 block text-xs leading-relaxed text-ink-r">
            {analysis.estimate.materialsSummary}
          </strong>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="md:col-span-1">
            <small className="block text-[9px] font-bold tracking-[0.08em] text-brand-600-r">ORDERED WORK SCOPE</small>
            <div className="mt-2 grid gap-2">
              {(workstreams.length
                ? workstreams.map((stream, index) => (
                    <div key={stream.id} className="rounded-lg-r border border-line-r bg-surface-r p-3">
                      <b className="block text-[8px] font-bold uppercase tracking-wide text-brand-600-r">
                        Task {stream.sequence} · {stream.qualification.replaceAll("_", " ")}
                      </b>
                      <strong className="mt-1 block text-xs text-ink-r">{stream.title}.</strong>
                      <small className="mt-1 block text-[10px] text-muted-r">
                        {stream.phaseIds.length} execution step{stream.phaseIds.length === 1 ? "" : "s"} ·{" "}
                        {stream.rangeLow}–{stream.rangeHigh} min · {stream.minimumCrew} minimum /{" "}
                        {stream.recommendedCrew} recommended
                      </small>
                      <span className="mt-1 block text-[10px] text-muted-r">
                        {stream.resourceIds.length
                          ? `Resources: ${stream.resourceIds
                              .map(id => analysis.intelligence?.resources.find(resource => resource.id === id)?.name || id.replaceAll("_", " "))
                              .join(", ")}`
                          : "No special resource gap identified"}
                      </span>
                      {index < workstreams.length - 1 && (
                        <em className="mt-2 block rounded-md-r bg-[#fff1e9] px-2 py-1 text-[9px] not-italic font-bold text-[#a94c28]">
                          Full stop · executor proves completion and customer approves before Task{" "}
                          {stream.sequence + 1}
                        </em>
                      )}
                    </div>
                  ))
                : analysis.tasks.map((title, index) => (
                    <div key={`${title}-${index}`} className="rounded-lg-r border border-line-r bg-surface-r p-3">
                      <b className="block text-[8px] font-bold uppercase tracking-wide text-brand-600-r">Task {index + 1}</b>
                      <strong className="mt-1 block text-xs text-ink-r">{title}.</strong>
                      <small className="mt-1 block text-[10px] text-muted-r">Detailed phases calculated after missing facts</small>
                    </div>
                  )))}
            </div>
          </div>
          <div>
            <small className="block text-[9px] font-bold tracking-[0.08em] text-brand-600-r">EXPERTISE TO MATCH</small>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {analysis.skillRequirements.map(skill => (
                <span key={skill} className="rounded-full bg-surface-r px-2.5 py-1 text-[11px] text-ink-r">
                  ✓ {skill}
                </span>
              ))}
            </div>
          </div>
          <div>
            <small className="block text-[9px] font-bold tracking-[0.08em] text-brand-600-r">PLANNING LOGIC</small>
            <div className="mt-2 grid gap-1 text-[11px] leading-relaxed text-ink-r/80">
              <span>1. Collect only missing facts for every task</span>
              <span>2. Verify equipment, materials and eligibility per task</span>
              <span>3. Complete and confirm each task before releasing the next</span>
              <span>4. Calculate {hasDrivingRoute ? "route, " : ""}manpower, time and price for the complete order</span>
            </div>
          </div>
        </div>
      </Card>

      {fulfillment?.mode === "coordinated_specialists" && (
        <Card>
          <div className="flex items-start justify-between gap-4">
            <SectionLabel
              step="ONE CUSTOMER ORDER · INTERNAL SERVICE COORDINATION"
              title="Doneeo may assign different executors without splitting the customer experience"
            />
            <Badge tone="brand">One plan · one price</Badge>
          </div>
          <p className="text-xs text-muted-r">{fulfillment.rationale}</p>
          <div className="mt-3 grid gap-2">
            {fulfillment.groups.map((group, index) => (
              <div key={group.id} className="flex gap-3 rounded-lg-r border border-line-r p-3">
                <b className="grid h-7 w-7 flex-none place-items-center rounded-full bg-brand-500-r text-xs font-bold text-white">
                  {String.fromCharCode(65 + index)}
                </b>
                <div>
                  <small className="block text-[9px] font-bold tracking-[0.08em] text-brand-600-r">{group.title}</small>
                  <strong className="mt-0.5 block text-xs text-ink-r">{group.executorRole}</strong>
                  <span className="mt-0.5 block text-[10px] text-muted-r">
                    Tasks {group.taskSequences.join(", ")}
                    {group.vehicleRequired ? " · vehicle required" : " · in-home service"}
                  </span>
                  <em className="mt-1 block text-[10px] not-italic text-muted-r">
                    {group.handoffAfterTask
                      ? `Managed handoff after Task ${group.handoffAfterTask}; the customer does not create another order.`
                      : "Completes the remaining tasks under the same Doneeo plan."}
                  </em>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function EquipmentCheck({
  analysis,
  hasDrivingRoute,
  answers,
  setAnswers,
}: {
  analysis: PlannerAnalysis;
  hasDrivingRoute: boolean;
  answers: Answers;
  setAnswers: Dispatch<SetStateAction<Answers>>;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <SectionLabel step="EQUIPMENT & SUPPLY PLAN" title="What the job requires" />
        <Badge tone="neutral">{analysis.equipment.length} item(s) verified during matching</Badge>
      </div>
      <p className="text-xs leading-relaxed text-muted-r">
        Doneeo checks matched-provider inventory first.{" "}
        {hasDrivingRoute
          ? "The required vehicle, reusable tools, handling aids and safety equipment"
          : "Reusable tools, handling aids and safety equipment"}{" "}
        are the provider’s responsibility—not the customer’s. You only confirm consumable materials you
        already have; missing consumables can be purchased with approval and added to the invoice.
      </p>
      <div className="mt-3 grid gap-2">
        {analysis.equipment.map(item => {
          const isConsumable = item.supplyType === "consumable";
          return (
            <div
              key={item.id}
              className="flex items-center justify-between gap-4 rounded-lg-r border border-line-r bg-surface-r p-3"
            >
              <div>
                <strong className="block text-xs text-ink-r">{item.name}</strong>
                <span className="mt-0.5 block text-[11px] text-muted-r">{item.purpose}</span>
                <small className="mt-1 block text-[10px] text-[#9c4b22]">
                  {isConsumable
                    ? `Purchase estimate if missing: $${item.rentalEstimate} CAD`
                    : "Provider inventory check · rental only if the matched provider has a verified gap"}
                </small>
              </div>
              {isConsumable ? (
                <div className="flex flex-none gap-1.5">
                  <button
                    className={`rounded-full border px-3 py-2 text-xs ${
                      answers[`equipment_${item.id}`] === true
                        ? "border-brand-500-r bg-brand-50-r text-brand-600-r"
                        : "border-line-r bg-surface-r text-muted-r"
                    }`}
                    onClick={() => setAnswers(current => ({ ...current, [`equipment_${item.id}`]: true }))}
                  >
                    I have it
                  </button>
                  <button
                    className={`rounded-full border px-3 py-2 text-xs ${
                      answers[`equipment_${item.id}`] === false
                        ? "border-brand-500-r bg-brand-50-r text-brand-600-r"
                        : "border-line-r bg-surface-r text-muted-r"
                    }`}
                    onClick={() => setAnswers(current => ({ ...current, [`equipment_${item.id}`]: false }))}
                  >
                    Add if needed
                  </button>
                </div>
              ) : (
                <span className="flex-none rounded-full bg-brand-50-r px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-brand-600-r">
                  Provider supplied
                </span>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function AdaptiveQuestions({
  visibleQuestions,
  displayedQuestions,
  questionAnswered,
  workstreams,
  answers,
  textDrafts,
  setTextDrafts,
  answerState,
  validateAnswer,
}: {
  visibleQuestions: PlannerQuestion[];
  displayedQuestions: PlannerQuestion[];
  questionAnswered: (question: PlannerQuestion) => boolean;
  workstreams: Workstream[];
  answers: Answers;
  textDrafts: Record<string, string>;
  setTextDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  answerState: "idle" | "validating";
  validateAnswer: (question: PlannerQuestion, value: string | boolean) => void | Promise<void>;
}) {
  const remaining = visibleQuestions.filter(question => !questionAnswered(question)).length;
  return (
    <div className="grid gap-4">
      {visibleQuestions.length > 0 ? (
        <div className="rounded-2xl-r border border-[#f0c9ad] bg-[#fff9f4] p-4">
          <small className="text-[9px] font-bold tracking-[0.1em] text-[#9c4b22]">3 · ADAPTIVE INFORMATION FLOW</small>
          <h3 className="mt-1 text-sm font-bold text-ink-r">Doneeo asks only the next verified missing question</h3>
          <p className="mt-1 text-xs text-muted-r">
            {remaining} relevant detail{remaining === 1 ? "" : "s"} {remaining === 1 ? "remains" : "remain"}.
            Irrelevant and already answered questions are removed before they reach this screen.
          </p>
        </div>
      ) : (
        <div className="rounded-xl-r bg-brand-50-r px-4 py-3 text-sm font-semibold text-brand-600-r">
          ✓ Enough information was provided.
        </div>
      )}

      <div className="grid gap-3">
        {displayedQuestions.map(question => {
          const task = workstreams.find(stream =>
            question.id.startsWith("handling_") || question.id.startsWith("refrigerator_")
              ? stream.domain === "transport_handling"
              : ["mounted_item", "wall_type", "mount_hardware_status"].includes(question.id)
                ? stream.domain === "mounting"
                : false,
          );
          const value =
            question.type === "text"
              ? textDrafts[question.id] ?? (typeof answers[question.id] === "string" ? answers[question.id] : "")
              : answers[question.id];
          return (
            <div key={question.id}>
              <small className="mb-1.5 block text-[9px] font-bold tracking-[0.08em] text-brand-600-r">
                {task ? `TASK ${task.sequence} · ${task.title}` : "COMPLETE ORDER · SHARED DETAIL"}
              </small>
              <Question
                question={question}
                value={value}
                busy={answerState === "validating"}
                onChange={nextValue =>
                  question.type === "text"
                    ? setTextDrafts(current => ({ ...current, [question.id]: String(nextValue) }))
                    : validateAnswer(question, nextValue)
                }
                onTextCommit={() =>
                  validateAnswer(question, String(textDrafts[question.id] ?? answers[question.id] ?? "").trim())
                }
              />
            </div>
          );
        })}
      </div>

      {answerState === "validating" && (
        <p className="text-xs text-muted-r">
          Doneeo is locking the fact, recalculating the job and checking which question is relevant next.
        </p>
      )}
    </div>
  );
}

export function AnalysisScreen({
  analysis,
  setStage,
  hasDrivingRoute,
  liveGateStatus,
  providerClassLabel,
  workstreams,
  householdCatalog,
  answers,
  setAnswers,
  textDrafts,
  setTextDrafts,
  answerState,
  validateAnswer,
  visibleQuestions,
  displayedQuestions,
  questionAnswered,
  requiredComplete,
  equipmentComplete,
  gateBlocked,
  requirementReady,
  buildMatchedOptions,
  error,
}: {
  analysis: PlannerAnalysis;
  setStage: (stage: number) => void;
  hasDrivingRoute: boolean;
  liveGateStatus: GateStatus;
  providerClassLabel: string;
  workstreams: Workstream[];
  householdCatalog: { items: number; families: number; jobRelations: number };
  answers: Answers;
  setAnswers: Dispatch<SetStateAction<Answers>>;
  textDrafts: Record<string, string>;
  setTextDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  answerState: "idle" | "validating";
  validateAnswer: (question: PlannerQuestion, value: string | boolean) => void | Promise<void>;
  visibleQuestions: PlannerQuestion[];
  displayedQuestions: PlannerQuestion[];
  questionAnswered: (question: PlannerQuestion) => boolean;
  requiredComplete: boolean;
  equipmentComplete: boolean;
  gateBlocked: boolean;
  requirementReady: boolean;
  buildMatchedOptions: () => void | Promise<void>;
  error: string;
}) {
  return (
    <section className="mx-auto max-w-[720px] px-[7%] pb-16 pt-10">
      <button
        onClick={() => setStage(0)}
        className="mb-6 text-sm text-muted-r transition-colors hover:text-ink-r"
      >
        ← Back
      </button>

      <div className="grid gap-5">
        <AnalysisIntro analysis={analysis} />
        <p className="rounded-xl-r bg-canvas-r px-5 py-4 text-sm leading-relaxed text-ink-r/85">
          {analysis.summary}
        </p>
        <AuditCard audit={analysis.audit} />
        <RulesGatePanel
          analysis={analysis}
          liveGateStatus={liveGateStatus}
          hasDrivingRoute={hasDrivingRoute}
          providerClassLabel={providerClassLabel}
        />
        <UnderstoodFacts
          analysis={analysis}
          hasDrivingRoute={hasDrivingRoute}
          workstreams={workstreams}
          householdCatalog={householdCatalog}
        />
        <ExecutionBlueprint analysis={analysis} hasDrivingRoute={hasDrivingRoute} workstreams={workstreams} />

        <div className="flex items-start gap-3 rounded-xl-r border border-[#efd5b8] bg-[#fff8ef] px-4 py-3.5 text-[#81532f]">
          <strong className="whitespace-nowrap text-xs">Safety and eligibility check</strong>
          <span className="text-xs leading-relaxed">{analysis.safetyNote}</span>
        </div>

        <EquipmentCheck
          analysis={analysis}
          hasDrivingRoute={hasDrivingRoute}
          answers={answers}
          setAnswers={setAnswers}
        />

        <AdaptiveQuestions
          visibleQuestions={visibleQuestions}
          displayedQuestions={displayedQuestions}
          questionAnswered={questionAnswered}
          workstreams={workstreams}
          answers={answers}
          textDrafts={textDrafts}
          setTextDrafts={setTextDrafts}
          answerState={answerState}
          validateAnswer={validateAnswer}
        />

        <Button
          variant="primary"
          size="lg"
          disabled={answerState === "validating" || gateBlocked || !requiredComplete || !equipmentComplete || !requirementReady}
          onClick={buildMatchedOptions}
        >
          {gateBlocked
            ? "Request blocked by Doneeo Rules Gate"
            : answerState === "validating"
              ? "Validating the work order…"
              : !requirementReady
                ? "Finalizing Requirement Contract…"
                : "Build matched work options"}
          <span aria-hidden="true">→</span>
        </Button>
        {error && (
          <p role="alert" className="rounded-xl-r border border-[#efcaca] bg-[#fff1f1] px-4 py-3 text-center text-sm text-[#9b2c2c]">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
