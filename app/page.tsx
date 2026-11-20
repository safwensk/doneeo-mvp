"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { createWorkOrderReference, saveWorkOrder } from "../lib/work-orders";
import { extractScheduleWindow, extractStreetAddresses, type PlannerAnalysis, type PlannerQuestion } from "../lib/planner";
import { householdCatalogStats } from "../lib/household-catalog";
import { AppHeader } from "./_components/AppHeader";
import { HeroIntake } from "./_components/HeroIntake";
import { AnalysisScreen } from "./_components/AnalysisScreen";
import { MatchingScreen } from "./_components/MatchingScreen";
import { TrackingScreen } from "./_components/TrackingScreen";
import { assignmentCoversTask, optionsFor, recalculateJob, serviceForTask } from "./_domain/plan-options";
import type { Answers, GoogleRoute, PlanKey, ServiceAssignment } from "./_domain/plan-types";
import { clockToMinutes } from "./_domain/schedule-format";

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
  currentLayerId: string;
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
    typeof data.currentLayerId !== "string" ||
    typeof data.correlationId !== "string"
  ) {
    throw new Error("Doneeo returned an invalid WorkCase control response.");
  }

  return {
    workCaseId: data.workCaseId,
    jobOrderId: data.jobOrderId,
    state: data.state,
    stateVersion: data.stateVersion,
    currentLayerId: data.currentLayerId,
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
    if (!planControl?.requirementReady || !planControl.requirementContractRef) {
      setError("The canonical Requirement Contract must be ready before this work order can be created.");
      return;
    }
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
      const saved = await saveWorkOrder({
        public_reference: reference,
        work_case_id: planControl.workCaseId,
        job_order_id: planControl.jobOrderId,
        requirement_contract_ref: planControl.requirementContractRef,
        expected_work_case_version: planControl.stateVersion,
        correlation_id: planControl.correlationId,
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
      const savedControl = saved.control;
      if (savedControl) {
        setPlanControl(current => {
          if (!current) return current;
          const next = {
            ...current,
            state: savedControl.state,
            stateVersion: savedControl.stateVersion,
            currentLayerId: savedControl.currentLayerId,
          };
          window.localStorage.setItem("doneeo.activeWorkCase", JSON.stringify(next));
          return next;
        });
      }
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

  return <main className="mx-auto min-h-screen w-full max-w-[1120px] bg-surface-r shadow-[0_0_50px_rgba(23,53,43,0.09)]">
    <AppHeader stage={stage} progress={progress} />

    {stage === 0 && (
      <HeroIntake
        request={request}
        setRequest={setRequest}
        analyzeRequest={analyzeRequest}
        plannerState={plannerState}
      />
    )}

    {stage === 1 && analysis && (
      <AnalysisScreen
        analysis={analysis}
        setStage={setStage}
        hasDrivingRoute={hasDrivingRoute}
        liveGateStatus={liveGateStatus}
        providerClassLabel={providerClassLabel}
        workstreams={workstreams}
        householdCatalog={householdCatalog}
        answers={answers}
        setAnswers={setAnswers}
        textDrafts={textDrafts}
        setTextDrafts={setTextDrafts}
        answerState={answerState}
        validateAnswer={validateAnswer}
        visibleQuestions={visibleQuestions}
        displayedQuestions={displayedQuestions}
        questionAnswered={questionAnswered}
        requiredComplete={requiredComplete}
        equipmentComplete={equipmentComplete}
        gateBlocked={gateBlocked}
        requirementReady={Boolean(planControl?.requirementReady)}
        buildMatchedOptions={buildMatchedOptions}
        error={error}
      />
    )}

    {stage === 2 && analysis && (
      <MatchingScreen
        analysis={analysis}
        setStage={setStage}
        selected={selected}
        setSelected={setSelected}
        chosen={chosen}
        plans={plans}
        providerClassLabel={providerClassLabel}
        serviceLocation={serviceLocation}
        exactRouteAddresses={exactRouteAddresses}
        googleRoute={googleRoute}
        calculateGoogleRoute={calculateGoogleRoute}
        googleMapsUrl={googleMapsUrl}
        routeState={routeState}
        operational={operational}
        hasDrivingRoute={hasDrivingRoute}
        routeStops={routeStops}
        routeNodes={routeNodes}
        totalLow={totalLow}
        totalHigh={totalHigh}
        assignmentWindow={assignmentWindow}
        requestedSchedule={requestedSchedule}
        scheduleWindow={scheduleWindow}
        completionDeadline={completionDeadline}
        deadlineFeasible={deadlineFeasible}
        deadlineMargin={deadlineMargin}
        billablePreparation={billablePreparation}
        executionTimeline={executionTimeline}
        plannedExecutionMinutes={plannedExecutionMinutes}
        finalTotal={finalTotal}
        protectionCost={protectionCost}
        protection={protection}
        setProtection={setProtection}
        resourcesApproved={resourcesApproved}
        resourcesRequiringApproval={resourcesRequiringApproval}
        resourceApprovalKey={resourceApprovalKey}
        resourceTask={resourceTask}
        answers={answers}
        setAnswers={setAnswers}
        setProviderStatus={setProviderStatus}
        setActiveCheckpoint={setActiveCheckpoint}
      />
    )}

    {stage === 3 && analysis && chosen && (
      <TrackingScreen
        analysis={analysis}
        chosen={chosen}
        setStage={setStage}
        paymentState={paymentState}
        bookingState={bookingState}
        simulationProgress={simulationProgress}
        jobCheckpoints={jobCheckpoints}
        activeCheckpoint={activeCheckpoint}
        activeServiceAssignment={activeServiceAssignment}
        isManagedHandoff={isManagedHandoff}
        completeSimulationAction={completeSimulationAction}
        simulationActionLabel={simulationActionLabel}
        activeTimelineStep={activeTimelineStep}
        handoffState={handoffState}
        finalTotal={finalTotal}
        notification={notification}
        requestedSchedule={requestedSchedule}
        completionDeadline={completionDeadline}
        protectionCost={protectionCost}
        authorizeDemoPayment={authorizeDemoPayment}
        savedReference={savedReference}
        dispatchAttempt={dispatchAttempt}
        providerStatus={providerStatus}
        sharedStopContacts={sharedStopContacts}
        scheduleWindow={scheduleWindow}
        alternateTimesVisible={alternateTimesVisible}
        setAlternateTimesVisible={setAlternateTimesVisible}
        setAnswers={setAnswers}
        setNotification={setNotification}
        routeNodes={routeNodes}
        estimatedRemaining={estimatedRemaining}
        milestoneDurations={milestoneDurations}
        activeGateState={activeGateState}
        setTaskGateConfirmations={setTaskGateConfirmations}
        declineAndRematch={declineAndRematch}
        executionGateBlocked={executionGateBlocked}
        advanceCheckpoint={advanceCheckpoint}
        taskGateBlocked={taskGateBlocked}
        incidentNote={incidentNote}
        setIncidentNote={setIncidentNote}
        confirmWorkOrder={confirmWorkOrder}
        setProviderStatus={setProviderStatus}
        setActiveCheckpoint={setActiveCheckpoint}
        providerArrived={providerArrived}
        materialsReady={materialsReady}
        setMaterialsReady={setMaterialsReady}
        delayMinutes={delayMinutes}
        reportDelay={reportDelay}
        setProviderArrived={setProviderArrived}
        executionTimeline={executionTimeline}
        activeExecutionStep={activeExecutionStep}
        completionVariance={completionVariance}
        plannedMinutes={plannedMinutes}
        actualMinutes={actualMinutes}
        error={error}
        restart={restart}
      />
    )}
  </main>;
}
