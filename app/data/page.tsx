"use client";

import { useEffect, useState } from "react";

type Row = Record<string, string | number | boolean | null>;
type Snapshot = { executors: Row[]; skills: Row[]; equipment: Row[]; rentals: Row[]; workOrders: Row[]; assignments: Row[]; reservations: Row[]; equipmentResponses: Row[]; stops: Row[]; events: Row[] };

const views: Array<{ key: keyof Snapshot; label: string; description: string }> = [
  { key: "workOrders", label: "Work orders", description: "Customer orders and shared operational status." },
  { key: "stops", label: "Ordered stops", description: "Every persisted pickup, delivery, service and rental stop." },
  { key: "events", label: "Event history", description: "The shared customer–executor status timeline." },
  { key: "assignments", label: "Assignments", description: "Individual roles, lead responsibility and acceptance state." },
  { key: "executors", label: "Executors & teams", description: "Profiles, skills, vehicles and verified equipment." },
  { key: "equipmentResponses", label: "Equipment answers", description: "Separate responses to genuine post-match gaps." },
  { key: "reservations", label: "Rental reservations", description: "Rental inventory reserved for a specific order." },
  { key: "rentals", label: "Rental inventory", description: "Simulated Montréal partners, prices and availability." },
  { key: "skills", label: "Skills", description: "Skills used by the matching logic." },
  { key: "equipment", label: "Equipment", description: "Equipment IDs shared across profiles and rentals." },
];

export default function DataLab() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [active, setActive] = useState<keyof Snapshot>("workOrders");
  const [message, setMessage] = useState("Connecting to Doneeo test data…");
  const load = async () => {
    const response = await fetch("/api/operations", { cache: "no-store" });
    const payload = await response.json() as Snapshot & { error?: string };
    if (!response.ok) throw new Error(payload.error || "Could not load test data");
    setData(payload); setMessage("Test data synchronized");
  };
  useEffect(() => { void load().catch(error => setMessage(error instanceof Error ? error.message : "Could not load test data")); }, []);
  const act = async (payload: Record<string, unknown>, success: string) => {
    setMessage("Applying test change…");
    const response = await fetch("/api/operations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!response.ok) { setMessage("The test change could not be applied."); return; }
    await load(); setMessage(success);
  };
  const rows = data?.[active] || [];
  const columns = rows.length ? Object.keys(rows[0]) : [];
  const alex = data?.executors.find(row => row.id === "alex");
  const samir = data?.executors.find(row => row.id === "samir");

  return <main className="data-shell">
    <header className="data-topbar"><a href="/"><img src="/brand/doneeo-logo.png" alt="Doneeo" /></a><nav><a href="/">Customer</a><a href="/track">Live tracking</a><a href="/provider/alex">Alex</a><a href="/provider/samir">Samir</a><button onClick={load}>Refresh</button></nav></header>
    <section className="data-hero"><small>DONEEO TEST CONTROL CENTRE</small><h1>Change the conditions. Test the intelligence.</h1><p>Reset the golden scenario, make an executor unavailable, remove equipment and verify how the same order flows across every interface.</p><div>{data && <><span><b>{data.workOrders.length}</b> orders</span><span><b>{data.stops.length}</b> route stops</span><span><b>{data.events.length}</b> events</span><span><b>{data.assignments.length}</b> assignments</span></>}</div></section>
    <div className="test-message" role="status">● {message}</div>

    <section className="test-controls"><div className="test-control-head"><div><small>SCENARIO CONTROLS</small><h2>Golden-path test switches</h2></div><button className="reset-test" onClick={() => act({ action: "reset_test_data" }, "The database was reset to the three-stop Montréal moving scenario.")}>Reset complete scenario</button></div><div className="test-control-grid">
      <article><small>EXECUTOR AVAILABILITY</small><h3>Alex M.</h3><p>Current: <strong>{alex?.status || "loading"}</strong></p><div><button onClick={() => act({ action: "set_executor_status", executorId: "alex", status: "available" }, "Alex is available.")}>Available</button><button onClick={() => act({ action: "set_executor_status", executorId: "alex", status: "busy" }, "Alex is busy for matching tests.")}>Busy</button></div><a href="/provider/alex">Open Alex view →</a></article>
      <article><small>EXECUTOR AVAILABILITY</small><h3>Samir K.</h3><p>Current: <strong>{samir?.status || "loading"}</strong></p><div><button onClick={() => act({ action: "set_executor_status", executorId: "samir", status: "available" }, "Samir is available.")}>Available</button><button onClick={() => act({ action: "set_executor_status", executorId: "samir", status: "offline" }, "Samir is offline for replacement tests.")}>Offline</button></div><a href="/provider/samir">Open Samir view →</a></article>
      <article><small>EQUIPMENT GAP</small><h3>Samir’s dolly</h3><p>Remove or restore the dolly in Samir’s verified profile.</p><div><button onClick={() => act({ action: "toggle_executor_equipment", executorId: "samir", equipmentId: "dolly" }, "Samir’s dolly profile state was toggled.")}>Toggle dolly</button></div><a href="/provider/samir">Test the gap →</a></article>
      <article><small>CROSS-INTERFACE TEST</small><h3>Follow the same order</h3><p>Keep customer tracking and both individual executor views open together.</p><div><a className="control-link" href="/track">Customer timeline</a><a className="control-link" href="/provider">Team console</a></div></article>
    </div></section>

    <section className="data-workspace"><aside>{views.map(view => <button className={active === view.key ? "active" : ""} onClick={() => setActive(view.key)} key={view.key}><strong>{view.label}</strong><span>{data?.[view.key]?.length || 0} records</span></button>)}</aside><div className="data-table-card"><div className="data-table-head"><div><small>LIVE TEST TABLE</small><h2>{views.find(view => view.key === active)?.label}</h2><p>{views.find(view => view.key === active)?.description}</p></div><span>Persistent test data</span></div><div className="data-table-scroll"><table><thead><tr>{columns.map(column => <th key={column}>{column.replaceAll("_", " ")}</th>)}</tr></thead><tbody>{rows.map((row,index) => <tr key={String(row.id || row.public_reference || index)}>{columns.map(column => <td key={column}>{row[column] === null ? "—" : String(row[column])}</td>)}</tr>)}</tbody></table>{!rows.length && <div className="empty-data">No records yet.</div>}</div></div></section>
  </main>;
}
