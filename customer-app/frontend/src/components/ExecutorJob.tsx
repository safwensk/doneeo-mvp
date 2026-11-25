import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, MessageSquare, Package, TriangleAlert } from 'lucide-react';
import { api } from '../lib/api';
import { clock, dateLabel, jobsUrl, money, stepRange, type Job, type JobDetails } from '../lib/executor';

const labels = { OFFERED:'Awaiting your decision', DECLINED:'Declined', UPCOMING:'Upcoming', IN_PROGRESS:'In progress', REVIEW:'Completion in review', COMPLETED:'Completed' } as const;
const noteLabels: Record<string,string> = { missing:'Missing equipment', issue:'Issue', question:'Question', doneeo:'Doneeo update' };

export default function ExecutorJob({ id, zone, accountId, onBack, onChange, onAccept }: {
  id: string; zone: string; accountId: string; onBack: () => void;
  onChange: () => Promise<void>; onAccept: (job: Job) => void;
}) {
  const [details, setDetails] = useState<JobDetails>();
  const [confirmKit, setConfirmKit] = useState(false);
  const [noteType, setNoteType] = useState<'question'|'issue'|'missing'|null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    let active = true;
    void api<JobDetails>(`${jobsUrl}/${id}`).then(value => { if (active) setDetails(value); })
      .catch(problem => { if (active) setError(problem.message); });
    return () => { active = false; };
  }, [id,attempt]);
  useEffect(() => { if (details?.job.id === id) heading.current?.focus(); }, [details?.job.id,id]);

  async function action(name: string, message?: string, step?: number) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const next = await api<JobDetails>(`${jobsUrl}/${id}`, { accountId, action:name, bringConfirmed:confirmKit, message, step });
      setDetails(next);
      setNote('');
      setNoteType(null);
      if (name === 'resolve_sample_equipment') setConfirmKit(false);
      try { await onChange(); } catch { /* The work order response already confirms the change. */ }
      if (name === 'accept') onAccept(next.job);
      if (name === 'decline') onBack();
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'This job could not be updated.'); }
    finally { setBusy(false); }
  }

  if (!details || details.job.id !== id) return <>
    <button className="worker-link" type="button" onClick={onBack}><ArrowLeft size={17} aria-hidden="true" /> Back to Jobs</button>
    {error ? <div className="worker-panel"><p className="worker-error" role="alert">{error}</p><button className="outlined" type="button" onClick={() => { setError(''); setAttempt(n=>n+1); }}>Try again</button></div> : <p role="status">Opening work plan…</p>}
  </>;

  const { job } = details;
  const plan = job.plan;
  const offered = job.status === 'OFFERED';
  const proposed = offered || job.status === 'DECLINED';
  const active = job.status === 'UPCOMING' || job.status === 'IN_PROGRESS';
  const pay = money(plan.workPay + plan.equipmentPay);
  const date = dateLabel(job.start,zone);
  const window = `${clock(job.start,zone)} – ${clock(job.end,zone)}`;

  function sendNote(event: FormEvent) {
    event.preventDefault();
    if (noteType && note.trim()) void action(noteType, note.trim());
  }

  return <article className="worker-job-plan">
    <button className="worker-link" type="button" onClick={onBack}><ArrowLeft size={17} aria-hidden="true" /> {offered ? 'Back to new offers' : 'Back to Jobs'}</button>
    <p className="worker-kicker">{proposed ? 'Review work plan' : 'Confirmed work order'}</p>
    <div className="worker-heading-line"><h1 ref={heading} tabIndex={-1}>{plan.title}</h1><span className="worker-pill">{labels[job.status]}</span></div>
    <p>{plan.scope}</p>
    {plan.demo && <p className="worker-sample">Sample job · no real booking or payout</p>}

    <div className="worker-job-summary">
      <span><Clock3 size={21} aria-hidden="true" /> <span><strong>Full job window</strong><br />{date}, {window}</span></span>
      <span><span><strong>{proposed ? 'Proposed pay' : 'Agreed pay'}</strong><br />{pay}</span></span>
      <span><span><strong>Location</strong><br />{plan.location}</span></span>
    </div>

    <div className="worker-grid worker-plan-grid">
      <section className="worker-panel">
        <h2>{offered ? 'Schedule & work steps' : 'Work plan'}</h2>
        <ol className="worker-timeline">
          {plan.steps.map((step,i) => <li key={step.fromMinute} className={i === job.progress && active ? 'is-current' : ''}>
            {!offered && i < job.progress && <CheckCircle2 size={20} aria-label="Complete" />}
            <div><strong>{stepRange(job,step,zone)}</strong><span>{step.label}</span></div>
            {i === job.progress && active && <button type="button" className="primary" disabled={busy} onClick={() => void action('advance', undefined, i)}>{i === plan.steps.length-1 ? 'Submit for review' : 'Mark step complete'}</button>}
          </li>)}
        </ol>
        <p><strong>Your role</strong> · {plan.role}</p>
        <details><summary>Access and completion notes</summary><p>{plan.access}</p></details>
      </section>

      <div className="worker-stack">
        <section className="worker-panel">
          <h2><Package size={23} aria-hidden="true" /> Equipment & sourcing</h2>
          <dl className="worker-definition">
            <div><dt>You bring</dt><dd>{plan.workerKit.length ? plan.workerKit.join(', ') : 'All required equipment is provided or arranged.'}
              {offered && plan.workerKit.length > 0 && <label className="worker-check"><input type="checkbox" checked={confirmKit} onChange={event=>setConfirmKit(event.target.checked)} /> I can bring these</label>}
            </dd></div>
            <div><dt>Customer provides</dt><dd>{plan.customerKit.join(', ') || 'None listed'}</dd></div>
            <div><dt>Doneeo arranges</dt><dd>{plan.sourced.map(supply => <details key={supply.item + supply.source}>
              <summary>{supply.item}</summary><p>{supply.source}. {supply.instructions}</p>
            </details>)}</dd></div>
          </dl>
          {offered && <button className="worker-link" type="button" onClick={()=>setNoteType('missing')}>Flag a missing item</button>}
          {job.equipmentHold && <div className="worker-note is-warning"><TriangleAlert size={18} aria-hidden="true" /><span>Equipment update needed before acceptance.</span>{plan.demo && <button type="button" className="worker-link" disabled={busy} onClick={()=>void action('resolve_sample_equipment')}>Try a sample rental update</button>}</div>}
        </section>
        <section className="worker-panel">
          <h2>Pay breakdown</h2>
          <dl className="worker-definition">
            <div><dt>On-site work</dt><dd>{money(plan.workPay)}</dd></div>
            <div><dt>Pickup and return</dt><dd>{money(plan.equipmentPay)}</dd></div>
            <div className="worker-pay-total"><dt>Total {proposed ? 'proposed' : 'agreed'} pay</dt><dd>{pay}</dd></div>
          </dl>
          <details><summary>Payment terms</summary><p>{plan.paymentTerms}</p></details>
        </section>
      </div>
    </div>

    <section className="worker-panel worker-followup">
      <div className="worker-heading-line"><h2>Job updates</h2>
        <button className="worker-link" type="button" onClick={()=>setNoteType('question')}><MessageSquare size={18} aria-hidden="true" /> Ask Doneeo a question</button>
        {!offered && job.status !== 'DECLINED' && <button className="worker-link" type="button" onClick={()=>setNoteType('issue')}>Report an issue</button>}
      </div>
      {details.notes.length === 0 && !noteType && <p className="worker-muted">Questions and updates stay with this work order.</p>}
      {details.notes.map(entry=><p className="worker-update" key={entry.id}><strong>{noteLabels[entry.kind] ?? 'Update'}</strong><span>{entry.message}</span></p>)}
      {noteType && <form className="worker-fields" onSubmit={sendNote}>
        <label>{noteLabels[noteType]}<textarea value={note} maxLength={800} required rows={2} onChange={event=>setNote(event.target.value)} /></label>
        <div className="worker-actions"><button className="worker-link" type="button" onClick={()=>{setNoteType(null);setNote('');}}>Cancel</button><button className="outlined" type="submit" disabled={busy || !note.trim()}>Send to Doneeo</button></div>
      </form>}
    </section>

    {error && <p className="worker-error" role="alert">{error}</p>}
    {offered && <div className="worker-actions worker-job-actions">
      <p>Accepting reserves {window} on {date}.</p>
      <button className="outlined" type="button" disabled={busy} onClick={()=>void action('decline')}>Decline offer</button>
      <button className="primary" type="button" disabled={busy || job.equipmentHold || (plan.workerKit.length > 0 && !confirmKit)} onClick={()=>void action('accept')}>Accept job <ArrowRight size={18} aria-hidden="true" /></button>
    </div>}
    {job.status === 'REVIEW' && plan.demo && <div className="worker-actions"><p>Completion submitted for this sample job.</p><button className="primary" type="button" disabled={busy} onClick={()=>void action('complete_sample')}>Confirm sample completion</button></div>}
  </article>;
}
