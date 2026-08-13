"use client";

import { useEffect, useState } from "react";

type Row = Record<string, string | number | boolean | null>;
type Snapshot = { workOrders: Row[]; assignments: Row[]; stops: Row[]; events: Row[]; reservations: Row[] };
const FLOW = ["matching", "team_pending", "equipment_check", "ready", "in_progress", "awaiting_customer", "completed"];

export default function CustomerTrackingPage() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const load = async () => {
    try {
      const response = await fetch("/api/operations", { cache: "no-store" });
      const payload = await response.json() as Snapshot & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not load order tracking");
      setData(payload); setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load order tracking"); }
  };
  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 5000); return () => window.clearInterval(timer); }, []);
  const order = data?.workOrders[0];
  const orderId = Number(order?.id || 0);
  const assignments = data?.assignments.filter(row => Number(row.work_order_id) === orderId && row.status !== "replaced") || [];
  const stops = data?.stops.filter(row => Number(row.work_order_id) === orderId).sort((a,b) => Number(a.stop_order) - Number(b.stop_order)) || [];
  const events = data?.events.filter(row => Number(row.work_order_id) === orderId).slice().reverse() || [];
  const currentIndex = Math.max(0, FLOW.indexOf(String(order?.status || "matching")));

  return <main className="tracking-shell">
    <header className="tracking-top"><a href="/"><img src="/brand/doneeo-logo.png" alt="Doneeo" /></a><nav><a href="/">New request</a><a href="/provider/alex">Alex view</a><a href="/provider/samir">Samir view</a><a href="/data">Test controls</a></nav></header>
    <section className="tracking-hero"><div><small>LIVE CUSTOMER ORDER</small><h1>{order?.public_reference || "Loading order…"}</h1><p>{order?.request_text || error}</p></div><div><span>{String(order?.status || "connecting").replaceAll("_", " ")}</span><strong>${Number(order?.price || 0).toFixed(2)} CAD</strong><small>Refreshes automatically</small></div></section>
    {order && <>
      <section className="tracking-progress">{FLOW.map((state,index) => <div className={index < currentIndex ? "complete" : index === currentIndex ? "active" : "pending"} key={state}><b>{index < currentIndex ? "✓" : index + 1}</b><span>{state.replaceAll("_", " ")}</span></div>)}</section>
      <section className="tracking-summary"><div><small>SCHEDULE</small><strong>{order.schedule_text}</strong></div><div><small>TEAM</small><strong>{assignments.length} assigned</strong><span>{assignments.map(item => `${item.executor_name}: ${item.status}`).join(" · ")}</span></div><div><small>ROUTE</small><strong>{stops.length} ordered stops</strong><span>{stops.map(item => item.address).join(" → ")}</span></div></section>
      <section className="tracking-events-card"><div className="tracking-events-head"><div><small>SHARED ACTIVITY</small><h2>Every important decision in one timeline</h2></div><button onClick={load}>Refresh now</button></div><div className="tracking-event-list">{events.map((event,index) => <article className={index === events.length - 1 ? "latest" : ""} key={String(event.id)}><b>{index + 1}</b><div><strong>{event.title}</strong><p>{event.detail}</p><small>{event.actor} · {new Date(String(event.created_at)).toLocaleString("en-CA")}</small></div></article>)}</div></section>
    </>}
  </main>;
}
