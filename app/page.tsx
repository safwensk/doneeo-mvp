"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { createWorkOrderReference, saveWorkOrder } from "../lib/work-orders";
import { extractScheduleWindow, extractStreetAddresses, type PlannerAnalysis, type PlannerQuestion } from "../lib/planner";
import { householdCatalogStats } from "../lib/household-catalog";
import { Question } from "./_components/question";
import { EXECUTOR_PORTRAITS } from "./_domain/executor-pool";
import { assignmentCoversTask, optionsFor, recalculateJob, serviceForTask } from "./_domain/plan-options";
import type { Answers, GoogleRoute, PlanKey, ServiceAssignment } from "./_domain/plan-types";
import { addMinutesToSchedule, clockToMinutes } from "./_domain/schedule-format";

const householdCatalog = householdCatalogStats();

type IntakeAttempt = {
  request: string;
  correlationId: string;
  operationId: string;
};

type PlanControlState = {
  workCaseId: string;
  jobOrderId: string;
  state: string;
  stateVersion: number;
  correlationId: string;
  requirementReady: boolean;
  requirementContractRef: string | null;
  requirementContractVersion: number | null;
};

function controlFromPlanResponse(
  data: Record<string, unknown>,
): PlanControlState {
  if (
    typeof data.workCaseId !== "string" ||
    typeof data.jobOrderId !== "string" ||
    typeof data.state !== "string" ||
    typeof data.stateVersion !== "number" ||
    typeof data.correlationId !== "string"
  ) {
    throw new Error("Doneeo returned an invalid WorkCase control response.");
  }

  return {
    workCaseId: data.workCaseId,
    jobOrderId: data.jobOrderId,
    state: data.state,
    stateVersion: data.stateVersion,
    correlationId: data.correlationId,
    requirementReady: data.requirementReady === true,
    requirementContractRef:
      typeof data.requirementContractRef === "string"
        ? data.requirementContractRef
        : null,
    requirementContractVersion:
      typeof data.requirementContractVersion === "number"
        ? data.requirementContractVersion
        : null,
  };
}

function stableOperationId(prefix: string, value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}-${(hash >>> 0).toString(16)}`;
}

export default function Home() {
  const [stage, setStage] = useState(0);
  const [request, setRequest] = useState("Pick up a couch I bought on Marketplace and bring it to my third-floor apartment");
  const [analysis, setAnalysis] = useState<PlannerAnalysis | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [textDrafts, setTextDrafts] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<PlanKey>("recommended");
  const [plannerState, setPlannerState] = useState<"idle" | "thinking" | "ready">("idle");
  const [bookingState, setBookingState] = useState<"idle" | "saving" | "created" | "saved" | "error">("idle");
  const [savedReference, setSavedReference] = useState("");
  const [error, setError] = useState("");
  const [protection, setProtection] = useState<"none" | "standard">("none");
  const [providerStatus, setProviderStatus] = useState<"not_sent" | "awaiting" | "accepted">("not_sent");
  const [paymentState, setPaymentState] = useState<"unpaid" | "processing" | "authorized">("unpaid");
  const [dispatchAttempt, setDispatchAttempt] = useState(1);
  const [incidentNote, setIncidentNote] = useState("");
  const [notification, setNotification] = useState("");
  const [alternateTimesVisible, setAlternateTimesVisible] = useState(false);
  const [milestoneDurations, setMilestoneDurations] = useState<Record<number, number>>({});
  const [delayMinutes, setDelayMinutes] = useState(0);
  const [materialsReady, setMaterialsReady] = useState(false);
  const [providerArrived, setProviderArrived] = useState(false);
  const [activeCheckpoint, setActiveCheckpoint] = useState(0);
  const [taskGateConfirmations, setTaskGateConfirmations] = useState<Record<number, { executor: boolean; customer: boolean }>>({});
  const [googleRoute, setGoogleRoute] = useState<GoogleRoute | null>(null);
  const [routeState, setRouteState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [answerState, setAnswerState] = useState<"idle" | "validating">("idle");
  const [planControl, setPlanControl] = useState<PlanControlState | null>(null);
  const intakeAttemptRef = useRef<IntakeAttempt | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem("doneeo.activeWorkCase");
    if (!stored) return;

    let cancelled = false;

    const resume = async () => {
      try {
        const saved = JSON.parse(stored) as Partial<PlanControlState>;
        if (
          typeof saved.workCaseId !== "string" ||
          typeof saved.correlationId !== "string"
        ) {
          window.localStorage.removeItem("doneeo.activeWorkCase");
          return;
        }

        setPlannerState("thinking");

        const response = await fetch("/api/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workCaseId: saved.workCaseId,
            correlationId: saved.correlationId,
            operationId: `resume-${crypto.randomUUID()}`,
            resume: true,
          }),
        });

        const data = (await response.json()) as Record<string, unknown> & {
          error?: string;
          analysis?: PlannerAnalysis;
          answers?: Record<string, string | boolean>;
        };

        if (!response.ok || !data.analysis) {
          throw new Error(data.error || "Could not resume this WorkCase");
        }

        const control = controlFromPlanResponse(data);
        if (cancelled) return;

        setPlanControl(control);
        setAnalysis(data.analysis);
        setAnswers({
          ...(data.analysis.extractedAnswers || {}),
          ...(data.answers || {}),
        });
        setPlannerState("ready");
        setStage(1);
        window.localStorage.setItem(
          "doneeo.activeWorkCase",
          JSON.stringify(control),
        );
      } catch (caught) {
        if (cancelled) return;
        setPlannerState("idle");
        setError(
          caught instanceof Error
            ? caught.message
            : "Doneeo could not resume this WorkCase.",
        );
      }
    };

    void resume();
    return () => {
      cancelled = true;
    };
  }, []);

  const plans = useMemo(() => analysis ? optionsFor(analysis, answers) : [], [analysis, answers]);
  const operational = useMemo(() => analysis ? recalculateJob(analysis, answers) : null, [analysis, answers]);
  const chosen = plans.find(plan => plan.key === selected) || plans[1];
  const requestAddresses = analysis ? extractStreetAddresses(analysis.sourceText) : [];
  const serviceLocation = String(answers.service_address || requestAddresses.at(-1) || analysis?.stops?.at(-1) || "Location to confirm");
  const fallbackLocations = analysis?.category === "moving"
    ? [String(answers.pickup_address || "Pickup to confirm"), String(answers.service_address || "Destination to confirm")]
    : [serviceLocation];
  const baseRouteNodes = analysis?.routeNodes?.length ? analysis.routeNodes : (analysis?.stops.length ? analysis.stops : fallbackLocations).map((location, index) => ({ location, actions: [index === 0 && analysis?.category === "moving" ? "Complete pickup or first service action" : "Complete the confirmed service work"] }));
  const retailerHint = /costco\s+(?:anjou|enjou)/i.test(request) ? "Costco Anjou" : /\bcostco\b/i.test(request) ? "Costco" : "";
  const requestIncludesRetailPickup = Boolean(retailerHint && /pick\s*up|collect|bring|deliver/i.test(request));
  const derivedRouteNodes = requestIncludesRetailPickup && baseRouteNodes.length === 1 && !baseRouteNodes.some(node => /costco/i.test(node.location))
    ? [{ location: retailerHint, actions: ["Pick up and verify the confirmed item at the retailer"] }, ...baseRouteNodes]
    : baseRouteNodes;
  const routeNodes = derivedRouteNodes.map((node, index) => {
    if (!analysis || index !== derivedRouteNodes.length - 1) return node;
    const onsiteTasks = derivedRouteNodes.length > 1 ? analysis.tasks.slice(1) : analysis.tasks;
    return { ...node, actions: onsiteTasks.length ? onsiteTasks : node.actions };
  });
  const routeStops = routeNodes.map(node => node.location);
  const hasUnresolvedExternalRoute = routeNodes.length === 1 && requestIncludesRetailPickup;
  const hasDrivingRoute = routeNodes.length > 1 || hasUnresolvedExternalRoute;
  const answeredEndpoints = [String(answers.pickup_address || "").trim(), String(answers.service_address || "").trim()].filter(value => value.length > 4);
  const exactRouteAddresses = routeStops.length >= 2 ? routeStops : answeredEndpoints;
  const googleMapsUrl = exactRouteAddresses.length >= 2 ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(exactRouteAddresses[0])}&destination=${encodeURIComponent(exactRouteAddresses[exactRouteAddresses.length - 1])}${exactRouteAddresses.length > 2 ? `&waypoints=${encodeURIComponent(exactRouteAddresses.slice(1, -1).join("|"))}` : ""}&travelmode=driving` : "";
  const progress = ((stage + 1) / 4) * 100;
  const visibleQuestions = (analysis?.questions || []).filter(question => {
    const concept = `${question.id} ${question.label}`.toLowerCase();
    if (question.required === false) return false;
    if (!hasDrivingRoute && (/^stop_\d+_(?:floor|elevator|vehicle_access)$/.test(question.id) || /pickup|final delivery|delivery address|loading area|vehicle access|usable elevator/.test(concept))) return false;
    if (!analysis?.recurrence.recurring && /frequency|how often|recurr|repeat|same provider each/.test(concept)) return false;
    const elevatorMatch = question.id.match(/^stop_(\d+)_elevator$/);
    if (elevatorMatch && answers[`stop_${elevatorMatch[1]}_floor`] === "Ground floor") return false;
    return true;
  });
  const questionAnswered = (question: PlannerQuestion) => {
    const value = answers[question.id];
    return typeof value === "boolean" || (typeof value === "string" && value.trim().length > 1);
  };
  const nextUnansweredId = visibleQuestions.find(question => !questionAnswered(question))?.id;
  const displayedQuestions = visibleQuestions.filter(question => question.id === nextUnansweredId);
  const requiredComplete = visibleQuestions.filter(question => question.required).every(question => {
    const value = answers[question.id];
    return typeof value === "boolean" || (typeof value === "string" && value.trim().length > 1);
  });
  // Reusable operating equipment belongs to the matched provider or rental
  // workflow. Customer equipment declarations are useful but never block the
  // customer from seeing matching options.
  const equipmentComplete = true;
  const gateBlocked = analysis?.rulesGate?.status === "blocked";
  const liveGateStatus = gateBlocked ? "blocked" : requiredComplete && equipmentComplete ? "cleared" : "needs_information";
  const providerClassLabel = analysis?.rulesGate ? ({
    general_helper: "General helper",
    skilled_executor: "Skilled executor",
    licensed_professional: "Licensed professional",
    regulated_care_provider: "Regulated-care provider",
    specialist_only: "Specialist only",
  }[analysis.rulesGate.providerClass]) : "Eligibility pending";
  const protectionCost = protection === "standard" ? 15 : 0;
  const finalTotal = (chosen?.price || 0) + protectionCost;
  const sharedStopContacts = routeStops.map((stop, index) => ({ stop, index, name: String(answers[`stop_contact_${index + 1}_name`] || ""), phone: String(answers[`stop_contact_${index + 1}_phone`] || ""), invited: answers[`stop_contact_${index + 1}_invite`] === true })).filter(contact => contact.invited && contact.name);
  const scheduleWindow = analysis?.scheduleWindow || extractScheduleWindow(request);
  // Preparation is executor-side by default. Only steps the customer actually
  // asked for (a purchase or a rental) surface here, so the price is legible
  // without putting the executor's own overhead in front of them.
  const billablePreparation = (analysis?.preparation || []).filter(step => step.billable);
  const scheduleAnswer = String(answers.schedule || answers.requested_time || "Requested date and time to be confirmed");
  const requestedSchedule = scheduleWindow?.arrivalTime ? scheduleWindow.arrivalLabel : scheduleAnswer;
  const completionDeadline = scheduleWindow?.deadlineLabel || String(answers.deadline || "No fixed completion deadline supplied");
  const selectedTeamSize = chosen?.teamFormation.length || analysis?.intelligence?.manpower.recommended || analysis?.recommendedTeamSize || 1;
  const workPhases = analysis?.intelligence?.primitives || [];
  const workstreams = analysis?.intelligence?.workstreams || [];
  const phaseMinutes = (phase: typeof workPhases[number], value: number) => {
    if (!phase.parallelizable) return value;
    const calibratedCrew = Math.max(1, phase.recommendedCrew || phase.minimumCrew || 1);
    const usefulCrew = Math.max(1, Math.min(selectedTeamSize, calibratedCrew));
    return Math.ceil((value * calibratedCrew / usefulCrew) / 5) * 5;
  };
  const orderedWorkPhases = workstreams.length
    ? workstreams.flatMap(stream => stream.phaseIds.map(id => workPhases.find(phase => phase.id === id)).filter((phase): phase is typeof workPhases[number] => Boolean(phase)))
    : workPhases;
  const managedHandoffAfterTask = chosen?.serviceAssignments.length > 1
    ? analysis?.intelligence?.fulfillment.groups[0]?.handoffAfterTask || 2
    : null;
  const taskEndByPhaseId = new Map(workstreams.map(stream => [stream.phaseIds.at(-1), stream]));
  const streamByPhaseId = new Map(workstreams.flatMap(stream => stream.phaseIds.map(id => [id, stream] as const)));
  const timelineInputs = [
    { stepId: "provider_arrival", taskSequence: null, taskTitle: "Arrival and readiness", isGate: false, title: "Provider arrival", description: "Provider reaches the first location at the accepted time and confirms arrival.", minutes: 0, lowMinutes: 0, highMinutes: 0, qualification: "Matched provider" },
    ...routeNodes.flatMap((node, index) => {
      const nodePhases = orderedWorkPhases.filter(phase => phase.locationIndex === index || (phase.locationIndex === undefined && index === routeNodes.length - 1));
      const accessMinutes = operational?.accessByStop[index]?.minutes || 0;
      const defaultLegMinutes = routeNodes.length > 1 ? Math.ceil((operational?.routeMinutes || 20 * (routeNodes.length - 1)) / (routeNodes.length - 1)) : 0;
      const travelMinutes = index > 0 ? googleRoute?.legs[index - 1]?.trafficMinutes || defaultLegMinutes : 0;
      const phaseSteps = nodePhases.length ? nodePhases.flatMap(phase => {
        const taskEnd = taskEndByPhaseId.get(phase.id);
        const stream = streamByPhaseId.get(phase.id);
        const phaseStep = {
          stepId: phase.id,
          taskSequence: stream?.sequence || null,
          taskTitle: stream?.title || "Household work",
          isGate: false,
          title: phase.label,
          description: `${node.location} · ${phase.domain?.replaceAll("_", " ") || "household work"}${phase.dependencies.length ? ` · depends on ${phase.dependencies.join(", ")}` : ""}.`,
          minutes: phaseMinutes(phase, phase.unitMinutes),
          lowMinutes: phaseMinutes(phase, phase.lowMinutes || Math.round(phase.unitMinutes * .75)),
          highMinutes: phaseMinutes(phase, phase.highMinutes || Math.round(phase.unitMinutes * 1.5)),
          qualification: (phase.qualification || "general_helper").replaceAll("_", " "),
        };
        if (!taskEnd || taskEnd.sequence === workstreams.length) return [phaseStep];
        const completionGate = {
          stepId: `task_${taskEnd.sequence}_completion_gate`,
          taskSequence: taskEnd.sequence,
          taskTitle: taskEnd.title,
          isGate: true,
          title: `Task ${taskEnd.sequence} complete · confirmation checkpoint`,
          description: `Executor records completion evidence. The customer or authorized recipient confirms “${taskEnd.title}” before Task ${taskEnd.sequence + 1} starts.`,
          minutes: 3,
          lowMinutes: 2,
          highMinutes: 8,
          qualification: "customer and executor confirmation",
        };
        const managedHandoff = managedHandoffAfterTask === taskEnd.sequence ? {
          stepId: "managed_service_handoff",
          taskSequence: null,
          taskTitle: "Doneeo-managed service transition",
          isGate: false,
          title: "Service A departs · Service B arrives",
          description: `${chosen?.serviceAssignments[0]?.executors} submits delivery condition proof and leaves. Doneeo confirms the release, then ${chosen?.serviceAssignments[1]?.executors} arrives for Task ${taskEnd.sequence + 1}. The customer keeps the same order and does not coordinate the teams.`,
          minutes: 10,
          lowMinutes: 5,
          highMinutes: 20,
          qualification: "Doneeo-managed handoff",
        } : null;
        return [phaseStep, completionGate, ...(managedHandoff ? [managedHandoff] : [])];
      }) : [{
        stepId: `stop_${index + 1}_work`, taskSequence: null, taskTitle: "Confirmed service", isGate: false,
        title: `Execute Stop ${index + 1}`,
        description: `${node.actions.join(" · ")} at ${node.location}.`,
        minutes: Math.max(30, 15 * node.actions.length),
        lowMinutes: Math.max(20, 10 * node.actions.length),
        highMinutes: Math.max(60, 30 * node.actions.length),
        qualification: "matched provider",
      }];
      return [
        ...(index > 0 ? [{ stepId: `travel_${index + 1}`, taskSequence: null, taskTitle: "Route", isGate: false, title: `Travel to Stop ${index + 1}`, description: `Drive to ${node.location} using the traffic-aware route.`, minutes: travelMinutes, lowMinutes: travelMinutes, highMinutes: travelMinutes, qualification: "driver" }] : []),
        ...(accessMinutes > 0 ? [{ stepId: `access_${index + 1}`, taskSequence: null, taskTitle: "Access", isGate: false, title: `Access and handling · Stop ${index + 1}`, description: `Account for the confirmed floor, elevator, parking and carrying conditions at ${node.location}.`, minutes: accessMinutes, lowMinutes: accessMinutes, highMinutes: accessMinutes, qualification: "handling team" }] : []),
        ...phaseSteps,
      ];
    }),
    ...(analysis?.intelligence?.estimate.bufferMinutes ? [{ stepId: "uncertainty_allowance", taskSequence: null, taskTitle: "Planning reserve", isGate: false, title: "Operational uncertainty allowance", description: `A transparent planning reserve for ${hasDrivingRoute ? "traffic variation, " : ""}site condition, fit, access and execution issues. Unused time is released from the live ETA.`, minutes: analysis.intelligence.estimate.bufferMinutes, lowMinutes: 0, highMinutes: analysis.intelligence.estimate.bufferMinutes, qualification: "planning reserve" }] : []),
    { stepId: "completion_validation", taskSequence: workstreams.at(-1)?.sequence || null, taskTitle: workstreams.at(-1)?.title || "Complete work order", isGate: true, title: workstreams.length > 1 ? `Task ${workstreams.length} and complete order validation` : "Completion validation", description: "Executor submits completion evidence. The customer or authorized recipient verifies the final result and closes the complete order.", minutes: 5, lowMinutes: 5, highMinutes: 10, qualification: "customer and executor confirmation" },
  ];
  const executionTimeline = timelineInputs.reduce<Array<{ stepId: string; taskSequence: number | null; taskTitle: string; isGate: boolean; title: string; description: string; minutes: number; lowMinutes: number; highMinutes: number; qualification: string; startOffset: number; finishOffset: number }>>((steps, step) => {
    const startOffset = steps.at(-1)?.finishOffset || 0;
    steps.push({ ...step, startOffset, finishOffset: startOffset + step.minutes });
    return steps;
  }, []);
  const plannedExecutionMinutes = executionTimeline.at(-1)?.finishOffset || 0;
  const assignmentWindow = (assignment: ServiceAssignment, assignmentIndex: number, assignmentCount: number) => {
    const coveredSteps = executionTimeline.filter(step => step.taskSequence && assignmentCoversTask(assignment, step.taskSequence));
    const firstCovered = coveredSteps[0];
    const lastCovered = coveredSteps.at(-1);
    const startOffset = assignmentIndex === 0 ? 0 : firstCovered?.startOffset || 0;
    const finishOffset = assignmentCount === 1 ? plannedExecutionMinutes : lastCovered?.finishOffset || plannedExecutionMinutes;
    const startLocation = assignmentIndex === 0 ? routeNodes[0]?.location : routeNodes.at(-1)?.location;
    const finishLocation = routeNodes.at(-1)?.location;
    return { startOffset, finishOffset, startLocation, finishLocation };
  };
  const resourceTask = (resourceName: string) => {
    const matcher = /mount|anchor|stud|ladder|level|drill/i.test(resourceName) ? /television|tv|wall-mount/i
      : /installation toolkit|plumb|water|leak|connection|fitting|seal|valve/i.test(resourceName) ? /install|connect|operation|leak/i
      : /dolly|truck|vehicle|strap|blanket|hand cart|protective equipment/i.test(resourceName) ? /pick|transport|deliver|box|carry/i
      : null;
    const index = matcher ? analysis?.tasks.findIndex(task => matcher.test(task)) ?? -1 : -1;
    return index >= 0 ? { sequence: index + 1, title: analysis?.tasks[index] || "Confirmed work" } : { sequence: 1, title: analysis?.tasks[0] || "Complete work order" };
  };
  const resourceApprovalKey = (name: string) => `resource_approval_${name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
  const resourcesRequiringApproval = chosen?.equipmentRows.filter(row => row.source === "Rental" || row.source === "Purchase") || [];
  const resourcesApproved = resourcesRequiringApproval.every(row => answers[resourceApprovalKey(row.name)] === true);
  const totalLow = executionTimeline.reduce((sum, step) => sum + step.lowMinutes, 0);
  const totalHigh = executionTimeline.reduce((sum, step) => sum + step.highMinutes, 0);
  const arrivalClockMinutes = clockToMinutes(scheduleWindow?.arrivalTime || requestedSchedule);
  const rawDeadlineMinutes = clockToMinutes(scheduleWindow?.deadlineTime || "");
  const deadlineClockMinutes = arrivalClockMinutes !== null && rawDeadlineMinutes !== null && rawDeadlineMinutes < arrivalClockMinutes ? rawDeadlineMinutes + 1440 : rawDeadlineMinutes;
  const deadlineFeasible = arrivalClockMinutes !== null && deadlineClockMinutes !== null ? arrivalClockMinutes + plannedExecutionMinutes <= deadlineClockMinutes : null;
  const deadlineMargin = arrivalClockMinutes !== null && deadlineClockMinutes !== null ? deadlineClockMinutes - (arrivalClockMinutes + plannedExecutionMinutes) : null;
  const preExecutionCheckpoints = analysis && chosen ? [
    { title: "Payment authorized", detail: `Test payment of $${finalTotal} CAD is authorized. It will be captured according to the service terms.`, actor: "Customer", eta: "Done" },
    { title: "Provider offer sent", detail: `The confirmed work order was sent to match attempt ${dispatchAttempt}. The provider sees the full execution responsibilities and must accept.`, actor: "Doneeo", eta: "Awaiting response" },
    { title: "Provider acceptance", detail: `${chosen.provider} reviews and accepts the tasks, route, equipment responsibility, milestones, time and price.`, actor: chosen.provider, eta: "5–30 min" },
    ...sharedStopContacts.map(contact => ({ title: `${contact.name} confirms stop ${contact.index + 1}`, detail: `${contact.name} receives only the timing, arrival, handoff/service and validation details for ${contact.stop}. Price and unrelated stops remain private.`, actor: contact.name, eta: "Before arrival" })),
    { title: "Equipment ready", detail: chosen.rentalTotal ? `Tools and materials are itemized in the order. Doneeo reserves rentals and purchases only after customer approval; every item is re-confirmed before the responsible team departs.` : "Every reusable tool is confirmed in customer or provider inventory. The responsible team re-confirms loading before departure.", actor: "Doneeo + responsible team", eta: "Before departure" },
    { title: "Provider en route", detail: `Arrival updates are active for the first stop. Contact options become available for operational coordination.`, actor: chosen.provider, eta: "Live ETA" },
  ] : [];
  // Pre-execution checkpoints have no timeline step behind them; execution steps do.
  // The optional member is what makes `?? -1` and `=== undefined` below meaningful.
  type JobCheckpoint = { title: string; detail: string; actor: string; eta: string; timelineIndex?: number };
  const jobCheckpoints: JobCheckpoint[] = analysis && chosen ? [
    ...preExecutionCheckpoints,
    ...executionTimeline.map((step, timelineIndex) => ({ title: step.taskSequence ? `Task ${step.taskSequence} · ${step.title}` : step.title, detail: step.description, actor: step.isGate ? "Responsible team + customer" : step.taskSequence ? serviceForTask(chosen.serviceAssignments, step.taskSequence)?.executors || chosen.provider : chosen.serviceAssignments[0]?.executors || chosen.provider, eta: step.minutes ? `${step.minutes} min likely` : "At arrival", timelineIndex })),
  ] : [];
  const activeTimelineIndex = Number(jobCheckpoints[activeCheckpoint]?.timelineIndex ?? -1);
  const activeTimelineStep = activeTimelineIndex >= 0 ? executionTimeline[activeTimelineIndex] : null;
  const activeGateState = activeTimelineStep?.isGate && activeTimelineStep.taskSequence ? taskGateConfirmations[activeTimelineStep.taskSequence] : undefined;
  const taskGateBlocked = Boolean(activeTimelineStep?.isGate && (!activeGateState?.executor || !activeGateState?.customer));
  const executionGateBlocked = providerStatus === "accepted" && ((!materialsReady && ["Equipment ready", "Provider en route"].includes(jobCheckpoints[activeCheckpoint]?.title || "")) || taskGateBlocked);
  const estimatedRemaining = activeTimelineIndex >= 0 ? Math.max(0, plannedExecutionMinutes - (executionTimeline[activeTimelineIndex]?.startOffset || 0)) : plannedExecutionMinutes;
  const plannedMinutes = Math.max(60, totalHigh);
  const actualMinutes = Object.entries(milestoneDurations).reduce((sum, [checkpointIndex, minutes]) => jobCheckpoints[Number(checkpointIndex)]?.timelineIndex === undefined ? sum : sum + minutes, 0) + delayMinutes;
  const completionVariance = actualMinutes - plannedMinutes;
  const activeExecutionStep = Math.min(executionTimeline.length - 1, Math.max(0, activeTimelineIndex));
  const activeServiceAssignment = activeTimelineStep?.taskSequence ? serviceForTask(chosen?.serviceAssignments || [], activeTimelineStep.taskSequence) : undefined;
  const isManagedHandoff = activeTimelineStep?.stepId === "managed_service_handoff";
  const handoffTimelineIndex = executionTimeline.findIndex(step => step.stepId === "managed_service_handoff");
  const handoffState = handoffTimelineIndex < 0 ? "not_needed" : activeTimelineIndex > handoffTimelineIndex ? "complete" : activeTimelineIndex === handoffTimelineIndex ? "active" : "pending";
  const simulationProgress = jobCheckpoints.length ? Math.round(((activeCheckpoint + 1) / jobCheckpoints.length) * 100) : 0;
  const simulationActionLabel = bookingState === "saved" ? "Simulation complete"
    : providerStatus !== "accepted" ? "Demo: provider accepts the complete order"
    : jobCheckpoints[activeCheckpoint]?.title === "Equipment ready" ? "Confirm equipment readiness and continue"
    : jobCheckpoints[activeCheckpoint]?.title === "Provider en route" ? "Start route to the first stop"
    : activeTimelineStep?.stepId === "provider_arrival" ? "Confirm arrival and begin execution"
    : activeTimelineStep?.isGate && activeCheckpoint === jobCheckpoints.length - 1 ? "Approve final result and create report"
    : activeTimelineStep?.isGate ? "Record both confirmations and continue"
    : isManagedHandoff ? "Complete the managed handoff"
    : "Complete this step and continue";
  const advanceCheckpoint = () => {
    if (executionGateBlocked) {
      setNotification(`Doneeo Rules Gate blocked departure: the provider must confirm ${hasDrivingRoute ? "tools, materials, vehicle and rentals" : "tools, materials and rentals"} first.`);
      return;
    }
    const next = Math.min(activeCheckpoint + 1, jobCheckpoints.length - 1);
    if (jobCheckpoints[next]?.title === "Provider acceptance") setProviderStatus("awaiting");
    if (jobCheckpoints[activeCheckpoint]?.title === "Provider acceptance") setProviderStatus("accepted");
    setMilestoneDurations(current => ({ ...current, [activeCheckpoint]: activeTimelineStep?.minutes || 12 + ((activeCheckpoint * 7) % 19) }));
    setActiveCheckpoint(next);
    if (jobCheckpoints[activeCheckpoint]?.title.includes("Provider arrival")) { setProviderArrived(true); setNotification("Provider arrived. Arrival notification sent to the requester and the authorized contact."); }
    else setNotification(`Update sent: ${jobCheckpoints[activeCheckpoint]?.title} completed. Remaining ETA recalculated.`);
  };
  const reportDelay = () => {
    const parsed = Number(incidentNote.match(/\d+/)?.[0] || 15);
    setDelayMinutes(current => current + parsed);
    setNotification(`DELAY: provider reported +${parsed} min. Arrival and remaining completion time were recalculated; affected participants were notified.`);
    setIncidentNote("");
  };
  const authorizeDemoPayment = async () => {
    setPaymentState("processing");
    await new Promise(resolve => window.setTimeout(resolve, 650));
    try {
      const reference = await persistConfirmedWorkOrder();
      setPaymentState("authorized");
      setProviderStatus("awaiting");
      setActiveCheckpoint(1);
      setNotification(`Payment authorized. Work order ${reference} was saved and sent to the executor workspace.`);
    } catch (caught) {
      setPaymentState("unpaid");
      setNotification(caught instanceof Error ? caught.message : "The test authorization could not create the shared work order. Please try again.");
    }
  };
  const declineAndRematch = () => {
    setDispatchAttempt(current => current + 1);
    setProviderStatus("awaiting");
    setActiveCheckpoint(1);
    setAlternateTimesVisible(true);
    setNotification("The provider declined the requested time. Doneeo is checking the next match and alternate time options.");
  };

  const analyzeRequest = async () => {
    const requestText = request.trim();
    if (requestText.length < 10) return;

    setPlannerState("thinking");
    setError("");
    setTextDrafts({});
    setPlanControl(null);
    window.localStorage.removeItem("doneeo.activeWorkCase");

    let attempt = intakeAttemptRef.current;
    if (!attempt || attempt.request !== requestText) {
      attempt = {
        request: requestText,
        correlationId: crypto.randomUUID(),
        operationId: crypto.randomUUID(),
      };
      intakeAttemptRef.current = attempt;
    }

    try {
      const response = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request: requestText,
          correlationId: attempt.correlationId,
          operationId: attempt.operationId,
        }),
      });

      const data = (await response.json()) as Record<string, unknown> & {
        error?: string;
        analysis?: PlannerAnalysis;
      };

      if (!response.ok || !data.analysis) {
        throw new Error(data.error || "Could not analyze request");
      }

      const control = controlFromPlanResponse(data);

      intakeAttemptRef.current = null;
      setPlanControl(control);
      setAnalysis(data.analysis);
      setAnswers(data.analysis.extractedAnswers || {});
      setPlannerState("ready");
      setStage(1);
      window.localStorage.setItem(
        "doneeo.activeWorkCase",
        JSON.stringify(control),
      );
    } catch (caught) {
      setAnalysis(null);
      setPlanControl(null);
      setPlannerState("idle");
      setError(
        caught instanceof Error
          ? caught.message
          : "Doneeo could not start this WorkCase. Please try again.",
      );
    }
  };

  const validateAnswer = async (
    question: PlannerQuestion,
    value: string | boolean,
  ) => {
    if (!planControl) {
      setError(
        "The WorkCase control state is missing. Restart the request before continuing.",
      );
      return;
    }

    const nextAnswers = { ...answers, [question.id]: value };

    if (question.type !== "text") {
      setAnswers(nextAnswers);
    }

    setAnswerState("validating");
    setError("");

    const operationId = stableOperationId(
      `answer-${planControl.workCaseId}-v${planControl.stateVersion}-${question.id}`,
      String(value),
    );

    try {
      const response = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workCaseId: planControl.workCaseId,
          expectedStateVersion: planControl.stateVersion,
          correlationId: planControl.correlationId,
          operationId,
          answers: nextAnswers,
        }),
      });

      const data = (await response.json()) as Record<string, unknown> & {
        error?: string;
        analysis?: PlannerAnalysis;
      };

      if (!response.ok || !data.analysis) {
        throw new Error(data.error || "Could not validate this answer");
      }

      const control = controlFromPlanResponse(data);

      setPlanControl(control);
      window.localStorage.setItem(
        "doneeo.activeWorkCase",
        JSON.stringify(control),
      );
      setAnalysis(data.analysis);
      setAnswers(current => ({
        ...current,
        [question.id]: value,
        ...(data.analysis?.extractedAnswers || {}),
      }));

      if (question.type === "text") {
        setTextDrafts(current => {
          const next = { ...current };
          delete next[question.id];
          return next;
        });
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Doneeo could not validate this answer. Please try again.",
      );
    } finally {
      setAnswerState("idle");
    }
  };

  const buildMatchedOptions = async () => {
    if (!analysis) return;
    setError("");

    if (!planControl?.requirementReady) {
      setError(
        "Doneeo is still resolving the work requirements. Matching cannot start until the Requirement Contract is ready.",
      );
      return;
    }

    const remaining = visibleQuestions.filter(question => question.required !== false && !questionAnswered(question));
    if (remaining.length) {
      setError("Please complete the visible operational detail before matching.");
      return;
    }
    // The request has already been recalculated after every committed answer.
    // Do not ask an AI architect to regenerate the intake here: that could add
    // a new, invisible question after the UI said the intake was complete.
    setSelected(analysis.intelligence?.fulfillment.mode === "coordinated_specialists" ? "budget" : "recommended");
    setStage(2);
    if (hasDrivingRoute) calculateGoogleRoute(analysis.routeNodes.map(node => node.location));
  };

  const persistConfirmedWorkOrder = async () => {
    if (!analysis || !chosen) return;
    const reference = createWorkOrderReference();
    const serviceAddress = String(answers.service_address || serviceLocation || "Montréal");
    const pickupAddress = String(answers.pickup_address || serviceAddress);
    const teamSize = chosen.teamFormation.length || analysis.intelligence?.manpower.recommended || 1;
    const selectedFulfillment = chosen.serviceAssignments.length > 1 && analysis.intelligence?.fulfillment
      ? analysis.intelligence.fulfillment
      : {
          mode: "single_team" as const,
          singleCustomerOrder: true as const,
          rationale: "The selected option uses one continuous cross-qualified team for every task in the customer order.",
          groups: [{
            id: "continuous_team",
            title: "Continuous execution team",
            executorRole: "Cross-qualified transport and in-home team",
            taskSequences: workstreams.map(stream => stream.sequence),
            vehicleRequired: hasDrivingRoute,
            handoffAfterTask: null,
          }],
        };
    setBookingState("saving");
    setError("");
    try {
      await saveWorkOrder({
        public_reference: reference,
        source: "mvp",
        status: "draft",
        request_text: request,
        job_category: analysis.category,
        city: "Montréal",
        pickup_address: pickupAddress,
        delivery_address: serviceAddress,
        schedule_text: requestedSchedule,
        access_floor: String(answers.floor || "Not applicable"),
        has_elevator: Boolean(answers.elevator),
        customer_has_straps: Boolean(answers.straps),
        selected_plan: selected,
        team_size: teamSize,
        vehicle_type: hasDrivingRoute ? "matched to confirmed load and route" : "not required for on-site execution",
        estimated_duration_min: plannedExecutionMinutes,
        route_plan: { pickup: pickupAddress, destination: serviceAddress, stops: routeNodes.map((node, index) => ({ location: node.location, actions: !hasDrivingRoute && routeNodes.length === 1 ? analysis.tasks : node.actions, access: { floor: answers[`stop_${index + 1}_floor`] || null, elevator: answers[`stop_${index + 1}_elevator`] ?? null, vehicle_access: answers[`stop_${index + 1}_vehicle_access`] || null }, contactName: answers[`stop_contact_${index + 1}_name`] || null })), seller_invite: answers.seller_invite === true, seller_name: answers.seller_invite === true ? String(answers.seller_name || "Marketplace seller") : null, status: hasDrivingRoute ? "coordinated route" : "one-property work" },
        equipment_plan: { summary: chosen.equipment, resources: analysis.intelligence?.resources || [], customer_answers: answers },
        pricing: { currency: "CAD", total: finalTotal, explanation: `${chosen.why} Protection: ${protection === "standard" ? "prototype protection selected" : "declined"}.` },
        work_steps: executionTimeline.map((step, index) => `${index + 1}. ${step.taskSequence ? `Task ${step.taskSequence} · ` : ""}${step.title}`),
        work_plan: {
          tasks: workstreams.map(stream => ({ sequence: stream.sequence, title: stream.title, domain: stream.domain, qualification: stream.qualification, resourceIds: stream.resourceIds, minimumCrew: stream.minimumCrew, recommendedCrew: stream.recommendedCrew, likelyMinutes: stream.likelyMinutes, rangeLow: stream.rangeLow, rangeHigh: stream.rangeHigh, completionGate: stream.completionGate, serviceGroup: stream.serviceGroup, assignedRole: stream.assignedRole, handoffRequired: stream.handoffRequired })),
          timeline: executionTimeline.map((step, index) => ({ sequence: index + 1, taskSequence: step.taskSequence, title: step.title, description: step.description, minutes: step.minutes, lowMinutes: step.lowMinutes, highMinutes: step.highMinutes, qualification: step.qualification, isGate: step.isGate })),
          skills: analysis.skillRequirements,
          domains: analysis.intelligence?.domains?.map(domain => domain.id) || [],
          fulfillment: selectedFulfillment,
        },
      });
      setSavedReference(reference);
      setBookingState("created");
      return reference;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn't save this work order.");
      setBookingState("error");
      throw caught;
    }
  };

  const completeWorkOrder = async () => {
    if (!savedReference) return;
    setBookingState("saving");
    try {
      const response = await fetch("/api/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "work_order_status", reference: savedReference, status: "completed" }),
      });
      if (!response.ok) throw new Error("Could not close the shared work order");
      setBookingState("saved");
      setNotification(`Work order ${savedReference} is complete in the customer, executor and data interfaces.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn't close this work order.");
      setBookingState("error");
    }
  };
  const confirmWorkOrder = completeWorkOrder;

  const completeSimulationAction = async () => {
    if (bookingState === "saving" || bookingState === "saved") return;
    if (providerStatus !== "accepted") {
      const readinessIndex = jobCheckpoints.findIndex(checkpoint => checkpoint.title === "Equipment ready");
      setProviderStatus("accepted");
      setActiveCheckpoint(readinessIndex >= 0 ? readinessIndex : Math.min(activeCheckpoint + 1, jobCheckpoints.length - 1));
      setNotification(`Provider accepted the complete order. Doneeo now verifies equipment before departure.`);
      return;
    }
    const title = jobCheckpoints[activeCheckpoint]?.title || "Current milestone";
    const next = Math.min(activeCheckpoint + 1, jobCheckpoints.length - 1);
    if (title === "Equipment ready") {
      setMaterialsReady(true);
      setActiveCheckpoint(next);
      setNotification("All tools, materials, vehicle and rentals are confirmed. The route is released.");
      return;
    }
    if (title === "Provider en route") {
      setActiveCheckpoint(next);
      setNotification("The assigned service is en route. Arrival tracking is active.");
      return;
    }
    if (activeTimelineStep?.stepId === "provider_arrival") {
      setProviderArrived(true);
      setMilestoneDurations(current => ({ ...current, [activeCheckpoint]: 0 }));
      setActiveCheckpoint(next);
      setNotification("Arrival confirmed. The first requested task is now active.");
      return;
    }
    if (activeTimelineStep?.isGate && activeTimelineStep.taskSequence) {
      setTaskGateConfirmations(current => ({ ...current, [activeTimelineStep.taskSequence!]: { executor: true, customer: true } }));
      setMilestoneDurations(current => ({ ...current, [activeCheckpoint]: activeTimelineStep.minutes }));
      if (activeCheckpoint === jobCheckpoints.length - 1) {
        setNotification("Final result approved. Doneeo is creating the completion report.");
        await completeWorkOrder();
        return;
      }
      setActiveCheckpoint(next);
      setNotification(`Task ${activeTimelineStep.taskSequence} is complete and approved. The next plan step is released.`);
      return;
    }
    setMilestoneDurations(current => ({ ...current, [activeCheckpoint]: activeTimelineStep?.minutes || 10 }));
    setActiveCheckpoint(next);
    setNotification(isManagedHandoff ? "Service A has departed and Service B has arrived. Doneeo released the in-home work under the same order." : `${title} completed. The next plan step is active.`);
  };

  const calculateGoogleRoute = async (addresses: string[] = exactRouteAddresses) => {
    if (addresses.length < 2) return;
    setRouteState("loading");
    try {
      const response = await fetch("/api/route", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ addresses }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Google route unavailable");
      setGoogleRoute(data);
      setAnalysis(current => {
        if (!current) return current;
        const previousRoute = current.intelligence?.estimate.routeMinutes || current.estimate.travelMinutes || 0;
        const routeDelta = data.trafficMinutes - previousRoute;
        const intelligence = current.intelligence ? {
          ...current.intelligence,
          estimate: {
            ...current.intelligence.estimate,
            routeMinutes: data.trafficMinutes,
            totalMinutes: Math.max(0, current.intelligence.estimate.totalMinutes + routeDelta),
            rangeLow: Math.max(15, current.intelligence.estimate.rangeLow + routeDelta),
            rangeHigh: Math.max(20, current.intelligence.estimate.rangeHigh + routeDelta),
            equation: `${current.intelligence.estimate.executionMinutes} min phase model + ${current.intelligence.estimate.accessMinutes} min access + ${data.trafficMinutes} min Google route + ${current.intelligence.estimate.bufferMinutes} min uncertainty = ${Math.max(0, current.intelligence.estimate.totalMinutes + routeDelta)} min likely total`,
          },
        } : undefined;
        return { ...current, estimate: { ...current.estimate, travelMinutes: data.trafficMinutes }, intelligence };
      });
      setRouteState("ready");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Google route unavailable");
      setRouteState("error");
    }
  };

  const restart = () => { setStage(0); setAnalysis(null); setAnswers({}); setTextDrafts({}); setSelected("recommended"); setBookingState("idle"); setSavedReference(""); setError(""); setProtection("none"); setProviderStatus("not_sent"); setPaymentState("unpaid"); setDispatchAttempt(1); setIncidentNote(""); setNotification(""); setAlternateTimesVisible(false); setMilestoneDurations({}); setDelayMinutes(0); setMaterialsReady(false); setProviderArrived(false); setActiveCheckpoint(0); setTaskGateConfirmations({}); setGoogleRoute(null); setRouteState("idle"); };

  return <main className="app-shell">
    <header className="topbar"><div className="brand"><img className="brand-logo" src="/brand/doneeo-logo.png" alt="Doneeo" /></div><nav className="demo-nav" aria-label="Demo views"><span className="planner-chip">Customer planner</span><a href="/track">Live tracking</a><a href="/provider">Team workspace</a><a href="/provider/alex">Alex view</a><a href="/data">Test controls →</a></nav></header>
    <div className="progress-track" aria-label={`Step ${stage + 1} of 4`}><span style={{ width: `${progress}%` }} /></div>

    {stage === 0 && <section className="screen hero-screen">
      <div className="hero-composition"><div className="hero-message"><div className="eyebrow">FROM PROBLEM TO COMPLETE WORK ORDER</div><h1>What needs to<br />get done?</h1><p className="lead">Describe the outcome. Doneeo will determine the steps, people, equipment, travel, safety constraints and price.</p><div className="thinking-flow" aria-hidden="true"><span>Request</span><i /><span>Job plan</span><i /><span>Ready</span></div></div><img className="section-comic intake-comic" src="/brand/doneeo-comic-intake.png" alt="A customer considering several kinds of work that need to be completed" /></div>
      <label className="request-box"><span>Describe your request</span><textarea value={request} onChange={event => setRequest(event.target.value)} rows={5} /><small>You do not need to know the job category or what resources it requires.</small></label>
      <div className="suggestions"><button onClick={() => setRequest("Pick up a couch from a Marketplace seller and carry it to my third-floor apartment. I cannot help lift.")}>Move a couch</button><button onClick={() => setRequest("Clean my three-bedroom house every week, including kitchen and two bathrooms")}>Weekly cleaning</button><button onClick={() => setRequest("Assemble and secure a wardrobe in my bedroom")}>Install furniture</button><button onClick={() => setRequest("Help my elderly father with groceries, companionship and a weekly wellness visit")}>Support a parent</button></div>
      <button className="primary" onClick={analyzeRequest} disabled={request.trim().length < 10 || plannerState === "thinking"}>{plannerState === "thinking" ? "Planning, then independently validating…" : "Architect my job"}<span>→</span></button>
    </section>}

    {stage === 1 && analysis && <section className="screen">
      <button className="back" onClick={() => setStage(0)}>← Back</button>
      <div className="analysis-intro"><div className="ai-orb"><img src="/brand/ai-engine.png" alt="Doneeo AI matching engine" /></div><div><div className="eyebrow">DONEEO UNDERSTOOD THE REQUEST</div><h2>{analysis.title}</h2></div></div>
      <p className="analysis-summary">{analysis.summary}</p>
      <div className={`audit-card ${analysis.audit.status}`}><span>{analysis.audit.status === "corrected" ? "↻" : "✓"}</span><div><small>{analysis.audit.pipeline || "PLANNER AGENT → INDEPENDENT VALIDATOR → RULES GATE"}</small><strong>{analysis.audit.status === "corrected" ? "Questions corrected before display" : analysis.audit.status === "verified" ? "Every question verified before display" : "Deterministic validation completed"}</strong><p>{analysis.audit.checks.join(" · ")}</p>{analysis.audit.issues.length > 0 && <em>{analysis.audit.issues.join("; ")}</em>}</div></div>
      {analysis.rulesGate && <section className={`rules-gate ${liveGateStatus}`}><div className="rules-gate-head"><div><small>DONEEO RULES GATE · {analysis.rulesGate.version}</small><h3>{liveGateStatus === "blocked" ? "Matching stopped" : liveGateStatus === "cleared" ? "Intake gate cleared" : "Resolve required details before matching"}</h3><p>{liveGateStatus === "cleared" ? `All required customer facts are complete. Doneeo may now calculate ${hasDrivingRoute ? "route, " : ""}time, price, provider equipment coverage and matching options.` : analysis.rulesGate.summary}</p></div><span>{liveGateStatus === "blocked" ? "BLOCKED" : liveGateStatus === "cleared" ? "CLEARED" : "COLLECTING"}</span></div><div className="gate-metrics"><div><small>RISK LEVEL</small><strong>{analysis.rulesGate.riskLevel}</strong></div><div><small>PROVIDER CLASS</small><strong>{providerClassLabel}</strong></div><div><small>RULE DOMAINS</small><strong>{analysis.rulesGate.domains.length} checked</strong></div></div><div className="gate-domain-grid">{analysis.rulesGate.domains.map(domain => <div className={domain.status} key={domain.id}><span>{domain.status === "pass" ? "✓" : domain.status === "blocked" ? "×" : "!"}</span><div><strong>{domain.label}</strong><small>{domain.detail}</small></div></div>)}</div>{analysis.rulesGate.issues.length > 0 && <div className="gate-issues"><small>RULES REQUIRING ATTENTION</small>{analysis.rulesGate.issues.map(issue => <div className={issue.severity} key={issue.code}><strong>{issue.title}</strong><span>{issue.detail}</span></div>)}</div>}<details className="gate-safeguards"><summary>{analysis.rulesGate.safeguards.length} safeguards carried into booking and execution</summary><ol>{analysis.rulesGate.safeguards.map(safeguard => <li key={safeguard}>{safeguard}</li>)}</ol></details></section>}
      <section className="request-readback"><div className="section-title"><div><small>1 · WHAT THE CUSTOMER REQUESTED</small><h3>Facts already understood</h3></div><span>{analysis.understoodFacts.length} facts locked</span></div><div className="fact-chips">{analysis.understoodFacts.map(fact => <span key={fact}>✓ {fact}</span>)}</div><p>These facts are locked. Doneeo will not ask you to provide them again.</p></section>
      {analysis.understoodFacts.some(fact => fact.startsWith("Household catalog match:")) && <section className="household-knowledge-match"><div><small>HOUSEHOLD KNOWLEDGE MATCH</small><strong>{analysis.items.join(", ")}</strong><span>{householdCatalog.items} common household items across {householdCatalog.families} families · {householdCatalog.jobRelations} item-to-job relationships</span></div><p>Doneeo uses the identified item to select its possible work, handling risks, crew, vehicle, tools and only the still-missing questions.</p></section>}
      <div className="analysis-gate"><strong>Analysis first. Estimates after the missing facts.</strong><span>Doneeo will calculate providers, {hasDrivingRoute ? "driving route, " : ""}manpower, equipment, time and price only after the required information below is complete.</span></div>
      <div className="understood-grid">
        <div><small>{workstreams.length > 1 ? `${workstreams.length} TASKS PRESERVED · ORDER LOCKED` : "TASKS PRESERVED"}</small><ol>{analysis.tasks.map((task, index) => <li key={`${task}-${index}`}>{task}{workstreams.length > 1 && index < analysis.tasks.length - 1 ? <em>Complete and confirm before Task {index + 2}</em> : null}</li>)}</ol></div>
        <div><small>CONSTRAINTS LOCKED</small><strong>{analysis.customerCanHelp === false ? "Customer cannot help — provider team handles all lifting" : "Only confirmed constraints are applied"}</strong>{analysis.items.length > 0 && <span>Items: {analysis.items.join(", ")}</span>}</div>
      </div>
      <section className="execution-blueprint"><div className="section-title"><div><small>2 · REQUEST BREAKDOWN</small><h3>{workstreams.length > 1 ? `${workstreams.length} connected tasks identified` : "What Doneeo has identified"}</h3></div><span>Estimation pending</span></div><div className="materials-readout"><small>RESOURCES DONEEO WILL VERIFY</small><strong>{analysis.estimate.materialsSummary}</strong></div><div className="blueprint-grid"><div><small>ORDERED WORK SCOPE</small>{workstreams.length ? workstreams.map((stream, index) => <article className="task-sentence" key={stream.id}><b>Task {stream.sequence} · {stream.qualification.replaceAll("_", " ")}</b><strong>{stream.title}.</strong><small>{stream.phaseIds.length} execution step{stream.phaseIds.length === 1 ? "" : "s"} · {stream.rangeLow}–{stream.rangeHigh} min · {stream.minimumCrew} minimum / {stream.recommendedCrew} recommended</small><span>{stream.resourceIds.length ? `Resources: ${stream.resourceIds.map(id => analysis.intelligence?.resources.find(resource => resource.id === id)?.name || id.replaceAll("_", " ")).join(", ")}` : "No special resource gap identified"}</span>{index < workstreams.length - 1 && <em>Full stop · executor proves completion and customer approves before Task {stream.sequence + 1}</em>}</article>) : analysis.tasks.map((title, index) => <article className="task-sentence" key={`${title}-${index}`}><b>Task {index + 1}</b><strong>{title}.</strong><small>Detailed phases calculated after missing facts</small></article>)}</div><div><small>EXPERTISE TO MATCH</small>{analysis.skillRequirements.map(skill => <span key={skill}>✓ {skill}</span>)}</div><div><small>PLANNING LOGIC</small><span>1. Collect only missing facts for every task</span><span>2. Verify equipment, materials and eligibility per task</span><span>3. Complete and confirm each task before releasing the next</span><span>4. Calculate {hasDrivingRoute ? "route, " : ""}manpower, time and price for the complete order</span></div></div></section>
      {analysis.intelligence?.fulfillment.mode === "coordinated_specialists" && <section className="fulfillment-plan"><div className="section-title"><div><small>ONE CUSTOMER ORDER · INTERNAL SERVICE COORDINATION</small><h3>Doneeo may assign different executors without splitting the customer experience</h3></div><span>One plan · one price</span></div><p>{analysis.intelligence.fulfillment.rationale}</p><div className="fulfillment-groups">{analysis.intelligence.fulfillment.groups.map((group, index) => <article key={group.id}><b>{String.fromCharCode(65 + index)}</b><div><small>{group.title}</small><strong>{group.executorRole}</strong><span>Tasks {group.taskSequences.join(", ")}{group.vehicleRequired ? " · vehicle required" : " · in-home service"}</span>{group.handoffAfterTask ? <em>Managed handoff after Task {group.handoffAfterTask}; the customer does not create another order.</em> : <em>Completes the remaining tasks under the same Doneeo plan.</em>}</div></article>)}</div></section>}
      <div className="safety-note"><strong>Safety and eligibility check</strong><span>{analysis.safetyNote}</span></div>
      <section className="equipment-check illustrated-section">
        <img className="section-comic resource-comic" src="/brand/doneeo-comic-resources.png" alt="A prepared executor checking tools, supplies and safety equipment" />
        <div className="illustrated-content">
          <div className="section-title"><div><small>EQUIPMENT & SUPPLY PLAN</small><h3>What the job requires</h3></div><span>{analysis.equipment.length} item(s) verified during matching</span></div>
          <p>Doneeo checks matched-provider inventory first. {hasDrivingRoute ? "The required vehicle, reusable tools, handling aids and safety equipment" : "Reusable tools, handling aids and safety equipment"} are the provider’s responsibility—not the customer’s. You only confirm consumable materials you already have; missing consumables can be purchased with approval and added to the invoice.</p>
          <div className="equipment-list">{analysis.equipment.map(item => {
            const isConsumable = item.supplyType === "consumable";
            return <div className="equipment-item" key={item.id}>
              <div><strong>{item.name}</strong><span>{item.purpose}</span><small>{isConsumable ? `Purchase estimate if missing: $${item.rentalEstimate} CAD` : "Provider inventory check · rental only if the matched provider has a verified gap"}</small></div>
              {isConsumable ? <div className="yes-no"><button className={answers[`equipment_${item.id}`] === true ? "active" : ""} onClick={() => setAnswers(current => ({ ...current, [`equipment_${item.id}`]: true }))}>I have it</button><button className={answers[`equipment_${item.id}`] === false ? "active" : ""} onClick={() => setAnswers(current => ({ ...current, [`equipment_${item.id}`]: false }))}>Add if needed</button></div> : <div className="provider-supplied">Provider supplied</div>}
            </div>;
          })}</div>
        </div>
      </section>
      {visibleQuestions.length > 0 ? <div className="missing-panel"><small>3 · ADAPTIVE INFORMATION FLOW</small><h3>Doneeo asks only the next verified missing question</h3><p>{visibleQuestions.filter(question => !questionAnswered(question)).length} relevant detail{visibleQuestions.filter(question => !questionAnswered(question)).length === 1 ? "" : "s"} {visibleQuestions.filter(question => !questionAnswered(question)).length === 1 ? "remains" : "remain"}. Irrelevant and already answered questions are removed before they reach this screen.</p></div> : <div className="all-understood">✓ Enough information was provided.</div>}
      <div className="dynamic-form adaptive-flow">{displayedQuestions.map(question => { const task = workstreams.find(stream => question.id.startsWith("handling_") || question.id.startsWith("refrigerator_") ? stream.domain === "transport_handling" : ["mounted_item", "wall_type", "mount_hardware_status"].includes(question.id) ? stream.domain === "mounting" : false); const value = question.type === "text" ? textDrafts[question.id] ?? (typeof answers[question.id] === "string" ? answers[question.id] : "") : answers[question.id]; return <div className="question-task-context" key={question.id}>{task ? <small>TASK {task.sequence} · {task.title}</small> : <small>COMPLETE ORDER · SHARED DETAIL</small>}<Question question={question} value={value} busy={answerState === "validating"} onChange={nextValue => question.type === "text" ? setTextDrafts(current => ({ ...current, [question.id]: String(nextValue) })) : validateAnswer(question, nextValue)} onTextCommit={() => validateAnswer(question, String(textDrafts[question.id] ?? answers[question.id] ?? "").trim())} /></div>; })}</div>
      {answerState === "validating" && <div className="answer-validation-note">Doneeo is locking the fact, recalculating the job and checking which question is relevant next.</div>}
      <button className="primary" disabled={answerState === "validating" || gateBlocked || !requiredComplete || !equipmentComplete || !planControl?.requirementReady} onClick={buildMatchedOptions}>{gateBlocked ? "Request blocked by Doneeo Rules Gate" : answerState === "validating" ? "Validating the work order…" : !planControl?.requirementReady ? "Finalizing Requirement Contract…" : "Build matched work options"}<span>→</span></button>
      {error && <p className="booking-error" role="alert">{error}</p>}
    </section>}

    {stage === 2 && analysis && <section className="screen wide-screen">
      <button className="back" onClick={() => setStage(1)}>← Back</button><div className="matching-intro"><div><div className="eyebrow">YOUR JOB, ARCHITECTED</div><h2>Three transparent ways to get it done.</h2><div className="match-signal" aria-hidden="true"><span className={selected === "budget" ? "active" : ""}>82</span><i /><span className={selected === "recommended" ? "active" : ""}>94</span><i /><span className={selected === "complete" ? "active" : ""}>96</span></div></div><img className="section-comic matching-comic" src="/brand/doneeo-comic-matching.png" alt="A coordinated team of complementary executors prepared for the work" /></div>
      {chosen && <section className="selected-fulfillment"><div><small>HOW THE SELECTED OPTION WILL BE FULFILLED</small><h3>{chosen.fulfillmentLabel}</h3><p>The customer keeps one Doneeo work order, one combined price and one completion tracker.</p></div><div>{chosen.serviceAssignments.map(assignment => <article key={assignment.title}><strong>{assignment.title}</strong><span>{assignment.executors} · {assignment.tasks}</span><small>{assignment.handoff}</small></article>)}</div></section>}
      <div className="planner-proof"><div><small>JOB TYPE</small><strong>{analysis.title}</strong></div><div><small>RULES-GATE ELIGIBILITY</small><strong>{providerClassLabel}</strong></div><div><small>LOCATION</small><strong>{serviceLocation}</strong></div></div>
      {analysis.intelligence && <section className="intelligence-workbench"><div className="section-title"><div><small>DONEEO JOB INTELLIGENCE · {analysis.intelligence.version}</small><h3>How the work was calculated</h3></div><span>{analysis.intelligence.confidence.score}% confidence</span></div>{analysis.intelligence.domains?.length ? <div className="work-domain-strip">{analysis.intelligence.domains.map(domain => <span key={domain.id}><b>{domain.label}</b><small>{domain.phaseCount} phase{domain.phaseCount === 1 ? "" : "s"} · {domain.qualification.replaceAll("_", " ")}</small></span>)}</div> : null}<div className="intelligence-summary"><div><small>PERSON-WORK</small><strong>{analysis.intelligence.estimate.personMinutes} min</strong></div><div><small>RECOMMENDED TEAM</small><strong>{analysis.intelligence.manpower.recommended}</strong></div><div><small>EXECUTION RANGE</small><strong>{analysis.intelligence.estimate.rangeLow}–{analysis.intelligence.estimate.rangeHigh} min</strong></div><div><small>RESOURCE REQUIREMENTS</small><strong>{analysis.intelligence.resources.length}</strong></div></div><div className="intelligence-equation"><small>TRANSPARENT EQUATION</small><strong>{analysis.intelligence.estimate.equation}</strong><p>Each phase has its own low, likely and high duration. Extra people shorten only genuinely parallel work; licensing and safe crew minimums cannot be traded for speed.</p></div><div className="intelligence-columns"><details open><summary>{analysis.intelligence.primitives.length} execution operations</summary>{analysis.intelligence.primitives.map(item => <div className="primitive-line" key={item.id}><span><b>{item.label}</b><small>{item.domain?.replaceAll("_", " ")} · likely {item.unitMinutes} min · range {item.lowMinutes || Math.round(item.unitMinutes * .75)}–{item.highMinutes || Math.round(item.unitMinutes * 1.5)} min</small><small>{(item.qualification || "general_helper").replaceAll("_", " ")} · crew {item.minimumCrew || 1} minimum / {item.recommendedCrew || 1} recommended{item.dependencies.length ? ` · Requires ${item.dependencies.join(", ")}` : ""}</small></span><strong>{item.personMinutes} person-min</strong></div>)}</details><details open><summary>Equipment and material resolution</summary>{analysis.intelligence.resources.map(item => <div className="resource-line" key={item.id}><span><b>{item.name}</b><small>{item.kind}</small></span><em className={item.status}>{item.status.replaceAll("_", " ")}</em><p>{item.resolution}{item.estimatedCost ? ` · Approx. $${item.estimatedCost}` : ""}</p></div>)}</details></div><div className="manpower-comparison"><div><small>WHY THIS TEAM</small><strong>{analysis.intelligence.manpower.reason}</strong></div>{analysis.intelligence.manpower.alternatives.map(option => <span key={`${option.people}-${option.label}`}><b>{option.people} executor{option.people > 1 ? "s" : ""}</b><strong>{option.estimatedMinutes} min work</strong><small>{option.label}</small></span>)}</div><details className="fact-ledger"><summary>{analysis.intelligence.facts.length} facts locked in the work order</summary>{analysis.intelligence.facts.slice(0, 24).map(fact => <div key={`${fact.key}-${fact.value}`}><span>{fact.label}</span><strong>{fact.value}</strong><small>{fact.confidence}</small></div>)}</details></section>}
      {exactRouteAddresses.length >= 2 && <section className="google-route-card">
        <div><small>GOOGLE ROUTES · LIVE DEMO</small><h3>Real driving route and traffic estimate</h3><p>{exactRouteAddresses.length >= 2 ? exactRouteAddresses.join(" → ") : "Enter all route locations to calculate the route."}</p></div>
        {googleRoute ? <div className="google-route-result"><strong>{googleRoute.distanceKm} km</strong><span>{googleRoute.trafficMinutes} min across {googleRoute.legs.length} driving leg{googleRoute.legs.length === 1 ? "" : "s"}</span><em>Plan time and pricing recalculated</em></div> : <button onClick={() => calculateGoogleRoute()} disabled={exactRouteAddresses.length < 2 || routeState === "loading"}>{routeState === "loading" ? "Calculating…" : "Calculate with Google"}</button>}
        {googleMapsUrl && <a href={googleMapsUrl} target="_blank" rel="noreferrer">Open route in Google Maps ↗</a>}{routeState === "error" && <span className="route-error">Check that Routes API is enabled for this key.</span>}
      </section>}
      {operational && <section className="recalculation-card"><div className="section-title"><div><small>PLAN RECALCULATED FROM YOUR ANSWERS</small><h3>The answers now change the job</h3></div><span>Updated live</span></div><div className="recalc-metrics"><div><small>TEAM</small><strong>{operational.teamSize} executor{operational.teamSize > 1 ? "s" : ""}</strong></div><div><small>{hasDrivingRoute ? "DRIVING ROUTE" : "BETWEEN-STOP TRAVEL"}</small><strong>{hasDrivingRoute ? `${operational.routeMinutes} min` : "Not required"}</strong></div><div><small>ON-SITE WORK</small><strong>{operational.handlingMinutes} min</strong></div><div><small>ACCESS IMPACT</small><strong>+{operational.accessMinutes} min</strong></div></div>{operational.changes.length > 0 && <div className="change-log">{operational.changes.map(change => <span key={change}>✓ {change}</span>)}</div>}{hasDrivingRoute ? <div className="stop-access-grid">{operational.accessByStop.map((stop, index) => <div key={index}><small>{index === 0 ? "PICKUP" : index === operational.accessByStop.length - 1 ? "FINAL DELIVERY" : `STOP ${index + 1}`}</small><strong>{stop.floor} · {stop.elevator}</strong><span>{stop.vehicle}</span><em>{stop.minutes ? `+${stop.minutes} min handling` : "No confirmed delay"}</em></div>)}</div> : <div className="single-property-note"><strong>One-property execution</strong><span>No pickup route, delivery route, vehicle-access estimate or Google driving leg is added. Only the internal carrying path and work phases affect execution time.</span></div>}</section>}
      {hasDrivingRoute ? <div className="route-card">
        <div className="route-head"><div><span className="route-icon">⌁</span><div><small>EXECUTION ROUTE</small><strong>{routeStops.length} locations · {Math.max(0, routeStops.length - 1)} driving legs</strong></div></div><span className="route-status">{routeState === "loading" ? "Calculating…" : googleRoute ? "Google verified" : "Sequence verified"}</span></div>
        {googleRoute && <div className="route-google-summary"><div><small>GOOGLE DISTANCE</small><strong>{googleRoute.distanceKm} km</strong></div><div><small>TRAFFIC-AWARE DRIVE</small><strong>{googleRoute.trafficMinutes} min</strong></div><div><small>DRIVE + HANDLING + WORK</small><strong>{totalLow}–{totalHigh} min</strong></div></div>}
        <div className="route-list">{routeNodes.map((node, index) => <div key={`${node.location}-${index}`}><b>{index + 1}</b><span><small>{index === 0 ? "START / PICKUP" : index === routeNodes.length - 1 ? "FINAL DROP / SERVICE" : `STOP ${index + 1}`}</small><strong>{node.location}</strong><ul className="route-actions">{node.actions.map(action => <li key={action}>{action}</li>)}</ul>{operational?.accessByStop[index] && <em>Handling at this location: +{operational.accessByStop[index].minutes} min</em>}{googleRoute?.legs[index] && <div className="leg-estimate"><span>↓ LEG {index + 1}</span><strong>{googleRoute.legs[index].distanceKm} km · {googleRoute.legs[index].trafficMinutes} min with traffic</strong><small>Next: {googleRoute.legs[index].to}</small></div>}</span></div>)}</div>
        <div className="route-total-equation"><span>{googleRoute?.trafficMinutes || operational?.routeMinutes || 0} min driving</span><b>+</b><span>{operational?.accessMinutes || 0} min access</span><b>+</b><span>{analysis.intelligence?.estimate.executionMinutes || operational?.handlingMinutes || 0} min phase-based work</span><b>+</b><span>{analysis.intelligence?.estimate.bufferMinutes || 0} min transparent reserve</span><b>=</b><strong>{totalLow}–{totalHigh} min estimated range</strong></div>
      </div> : <div className="route-card onsite-execution-card"><div className="route-head"><div><span className="route-icon">⌂</span><div><small>ON-SITE EXECUTION</small><strong>One property · no driving route</strong></div></div><span className="route-status">Scope verified</span></div><div className="route-list">{routeNodes.map((node, index) => <div key={`${node.location}-${index}`}><b>{index + 1}</b><span><small>SERVICE LOCATION</small><strong>{node.location}</strong><ul className="route-actions">{analysis.intelligence?.primitives.map(item => <li key={item.id}>{item.label}</li>) || node.actions.map(action => <li key={action}>{action}</li>)}</ul></span></div>)}</div><div className="route-total-equation"><span>{operational?.accessMinutes || 0} min access adjustment</span><b>+</b><span>{analysis.intelligence?.estimate.executionMinutes || operational?.handlingMinutes || 0} min phase-based work</span><b>+</b><span>{analysis.intelligence?.estimate.bufferMinutes || 0} min transparent reserve</span><b>=</b><strong>{totalLow}–{totalHigh} min estimated range</strong></div></div>}
      <div className="plan-grid dynamic-plans">{plans.map(plan => <button key={plan.key} className={`plan-card ${selected === plan.key ? "selected" : ""}`} onClick={() => setSelected(plan.key)}><span className="radio">{selected === plan.key ? "✓" : ""}</span><span className="plan-badge">{plan.badge}</span><h3>{plan.name}</h3><div className="strategy-line">{plan.strategy}</div><div className="price">${plan.price}<small> CAD estimate</small></div><div className="provider-match"><span>✓</span><div><small>{plan.formationType.toUpperCase()}</small><strong>{plan.provider}</strong><em>{plan.providerRating}</em></div></div><div className="offer-operation-map"><small>WHO HANDLES EACH PART</small>{plan.serviceAssignments.map((assignment, index) => { const window = assignmentWindow(assignment, index, plan.serviceAssignments.length); return <div key={`${plan.key}-${assignment.title}`}><b>{plan.serviceAssignments.length > 1 ? `TEAM ${String.fromCharCode(65 + index)}` : "ONE TEAM"}</b><span><strong>{assignment.executors}</strong><em>{assignment.tasks}</em><small>{addMinutesToSchedule(requestedSchedule, window.startOffset)} at {window.startLocation} → {addMinutesToSchedule(requestedSchedule, window.finishOffset)} at {window.finishLocation}</small></span></div>; })}{plan.serviceAssignments.length > 1 && <p>Doneeo releases Team B only after Team A’s delivery is approved. Same order, price and tracker.</p>}</div><div className="offer-cost-map"><small>ESTIMATED PRICE DECOMPOSITION</small>{plan.breakdown.map(line => { const [label, value] = line.split(" $"); return <div key={`${plan.key}-${line}`}><span>{label}</span><strong>${value || 0}</strong></div>; })}</div><div className="credential-line"><small>SCREENING / CREDENTIALS</small><strong>{plan.credential}</strong></div><div className="team-roster">{plan.teamFormation.map(member => <div key={member.name}><b className={EXECUTOR_PORTRAITS[member.name] ? "has-photo" : ""}>{EXECUTOR_PORTRAITS[member.name] ? <img src={EXECUTOR_PORTRAITS[member.name]} alt={member.name} /> : member.name.slice(0, 1)}</b><span><strong>{member.name}</strong><small>{member.role}</small><em>{member.rating}</em></span></div>)}</div><div className="option-fact"><small>TOTAL COMPLETION TIME</small><strong>{plan.duration}</strong><span>Includes {plan.rentalMinutes} min equipment logistics</span></div><div className="option-fact"><small>TEAM STRATEGY</small><strong>{plan.teamFormation.length} executor{plan.teamFormation.length > 1 ? "s" : ""} · {plan.formationType}</strong></div><div className="option-fact"><small>FREQUENCY</small><strong>{analysis.recurrence.recurring ? analysis.recurrence.frequency : "One-time service"}</strong></div><div className="option-fact"><small>EQUIPMENT AVAILABILITY</small>{plan.equipmentRows.map(row => <span className={`coverage ${row.source.toLowerCase()}`} key={row.name}><b>{row.name}</b><em>{row.source}{row.cost ? ` · +$${row.cost}` : " · included"}</em><small>{row.availability}</small></span>)}</div><div className={`rental-route ${plan.rentalTotal ? "needed" : "covered"}`}><small>RENTAL COORDINATION</small><strong>{plan.rentalLogistics}</strong><span>{plan.rentalTotal ? `$${plan.rentalTotal} resource cost · ${plan.rentalMinutes} min sourcing impact` : "No additional rental or purchase cost"}</span></div><ul>{plan.inclusions.map(item => <li key={item}>{item}</li>)}</ul><div className="card-breakdown">{plan.breakdown.map(line => { const [label, value] = line.split(" $"); return <div key={line}><span>{label}</span><strong>{value ? `$${value}` : "Included"}</strong></div>})}<div><span>Estimated total</span><strong>${plan.price} CAD</strong></div></div><div className="why-more"><strong>Why this option</strong><span>{plan.why}</span></div></button>)}</div>
      <section className="transparency-card"><div><small>WHY DONEEO RECOMMENDS THIS MATCH</small><h3>{chosen?.provider}</h3><p>Selected from a simulated database of individual executors and established teams. Ranked job-fit first—not highest price: <strong>35% expertise and task history</strong>, <strong>25% {hasDrivingRoute ? "equipment and vehicle" : "equipment"} coverage</strong>, <strong>20% rating and reliability</strong>, <strong>10% availability</strong>, and <strong>10% total customer cost</strong>. If no complete team is available, Doneeo combines compatible solo executors, assigns one lead, and verifies that their combined skills and equipment cover the full work order.</p></div><div className="score-ring">{selected === "recommended" ? "94" : selected === "complete" ? "96" : "82"}<small>/100 fit</small></div></section>
      <section className="execution-summary"><div className="section-title"><div><small>EXECUTION PLAN · BEFORE PAYMENT</small><h3>Arrive {requestedSchedule}{scheduleWindow?.deadlineTime ? ` · complete before ${completionDeadline}` : " · completion time estimated below"}</h3></div><span>Included with selected offer</span></div><div className="execution-time-head"><div><small>PLANNED ARRIVAL</small><strong>{addMinutesToSchedule(requestedSchedule, 0)}</strong></div><div><small>LIKELY COMPLETION</small><strong>{addMinutesToSchedule(requestedSchedule, plannedExecutionMinutes)}</strong></div><div><small>CUSTOMER DEADLINE</small><strong>{scheduleWindow?.deadlineTime || "Not fixed"}</strong></div><div><small>ESTIMATED RANGE</small><strong>{totalLow}–{totalHigh} min</strong></div></div>{deadlineFeasible !== null && <div className={`deadline-check ${deadlineFeasible ? "feasible" : "conflict"}`}><strong>{deadlineFeasible ? "✓ Likely plan fits the customer deadline" : "! Current likely plan misses the customer deadline"}</strong><span>{deadlineFeasible ? `${deadlineMargin} minutes of planned margin before ${scheduleWindow?.deadlineTime}.` : `The likely estimate is ${Math.abs(deadlineMargin || 0)} minutes late. Doneeo must offer a faster eligible team or a different schedule before payment.`}</span></div>}{billablePreparation.length > 0 && <div className="preparation-block"><div className="preparation-head"><small>BEFORE ARRIVAL · EXECUTOR PREPARATION</small><strong>{scheduleWindow?.preparationStartTime ? `Starts ${scheduleWindow.preparationStartTime} so your arrival stays ${scheduleWindow.arrivalTime}` : "Scheduled before your arrival time"}</strong></div>{billablePreparation.map((step, index) => <div className="preparation-step" key={`${step.step}-${index}`}><b>{step.kind === "rental" ? "R" : step.kind === "materials" ? "M" : "E"}</b><span><strong>{step.step}</strong><small>{step.kind === "rental" ? "Rental pickup you requested" : step.kind === "materials" ? "Materials purchase you requested" : "Equipment collection"} · {step.durationMinutes} min</small></span></div>)}<p>Happens before your appointment. Your arrival time is unchanged.</p></div>}<div className="execution-step-list">{executionTimeline.map((step, index) => <div className={`execution-step ${step.isGate ? "task-boundary" : ""}`} key={`${step.title}-${index}`}><b>{index + 1}</b><div>{step.taskSequence ? <em className="task-step-label">TASK {step.taskSequence} · {step.taskTitle}</em> : null}<strong>{step.title}</strong><p>{step.description}</p><small>{addMinutesToSchedule(requestedSchedule, step.startOffset)} → {addMinutesToSchedule(requestedSchedule, step.finishOffset)} · likely {step.minutes} min · range {step.lowMinutes}–{step.highMinutes} min · {step.qualification}</small></div></div>)}</div><p className="estimate-disclaimer">This is an operational estimate, not a guaranteed completion time. Every phase uses a low, likely and high duration. {hasDrivingRoute ? "Traffic, " : ""}access, product fit, site conditions, parts, drying or test cycles, recipient readiness and unexpected execution problems can change individual milestones and the final completion time.</p></section>
      {chosen && <section className="customer-journey-plan">
        <div className="journey-plan-head"><div><small>YOUR CONNECTED PLAN · BEFORE PAYMENT</small><h3>{chosen.name} · {chosen.fulfillmentLabel}</h3><p>This is the exact plan that continues after payment. One reference, one price and one tracker—no need to return to an earlier page.</p></div><span>Selected · ${finalTotal} CAD</span></div>
        <div className="work-order-continuity"><b>ONE WORK ORDER</b><span>Request confirmed</span><i>→</i><span>Resources approved</span><i>→</i><span>{chosen.serviceAssignments.length > 1 ? "Team A executes" : "Team executes"}</span><i>→</i>{chosen.serviceAssignments.length > 1 && <><span>Doneeo handoff</span><i>→</i><span>Team B executes</span><i>→</i></>}<span>Customer approves</span><i>→</i><span>Completion report</span></div>
        <div className="journey-overview"><div><small>START</small><strong>{routeNodes[0]?.location}</strong><span>{requestedSchedule}</span></div><div><small>FINISH</small><strong>{routeNodes.at(-1)?.location}</strong><span>{addMinutesToSchedule(requestedSchedule, plannedExecutionMinutes)} likely</span></div><div><small>TEAM MODEL</small><strong>{chosen.serviceAssignments.length > 1 ? "Specialist handoff" : "Same team throughout"}</strong><span>{chosen.serviceAssignments.length > 1 ? "Doneeo coordinates the transition" : "No executor change"}</span></div></div>
        <div className={`service-journey ${chosen.serviceAssignments.length > 1 ? "split" : "continuous"}`}>{chosen.serviceAssignments.map((assignment, index) => { const window = assignmentWindow(assignment, index, chosen.serviceAssignments.length); return <div className="service-leg" key={assignment.title}><article><b>{chosen.serviceAssignments.length > 1 ? `TEAM ${String.fromCharCode(65 + index)}` : "ONE TEAM"}</b><small>{assignment.tasks}</small><h4>{assignment.title}</h4><strong>{assignment.executors}</strong><span>START · {addMinutesToSchedule(requestedSchedule, window.startOffset)} at {window.startLocation}</span><span>FINISH · {addMinutesToSchedule(requestedSchedule, window.finishOffset)} at {window.finishLocation}</span><span>RESPONSIBILITY · {assignment.handoff}</span></article>{index < chosen.serviceAssignments.length - 1 && <div className="handoff-bridge"><b>FULL STOP · {addMinutesToSchedule(requestedSchedule, window.finishOffset)}</b><strong>Team A finishes and leaves</strong><span>Delivery approval → Doneeo releases Team B → Team B takes over</span><small>No customer rematching, second payment or separate order.</small></div>}</div>; })}</div>
        <div className="journey-task-sequence"><div className="journey-subhead"><small>WHO DOES WHAT · IN THE ORDER IT HAPPENS</small><strong>{analysis.tasks.length} requested tasks, all preserved</strong></div>{analysis.tasks.map((task, index) => { const assignment = serviceForTask(chosen.serviceAssignments, index + 1); return <article key={`${task}-${index}`}><b>{index + 1}</b><div><small>{assignment?.title || "Assigned team"}</small><strong>{task}</strong><span>{assignment?.executors}</span>{index < analysis.tasks.length - 1 ? <em>Complete and approve before Task {index + 2}</em> : <em>Final approval creates the completion report</em>}</div></article>; })}</div>
        <div className="journey-route-summary"><div className="journey-subhead"><small>CONNECTED LOCATION PATH</small><strong>{routeNodes.length} location{routeNodes.length === 1 ? "" : "s"}</strong></div>{routeNodes.map((node, index) => <article key={`${node.location}-journey`}><b>{index + 1}</b><div><strong>{node.location}</strong><span>{node.actions.join(" · ")}</span></div></article>)}</div>
        <section className="resource-resolution"><div className="journey-subhead"><small>TOOLS & MATERIALS · CONFIRMATION AND ORDERING</small><strong>{resourcesApproved ? "Ready for plan confirmation" : `${resourcesRequiringApproval.filter(row => answers[resourceApprovalKey(row.name)] !== true).length} approval needed`}</strong></div><p>Every resource is tied to the task and team that uses it. Provider-owned items are verified automatically; Doneeo books rentals or purchases only after your approval.</p><div className="resource-resolution-grid">{chosen.equipmentRows.length ? chosen.equipmentRows.map(row => { const task = resourceTask(row.name); const team = serviceForTask(chosen.serviceAssignments, task.sequence); const approvalRequired = row.source === "Rental" || row.source === "Purchase"; const approved = !approvalRequired || answers[resourceApprovalKey(row.name)] === true; return <article className={approved ? "resolved" : "approval-needed"} key={`${row.name}-resolution`}><div><small>TASK {task.sequence} · {team?.title}</small><strong>{row.name}</strong><span>{team?.executors}</span></div><div><small>HOW IT IS SUPPLIED</small><strong>{row.source}{row.cost ? ` · $${row.cost}` : " · included"}</strong><span>{row.availability}</span></div><div><small>ORDER STATUS</small>{approvalRequired ? <button className={approved ? "approved" : ""} onClick={() => setAnswers(current => ({ ...current, [resourceApprovalKey(row.name)]: true }))}>{approved ? "✓ Approved · Doneeo will arrange" : `Approve ${row.source.toLowerCase()} · $${row.cost}`}</button> : <strong className="confirmed-resource">✓ {row.source === "Provider" ? "Provider inventory verified" : "Customer supply confirmed"}</strong>}</div></article>; }) : <div className="all-resources-covered"><strong>✓ No additional tools or materials identified</strong><span>The selected team still completes a readiness check before departure.</span></div>}</div><div className="resource-readiness-path"><span><b>1</b> Customer approves gaps</span><i>→</i><span><b>2</b> Doneeo reserves or orders</span><i>→</i><span><b>3</b> Team confirms loaded</span><i>→</i><span><b>4</b> Departure released</span></div></section>
        <section className="work-order-price"><div className="journey-subhead"><small>COMPLETE PRICE · SAME WORK ORDER</small><strong>${finalTotal} CAD estimated total</strong></div><div className="work-order-price-grid"><div className="price-team-scope">{chosen.serviceAssignments.map((assignment, index) => { const window = assignmentWindow(assignment, index, chosen.serviceAssignments.length); return <article key={`${assignment.title}-price`}><b>{chosen.serviceAssignments.length > 1 ? `TEAM ${String.fromCharCode(65 + index)}` : "ONE TEAM"}</b><div><strong>{assignment.executors}</strong><span>{assignment.tasks} · {addMinutesToSchedule(requestedSchedule, window.startOffset)}–{addMinutesToSchedule(requestedSchedule, window.finishOffset)}</span></div></article>; })}<p>{chosen.serviceAssignments.length > 1 ? "Doneeo coordinates the team transition, shared evidence and second-team release inside this price." : "One lead remains responsible from the first location through final approval."}</p></div><div className="price-contract">{chosen.breakdown.map(line => { const [label, value] = line.split(" $"); return <div key={`${line}-contract`}><span>{label}</span><strong>${value || 0}</strong></div>; })}<div><span>Optional protection</span><strong>${protectionCost}</strong></div><div className="total"><span>Estimated total</span><strong>${finalTotal} CAD</strong></div></div></div></section>
        <details className="journey-detail"><summary>See exact step-by-step timing and completion gates</summary>{billablePreparation.length > 0 && <div className="preparation-block"><div className="preparation-head"><small>BEFORE ARRIVAL · EXECUTOR PREPARATION</small><strong>{scheduleWindow?.preparationStartTime ? `Starts ${scheduleWindow.preparationStartTime} so your arrival stays ${scheduleWindow.arrivalTime}` : "Scheduled before your arrival time"}</strong></div>{billablePreparation.map((step, index) => <div className="preparation-step" key={`${step.step}-${index}`}><b>{step.kind === "rental" ? "R" : step.kind === "materials" ? "M" : "E"}</b><span><strong>{step.step}</strong><small>{step.kind === "rental" ? "Rental pickup you requested" : step.kind === "materials" ? "Materials purchase you requested" : "Equipment collection"} · {step.durationMinutes} min</small></span></div>)}<p>Happens before your appointment. Your arrival time is unchanged.</p></div>}<div className="execution-step-list">{executionTimeline.map((step, index) => <div className={`execution-step ${step.isGate ? "task-boundary" : ""} ${step.stepId === "managed_service_handoff" ? "managed-handoff-step" : ""}`} key={`${step.title}-connected-${index}`}><b>{index + 1}</b><div>{step.taskSequence ? <em className="task-step-label">TASK {step.taskSequence} · {step.taskTitle}</em> : null}<strong>{step.title}</strong><p>{step.description}</p><small>{addMinutesToSchedule(requestedSchedule, step.startOffset)} → {addMinutesToSchedule(requestedSchedule, step.finishOffset)} · likely {step.minutes} min · range {step.lowMinutes}–{step.highMinutes} min</small></div></div>)}</div></details>
      </section>}
      <section className="protection-card"><div><span className="shield">◇</span><div><small>OPTIONAL SERVICE PROTECTION</small><h3>Protection for accidental damage</h3><p>A future licensed partner could cover eligible accidental damage during the service, subject to terms, limits, exclusions and a claims review.</p></div></div><div className="protection-options"><button className={protection === "none" ? "active" : ""} onClick={() => setProtection("none")}><strong>No protection</strong><span>$0</span></button><button className={protection === "standard" ? "active" : ""} onClick={() => setProtection("standard")}><strong>Standard protection</strong><span>+$15 estimate</span></button></div><small className="legal-note">Prototype only—not an insurance policy or offer. Launch requires a licensed insurance partner and approved terms.</small></section>
      <section className="coordination-card final-coordination"><div className="section-title"><div><small>FINAL COORDINATION · AFTER PLAN CONFIRMATION</small><h3>Who receives the service at each stop?</h3></div><span>Private by default</span></div><p>The requester does not have to be present. Add a recipient, building contact, family member, business, pickup contact or any other person involved at each location. Each contact receives only the part of the plan needed for their stop unless you explicitly allow more.</p><div className="stop-contact-list">{routeNodes.map((node, index) => <div className="stop-contact" key={`${node.location}-contact`}><div className="stop-contact-head"><b>{index + 1}</b><span><small>STOP {index + 1}</small><strong>{node.location}</strong><em>{node.actions.join(" · ")}</em></span></div><div className="contact-grid"><label className="field-card"><span>Contact or recipient name</span><input value={String(answers[`stop_contact_${index + 1}_name`] || "")} onChange={event => setAnswers(current => ({ ...current, [`stop_contact_${index + 1}_name`]: event.target.value }))} placeholder="Person or organization" /></label><label className="field-card"><span>Phone</span><input inputMode="tel" value={String(answers[`stop_contact_${index + 1}_phone`] || "")} onChange={event => setAnswers(current => ({ ...current, [`stop_contact_${index + 1}_phone`]: event.target.value }))} placeholder="Test number" /></label></div><button className={`coordination-toggle ${answers[`stop_contact_${index + 1}_invite`] === true ? "active" : ""}`} onClick={() => setAnswers(current => ({ ...current, [`stop_contact_${index + 1}_invite`]: current[`stop_contact_${index + 1}_invite`] !== true }))}><span>{answers[`stop_contact_${index + 1}_invite`] === true ? "✓" : "+"}</span><div><strong>Share the limited Stop {index + 1} plan</strong><small>Can view timing, assigned provider, arrival, actions and validation for this stop only. Cannot view price, other contacts or unrelated stops.</small></div></button></div>)}</div><p className="privacy-note">Test contacts only. Secure links, consent, verified messaging and configurable permissions are required for production.</p></section>
      <button className="primary" disabled={!resourcesApproved} onClick={() => { if (!resourcesApproved) return; setProviderStatus("not_sent"); setActiveCheckpoint(0); setStage(3); }}>{resourcesApproved ? `Confirm complete work order · $${finalTotal}` : "Approve rental and purchase items to continue"}<span>→</span></button>
    </section>}

    {stage === 3 && analysis && chosen && <section className="screen order-screen">
      <button className="back" onClick={() => setStage(2)}>← Back</button><div className="tracking-intro"><div className="tracking-message"><div className="success-mark">✓</div><div className="eyebrow">CONFIRMED DONEEO WORK ORDER</div><h2>{paymentState === "authorized" ? "Track every execution milestone." : "Authorize payment to request the provider."}</h2><p className="lead">Payment comes before provider acceptance. If the provider declines or times out, Doneeo keeps the confirmed order and immediately proposes the next compatible option.</p></div><img className="section-comic execution-comic" src="/brand/doneeo-comic-execution.png" alt="A provider arriving prepared while the customer follows the work progress" /></div>
      {paymentState === "authorized" && <section className={`guided-simulation ${bookingState === "saved" ? "complete" : ""}`}>
        <div className="guided-progress"><div><small>FULL DEMO SIMULATION</small><strong>{bookingState === "saved" ? "Complete" : `${simulationProgress}% through the work order`}</strong></div><span><i style={{ width: `${bookingState === "saved" ? 100 : simulationProgress}%` }} /></span></div>
        <div className="guided-current"><div><small>{bookingState === "saved" ? "FINAL STATUS" : "NEXT REQUIRED ACTION"}</small><h3>{bookingState === "saved" ? "Every task is complete and the report is ready" : jobCheckpoints[activeCheckpoint]?.title}</h3><p>{bookingState === "saved" ? "Doneeo closed the same customer work order after all execution and approval gates." : jobCheckpoints[activeCheckpoint]?.detail}</p>{activeServiceAssignment && <div className="active-service-owner"><b>{activeServiceAssignment.title}</b><span>{activeServiceAssignment.executors}</span><small>{activeServiceAssignment.tasks}</small></div>}{isManagedHandoff && <div className="active-service-owner handoff"><b>Doneeo-managed transition</b><span>{chosen.serviceAssignments[0]?.executors} leaves after delivery approval</span><small>{chosen.serviceAssignments[1]?.executors} arrives for the in-home work</small></div>}</div>
          <div className="guided-action"><small>ONE CONTROL ADVANCES THE SAME PLAN</small><button onClick={completeSimulationAction} disabled={bookingState === "saving" || bookingState === "saved"}>{bookingState === "saving" ? "Creating completion report…" : simulationActionLabel}<span>→</span></button><p>{activeTimelineStep?.isGate ? "This demo records both the executor completion and customer approval, then releases the next task." : "The next milestone becomes active immediately after this confirmation."}</p></div>
        </div>
        {chosen.serviceAssignments.length > 1 && <div className={`handoff-status ${handoffState}`}><b>{handoffState === "complete" ? "✓" : handoffState === "active" ? "↔" : "2"}</b><div><small>PLANNED TEAM TRANSITION</small><strong>{handoffState === "complete" ? "Service B is active" : handoffState === "active" ? "Service A is leaving and Service B is arriving" : "Service B waits for Task 2 approval"}</strong><span>Doneeo owns the transition; the customer keeps the same reference, price and tracker.</span></div></div>}
      </section>}
      {paymentState !== "authorized" ? <section className="demo-payment"><div><small>TEST CHECKOUT</small><h3>Authorize ${finalTotal} CAD</h3><p>This prototype simulates payment. No card is requested and no real charge is made.</p></div>{notification && <div className="notification-toast">🔔 {notification}</div>}<div className="payment-summary"><span>Committed arrival <strong>{requestedSchedule}</strong></span><span>Required completion <strong>{completionDeadline}</strong></span><span>Selected service <strong>{chosen.name}</strong></span><span>Service protection <strong>${protectionCost}</strong></span><span>Total authorization <strong>${finalTotal} CAD</strong></span></div><button className="primary confirm" onClick={authorizeDemoPayment} disabled={paymentState === "processing"}>{paymentState === "processing" ? "Authorizing test payment…" : `Simulate payment · $${finalTotal}`}<span>→</span></button></section> : <article className="work-order compact-order"><div className="order-head"><div><small>REFERENCE</small><strong>{savedReference || `DEMO-${String(dispatchAttempt).padStart(3, "0")}`}</strong></div><span>Checkpoint {activeCheckpoint + 1}/{jobCheckpoints.length}</span></div><div className="scenario"><small>ROLE-BASED COORDINATION</small><h3>{analysis.title}</h3><div className="participant-row"><div><b>C</b><span><strong>Requester / payer</strong><small>Sees the complete order, payment and all updates.</small></span></div><div><b>P</b><span><strong>{chosen.provider}</strong><small>{providerStatus === "accepted" ? "Work order accepted" : "Acceptance requested after payment"}</small></span></div>{sharedStopContacts.map(contact => <div key={`${contact.index}-${contact.name}`}><b>{contact.index + 1}</b><span><strong>{contact.name}</strong><small>Limited access · Stop {contact.index + 1} only</small></span></div>)}</div></div><div className={`schedule-status ${providerStatus === "accepted" ? "confirmed" : "pending"}`}><small>{providerStatus === "accepted" ? "SCHEDULED SERVICE" : "REQUESTED WINDOW"}</small><strong>Arrive {requestedSchedule}</strong><b>{scheduleWindow?.deadlineTime ? `Finish by ${completionDeadline}` : "No fixed completion deadline"}</b><span>{providerStatus === "accepted" ? scheduleWindow?.deadlineTime ? "Provider accepted both the arrival commitment and completion deadline · confirmation notifications sent." : "Provider accepted the arrival commitment · confirmation notifications sent." : scheduleWindow?.deadlineTime ? "Waiting for a provider to accept this arrival time and deadline." : "Waiting for a provider to accept this arrival time."}</span></div>{notification && <div className="notification-toast">🔔 {notification}</div>}{alternateTimesVisible && providerStatus !== "accepted" && <div className="alternate-times"><small>REQUESTED TIME NOT AVAILABLE</small><strong>Choose another available option or continue rematching</strong><div><button onClick={() => { setAnswers(current => ({ ...current, schedule: "Same day · 2 hours later" })); setAlternateTimesVisible(false); }}>Same day · +2h</button><button onClick={() => { setAnswers(current => ({ ...current, schedule: "Next morning · 9:00–11:00" })); setAlternateTimesVisible(false); }}>Next morning</button><button onClick={() => { setAlternateTimesVisible(false); setNotification("Doneeo continues searching for the original requested time."); }}>Keep requested time</button></div></div>}<div className="order-route"><small>WORK LOCATION</small>{routeNodes.map((node, index) => <div className="order-stop" key={`${node.location}-${index}`}><b>{index + 1}</b><span>{node.location}<em>{node.actions.join(" · ")}</em><small>{sharedStopContacts.find(contact => contact.index === index)?.name ? `Shared with ${sharedStopContacts.find(contact => contact.index === index)?.name}` : "No external contact invited"}</small></span></div>)}</div><div className="live-tracker"><div className="live-time-strip"><div><small>PLANNED ARRIVAL</small><strong>{requestedSchedule}</strong></div><div><small>FINISH DEADLINE</small><strong>{scheduleWindow?.deadlineTime || "Not fixed"}</strong></div><div><small>REMAINING ETA</small><strong>{estimatedRemaining ? `≈ ${estimatedRemaining} min` : "Complete"}</strong></div><div><small>LAST MILESTONE</small><strong>{milestoneDurations[activeCheckpoint - 1] ? `${milestoneDurations[activeCheckpoint - 1]} min actual` : "Not started"}</strong></div></div><div className="tracker-hero"><small>NOW · MATCH ATTEMPT {dispatchAttempt}</small><h3>{jobCheckpoints[activeCheckpoint]?.title}</h3><p>{jobCheckpoints[activeCheckpoint]?.detail}</p><div><span>{jobCheckpoints[activeCheckpoint]?.actor}</span><strong>{jobCheckpoints[activeCheckpoint]?.eta}</strong></div></div><div className="checkpoint-list">{jobCheckpoints.map((checkpoint, index) => <div className={`checkpoint ${index < activeCheckpoint ? "complete" : index === activeCheckpoint ? "active" : "pending"}`} key={`${checkpoint.title}-${index}`}><span>{index < activeCheckpoint ? "✓" : index + 1}</span><div><strong>{checkpoint.title}</strong>{index === activeCheckpoint && <small>{checkpoint.detail}</small>}{index < activeCheckpoint && milestoneDurations[index] && <small>Actual milestone time: {milestoneDurations[index]} min</small>}</div><em>{index < activeCheckpoint ? `${milestoneDurations[index] || 0} min` : index === activeCheckpoint ? "In progress" : checkpoint.eta}</em></div>)}</div><div className="tracker-actions">{activeTimelineStep?.isGate && activeTimelineStep.taskSequence ? <div className="task-approval-gate"><small>FULL STOP · TASK {activeTimelineStep.taskSequence} CANNOT BE SKIPPED</small><strong>{activeTimelineStep.taskTitle}</strong><p>Both confirmations are required before Doneeo releases the next task or closes the order.</p><div><button className={activeGateState?.executor ? "confirmed" : ""} onClick={() => setTaskGateConfirmations(current => ({ ...current, [activeTimelineStep.taskSequence!]: { executor: true, customer: current[activeTimelineStep.taskSequence!]?.customer || false } }))}>{activeGateState?.executor ? "✓ Executor completion recorded" : "Executor: mark task completed"}</button><button className={activeGateState?.customer ? "confirmed" : ""} onClick={() => setTaskGateConfirmations(current => ({ ...current, [activeTimelineStep.taskSequence!]: { executor: current[activeTimelineStep.taskSequence!]?.executor || false, customer: true } }))}>{activeGateState?.customer ? "✓ Customer approved result" : "Customer: approve this task"}</button></div></div> : null}{providerStatus !== "accepted" && activeCheckpoint <= 2 ? <div className="provider-decision"><button className="primary" onClick={() => { setProviderStatus("accepted"); setActiveCheckpoint(3); setAlternateTimesVisible(false); setNotification(`Provider accepted. Service scheduled for ${requestedSchedule}${scheduleWindow?.deadlineTime ? ` with completion required by ${completionDeadline}` : " with no fixed completion deadline"}. Confirmation notifications sent.`); }}>Demo: provider accepts requested window<span>✓</span></button><button className="decline-button" onClick={declineAndRematch}>Demo: provider unavailable — show alternatives</button></div> : activeCheckpoint < jobCheckpoints.length - 1 ? <><button className="primary" disabled={executionGateBlocked} onClick={advanceCheckpoint}>{taskGateBlocked ? "Waiting for both task confirmations" : executionGateBlocked ? "Readiness confirmation required" : "Confirm milestone and continue"}<span>→</span></button><label className="incident-box"><span>Challenge or delay at this milestone</span><textarea value={incidentNote} onChange={event => setIncidentNote(event.target.value)} placeholder="Example: loading access blocked; approximately 15-minute delay" /><button onClick={() => { setNotification("Delay update sent. Arrival and remaining-time estimates recalculated."); setIncidentNote(""); }}>Report update to affected participants</button></label></> : bookingState === "saved" ? <div className="booking-success"><strong>Job completed</strong><span>{savedReference}</span><p>Every checkpoint was confirmed.</p></div> : <button className="primary confirm" onClick={confirmWorkOrder} disabled={bookingState === "saving" || taskGateBlocked}>{bookingState === "saving" ? "Closing work order…" : taskGateBlocked ? "Complete both final confirmations" : "Close the complete work order"}<span>✓</span></button>}</div></div><details className="order-details"><summary>Requester only · View complete work order and price</summary><div className="order-grid"><div><small>PROVIDER</small><strong>{chosen.provider}</strong><span>{chosen.providerRating}</span></div><div><small>SERVICE</small><strong>{chosen.name}</strong><span>{chosen.team}</span></div><div><small>DURATION</small><strong>{chosen.duration}</strong></div><div><small>AUTHORIZED TOTAL</small><strong>${finalTotal} CAD</strong><span>Includes selected rentals/protection</span></div></div><div className="price-breakdown">{chosen.breakdown.map(line => <div key={line}><span>{line}</span></div>)}<div><span>Optional protection</span><strong>${protectionCost} CAD</strong></div><div className="total"><span>Authorized total</span><strong>${finalTotal} CAD</strong></div></div></details></article>}
      {paymentState === "authorized" && providerStatus === "accepted" && <section className="operations-control"><div className="section-title"><div><small>PROVIDER OPERATIONS</small><h3>Readiness, punctuality and time control</h3></div><span>{providerArrived ? "Arrived" : materialsReady ? "Ready to depart" : "Action required"}</span></div><div className={`readiness-gate ${materialsReady ? "ready" : "waiting"}`}><div><small>TOOLS · MATERIALS · RENTALS</small><strong>{materialsReady ? "Everything confirmed before departure" : "Waiting for provider confirmation"}</strong><p>{materialsReady ? "Provider confirms all owned equipment is loaded and all reserved rental items are already collected." : "The provider must confirm equipment, supplies and rental collection before starting the route. Doneeo blocks route progress until this is complete."}</p></div><button onClick={() => { setMaterialsReady(true); setNotification("Provider confirmed all equipment, materials and rental pickups. Departure is authorized."); }}>Demo: provider confirms readiness</button></div><div className={`punctuality-card ${delayMinutes ? "late" : "ontime"}`}><div><small>COMMITTED ARRIVAL</small><strong>{requestedSchedule}</strong><span>Acceptable arrival window: requested time ±15 minutes</span></div><div><small>CURRENT ARRIVAL STATUS</small><strong>{providerArrived ? "Provider arrived" : delayMinutes ? `Delayed by ${delayMinutes} minutes` : "On schedule"}</strong><span>{delayMinutes ? `Updated arrival: requested time +${delayMinutes} min` : "No delay reported"}</span></div></div>{delayMinutes > 0 && <div className="delay-banner"><strong>DELAY · +{delayMinutes} MIN</strong><span>The provider’s note changed the arrival time and every remaining milestone estimate. A notification was sent to the requester and affected stop contacts.</span></div>}<label className="delay-entry"><span>Provider delay note</span><textarea value={incidentNote} onChange={event => setIncidentNote(event.target.value)} placeholder="Example: rental pickup is taking 20 minutes longer"/><button onClick={reportDelay}>Report delay and add time</button></label><button className="arrival-button" disabled={!materialsReady} onClick={() => { setProviderArrived(true); setNotification("Provider arrived. Arrival notification sent to the requester and the contact at this stop."); }}>{materialsReady ? "Demo: provider confirms arrival" : "Arrival locked until readiness is confirmed"}</button></section>}
      {paymentState === "authorized" && providerStatus === "accepted" && <section className="live-execution-plan"><div className="section-title"><div><small>LIVE EXECUTION PLAN</small><h3>The confirmed plan, updated in real time</h3></div><span>{delayMinutes ? `Updated · +${delayMinutes} min` : "On plan"}</span></div><div className="execution-time-head"><div><small>CONFIRMED ARRIVAL</small><strong>{addMinutesToSchedule(requestedSchedule, delayMinutes)}</strong></div><div><small>CURRENT EXPECTED FINISH</small><strong>{addMinutesToSchedule(requestedSchedule, (executionTimeline.at(-1)?.finishOffset || 0) + delayMinutes)}</strong></div><div><small>REMAINING</small><strong>{Math.max(0, (executionTimeline.at(-1)?.finishOffset || 0) - (executionTimeline[activeExecutionStep]?.startOffset || 0) + delayMinutes)} min</strong></div></div><div className="execution-step-list live">{executionTimeline.map((step, index) => <div className={`execution-step ${index < activeExecutionStep ? "complete" : index === activeExecutionStep ? "active" : "pending"} ${delayMinutes && index === activeExecutionStep ? "delayed" : ""}`} key={`live-${step.title}-${index}`}><b>{index < activeExecutionStep ? "✓" : index + 1}</b><div><strong>{step.title}</strong><p>{step.description}</p><small>{addMinutesToSchedule(requestedSchedule, step.startOffset + delayMinutes)} → {addMinutesToSchedule(requestedSchedule, step.finishOffset + delayMinutes)} · {index < activeExecutionStep ? `${milestoneDurations[index] || step.minutes} min actual` : `likely ${step.minutes} min · range ${step.lowMinutes}–${step.highMinutes} min`}</small>{delayMinutes > 0 && index === activeExecutionStep && <div className="inline-delay"><strong>DELAY · +{delayMinutes} MIN</strong><span>{notification.startsWith("DELAY") ? notification.replace("DELAY: ", "") : "Provider reported an operational delay. This step and all following finish times were recalculated."}</span></div>}{index === activeExecutionStep && <label className="inline-delay-entry"><textarea value={incidentNote} onChange={event => setIncidentNote(event.target.value)} placeholder="Provider note, for example: traffic adds 20 minutes"/><button onClick={reportDelay}>Report change and update this plan</button></label>}</div></div>)}</div><p className="estimate-disclaimer">Live times remain estimates and can change because of traffic, access, rental collection, recipient readiness or execution problems. Every confirmed change appears inside the affected milestone and updates all following times.</p></section>}
      {bookingState === "saved" && <section className={`completion-report ${completionVariance > 0 ? "over" : "under"}`}><small>FINAL PERFORMANCE REPORT</small><h3>{completionVariance > 0 ? "Completed later than estimated" : "Completed within the estimate"}</h3><div><span>Original completion estimate <strong>{plannedMinutes} min</strong></span><span>Actual recorded time <strong>{actualMinutes} min</strong></span><span>Difference <strong>{completionVariance > 0 ? `+${completionVariance} min over` : `${Math.abs(completionVariance)} min faster`}</strong></span><span>Reported delay time <strong>{delayMinutes} min</strong></span></div><p>{completionVariance > 0 ? `The job required ${completionVariance} additional minutes compared with the estimate shown before booking.` : `The job finished ${Math.abs(completionVariance)} minutes faster than the original estimate.`}</p>{delayMinutes > 0 && <p><strong>Reported issue:</strong> {notification.startsWith("DELAY") ? notification.replace("DELAY: ", "") : `${delayMinutes} minutes of delay were recorded during execution.`}</p>}</section>}
      {error && <p className="booking-error" role="alert">{error}</p>}<button className="text-button" onClick={restart}>Plan another job</button><p className="prototype-note">Demo payment and dispatch only — no real charge, message or provider request is sent.</p>
    </section>}
  </main>;
}
