// New for the frontend redesign. Stage 3 — booking/checkout and live execution
// tracking. Presentation-only: every value/handler is computed in page.tsx
// exactly as before and passed straight through.
import type { Dispatch, SetStateAction } from "react";
import type { PlannerAnalysis, RouteNode, ScheduleWindow } from "../../lib/planner";
import type { Answers, PlanOption, ServiceAssignment } from "../_domain/plan-types";
import { addMinutesToSchedule } from "../_domain/schedule-format";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";

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
type JobCheckpoint = { title: string; detail: string; actor: string; eta: string; timelineIndex?: number };
type PaymentState = "unpaid" | "processing" | "authorized";
type BookingState = "idle" | "saving" | "created" | "saved" | "error";
type ProviderStatus = "not_sent" | "awaiting" | "accepted";

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

function TrackingIntro({ paymentState }: { paymentState: PaymentState }) {
  return (
    <div className="mb-2">
      <div className="mb-3 grid h-9 w-9 place-items-center rounded-full bg-brand-500-r text-sm font-bold text-white">✓</div>
      <div className="text-xs font-bold tracking-[0.17em] text-brand-600-r">CONFIRMED DONEEO WORK ORDER</div>
      <h2 className="mt-2 text-[clamp(26px,4.5vw,38px)] font-extrabold leading-tight text-ink-r">
        {paymentState === "authorized" ? "Track every execution milestone." : "Authorize payment to request the provider."}
      </h2>
      <p className="mt-2 max-w-[560px] text-sm leading-relaxed text-muted-r">
        Payment comes before provider acceptance. If the provider declines or times out, Doneeo keeps the confirmed
        order and immediately proposes the next compatible option.
      </p>
    </div>
  );
}

function GuidedSimulation({
  bookingState,
  simulationProgress,
  jobCheckpoints,
  activeCheckpoint,
  activeServiceAssignment,
  isManagedHandoff,
  chosen,
  completeSimulationAction,
  simulationActionLabel,
  activeTimelineStep,
  handoffState,
}: {
  bookingState: BookingState;
  simulationProgress: number;
  jobCheckpoints: JobCheckpoint[];
  activeCheckpoint: number;
  activeServiceAssignment: ServiceAssignment | undefined;
  isManagedHandoff: boolean;
  chosen: PlanOption;
  completeSimulationAction: () => void | Promise<void>;
  simulationActionLabel: string;
  activeTimelineStep: ExecutionStep | null;
  handoffState: string;
}) {
  const complete = bookingState === "saved";
  const percent = complete ? 100 : simulationProgress;
  return (
    <Card className={complete ? "border-brand-200-r bg-brand-50-r/30" : undefined}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <small className="block text-[9px] font-bold tracking-[0.08em] text-brand-600-r">FULL DEMO SIMULATION</small>
          <strong className="mt-1 block text-sm text-ink-r">{complete ? "Complete" : `${simulationProgress}% through the work order`}</strong>
        </div>
        <div className="h-1.5 w-32 flex-none overflow-hidden rounded-full bg-line-r">
          <span className="block h-full bg-brand-500-r transition-[width] duration-300" style={{ width: `${percent}%` }} />
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-start">
        <div>
          <small className="block text-[9px] font-bold tracking-[0.08em] text-brand-600-r">
            {complete ? "FINAL STATUS" : "NEXT REQUIRED ACTION"}
          </small>
          <h3 className="mt-1 text-sm font-bold text-ink-r">
            {complete ? "Every task is complete and the report is ready" : jobCheckpoints[activeCheckpoint]?.title}
          </h3>
          <p className="mt-1 text-xs text-muted-r">
            {complete
              ? "Doneeo closed the same customer work order after all execution and approval gates."
              : jobCheckpoints[activeCheckpoint]?.detail}
          </p>
          {activeServiceAssignment && (
            <div className="mt-2 rounded-lg-r bg-canvas-r p-2.5">
              <b className="block text-xs font-bold text-ink-r">{activeServiceAssignment.title}</b>
              <span className="block text-[11px] text-muted-r">{activeServiceAssignment.executors}</span>
              <small className="block text-[10px] text-subtle-r">{activeServiceAssignment.tasks}</small>
            </div>
          )}
          {isManagedHandoff && (
            <div className="mt-2 rounded-lg-r bg-[#fff3e8] p-2.5">
              <b className="block text-xs font-bold text-ink-r">Doneeo-managed transition</b>
              <span className="block text-[11px] text-muted-r">{chosen.serviceAssignments[0]?.executors} leaves after delivery approval</span>
              <small className="block text-[10px] text-subtle-r">{chosen.serviceAssignments[1]?.executors} arrives for the in-home work</small>
            </div>
          )}
        </div>
        <div className="sm:w-56">
          <small className="block text-[9px] font-bold tracking-[0.08em] text-brand-600-r">ONE CONTROL ADVANCES THE SAME PLAN</small>
          <Button
            variant="primary"
            className="mt-2 w-full"
            onClick={completeSimulationAction}
            disabled={bookingState === "saving" || bookingState === "saved"}
          >
            {bookingState === "saving" ? "Creating completion report…" : simulationActionLabel}
            <span aria-hidden="true">→</span>
          </Button>
          <p className="mt-2 text-[10px] text-muted-r">
            {activeTimelineStep?.isGate
              ? "This demo records both the executor completion and customer approval, then releases the next task."
              : "The next milestone becomes active immediately after this confirmation."}
          </p>
        </div>
      </div>

      {chosen.serviceAssignments.length > 1 && (
        <div className="mt-4 flex items-center gap-3 rounded-lg-r border border-line-r p-3">
          <b className="grid h-8 w-8 flex-none place-items-center rounded-full bg-brand-50-r text-sm font-bold text-brand-600-r">
            {handoffState === "complete" ? "✓" : handoffState === "active" ? "↔" : "2"}
          </b>
          <div>
            <small className="block text-[9px] font-bold tracking-[0.08em] text-brand-600-r">PLANNED TEAM TRANSITION</small>
            <strong className="mt-0.5 block text-xs text-ink-r">
              {handoffState === "complete"
                ? "Service B is active"
                : handoffState === "active"
                  ? "Service A is leaving and Service B is arriving"
                  : "Service B waits for Task 2 approval"}
            </strong>
            <span className="mt-0.5 block text-[10px] text-muted-r">
              Doneeo owns the transition; the customer keeps the same reference, price and tracker.
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}

function DemoPayment({
  finalTotal,
  notification,
  requestedSchedule,
  completionDeadline,
  chosen,
  protectionCost,
  paymentState,
  authorizeDemoPayment,
}: {
  finalTotal: number;
  notification: string;
  requestedSchedule: string;
  completionDeadline: string;
  chosen: PlanOption;
  protectionCost: number;
  paymentState: PaymentState;
  authorizeDemoPayment: () => void | Promise<void>;
}) {
  return (
    <Card className="border-brand-200-r bg-brand-50-r/30">
      <small className="text-[9px] font-bold tracking-[0.08em] text-brand-600-r">TEST CHECKOUT</small>
      <h3 className="mt-1 text-lg font-bold text-ink-r">Authorize ${finalTotal} CAD</h3>
      <p className="mt-1 text-xs text-muted-r">This prototype simulates payment. No card is requested and no real charge is made.</p>
      {notification && <div className="mt-3 rounded-lg-r bg-[#eef5ff] px-3 py-2.5 text-xs font-semibold text-[#295c9c]">🔔 {notification}</div>}
      <div className="mt-3 grid gap-1.5 border-y border-line-r py-3 text-xs text-muted-r">
        <span className="flex justify-between">
          Committed arrival <strong className="text-ink-r">{requestedSchedule}</strong>
        </span>
        <span className="flex justify-between">
          Required completion <strong className="text-ink-r">{completionDeadline}</strong>
        </span>
        <span className="flex justify-between">
          Selected service <strong className="text-ink-r">{chosen.name}</strong>
        </span>
        <span className="flex justify-between">
          Service protection <strong className="text-ink-r">${protectionCost}</strong>
        </span>
        <span className="flex justify-between">
          Total authorization <strong className="text-ink-r">${finalTotal} CAD</strong>
        </span>
      </div>
      <Button variant="primary" size="lg" className="mt-4 bg-accent-r shadow-[0_9px_22px_rgba(255,107,53,0.35)]" onClick={authorizeDemoPayment} disabled={paymentState === "processing"}>
        {paymentState === "processing" ? "Authorizing test payment…" : `Simulate payment · $${finalTotal}`}
        <span aria-hidden="true">→</span>
      </Button>
    </Card>
  );
}

function WorkOrderTracker({
  analysis,
  chosen,
  savedReference,
  dispatchAttempt,
  activeCheckpoint,
  jobCheckpoints,
  providerStatus,
  sharedStopContacts,
  requestedSchedule,
  scheduleWindow,
  completionDeadline,
  notification,
  alternateTimesVisible,
  setAlternateTimesVisible,
  setAnswers,
  setNotification,
  routeNodes,
  estimatedRemaining,
  milestoneDurations,
  activeTimelineStep,
  activeGateState,
  setTaskGateConfirmations,
  declineAndRematch,
  executionGateBlocked,
  advanceCheckpoint,
  taskGateBlocked,
  incidentNote,
  setIncidentNote,
  bookingState,
  confirmWorkOrder,
  setProviderStatus,
  setActiveCheckpoint,
  protectionCost,
  finalTotal,
}: {
  analysis: PlannerAnalysis;
  chosen: PlanOption;
  savedReference: string;
  dispatchAttempt: number;
  activeCheckpoint: number;
  jobCheckpoints: JobCheckpoint[];
  providerStatus: ProviderStatus;
  sharedStopContacts: Array<{ stop: string; index: number; name: string; phone: string; invited: boolean }>;
  requestedSchedule: string;
  scheduleWindow: ScheduleWindow | null;
  completionDeadline: string;
  notification: string;
  alternateTimesVisible: boolean;
  setAlternateTimesVisible: Dispatch<SetStateAction<boolean>>;
  setAnswers: Dispatch<SetStateAction<Answers>>;
  setNotification: Dispatch<SetStateAction<string>>;
  routeNodes: RouteNode[];
  estimatedRemaining: number;
  milestoneDurations: Record<number, number>;
  activeTimelineStep: ExecutionStep | null;
  activeGateState: { executor: boolean; customer: boolean } | undefined;
  setTaskGateConfirmations: Dispatch<SetStateAction<Record<number, { executor: boolean; customer: boolean }>>>;
  declineAndRematch: () => void;
  executionGateBlocked: boolean;
  advanceCheckpoint: () => void;
  taskGateBlocked: boolean;
  incidentNote: string;
  setIncidentNote: Dispatch<SetStateAction<string>>;
  bookingState: BookingState;
  confirmWorkOrder: () => void | Promise<void>;
  setProviderStatus: (status: ProviderStatus) => void;
  setActiveCheckpoint: (checkpoint: number) => void;
  protectionCost: number;
  finalTotal: number;
}) {
  return (
    <Card raised>
      <div className="flex items-start justify-between gap-4">
        <div>
          <small className="block text-[9px] font-bold tracking-[0.08em] text-brand-600-r">REFERENCE</small>
          <strong className="mt-1 block text-sm text-ink-r">{savedReference || `DEMO-${String(dispatchAttempt).padStart(3, "0")}`}</strong>
        </div>
        <Badge tone="neutral">
          Checkpoint {activeCheckpoint + 1}/{jobCheckpoints.length}
        </Badge>
      </div>

      <div className="mt-4 rounded-lg-r bg-canvas-r p-4">
        <small className="block text-[9px] font-bold tracking-[0.08em] text-brand-600-r">ROLE-BASED COORDINATION</small>
        <h3 className="mt-1 text-sm font-bold text-ink-r">{analysis.title}</h3>
        <div className="mt-2 grid gap-2">
          <div className="flex gap-2">
            <b className="grid h-6 w-6 flex-none place-items-center rounded-full bg-brand-500-r text-[10px] font-bold text-white">C</b>
            <span>
              <strong className="block text-xs text-ink-r">Requester / payer</strong>
              <small className="block text-[10px] text-muted-r">Sees the complete order, payment and all updates.</small>
            </span>
          </div>
          <div className="flex gap-2">
            <b className="grid h-6 w-6 flex-none place-items-center rounded-full bg-brand-500-r text-[10px] font-bold text-white">P</b>
            <span>
              <strong className="block text-xs text-ink-r">{chosen.provider}</strong>
              <small className="block text-[10px] text-muted-r">
                {providerStatus === "accepted" ? "Work order accepted" : "Acceptance requested after payment"}
              </small>
            </span>
          </div>
          {sharedStopContacts.map(contact => (
            <div key={`${contact.index}-${contact.name}`} className="flex gap-2">
              <b className="grid h-6 w-6 flex-none place-items-center rounded-full bg-canvas-r text-[10px] font-bold text-ink-r">
                {contact.index + 1}
              </b>
              <span>
                <strong className="block text-xs text-ink-r">{contact.name}</strong>
                <small className="block text-[10px] text-muted-r">Limited access · Stop {contact.index + 1} only</small>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className={`mt-4 rounded-lg-r p-4 ${providerStatus === "accepted" ? "bg-brand-50-r" : "bg-[#fff7ef]"}`}>
        <small className={`text-[9px] font-bold tracking-[0.08em] ${providerStatus === "accepted" ? "text-brand-600-r" : "text-[#9a4b26]"}`}>
          {providerStatus === "accepted" ? "SCHEDULED SERVICE" : "REQUESTED WINDOW"}
        </small>
        <strong className="mt-1 block text-base text-ink-r">Arrive {requestedSchedule}</strong>
        <b className="block text-xs text-ink-r">{scheduleWindow?.deadlineTime ? `Finish by ${completionDeadline}` : "No fixed completion deadline"}</b>
        <span className="mt-1 block text-xs text-muted-r">
          {providerStatus === "accepted"
            ? scheduleWindow?.deadlineTime
              ? "Provider accepted both the arrival commitment and completion deadline · confirmation notifications sent."
              : "Provider accepted the arrival commitment · confirmation notifications sent."
            : scheduleWindow?.deadlineTime
              ? "Waiting for a provider to accept this arrival time and deadline."
              : "Waiting for a provider to accept this arrival time."}
        </span>
      </div>

      {notification && <div className="mt-3 rounded-lg-r bg-[#eef5ff] px-3 py-2.5 text-xs font-semibold text-[#295c9c]">🔔 {notification}</div>}

      {alternateTimesVisible && providerStatus !== "accepted" && (
        <div className="mt-3 rounded-lg-r border border-[#efc5ae] bg-[#fff8f3] p-4">
          <small className="block text-[9px] font-bold tracking-[0.08em] text-[#9a4b26]">REQUESTED TIME NOT AVAILABLE</small>
          <strong className="mt-1 block text-sm text-ink-r">Choose another available option or continue rematching</strong>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="rounded-lg-r border border-[#d7a88e] bg-surface-r px-3 py-2 text-xs font-semibold text-[#84421f]"
              onClick={() => {
                setAnswers(current => ({ ...current, schedule: "Same day · 2 hours later" }));
                setAlternateTimesVisible(false);
              }}
            >
              Same day · +2h
            </button>
            <button
              className="rounded-lg-r border border-[#d7a88e] bg-surface-r px-3 py-2 text-xs font-semibold text-[#84421f]"
              onClick={() => {
                setAnswers(current => ({ ...current, schedule: "Next morning · 9:00–11:00" }));
                setAlternateTimesVisible(false);
              }}
            >
              Next morning
            </button>
            <button
              className="rounded-lg-r border border-[#d7a88e] bg-surface-r px-3 py-2 text-xs font-semibold text-[#84421f]"
              onClick={() => {
                setAlternateTimesVisible(false);
                setNotification("Doneeo continues searching for the original requested time.");
              }}
            >
              Keep requested time
            </button>
          </div>
        </div>
      )}

      <div className="mt-4">
        <small className="block text-[9px] font-bold tracking-[0.08em] text-brand-600-r">WORK LOCATION</small>
        <div className="mt-2 grid gap-2">
          {routeNodes.map((node, index) => (
            <div key={`${node.location}-${index}`} className="flex gap-3">
              <b className="grid h-6 w-6 flex-none place-items-center rounded-full bg-canvas-r text-[10px] font-bold text-ink-r">{index + 1}</b>
              <span>
                <strong className="block text-xs text-ink-r">{node.location}</strong>
                <em className="block text-[10px] not-italic text-muted-r">{node.actions.join(" · ")}</em>
                <small className="block text-[10px] text-subtle-r">
                  {sharedStopContacts.find(contact => contact.index === index)?.name
                    ? `Shared with ${sharedStopContacts.find(contact => contact.index === index)?.name}`
                    : "No external contact invited"}
                </small>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-2xl-r border border-line-r bg-canvas-r/40 p-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div>
            <small className="block text-[8px] font-bold text-brand-600-r">PLANNED ARRIVAL</small>
            <strong className="mt-1 block text-xs text-ink-r">{requestedSchedule}</strong>
          </div>
          <div>
            <small className="block text-[8px] font-bold text-brand-600-r">FINISH DEADLINE</small>
            <strong className="mt-1 block text-xs text-ink-r">{scheduleWindow?.deadlineTime || "Not fixed"}</strong>
          </div>
          <div>
            <small className="block text-[8px] font-bold text-brand-600-r">REMAINING ETA</small>
            <strong className="mt-1 block text-xs text-ink-r">{estimatedRemaining ? `≈ ${estimatedRemaining} min` : "Complete"}</strong>
          </div>
          <div>
            <small className="block text-[8px] font-bold text-brand-600-r">LAST MILESTONE</small>
            <strong className="mt-1 block text-xs text-ink-r">
              {milestoneDurations[activeCheckpoint - 1] ? `${milestoneDurations[activeCheckpoint - 1]} min actual` : "Not started"}
            </strong>
          </div>
        </div>

        <div className="mt-4 rounded-xl-r bg-ink-r p-4 text-white">
          <small className="text-[9px] font-bold tracking-[0.1em] opacity-70">NOW · MATCH ATTEMPT {dispatchAttempt}</small>
          <h3 className="mt-1 text-lg font-bold">{jobCheckpoints[activeCheckpoint]?.title}</h3>
          <p className="mt-1 text-xs opacity-80">{jobCheckpoints[activeCheckpoint]?.detail}</p>
          <div className="mt-3 flex justify-between border-t border-white/20 pt-3 text-xs">
            <span className="opacity-80">{jobCheckpoints[activeCheckpoint]?.actor}</span>
            <strong>{jobCheckpoints[activeCheckpoint]?.eta}</strong>
          </div>
        </div>

        <div className="mt-4 grid gap-0">
          {jobCheckpoints.map((checkpoint, index) => (
            <div key={`${checkpoint.title}-${index}`} className="flex items-center gap-3 py-2.5">
              <span
                className={`grid h-8 w-8 flex-none place-items-center rounded-full text-xs font-bold ${
                  index < activeCheckpoint ? "bg-brand-500-r text-white" : index === activeCheckpoint ? "bg-accent-r text-white" : "bg-line-r text-muted-r"
                }`}
              >
                {index < activeCheckpoint ? "✓" : index + 1}
              </span>
              <div className="flex-1">
                <strong className="block text-xs text-ink-r">{checkpoint.title}</strong>
                {index === activeCheckpoint && <small className="block text-[10px] text-muted-r">{checkpoint.detail}</small>}
                {index < activeCheckpoint && milestoneDurations[index] && (
                  <small className="block text-[10px] text-muted-r">Actual milestone time: {milestoneDurations[index]} min</small>
                )}
              </div>
              <em className="flex-none text-[10px] not-italic text-muted-r">
                {index < activeCheckpoint ? `${milestoneDurations[index] || 0} min` : index === activeCheckpoint ? "In progress" : checkpoint.eta}
              </em>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-3">
          {activeTimelineStep?.isGate && activeTimelineStep.taskSequence ? (
            <div className="rounded-lg-r border border-brand-200-r bg-brand-50-r p-3">
              <small className="block text-[9px] font-bold text-brand-600-r">
                FULL STOP · TASK {activeTimelineStep.taskSequence} CANNOT BE SKIPPED
              </small>
              <strong className="mt-1 block text-sm text-ink-r">{activeTimelineStep.taskTitle}</strong>
              <p className="mt-1 text-xs text-muted-r">Both confirmations are required before Doneeo releases the next task or closes the order.</p>
              <div className="mt-2 flex gap-2">
                <button
                  className={`flex-1 rounded-lg-r border px-3 py-2 text-xs font-semibold ${
                    activeGateState?.executor ? "border-brand-500-r bg-brand-500-r text-white" : "border-line-r bg-surface-r text-ink-r"
                  }`}
                  onClick={() =>
                    setTaskGateConfirmations(current => ({
                      ...current,
                      [activeTimelineStep.taskSequence!]: { executor: true, customer: current[activeTimelineStep.taskSequence!]?.customer || false },
                    }))
                  }
                >
                  {activeGateState?.executor ? "✓ Executor completion recorded" : "Executor: mark task completed"}
                </button>
                <button
                  className={`flex-1 rounded-lg-r border px-3 py-2 text-xs font-semibold ${
                    activeGateState?.customer ? "border-brand-500-r bg-brand-500-r text-white" : "border-line-r bg-surface-r text-ink-r"
                  }`}
                  onClick={() =>
                    setTaskGateConfirmations(current => ({
                      ...current,
                      [activeTimelineStep.taskSequence!]: { executor: current[activeTimelineStep.taskSequence!]?.executor || false, customer: true },
                    }))
                  }
                >
                  {activeGateState?.customer ? "✓ Customer approved result" : "Customer: approve this task"}
                </button>
              </div>
            </div>
          ) : null}

          {providerStatus !== "accepted" && activeCheckpoint <= 2 ? (
            <div className="grid gap-2">
              <Button
                variant="primary"
                onClick={() => {
                  setProviderStatus("accepted");
                  setActiveCheckpoint(3);
                  setAlternateTimesVisible(false);
                  setNotification(
                    `Provider accepted. Service scheduled for ${requestedSchedule}${
                      scheduleWindow?.deadlineTime ? ` with completion required by ${completionDeadline}` : " with no fixed completion deadline"
                    }. Confirmation notifications sent.`,
                  );
                }}
              >
                Demo: provider accepts requested window <span aria-hidden="true">✓</span>
              </Button>
              <button
                className="rounded-lg-r border border-[#d7a88e] bg-[#fff7f2] px-4 py-2.5 text-sm font-semibold text-[#934521]"
                onClick={declineAndRematch}
              >
                Demo: provider unavailable — show alternatives
              </button>
            </div>
          ) : activeCheckpoint < jobCheckpoints.length - 1 ? (
            <div className="grid gap-3">
              <Button variant="primary" disabled={executionGateBlocked} onClick={advanceCheckpoint}>
                {taskGateBlocked ? "Waiting for both task confirmations" : executionGateBlocked ? "Readiness confirmation required" : "Confirm milestone and continue"}
                <span aria-hidden="true">→</span>
              </Button>
              <label className="block rounded-lg-r border border-line-r bg-surface-r p-3">
                <span className="block text-xs font-semibold text-ink-r">Challenge or delay at this milestone</span>
                <textarea
                  value={incidentNote}
                  onChange={event => setIncidentNote(event.target.value)}
                  placeholder="Example: loading access blocked; approximately 15-minute delay"
                  className="mt-2 min-h-[60px] w-full resize-y rounded-lg-r border border-line-r p-2 text-xs outline-none focus:border-brand-500-r"
                />
                <button
                  className="mt-2 rounded-lg-r border border-line-r px-3 py-2 text-xs font-semibold text-ink-r"
                  onClick={() => {
                    setNotification("Delay update sent. Arrival and remaining-time estimates recalculated.");
                    setIncidentNote("");
                  }}
                >
                  Report update to affected participants
                </button>
              </label>
            </div>
          ) : bookingState === "saved" ? (
            <div className="rounded-lg-r border border-brand-200-r bg-brand-50-r p-4 text-center">
              <strong className="block text-sm text-brand-600-r">Job completed</strong>
              <span className="mt-1 block text-xs font-semibold text-brand-600-r">{savedReference}</span>
              <p className="mt-1 text-xs text-muted-r">Every checkpoint was confirmed.</p>
            </div>
          ) : (
            <Button variant="primary" className="bg-accent-r" disabled={bookingState === "saving" || taskGateBlocked} onClick={confirmWorkOrder}>
              {bookingState === "saving" ? "Closing work order…" : taskGateBlocked ? "Complete both final confirmations" : "Close the complete work order"}
              <span aria-hidden="true">✓</span>
            </Button>
          )}
        </div>
      </div>

      <details className="mt-4 border-t border-line-r pt-3">
        <summary className="cursor-pointer text-xs font-bold text-brand-600-r">Requester only · View complete work order and price</summary>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <small className="block text-[9px] font-bold text-brand-600-r">PROVIDER</small>
            <strong className="mt-1 block text-sm text-ink-r">{chosen.provider}</strong>
            <span className="block text-xs text-muted-r">{chosen.providerRating}</span>
          </div>
          <div>
            <small className="block text-[9px] font-bold text-brand-600-r">SERVICE</small>
            <strong className="mt-1 block text-sm text-ink-r">{chosen.name}</strong>
            <span className="block text-xs text-muted-r">{chosen.team}</span>
          </div>
          <div>
            <small className="block text-[9px] font-bold text-brand-600-r">DURATION</small>
            <strong className="mt-1 block text-sm text-ink-r">{chosen.duration}</strong>
          </div>
          <div>
            <small className="block text-[9px] font-bold text-brand-600-r">AUTHORIZED TOTAL</small>
            <strong className="mt-1 block text-sm text-ink-r">${finalTotal} CAD</strong>
            <span className="block text-xs text-muted-r">Includes selected rentals/protection</span>
          </div>
        </div>
        <div className="mt-3 rounded-lg-r bg-canvas-r p-3">
          {chosen.breakdown.map(line => (
            <div key={line} className="py-0.5 text-xs text-muted-r">
              {line}
            </div>
          ))}
          <div className="flex justify-between py-0.5 text-xs text-muted-r">
            <span>Optional protection</span>
            <strong className="text-ink-r">${protectionCost} CAD</strong>
          </div>
          <div className="mt-1 flex justify-between border-t border-line-r pt-2 text-sm">
            <span className="text-ink-r">Authorized total</span>
            <strong className="text-ink-r">${finalTotal} CAD</strong>
          </div>
        </div>
      </details>
    </Card>
  );
}

function OperationsControl({
  providerArrived,
  materialsReady,
  setMaterialsReady,
  setNotification,
  requestedSchedule,
  delayMinutes,
  incidentNote,
  setIncidentNote,
  reportDelay,
  setProviderArrived,
}: {
  providerArrived: boolean;
  materialsReady: boolean;
  setMaterialsReady: Dispatch<SetStateAction<boolean>>;
  setNotification: Dispatch<SetStateAction<string>>;
  requestedSchedule: string;
  delayMinutes: number;
  incidentNote: string;
  setIncidentNote: Dispatch<SetStateAction<string>>;
  reportDelay: () => void;
  setProviderArrived: Dispatch<SetStateAction<boolean>>;
}) {
  return (
    <Card>
      <SectionHead
        eyebrow="PROVIDER OPERATIONS"
        title="Readiness, punctuality and time control"
        badge={providerArrived ? "Arrived" : materialsReady ? "Ready to depart" : "Action required"}
      />
      <div className={`mt-3 rounded-lg-r p-3 ${materialsReady ? "bg-brand-50-r" : "bg-[#fff6ed]"}`}>
        <small className={`block text-[9px] font-bold ${materialsReady ? "text-brand-600-r" : "text-[#9a4b26]"}`}>
          TOOLS · MATERIALS · RENTALS
        </small>
        <strong className="mt-1 block text-sm text-ink-r">
          {materialsReady ? "Everything confirmed before departure" : "Waiting for provider confirmation"}
        </strong>
        <p className="mt-1 text-xs text-muted-r">
          {materialsReady
            ? "Provider confirms all owned equipment is loaded and all reserved rental items are already collected."
            : "The provider must confirm equipment, supplies and rental collection before starting the route. Doneeo blocks route progress until this is complete."}
        </p>
        <button
          className="mt-3 rounded-lg-r bg-ink-r px-4 py-2.5 text-xs font-semibold text-white"
          onClick={() => {
            setMaterialsReady(true);
            setNotification("Provider confirmed all equipment, materials and rental pickups. Departure is authorized.");
          }}
        >
          Demo: provider confirms readiness
        </button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg-r border border-line-r p-3">
          <small className="block text-[9px] font-bold text-brand-600-r">COMMITTED ARRIVAL</small>
          <strong className="mt-1 block text-sm text-ink-r">{requestedSchedule}</strong>
          <span className="mt-0.5 block text-[10px] text-muted-r">Acceptable arrival window: requested time ±15 minutes</span>
        </div>
        <div className={`rounded-lg-r border p-3 ${delayMinutes ? "border-[#e0a49b] bg-[#fff0ee]" : "border-line-r"}`}>
          <small className="block text-[9px] font-bold text-brand-600-r">CURRENT ARRIVAL STATUS</small>
          <strong className="mt-1 block text-sm text-ink-r">
            {providerArrived ? "Provider arrived" : delayMinutes ? `Delayed by ${delayMinutes} minutes` : "On schedule"}
          </strong>
          <span className="mt-0.5 block text-[10px] text-muted-r">
            {delayMinutes ? `Updated arrival: requested time +${delayMinutes} min` : "No delay reported"}
          </span>
        </div>
      </div>

      {delayMinutes > 0 && (
        <div className="mt-3 rounded-lg-r bg-[#ffe9e6] p-3 text-[#9f2f25]">
          <strong className="block text-xs">DELAY · +{delayMinutes} MIN</strong>
          <span className="mt-1 block text-xs">
            The provider’s note changed the arrival time and every remaining milestone estimate. A notification was
            sent to the requester and affected stop contacts.
          </span>
        </div>
      )}

      <label className="mt-3 block rounded-lg-r border border-line-r bg-surface-r p-3">
        <span className="block text-xs font-semibold text-ink-r">Provider delay note</span>
        <textarea
          value={incidentNote}
          onChange={event => setIncidentNote(event.target.value)}
          placeholder="Example: rental pickup is taking 20 minutes longer"
          className="mt-2 min-h-[60px] w-full resize-y rounded-lg-r border border-line-r p-2 text-xs outline-none focus:border-brand-500-r"
        />
        <button className="mt-2 rounded-lg-r border border-line-r px-3 py-2 text-xs font-semibold text-ink-r" onClick={reportDelay}>
          Report delay and add time
        </button>
      </label>

      <Button
        variant="primary"
        className="mt-3 w-full"
        disabled={!materialsReady}
        onClick={() => {
          setProviderArrived(true);
          setNotification("Provider arrived. Arrival notification sent to the requester and the contact at this stop.");
        }}
      >
        {materialsReady ? "Demo: provider confirms arrival" : "Arrival locked until readiness is confirmed"}
      </Button>
    </Card>
  );
}

function LiveExecutionPlan({
  delayMinutes,
  requestedSchedule,
  executionTimeline,
  activeExecutionStep,
  milestoneDurations,
  notification,
  incidentNote,
  setIncidentNote,
  reportDelay,
}: {
  delayMinutes: number;
  requestedSchedule: string;
  executionTimeline: ExecutionStep[];
  activeExecutionStep: number;
  milestoneDurations: Record<number, number>;
  notification: string;
  incidentNote: string;
  setIncidentNote: Dispatch<SetStateAction<string>>;
  reportDelay: () => void;
}) {
  return (
    <Card>
      <SectionHead
        eyebrow="LIVE EXECUTION PLAN"
        title="The confirmed plan, updated in real time"
        badge={delayMinutes ? `Updated · +${delayMinutes} min` : "On plan"}
      />
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div>
          <small className="block text-[8px] font-bold text-brand-600-r">CONFIRMED ARRIVAL</small>
          <strong className="mt-1 block text-sm text-ink-r">{addMinutesToSchedule(requestedSchedule, delayMinutes)}</strong>
        </div>
        <div>
          <small className="block text-[8px] font-bold text-brand-600-r">CURRENT EXPECTED FINISH</small>
          <strong className="mt-1 block text-sm text-ink-r">
            {addMinutesToSchedule(requestedSchedule, (executionTimeline.at(-1)?.finishOffset || 0) + delayMinutes)}
          </strong>
        </div>
        <div>
          <small className="block text-[8px] font-bold text-brand-600-r">REMAINING</small>
          <strong className="mt-1 block text-sm text-ink-r">
            {Math.max(
              0,
              (executionTimeline.at(-1)?.finishOffset || 0) - (executionTimeline[activeExecutionStep]?.startOffset || 0) + delayMinutes,
            )}{" "}
            min
          </strong>
        </div>
      </div>

      <div className="mt-3 grid gap-0">
        {executionTimeline.map((step, index) => (
          <div key={`live-${step.title}-${index}`} className="py-2.5">
            <div className="flex gap-3">
              <b
                className={`grid h-7 w-7 flex-none place-items-center rounded-full text-xs font-bold ${
                  index < activeExecutionStep
                    ? "bg-brand-500-r text-white"
                    : index === activeExecutionStep
                      ? "bg-accent-r text-white"
                      : "bg-line-r text-muted-r"
                }`}
              >
                {index < activeExecutionStep ? "✓" : index + 1}
              </b>
              <div className="flex-1">
                <strong className="block text-sm text-ink-r">{step.title}</strong>
                <p className="mt-0.5 text-xs text-muted-r">{step.description}</p>
                <small className="mt-0.5 block text-[10px] text-subtle-r">
                  {addMinutesToSchedule(requestedSchedule, step.startOffset + delayMinutes)} →{" "}
                  {addMinutesToSchedule(requestedSchedule, step.finishOffset + delayMinutes)} ·{" "}
                  {index < activeExecutionStep
                    ? `${milestoneDurations[index] || step.minutes} min actual`
                    : `likely ${step.minutes} min · range ${step.lowMinutes}–${step.highMinutes} min`}
                </small>
                {delayMinutes > 0 && index === activeExecutionStep && (
                  <div className="mt-2 rounded-lg-r bg-[#ffdeda] p-2.5 text-[#a33127]">
                    <strong className="block text-xs">DELAY · +{delayMinutes} MIN</strong>
                    <span className="mt-0.5 block text-[11px]">
                      {notification.startsWith("DELAY")
                        ? notification.replace("DELAY: ", "")
                        : "Provider reported an operational delay. This step and all following finish times were recalculated."}
                    </span>
                  </div>
                )}
                {index === activeExecutionStep && (
                  <label className="mt-2 block">
                    <textarea
                      value={incidentNote}
                      onChange={event => setIncidentNote(event.target.value)}
                      placeholder="Provider note, for example: traffic adds 20 minutes"
                      className="min-h-[56px] w-full resize-y rounded-lg-r border border-line-r p-2 text-xs outline-none focus:border-brand-500-r"
                    />
                    <button className="mt-2 rounded-lg-r border border-line-r px-3 py-2 text-xs font-semibold text-ink-r" onClick={reportDelay}>
                      Report change and update this plan
                    </button>
                  </label>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 rounded-lg-r bg-canvas-r p-3 text-[11px] leading-relaxed text-muted-r">
        Live times remain estimates and can change because of traffic, access, rental collection, recipient readiness
        or execution problems. Every confirmed change appears inside the affected milestone and updates all
        following times.
      </p>
    </Card>
  );
}

function CompletionReport({
  completionVariance,
  plannedMinutes,
  actualMinutes,
  delayMinutes,
  notification,
}: {
  completionVariance: number;
  plannedMinutes: number;
  actualMinutes: number;
  delayMinutes: number;
  notification: string;
}) {
  const over = completionVariance > 0;
  return (
    <Card className={over ? "border-[#d98177] bg-[#ffe9e6]" : "border-brand-200-r bg-brand-50-r/40"}>
      <small className={`text-[9px] font-bold tracking-[0.1em] ${over ? "text-[#9f2f25]" : "text-brand-600-r"}`}>
        FINAL PERFORMANCE REPORT
      </small>
      <h3 className="mt-1 text-lg font-bold text-ink-r">{over ? "Completed later than estimated" : "Completed within the estimate"}</h3>
      <div className="mt-3 grid gap-1.5 text-xs">
        <span className="flex justify-between text-muted-r">
          Original completion estimate <strong className="text-ink-r">{plannedMinutes} min</strong>
        </span>
        <span className="flex justify-between text-muted-r">
          Actual recorded time <strong className="text-ink-r">{actualMinutes} min</strong>
        </span>
        <span className="flex justify-between text-muted-r">
          Difference{" "}
          <strong className="text-ink-r">{over ? `+${completionVariance} min over` : `${Math.abs(completionVariance)} min faster`}</strong>
        </span>
        <span className="flex justify-between text-muted-r">
          Reported delay time <strong className="text-ink-r">{delayMinutes} min</strong>
        </span>
      </div>
      <p className="mt-3 text-xs text-muted-r">
        {over
          ? `The job required ${completionVariance} additional minutes compared with the estimate shown before booking.`
          : `The job finished ${Math.abs(completionVariance)} minutes faster than the original estimate.`}
      </p>
      {delayMinutes > 0 && (
        <p className="mt-1 text-xs text-muted-r">
          <strong className="text-ink-r">Reported issue:</strong>{" "}
          {notification.startsWith("DELAY") ? notification.replace("DELAY: ", "") : `${delayMinutes} minutes of delay were recorded during execution.`}
        </p>
      )}
    </Card>
  );
}

export function TrackingScreen({
  analysis,
  chosen,
  setStage,
  paymentState,
  bookingState,
  simulationProgress,
  jobCheckpoints,
  activeCheckpoint,
  activeServiceAssignment,
  isManagedHandoff,
  completeSimulationAction,
  simulationActionLabel,
  activeTimelineStep,
  handoffState,
  finalTotal,
  notification,
  requestedSchedule,
  completionDeadline,
  protectionCost,
  authorizeDemoPayment,
  savedReference,
  dispatchAttempt,
  providerStatus,
  sharedStopContacts,
  scheduleWindow,
  alternateTimesVisible,
  setAlternateTimesVisible,
  setAnswers,
  setNotification,
  routeNodes,
  estimatedRemaining,
  milestoneDurations,
  activeGateState,
  setTaskGateConfirmations,
  declineAndRematch,
  executionGateBlocked,
  advanceCheckpoint,
  taskGateBlocked,
  incidentNote,
  setIncidentNote,
  confirmWorkOrder,
  setProviderStatus,
  setActiveCheckpoint,
  providerArrived,
  materialsReady,
  setMaterialsReady,
  delayMinutes,
  reportDelay,
  setProviderArrived,
  executionTimeline,
  activeExecutionStep,
  completionVariance,
  plannedMinutes,
  actualMinutes,
  error,
  restart,
}: {
  analysis: PlannerAnalysis;
  chosen: PlanOption;
  setStage: (stage: number) => void;
  paymentState: PaymentState;
  bookingState: BookingState;
  simulationProgress: number;
  jobCheckpoints: JobCheckpoint[];
  activeCheckpoint: number;
  activeServiceAssignment: ServiceAssignment | undefined;
  isManagedHandoff: boolean;
  completeSimulationAction: () => void | Promise<void>;
  simulationActionLabel: string;
  activeTimelineStep: ExecutionStep | null;
  handoffState: string;
  finalTotal: number;
  notification: string;
  requestedSchedule: string;
  completionDeadline: string;
  protectionCost: number;
  authorizeDemoPayment: () => void | Promise<void>;
  savedReference: string;
  dispatchAttempt: number;
  providerStatus: ProviderStatus;
  sharedStopContacts: Array<{ stop: string; index: number; name: string; phone: string; invited: boolean }>;
  scheduleWindow: ScheduleWindow | null;
  alternateTimesVisible: boolean;
  setAlternateTimesVisible: Dispatch<SetStateAction<boolean>>;
  setAnswers: Dispatch<SetStateAction<Answers>>;
  setNotification: Dispatch<SetStateAction<string>>;
  routeNodes: RouteNode[];
  estimatedRemaining: number;
  milestoneDurations: Record<number, number>;
  activeGateState: { executor: boolean; customer: boolean } | undefined;
  setTaskGateConfirmations: Dispatch<SetStateAction<Record<number, { executor: boolean; customer: boolean }>>>;
  declineAndRematch: () => void;
  executionGateBlocked: boolean;
  advanceCheckpoint: () => void;
  taskGateBlocked: boolean;
  incidentNote: string;
  setIncidentNote: Dispatch<SetStateAction<string>>;
  confirmWorkOrder: () => void | Promise<void>;
  setProviderStatus: (status: ProviderStatus) => void;
  setActiveCheckpoint: (checkpoint: number) => void;
  providerArrived: boolean;
  materialsReady: boolean;
  setMaterialsReady: Dispatch<SetStateAction<boolean>>;
  delayMinutes: number;
  reportDelay: () => void;
  setProviderArrived: Dispatch<SetStateAction<boolean>>;
  executionTimeline: ExecutionStep[];
  activeExecutionStep: number;
  completionVariance: number;
  plannedMinutes: number;
  actualMinutes: number;
  error: string;
  restart: () => void;
}) {
  return (
    <section className="mx-auto max-w-[760px] px-[7%] pb-16 pt-10">
      <button onClick={() => setStage(2)} className="mb-6 text-sm text-muted-r transition-colors hover:text-ink-r">
        ← Back
      </button>

      <div className="grid gap-5">
        <TrackingIntro paymentState={paymentState} />

        {paymentState === "authorized" && (
          <GuidedSimulation
            bookingState={bookingState}
            simulationProgress={simulationProgress}
            jobCheckpoints={jobCheckpoints}
            activeCheckpoint={activeCheckpoint}
            activeServiceAssignment={activeServiceAssignment}
            isManagedHandoff={isManagedHandoff}
            chosen={chosen}
            completeSimulationAction={completeSimulationAction}
            simulationActionLabel={simulationActionLabel}
            activeTimelineStep={activeTimelineStep}
            handoffState={handoffState}
          />
        )}

        {paymentState !== "authorized" ? (
          <DemoPayment
            finalTotal={finalTotal}
            notification={notification}
            requestedSchedule={requestedSchedule}
            completionDeadline={completionDeadline}
            chosen={chosen}
            protectionCost={protectionCost}
            paymentState={paymentState}
            authorizeDemoPayment={authorizeDemoPayment}
          />
        ) : (
          <WorkOrderTracker
            analysis={analysis}
            chosen={chosen}
            savedReference={savedReference}
            dispatchAttempt={dispatchAttempt}
            activeCheckpoint={activeCheckpoint}
            jobCheckpoints={jobCheckpoints}
            providerStatus={providerStatus}
            sharedStopContacts={sharedStopContacts}
            requestedSchedule={requestedSchedule}
            scheduleWindow={scheduleWindow}
            completionDeadline={completionDeadline}
            notification={notification}
            alternateTimesVisible={alternateTimesVisible}
            setAlternateTimesVisible={setAlternateTimesVisible}
            setAnswers={setAnswers}
            setNotification={setNotification}
            routeNodes={routeNodes}
            estimatedRemaining={estimatedRemaining}
            milestoneDurations={milestoneDurations}
            activeTimelineStep={activeTimelineStep}
            activeGateState={activeGateState}
            setTaskGateConfirmations={setTaskGateConfirmations}
            declineAndRematch={declineAndRematch}
            executionGateBlocked={executionGateBlocked}
            advanceCheckpoint={advanceCheckpoint}
            taskGateBlocked={taskGateBlocked}
            incidentNote={incidentNote}
            setIncidentNote={setIncidentNote}
            bookingState={bookingState}
            confirmWorkOrder={confirmWorkOrder}
            setProviderStatus={setProviderStatus}
            setActiveCheckpoint={setActiveCheckpoint}
            protectionCost={protectionCost}
            finalTotal={finalTotal}
          />
        )}

        {paymentState === "authorized" && providerStatus === "accepted" && (
          <OperationsControl
            providerArrived={providerArrived}
            materialsReady={materialsReady}
            setMaterialsReady={setMaterialsReady}
            setNotification={setNotification}
            requestedSchedule={requestedSchedule}
            delayMinutes={delayMinutes}
            incidentNote={incidentNote}
            setIncidentNote={setIncidentNote}
            reportDelay={reportDelay}
            setProviderArrived={setProviderArrived}
          />
        )}

        {paymentState === "authorized" && providerStatus === "accepted" && (
          <LiveExecutionPlan
            delayMinutes={delayMinutes}
            requestedSchedule={requestedSchedule}
            executionTimeline={executionTimeline}
            activeExecutionStep={activeExecutionStep}
            milestoneDurations={milestoneDurations}
            notification={notification}
            incidentNote={incidentNote}
            setIncidentNote={setIncidentNote}
            reportDelay={reportDelay}
          />
        )}

        {bookingState === "saved" && (
          <CompletionReport
            completionVariance={completionVariance}
            plannedMinutes={plannedMinutes}
            actualMinutes={actualMinutes}
            delayMinutes={delayMinutes}
            notification={notification}
          />
        )}

        {error && (
          <p role="alert" className="rounded-xl-r border border-[#efcaca] bg-[#fff1f1] px-4 py-3 text-center text-sm text-[#9b2c2c]">
            {error}
          </p>
        )}
        <button onClick={restart} className="mx-auto block text-sm font-semibold text-brand-600-r">
          Plan another job
        </button>
        <p className="text-center text-xs text-subtle-r">Demo payment and dispatch only — no real charge, message or provider request is sent.</p>
      </div>
    </section>
  );
}
