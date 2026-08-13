"use client";

import { useEffect, useMemo, useState } from "react";

type OfferState = "offered" | "accepted" | "declined" | "in_progress" | "completed";
type MemberStatus = "waiting" | "accepted" | "declined" | "replacement";
type EquipmentAnswer = "bringing" | "not_available";
type SharedSnapshot = { workOrders: Array<Record<string, string | number | null>>; executors: Array<Record<string, string | number | null>>; rentals: Array<Record<string, string | number | null>>; assignments: Array<Record<string, string | number | null>>; reservations: Array<Record<string, string | number | null>>; equipmentResponses: Array<Record<string, string | number | null>>; stops: Array<Record<string, string | number | null>> };
type StoredWorkPlan = { tasks?: Array<{ sequence?: number; title?: string; domain?: string; qualification?: string; resourceIds?: string[]; minimumCrew?: number; recommendedCrew?: number; likelyMinutes?: number; rangeLow?: number; rangeHigh?: number; completionGate?: string; serviceGroup?: string; assignedRole?: string; handoffRequired?: boolean }>; timeline?: Array<{ sequence?: number; taskSequence?: number | null; title?: string; description?: string; minutes?: number; lowMinutes?: number; highMinutes?: number; qualification?: string; isGate?: boolean }>; skills?: string[]; domains?: string[]; fulfillment?: { mode?: string; singleCustomerOrder?: boolean; rationale?: string; groups?: Array<{ id?: string; title?: string; executorRole?: string; taskSequences?: number[]; vehicleRequired?: boolean; handoffAfterTask?: number | null }> } };

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

const route = [
  {
    location: "IKEA Montréal · 9191 Boulevard Cavendish",
    contact: "IKEA pickup desk",
    actions: ["Pick up the paid and ready large dining table", "Photograph condition before loading"],
  },
  {
    location: "175 Sainte-Catherine Street West · Montréal",
    contact: "Customer-authorized recipient",
    actions: ["Deliver and place the new dining table", "Pick up the old dining table"],
  },
  {
    location: "100 Place Charles-Le Moyne · Longueuil",
    contact: "Final recipient",
    actions: ["Deliver and place the old dining table", "Record final condition and handoff"],
  },
];

const equipment = [
  { id: "cargo_van", label: "Cargo van or suitable moving truck", detail: "Interior length and payload suitable for both tables", rental: 89, rentalKm: 6.4 },
  { id: "straps", label: "Moving straps", detail: "Secure both tables during transport", rental: 8, rentalKm: 4.8 },
  { id: "blankets", label: "Protective blankets", detail: "Protect surfaces and table edges", rental: 12, rentalKm: 4.8 },
  { id: "dolly", label: "Furniture dolly", detail: "Required for safe handling and access", rental: 18, rentalKm: 4.8 },
  { id: "loading_ramp", label: "Portable loading ramp", detail: "Required because the selected vehicle and pickup access have a loading-height gap", rental: 25, rentalKm: 4.8 },
];

const TEST_KM_RATE = 0.70;

const initialMembers: Array<{ id: string; executorId: string; name: string; role: string; rating: string; equipment: string[]; status: MemberStatus }> = [
  { id: "lead", executorId: "alex", name: "Alex M.", role: "Team lead · driver", rating: "4.8 ★ · 126 jobs", equipment: ["cargo_van", "blankets", "straps"], status: "waiting" },
  { id: "support", executorId: "samir", name: "Samir K.", role: "Handling support", rating: "4.9 ★ · 97 jobs", equipment: ["dolly", "straps", "ppe"], status: "waiting" },
];

const baseMilestones = [
  { title: "Readiness confirmed", place: "Provider preparation", start: "8:15 AM", finish: "8:35 AM", minutes: 20, action: "Load verified equipment and confirm the second executor." },
  { title: "Arrive at Stop 1", place: route[0].location, start: "9:00 AM", finish: "9:00 AM", minutes: 0, action: "Arrive at the committed customer time." },
  { title: "Pick up new table", place: route[0].location, start: "9:00 AM", finish: "9:20 AM", minutes: 20, action: route[0].actions.join(" · ") },
  { title: "Travel to Stop 2", place: route[1].location, start: "9:20 AM", finish: "10:10 AM", minutes: 50, action: "Follow the traffic-aware route and protect the loaded item." },
  { title: "Exchange tables", place: route[1].location, start: "10:10 AM", finish: "10:40 AM", minutes: 30, action: route[1].actions.join(" · ") },
  { title: "Travel to Stop 3", place: route[2].location, start: "10:40 AM", finish: "11:10 AM", minutes: 30, action: "Continue with the old table secured in the vehicle." },
  { title: "Final delivery", place: route[2].location, start: "11:10 AM", finish: "11:30 AM", minutes: 20, action: route[2].actions.join(" · ") },
  { title: "Completion validation", place: "Doneeo work order", start: "11:30 AM", finish: "11:40 AM", minutes: 10, action: "Submit completion proof and wait for customer validation." },
];

function addMinutes(clock: string, minutes: number) {
  const match = clock.match(/(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)/i);
  if (!match) return clock;
  const meridiem = match[3].replaceAll(".", "").toLowerCase();
  const hour = Number(match[1]) % 12 + (meridiem === "pm" ? 12 : 0);
  const date = new Date(2000, 0, 1, hour, Number(match[2] || 0) + minutes);
  return date.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" });
}

export default function ProviderWorkspace() {
  const [offerState, setOfferState] = useState<OfferState>("offered");
  const [equipmentAnswers, setEquipmentAnswers] = useState<Record<string, Record<string, EquipmentAnswer>>>({});
  const [rentalAdded, setRentalAdded] = useState<string[]>([]);
  const [members, setMembers] = useState(initialMembers);
  const [activeMilestone, setActiveMilestone] = useState(0);
  const [delayMinutes, setDelayMinutes] = useState(0);
  const [delayInput, setDelayInput] = useState("");
  const [delayNote, setDelayNote] = useState("");
  const [notice, setNotice] = useState("A new Doneeo work offer is waiting for your decision.");
  const [providerGateProofs, setProviderGateProofs] = useState<Record<number, boolean>>({});
  const [sharedData, setSharedData] = useState<SharedSnapshot | null>(null);
  const [databaseStatus, setDatabaseStatus] = useState("Connecting to shared test data…");

  const refreshSharedData = async () => {
    try {
      const response = await fetch("/api/operations", { cache: "no-store" });
      const payload = await response.json() as SharedSnapshot & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Database unavailable");
      setSharedData(payload);
      setDatabaseStatus("Shared database connected");
    } catch (reason) { setDatabaseStatus(reason instanceof Error ? reason.message : "Database unavailable"); }
  };
  useEffect(() => { void refreshSharedData(); }, []);

  const activeOrder = sharedData?.workOrders?.[0];
  const activeOrderId = Number(activeOrder?.id || 0);
  const activeReference = String(activeOrder?.public_reference || "DN-DEMO24");
  const activeBaseTotal = Number(activeOrder?.price || 290);
  const activeSchedule = String(activeOrder?.schedule_text || "Tomorrow · 9:00 AM");
  const isSeedDemo = activeReference === "DN-DEMO24";
  const activeWorkPlan = parseJson<StoredWorkPlan>(activeOrder?.required_skills_json, {});
  const activeStops = sharedData?.stops?.filter(stop => Number(stop.work_order_id) === activeOrderId).sort((left, right) => Number(left.stop_order) - Number(right.stop_order)) || [];
  const activeRoute = activeOrder && !isSeedDemo && activeStops.length ? activeStops.map(stop => ({ location: String(stop.address || activeOrder.city || "Service location"), contact: String(stop.contact_name || "Customer-authorized recipient"), actions: parseJson<string[]>(stop.actions_json, ["Complete the confirmed work at this location"]) })) : route;
  const activeEquipment = activeOrder && !isSeedDemo ? parseJson<{ resources?: Array<{ id?: string; name?: string; kind?: string; status?: string }> }>(activeOrder.required_equipment_json, {}).resources?.filter(resource => resource.kind !== "consumable" && resource.kind !== "material").map(resource => { const known = equipment.find(item => item.id === resource.id); return known || { id: String(resource.id || "equipment"), label: String(resource.name || resource.id || "Required equipment"), detail: "Required by the confirmed multi-task work order", rental: 20, rentalKm: 4.8 }; }) || [] : equipment;
  useEffect(() => {
    if (!activeOrderId || isSeedDemo || !sharedData) return;
    const assigned = sharedData.assignments.filter(row => Number(row.work_order_id) === activeOrderId && row.status !== "replaced");
    if (!assigned.length) return;
    setMembers(assigned.map((assignment, index) => {
      const profile = sharedData.executors.find(executor => executor.id === assignment.executor_id);
      return { id: index === 0 ? "lead" : "support", executorId: String(assignment.executor_id), name: String(assignment.executor_name), role: String(assignment.role || (index === 0 ? "Lead executor" : "Support executor")), rating: `${profile?.rating || "4.8"} ★ · ${profile?.completed_jobs || "verified"} jobs`, equipment: String(profile?.equipment_ids || "").split(",").filter(Boolean), status: assignment.status === "accepted" ? "accepted" as const : "waiting" as const };
    }));
  }, [activeOrderId, isSeedDemo, sharedData?.assignments.length]);

  const outcomeFor = (equipmentId: string) => {
    if (members.some(member => member.equipment.includes(equipmentId))) return "profile_covered" as const;
    const answers = members.map(member => equipmentAnswers[member.executorId]?.[equipmentId]);
    if (answers.includes("bringing")) return "covered" as const;
    if (answers.every(answer => answer === "not_available")) return "rental" as const;
    return "pending" as const;
  };
  const readinessComplete = activeEquipment.every(item => outcomeFor(item.id) !== "pending") && members.every(member => member.status === "accepted" || member.status === "replacement");
  const rentalItems = activeEquipment.filter(item => rentalAdded.includes(item.id));
  const rentalFeeTotal = rentalItems.reduce((sum, item) => sum + item.rental, 0);
  const rentalKm = rentalItems.reduce((sum, item) => sum + item.rentalKm, 0);
  const mileageReimbursement = Math.round(rentalKm * TEST_KM_RATE * 100) / 100;
  const rentalTotal = rentalFeeTotal + mileageReimbursement;
  const jobTotal = activeBaseTotal + rentalTotal;
  const confirmedEquipment = activeEquipment.filter(item => outcomeFor(item.id) !== "pending").length;
  const milestoneSource = activeWorkPlan.timeline?.length ? activeWorkPlan.timeline.map((step, index) => ({ title: `${step.taskSequence ? `Task ${step.taskSequence} · ` : ""}${step.title || `Step ${index + 1}`}`, place: activeRoute.at(-1)?.location || "Service location", start: addMinutes(activeSchedule, activeWorkPlan.timeline!.slice(0, index).reduce((sum, item) => sum + Number(item.minutes || 0), 0)), finish: addMinutes(activeSchedule, activeWorkPlan.timeline!.slice(0, index + 1).reduce((sum, item) => sum + Number(item.minutes || 0), 0)), minutes: Number(step.minutes || 0), action: step.description || "Complete the confirmed phase.", isGate: Boolean(step.isGate), taskSequence: Number(step.taskSequence || 0) })) : baseMilestones.map(item => ({ ...item, isGate: false, taskSequence: 0 }));
  const milestones = useMemo(() => milestoneSource.map((milestone, index) => ({
    ...milestone,
    start: index < 2 ? milestone.start : addMinutes(milestone.start, delayMinutes),
    finish: index < 2 ? milestone.finish : addMinutes(milestone.finish, delayMinutes),
  })), [delayMinutes, activeOrderId, activeWorkPlan.timeline?.length]);
  const expectedFinish = milestones.at(-1)?.finish || "11:40 AM";
  const totalMinutes = milestoneSource.reduce((sum, milestone) => sum + milestone.minutes, 0) + delayMinutes;
  const customerDeadline = isSeedDemo ? "Tomorrow · 1:00 PM" : "Not fixed";

  const acceptOffer = () => {
    setOfferState("accepted");
    setMembers(current => current.map((member, index) => index === 0 ? { ...member, status: "accepted" } : member));
    setNotice("Lead accepted. Doneeo is holding the work order while every assembled team member validates the same plan.");
    const leadAssignment = sharedData?.assignments?.find(row => Number(row.work_order_id) === activeOrderId && Number(row.is_lead) === 1);
    if (leadAssignment?.id) void fetch("/api/operations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "assignment_status", assignmentId: leadAssignment.id, status: "accepted" }) }).then(() => refreshSharedData());
  };

  const setMemberStatus = (id: string, status: MemberStatus) => {
    setMembers(current => current.map(member => member.id === id ? { ...member, status } : member));
    setOfferState("accepted");
    setNotice(status === "accepted" ? "Team member accepted. Doneeo is checking the full team and equipment plan." : "One executor declined. Doneeo is matching a replacement without changing the customer order.");
    const memberName = members.find(member => member.id === id)?.name;
    const assignment = sharedData?.assignments?.find(row => Number(row.work_order_id) === activeOrderId && row.executor_name === memberName);
    if (assignment?.id) void fetch("/api/operations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "assignment_status", assignmentId: assignment.id, status }) }).then(() => refreshSharedData());
  };

  const matchReplacement = (id: string) => {
    setMembers(current => current.map(member => member.id === id ? { ...member, executorId: "maya", name: "Maya T.", rating: "4.9 ★ · 112 jobs", equipment: ["dolly", "ppe"], status: "replacement" } : member));
    setNotice("Replacement matched and accepted. Roles, route, timing and payout have been synchronized for the full team.");
    if (activeOrderId) void fetch("/api/operations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "replace_assignment", workOrderId: activeOrderId, executorId: id === "support" ? "samir" : "alex", replacementExecutorId: "maya" }) }).then(() => refreshSharedData());
  };

  const answerEquipment = (executorId: string, equipmentId: string, answer: EquipmentAnswer) => {
    const member = members.find(person => person.executorId === executorId);
    const nextAnswers = { ...equipmentAnswers, [executorId]: { ...(equipmentAnswers[executorId] || {}), [equipmentId]: answer } };
    setEquipmentAnswers(nextAnswers);
    const teamAnswers = members.map(person => nextAnswers[person.executorId]?.[equipmentId]);
    const bothUnavailable = teamAnswers.every(value => value === "not_available");
    const nowCovered = teamAnswers.includes("bringing");
    const workOrderId = activeOrderId;
    const profileListed = Boolean(member?.equipment.includes(equipmentId));
    if (workOrderId) {
      void fetch("/api/operations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "equipment_response", workOrderId, executorId, equipmentId, profileListed, response: answer }) }).then(() => refreshSharedData());
    }
    if (bothUnavailable && !rentalAdded.includes(equipmentId)) {
      setRentalAdded(current => [...current, equipmentId]);
      const item = activeEquipment.find(entry => entry.id === equipmentId);
      setNotice(`Both executors confirmed they cannot supply ${item?.label}. Doneeo added the nearest rental plus ${item?.rentalKm} km of pickup/return reimbursement. Paid execution minutes remain unchanged.`);
      if (workOrderId) void fetch("/api/operations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reserve_rental", workOrderId, equipmentId, executorId: "alex" }) }).then(() => refreshSharedData());
    } else if (nowCovered && rentalAdded.includes(equipmentId)) {
      setRentalAdded(current => current.filter(id => id !== equipmentId));
      setNotice(`${member?.name} confirmed the item. The rental was removed and the total cost and time were recalculated.`);
      if (workOrderId) void fetch("/api/operations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "cancel_rental", workOrderId, equipmentId }) }).then(() => refreshSharedData());
    } else {
      setNotice(answer === "bringing" ? `${member?.name} individually confirmed this equipment.` : `${member?.name} does not have it. Doneeo is waiting for the other executor before considering rental.`);
    }
  };

  const declineOffer = () => {
    setOfferState("declined");
    setNotice("Offer declined. Doneeo is rematching the same confirmed plan without asking the customer to start again.");
  };

  const startJob = () => {
    if (!readinessComplete) return;
    setOfferState("in_progress");
    setActiveMilestone(1);
    setNotice("Readiness confirmed. The customer can now follow the same execution plan live.");
    if (activeOrderId) void fetch("/api/operations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "work_order_status", workOrderId: activeOrderId, status: "in_progress" }) }).then(() => refreshSharedData());
  };

  const advance = () => {
    const currentMilestone = milestones[activeMilestone];
    if (currentMilestone?.isGate && currentMilestone.taskSequence && !providerGateProofs[currentMilestone.taskSequence]) {
      setProviderGateProofs(current => ({ ...current, [currentMilestone.taskSequence]: true }));
      setNotice(`Task ${currentMilestone.taskSequence} completion evidence submitted. The next task remains locked until the customer approves this result.`);
      return;
    }
    if (activeMilestone >= milestones.length - 1) {
      setOfferState("completed");
      setNotice("Completion submitted. The customer received the final report and validation request.");
      if (activeOrderId) void fetch("/api/operations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "work_order_status", workOrderId: activeOrderId, status: "completed" }) }).then(() => refreshSharedData());
      return;
    }
    const next = activeMilestone + 1;
    setActiveMilestone(next);
    setNotice(currentMilestone?.isGate ? `Customer approval recorded. Doneeo released Task ${Number(currentMilestone.taskSequence || 0) + 1}.` : `${milestones[activeMilestone].title} confirmed. Remaining arrival and finish times were updated for affected participants.`);
  };

  const reportDelay = () => {
    const parsed = Math.max(1, Math.min(180, Number(delayInput) || 15));
    setDelayMinutes(current => current + parsed);
    setDelayNote(`+${parsed} min · ${delayNote.trim() || "Operational delay reported by provider"}`);
    setDelayInput("");
    setNotice(`Delay reported. Doneeo added ${parsed} minutes to the current and following milestones and notified affected participants.`);
  };

  return <main className="provider-shell">
    <header className="provider-topbar">
      <a href="/" aria-label="Return to Doneeo customer planner"><img src="/brand/doneeo-logo.png" alt="Doneeo" /></a>
      <div><span>EXECUTOR WORKSPACE</span><b>{members.map(member => member.name).join(" + ")}</b></div>
    </header>

    <section className="provider-hero">
      <div><small>WORK OFFER · {activeReference}</small><h1>A complete job—not a vague request.</h1><p>{String(activeOrder?.request_text || "Review the tasks, route, customer commitments, equipment responsibility, timing and payment before accepting.")}</p></div>
      <div className={`provider-status ${offerState}`}><span>{offerState.replace("_", " ")}</span><strong>${jobTotal.toFixed(2)} CAD</strong><small>{rentalTotal ? `$${activeBaseTotal.toFixed(2)} service + $${rentalFeeTotal.toFixed(2)} rental + $${mileageReimbursement.toFixed(2)} km reimbursement` : `$${activeBaseTotal.toFixed(2)} service · no rental needed`}</small></div>
    </section>

    <div className="provider-notice" role="status">● {notice}</div>

    <section className="provider-db-sync"><div><small>SHARED DATABASE</small><strong>{databaseStatus}</strong><span>{sharedData?.workOrders?.[0] ? `Latest customer order: ${sharedData.workOrders[0].public_reference} · ${sharedData.workOrders[0].status}` : "Loading latest customer work order"}</span></div><div><b>{sharedData?.executors?.length || 0}</b><span>profiles</span></div><div><b>{sharedData?.rentals?.length || 0}</b><span>rental items</span></div><button onClick={refreshSharedData}>Refresh</button></section>

    <section className="provider-summary">
      <div><small>COMMITTED ARRIVAL</small><strong>{activeSchedule}</strong><span>At {activeRoute[0]?.location}</span></div>
      <div><small>MUST FINISH BY</small><strong>{customerDeadline}</strong><span>{customerDeadline === "Not fixed" ? "No customer deadline supplied" : "Customer deadline"}</span></div>
      <div><small>CURRENT EXPECTED FINISH</small><strong>{expectedFinish}</strong><span>{delayMinutes ? `Updated · +${delayMinutes} min` : customerDeadline === "Not fixed" ? "Based on the ordered task plan" : "1h20 buffer"}</span></div>
      <div><small>TEAM</small><strong>{members.length} executor{members.length === 1 ? "" : "s"}</strong><span>{members.map(member => member.role).join(" + ")}</span></div>
    </section>

    <section className="provider-card provider-team">
      <div className="provider-section-head"><div><small>DYNAMIC TEAM FORMATION</small><h2>Doneeo assembled the required skill coverage</h2></div><span>{members.filter(member => member.status === "accepted" || member.status === "replacement").length}/{members.length} validated</span></div>
      <p className="provider-explainer">Doneeo matched the complete request, not only its first task. Every executor receives the same ordered tasks, completion gates, equipment responsibility, timing and payout.</p>
      <div className="provider-team-grid">{members.map(member => <article key={member.id} className={member.status}>
        <div className="member-head"><b>{member.name}</b><span>{member.status}</span></div>
        <strong>{member.role}</strong><small>{member.rating}</small><div className="profile-equipment"><small>VERIFIED PROFILE EQUIPMENT</small>{member.equipment.map(id => <span key={id}>✓ {activeEquipment.find(item => item.id === id)?.label || id}</span>)}</div>
        {member.status === "waiting" && <div className="member-actions"><button onClick={() => setMemberStatus(member.id, "accepted")}>Accept role</button><button onClick={() => setMemberStatus(member.id, "declined")}>Decline</button></div>}
        {member.status === "declined" && <button className="replacement-button" onClick={() => matchReplacement(member.id)}>Let Doneeo match replacement</button>}
        {(member.status === "accepted" || member.status === "replacement") && <em>✓ Role, route and payout validated</em>}
      </article>)}</div>
      <div className="team-rule"><b>Team activation rule</b><span>The order stays on hold until every assigned executor validates. If one declines, only that role is rematched; the customer does not rebuild the request.</span></div>
    </section>

    {activeWorkPlan.fulfillment?.mode === "coordinated_specialists" ? <section className="provider-card provider-service-groups"><div className="provider-section-head"><div><small>ONE ORDER · MULTIPLE INTERNAL SERVICES</small><h2>Doneeo owns the executor handoff</h2></div><span>Customer order unchanged</span></div><p>{activeWorkPlan.fulfillment.rationale}</p><div className="fulfillment-groups">{activeWorkPlan.fulfillment.groups?.map((group, index) => <article key={group.id || index}><b>{String.fromCharCode(65 + index)}</b><div><small>{group.title}</small><strong>{group.executorRole}</strong><span>Assigned tasks: {group.taskSequences?.join(", ")}{group.vehicleRequired ? " · vehicle required" : " · in-home service"}</span>{group.handoffAfterTask ? <em>Submit condition and delivery proof after Task {group.handoffAfterTask}; Doneeo releases the next service only after approval.</em> : <em>Finish the remaining tasks under the same work-order reference.</em>}</div></article>)}</div></section> : null}

    {activeWorkPlan.tasks?.length ? <section className="provider-card provider-task-plan"><div className="provider-section-head"><div><small>ORDERED MULTI-TASK WORK PLAN</small><h2>{activeWorkPlan.tasks.length} tasks form one complete order</h2></div><span>Order locked</span></div><p>The request is treated like a complete sentence: finish each task, record proof, obtain approval, then continue to the next task.</p><div className="provider-task-sequence">{activeWorkPlan.tasks.map((task, index) => <article key={`${task.sequence}-${task.title}`}><b>Task {task.sequence}</b><div><h3>{task.title}</h3><p>{task.qualification?.replaceAll("_", " ")} · {task.rangeLow}–{task.rangeHigh} min · crew {task.minimumCrew} minimum / {task.recommendedCrew} recommended</p><small>{task.resourceIds?.length ? `Resources: ${task.resourceIds.join(", ").replaceAll("_", " ")}` : "No special resource gap"}</small>{index < activeWorkPlan.tasks!.length - 1 ? <em>FULL STOP · submit completion evidence and wait for customer approval before Task {Number(task.sequence || index + 1) + 1}</em> : <em>FINAL STOP · submit completion evidence for the full order</em>}</div></article>)}</div></section> : null}

    <section className="provider-card">
      <div className="provider-section-head"><div><small>ORDERED EXECUTION ROUTE</small><h2>Every stop has explicit actions</h2></div><span>{activeRoute.length} stops</span></div>
      <div className="provider-route">{activeRoute.map((node, index) => <article key={node.location}><b>{index + 1}</b><div><small>{activeRoute.length === 1 ? "ON-SITE SERVICE" : index === 0 ? "PICKUP" : index === activeRoute.length - 1 ? "FINAL DELIVERY" : "DELIVERY + PICKUP"}</small><h3>{node.location}</h3><ul>{node.actions.map(action => <li key={action}>✓ {action}</li>)}</ul><p>Contact visible for this stop: <strong>{node.contact}</strong></p></div></article>)}</div>
    </section>

    <section className="provider-card provider-equipment">
      <div className="provider-section-head"><div><small>PROFILE-FIRST EQUIPMENT CHECK</small><h2>Ask only when the matched team has a gap</h2></div><span>{confirmedEquipment}/{activeEquipment.length} resolved</span></div>
      <p>Equipment already verified in an assigned executor profile is added to the work order automatically. Doneeo asks the assigned team only about a missing item, and the first “I have it” answer closes the request without a rental.</p>
      <div className="equipment-confirmation-grid">{activeEquipment.map(item => {
        const outcome = outcomeFor(item.id);
        const profileOwners = members.filter(member => member.equipment.includes(item.id));
        const provider = members.find(member => equipmentAnswers[member.executorId]?.[item.id] === "bringing");
        return <article key={item.id} className={outcome}>
          <div className="equipment-requirement"><small>REQUIRED FOR THIS JOB</small><strong>{item.label}</strong><span>{item.detail}</span><em>{outcome === "profile_covered" ? "Verified profile equipment · added automatically" : outcome === "covered" ? `First confirmation received from ${provider?.name} · rental cancelled` : outcome === "rental" ? "Every assigned executor declined · rental added" : "Team gap detected · asking assigned executors"}</em></div>
          {outcome === "profile_covered" && <div className="automatic-coverage"><b>✓ No confirmation required</b><span>{profileOwners.map(member => member.name).join(" + ")} already listed this equipment in a verified profile. It is now attached to the work order.</span></div>}
          {outcome === "covered" && <div className="automatic-coverage"><b>✓ Gap covered by {provider?.name}</b><span>The first positive answer closed the request. Doneeo will not wait for the other executor and no rental is needed.</span></div>}
          {outcome === "rental" && <div className="automatic-coverage rental-result"><b>Rental required</b><span>Every assigned executor independently confirmed they do not have this missing item.</span></div>}
          {outcome === "pending" && <div className="individual-answer-list">{members.map(member => { const answer = equipmentAnswers[member.executorId]?.[item.id]; return <div key={`${member.executorId}-${item.id}`}><div><b>{member.name}</b><span className="not-listed">Gap request</span></div><small>Do you have this missing item even though it is not listed in your profile?</small><div><button className={answer === "bringing" ? "active" : ""} onClick={() => answerEquipment(member.executorId, item.id, "bringing")}>I have it</button><button className={answer === "not_available" ? "active no" : ""} onClick={() => answerEquipment(member.executorId, item.id, "not_available")}>I don’t have it</button></div></div>})}</div>}
        </article>;
      })}</div>
      {rentalItems.length > 0 && <>
        <div className="rental-plan"><div><small>RENTAL ADDED ONLY AFTER BOTH DECLINED</small><h3>ToolShare Montréal selected automatically</h3><p>The assigned lead collects the reservation before Stop 1 and returns it after the job. These trips are part of the execution route but stay outside paid execution time.</p>{rentalItems.map(item => <span className="rental-line" key={item.id}>{item.label} · ${item.rental.toFixed(2)} rental · {item.rentalKm.toFixed(1)} km round trip · ${(item.rentalKm * TEST_KM_RATE).toFixed(2)} reimbursement</span>)}</div><div><b>+${rentalTotal.toFixed(2)}</b><span>${rentalFeeTotal.toFixed(2)} rental + ${mileageReimbursement.toFixed(2)} mileage</span></div></div>
        <div className="rental-route-extension"><small>RENTAL ROUTE EXTENSION</small><ol><li><b>Before paid work:</b> team lead → ToolShare Montréal → Stop 1. Reimburse {rentalKm.toFixed(1)} km at ${TEST_KM_RATE.toFixed(2)}/km.</li><li><b>Paid execution begins:</b> working minutes start when the team reaches Stop 1 and starts the customer task.</li><li><b>After paid work:</b> return the rental item to ToolShare Montréal. Return travel is routed but is not paid working time.</li></ol></div>
      </>}
      <div className="job-recalculation"><div><small>ORIGINAL SERVICE</small><strong>${activeBaseTotal.toFixed(2)} · {totalMinutes} planned min</strong></div><span>+</span><div><small>RENTAL + KM</small><strong>${rentalTotal.toFixed(2)} · 0 paid min</strong></div><span>=</span><div><small>UPDATED CUSTOMER TOTAL</small><strong>${jobTotal.toFixed(2)} CAD · {totalMinutes} planned min</strong></div></div>
    </section>

    {offerState === "offered" && <section className="provider-decision-panel"><button className="provider-accept" onClick={acceptOffer}>Accept complete work order</button><button className="provider-decline" onClick={declineOffer}>Decline—Doneeo should rematch</button><p>Accepting means the team accepts every ordered task, completion gate, location, equipment responsibility, schedule and estimated payout.</p></section>}
    {offerState === "declined" && <section className="provider-decision-panel declined"><h2>Rematching started</h2><p>The customer’s confirmed scenario remains intact. Doneeo will send the complete order to the next compatible team.</p><button className="provider-accept" onClick={() => { setOfferState("offered"); setNotice("Demo reset. The offer is available again."); }}>Reset provider demo</button></section>}
    {offerState === "accepted" && <button className="provider-start" disabled={!readinessComplete} onClick={startJob}>{readinessComplete ? `Activate team · $${jobTotal.toFixed(2)} total · ${totalMinutes} planned execution min` : "Waiting for every executor and equipment gap decision"}</button>}

    {(offerState === "in_progress" || offerState === "completed") && <section className="provider-card provider-live">
      <div className="provider-section-head"><div><small>LIVE EXECUTION CONTROL</small><h2>Provider and customer follow the same plan</h2></div><span>{offerState === "completed" ? "Completed" : `Step ${activeMilestone + 1}/${milestones.length}`}</span></div>
      <div className="provider-milestones">{milestones.map((milestone, index) => <article className={index < activeMilestone || offerState === "completed" ? "complete" : index === activeMilestone ? "active" : "pending"} key={milestone.title}><b>{index < activeMilestone || offerState === "completed" ? "✓" : index + 1}</b><div><h3>{milestone.title}</h3><p>{milestone.action}</p><small>{milestone.place}</small>{delayNote && index === activeMilestone && <em>{delayNote}</em>}</div><time>{milestone.start} → {milestone.finish}<small>{milestone.minutes} min</small></time></article>)}</div>
      {offerState === "in_progress" && <div className="provider-live-actions"><button className="provider-accept" onClick={advance}>{milestones[activeMilestone]?.isGate && milestones[activeMilestone]?.taskSequence && !providerGateProofs[milestones[activeMilestone].taskSequence] ? `Submit Task ${milestones[activeMilestone].taskSequence} completion evidence` : milestones[activeMilestone]?.isGate ? "Demo: customer approves and releases next step" : activeMilestone === milestones.length - 1 ? "Submit completion" : "Confirm milestone and continue"}</button><div className="provider-delay"><label><span>Delay minutes</span><input inputMode="numeric" value={delayInput} onChange={event => setDelayInput(event.target.value)} placeholder="15" /></label><label><span>Reason</span><input value={delayNote} onChange={event => setDelayNote(event.target.value)} placeholder="Traffic, access or execution issue" /></label><button onClick={reportDelay}>Report and recalculate</button></div></div>}
    </section>}

    {offerState === "completed" && <section className={`provider-report ${delayMinutes ? "late" : "ontime"}`}><small>FINAL EXECUTION REPORT</small><h2>{delayMinutes ? "Completed with a reported delay" : "Completed within the original estimate"}</h2><div><span>Original expected finish <strong>{addMinutes(activeSchedule, totalMinutes - delayMinutes)}</strong></span><span>Actual demo finish <strong>{expectedFinish}</strong></span><span>Execution time <strong>{totalMinutes} min</strong></span><span>Customer deadline <strong>{customerDeadline}</strong></span></div>{delayNote && <p><strong>Reported event:</strong> {delayNote}</p>}</section>}

    <footer className="provider-footer"><div><a href="/">← Customer planner</a> · <a href="/provider/alex">Alex view</a> · <a href="/provider/samir">Samir view</a> · <a href="/track">Customer tracking</a> · <a href="/data">Test controls</a></div><span>Prototype actions only—no real provider request, payment or notification is sent.</span></footer>
  </main>;
}
