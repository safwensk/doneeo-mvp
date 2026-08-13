"use client";

import { useEffect, useMemo, useState } from "react";

type Row = Record<string, string | number | boolean | null>;
type Snapshot = { executors: Row[]; workOrders: Row[]; assignments: Row[]; equipment: Row[]; equipmentResponses: Row[]; reservations: Row[]; stops: Row[]; events: Row[] };

const CATEGORY_EQUIPMENT: Record<string, string[]> = {
  moving: ["cargo_van", "straps", "blankets", "dolly", "loading_ramp"],
  installation: ["drill", "level", "stud_finder"],
  cleaning: ["vacuum", "mop", "ppe"],
  elder_support: ["transport", "ppe"],
  general: ["toolkit", "ppe"],
};

function ids(value: unknown) {
  return String(value || "").split(",").map(item => item.trim()).filter(Boolean);
}

export default function ExecutorPortal({ executorId }: { executorId: string }) {
  const [data, setData] = useState<Snapshot | null>(null);
  const [message, setMessage] = useState("Loading your latest Doneeo assignment…");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const response = await fetch("/api/operations", { cache: "no-store" });
    const payload = await response.json() as Snapshot & { error?: string };
    if (!response.ok) throw new Error(payload.error || "Could not load executor data");
    setData(payload);
    setMessage("Your view is synchronized with the shared Doneeo work order.");
  };
  useEffect(() => { void load().catch(error => setMessage(error instanceof Error ? error.message : "Could not load data")); }, []);

  const executor = data?.executors.find(row => row.id === executorId);
  const assignment = data?.assignments.find(row => row.executor_id === executorId && row.status !== "replaced");
  const order = data?.workOrders.find(row => row.id === assignment?.work_order_id) || data?.workOrders[0];
  const orderId = Number(order?.id || 0);
  const teamAssignments = data?.assignments.filter(row => Number(row.work_order_id) === orderId && row.status !== "replaced") || [];
  const teamExecutors = teamAssignments.map(item => data?.executors.find(person => person.id === item.executor_id)).filter(Boolean) as Row[];
  const profileEquipment = ids(executor?.equipment_ids);
  const teamEquipment = Array.from(new Set(teamExecutors.flatMap(person => ids(person.equipment_ids))));
  const requiredIds = CATEGORY_EQUIPMENT[String(order?.category || "general")] || CATEGORY_EQUIPMENT.general;
  const catalog = new Map((data?.equipment || []).map(item => [String(item.id), item]));
  const missingEquipment = requiredIds.filter(id => !teamEquipment.includes(id) && catalog.has(id));
  const orderStops = (data?.stops || []).filter(row => Number(row.work_order_id) === orderId).sort((a,b) => Number(a.stop_order) - Number(b.stop_order));
  const events = (data?.events || []).filter(row => Number(row.work_order_id) === orderId).slice().reverse();
  const ownResponses = (data?.equipmentResponses || []).filter(row => Number(row.work_order_id) === orderId && row.executor_id === executorId);
  const payout = useMemo(() => {
    const rate = Number(executor?.hourly_rate || 0);
    const minutes = Math.max(90, orderStops.reduce((sum, stop) => sum + Number(stop.estimated_minutes || 0), 0));
    return Math.round(rate * minutes / 60);
  }, [executor?.hourly_rate, orderStops.length]);

  const post = async (payload: Record<string, unknown>, success: string) => {
    setBusy(true);
    const response = await fetch("/api/operations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setBusy(false);
    if (!response.ok) { setMessage("The action could not be saved."); return; }
    setMessage(success);
    await load();
  };

  if (!data || !executor) return <main className="executor-identity-shell"><p className="executor-loading">{message}</p></main>;

  return <main className="executor-identity-shell">
    <header className="executor-identity-top"><a href="/"><img src="/brand/doneeo-logo.png" alt="Doneeo" /></a><nav><a href="/provider/alex">Alex</a><a href="/provider/samir">Samir</a><a href="/provider/maya">Maya</a><a href="/track">Customer tracking</a><a href="/data">Test controls</a></nav></header>
    <section className="executor-identity-hero"><div><small>INDIVIDUAL EXECUTOR VIEW</small><h1>{executor.name}</h1><p>{executor.location} · {executor.rating} ★ · {executor.completed_jobs} completed jobs</p></div><div><span>{String(assignment?.status || "no offer")}</span><strong>{order?.public_reference || "No order"}</strong><small>Estimated payout ${payout} CAD</small></div></section>
    <div className="executor-sync-note" role="status">● {message}</div>

    {!assignment || !order ? <section className="executor-empty"><h2>No active assignment</h2><p>Use the testing console to reset or create a scenario for this executor.</p></section> : <>
      <section className="executor-offer-grid">
        <article><small>CUSTOMER OUTCOME</small><h2>{order.request_text}</h2><p>{order.schedule_text} · ${Number(order.price || 0).toFixed(2)} customer total</p></article>
        <article><small>YOUR RESPONSIBILITY</small><h2>{assignment.role}</h2><p>{assignment.is_lead ? "You are the accountable team lead." : "Follow the lead’s route and handling plan."}</p><strong>{orderStops.length} stops · {teamAssignments.length} executor(s)</strong></article>
      </section>

      {assignment.status === "offered" && <section className="executor-decision"><button disabled={busy} onClick={() => post({ action: "assignment_status", assignmentId: assignment.id, status: "accepted" }, "You accepted independently. Doneeo is waiting only for remaining team decisions.")}>Accept my role</button><button disabled={busy} onClick={() => post({ action: "assignment_status", assignmentId: assignment.id, status: "declined" }, "You declined. Doneeo will replace only your role.")}>Decline my role</button></section>}

      <section className="executor-section"><div className="executor-section-head"><div><small>ORDERED ROUTE</small><h2>Your complete execution plan</h2></div><span>{orderStops.length} stops</span></div><div className="executor-route">{orderStops.map((stop, index) => { let actions: string[] = []; try { actions = JSON.parse(String(stop.actions_json || "[]")); } catch {} return <article key={String(stop.id)}><b>{index + 1}</b><div><small>{String(stop.stop_type).replaceAll("_", " ")}</small><h3>{stop.address}</h3>{actions.map(action => <p key={action}>✓ {action}</p>)}<em>{stop.estimated_minutes} estimated working min</em></div></article>; })}</div></section>

      <section className="executor-section"><div className="executor-section-head"><div><small>PROFILE-FIRST EQUIPMENT</small><h2>Only genuine gaps require an answer</h2></div><span>{profileEquipment.length} profile items</span></div><div className="executor-profile-equipment">{profileEquipment.map(id => <span key={id}>✓ {catalog.get(id)?.name || id}</span>)}</div>{missingEquipment.length ? <div className="executor-gap-list">{missingEquipment.map(id => { const answered = ownResponses.find(response => response.equipment_id === id); return <article key={id}><div><strong>{catalog.get(id)?.name || id}</strong><span>{answered ? `Your answer: ${String(answered.response).replaceAll("_", " ")}` : "Not listed in any matched profile"}</span></div>{!answered && <div><button onClick={() => post({ action: "equipment_response", workOrderId: orderId, executorId, equipmentId: id, response: "bringing" }, "Your first positive answer closes this equipment gap for the team.")}>I have it</button><button onClick={() => post({ action: "equipment_response", workOrderId: orderId, executorId, equipmentId: id, response: "not_available" }, "Your answer was saved. Rental waits until every assigned executor declines.")}>I don’t have it</button></div>}</article>; })}</div> : <p className="executor-covered">✓ The assembled team’s verified profiles cover every required item.</p>}</section>

      <section className="executor-section"><div className="executor-section-head"><div><small>SHARED ORDER HISTORY</small><h2>What has happened so far</h2></div><span>{order.status}</span></div><div className="executor-events">{events.map(event => <article key={String(event.id)}><b>✓</b><div><strong>{event.title}</strong><p>{event.detail}</p><small>{event.actor} · {new Date(String(event.created_at)).toLocaleString("en-CA")}</small></div></article>)}</div></section>
    </>}
  </main>;
}
