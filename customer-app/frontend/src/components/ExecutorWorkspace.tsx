import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, Bell, BriefcaseBusiness, CalendarDays, CheckCircle2, Eye, LockKeyhole, Package, ShieldCheck, UserRound } from 'lucide-react';
import { api, type Customer } from '../lib/api';
import { clock, dateKey, dateLabel, days, documentLabels, hourLabel, jobsUrl, money, profileUrl, roles, toDraft, workspaceUrl,
  type Document, type Draft, type Job, type Notification, type Pending, type Workspace } from '../lib/executor';
import ExecutorJob from './ExecutorJob';
import { CalendarFields, DocumentRows, KitFields } from './ExecutorOnboarding';

const navigation = [
  { title:'Jobs', icon:BriefcaseBusiness }, { title:'Calendar', icon:CalendarDays },
  { title:'Equipment & transport', icon:Package }, { title:'Profile & verification', icon:UserRound },
] as const;
type View = typeof navigation[number]['title'] | 'Notifications' | 'Document review';
const tabs = ['New offers','Upcoming','In progress','Completed'] as const;
type Tab = typeof tabs[number];

export default function ExecutorWorkspace({ account, workspace, onUpdate, onEdit, onSignOut, signingOut, error }: {
  account: Customer; workspace: Workspace; onUpdate: (value: Workspace) => void; onEdit: () => void;
  onSignOut: () => void; signingOut: boolean; error: string;
}) {
  const [view,setView] = useState<View>('Jobs');
  const [tab,setTab] = useState<Tab>('New offers');
  const [selected,setSelected] = useState<string>();
  const [accepted,setAccepted] = useState<Job>();
  const [busy,setBusy] = useState(false);
  const [problem,setProblem] = useState('');
  const { jobs, notifications, documents } = workspace;
  const profile = toDraft(workspace.profile);
  const unread = notifications.filter(item=>!item.seen).length;
  const photo = documents.find(item=>item.kind==='photo' && item.hasFile);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!document.hidden) void api<Workspace>(workspaceUrl).then(onUpdate).catch(()=>{});
    }, 25000);
    return () => window.clearInterval(timer);
  }, [onUpdate]);

  async function refresh() { onUpdate(await api<Workspace>(workspaceUrl)); }
  function go(target: View) { setView(target); setSelected(undefined); setProblem(''); }
  function openJob(id: string) { setView('Jobs'); setSelected(id); setProblem(''); }

  async function getSample() {
    setBusy(true);
    setProblem('');
    try {
      await api<Job>(`${jobsUrl}/sample`, { accountId:account.id });
      await refresh();
      setTab('New offers');
    } catch (caught) { setProblem(caught instanceof Error ? caught.message : 'Couldn’t request a sample offer.'); }
    finally { setBusy(false); }
  }

  async function openNotification(item: Notification) {
    try {
      onUpdate(await api<Workspace>(`/api/executor/notifications/${item.id}/seen`, {accountId:account.id}));
      if (item.jobId) openJob(item.jobId);
      else go('Profile & verification');
    } catch (caught) { setProblem(caught instanceof Error ? caught.message : 'Couldn’t open the notification.'); }
  }

  const selectedJobs = jobs.filter(job => {
    if (tab === 'New offers') return job.status==='OFFERED';
    if (tab === 'Upcoming') return job.status==='UPCOMING';
    if (tab === 'In progress') return job.status==='IN_PROGRESS' || job.status==='REVIEW';
    return job.status==='COMPLETED';
  }).sort((a,b)=>tab==='Completed' ? b.start-a.start : a.start-b.start);

  return <div className="executor-page worker-workspace">
    <a href="#worker-main" className="skip">Skip to content</a>
    <aside className="worker-sidebar">
      <a href="/executors" className="worker-logo"><img src="/images/doneeo-logo.png" width="178" height="51" alt="Doneeo" /></a>
      <nav aria-label="Worker workspace">
        {navigation.map(item=><button key={item.title} type="button" aria-current={view===item.title ? 'page' : undefined} onClick={()=>go(item.title)}>
          <item.icon size={22} aria-hidden="true" /><span>{item.title}</span>
        </button>)}
        {workspace.canReview && <button type="button" aria-current={view==='Document review' ? 'page' : undefined} onClick={()=>go('Document review')}><ShieldCheck size={21} aria-hidden="true" /> <span>Document review</span></button>}
      </nav>
      <a className="worker-sidebar-support" href="/#trust">Support</a>
    </aside>
    <div className="worker-workspace-body">
      <header className="worker-topbar">
        <a href="/executors" className="worker-mobile-logo"><img src="/images/doneeo-logo.png" width="121" height="35" alt="Doneeo" /></a>
        <button className="worker-icon worker-notification-button" type="button" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} onClick={()=>go('Notifications')}><Bell size={23} aria-hidden="true" />{unread > 0 && <span>{unread}</span>}</button>
        <button className="worker-icon worker-account" type="button" aria-label="My worker profile" onClick={()=>go('Profile & verification')}>{photo ? <img src={`/api/executor/assets/photo?v=${photo.revision}`} alt="" /> : <UserRound size={23} aria-hidden="true" />}</button>
        <button type="button" className="worker-link" disabled={signingOut} onClick={onSignOut}>{signingOut ? 'Signing out…' : 'Sign out'}</button>
      </header>
      <main className="worker-main" id="worker-main">
        {(problem || error) && <p className="worker-error" role="alert">{problem || error}</p>}

        {view === 'Jobs' && (selected ? <ExecutorJob id={selected} key={selected} accountId={account.id} zone={profile.timeZone} onBack={()=>setSelected(undefined)} onChange={refresh} onAccept={job=>{
          setAccepted(job);
          setTab('Upcoming');
          go('Calendar');
        }} /> : <>
          <div className="worker-heading-line"><h1>Jobs</h1>{workspace.demo && <button className="outlined" type="button" disabled={busy} onClick={()=>void getSample()}>{busy ? 'Requesting…' : 'Receive a sample offer'}</button>}</div>
          {workspace.demo && <p className="worker-note">Test the full work order flow with a sample offer. Sample jobs stay in this workspace.</p>}
          {!workspace.matchingReady && <p className="worker-note">Finish verification and set your availability to receive eligible job offers. <button className="worker-link" type="button" onClick={()=>go('Profile & verification')}>View status</button></p>}
          <div className="worker-tabs" aria-label="Job status">
            {tabs.map(label=><button key={label} type="button" aria-pressed={tab===label} onClick={()=>setTab(label)}>{label}{label==='New offers' && jobs.some(job=>job.status==='OFFERED') && <span className="worker-pill">{jobs.filter(job=>job.status==='OFFERED').length}</span>}</button>)}
          </div>
          {selectedJobs.length === 0 ? <div className="worker-panel worker-empty"><h2>{tab==='New offers' ? 'No new offers yet' : `No ${tab.toLowerCase()} jobs`}</h2><p>{tab==='New offers' ? 'A matching job will appear here and in Notifications.' : 'Jobs appear here as they move through your work plan.'}</p></div> :
            <div className="worker-stack">{selectedJobs.map(job=><button className="worker-job-row" type="button" key={job.id} onClick={()=>openJob(job.id)}>
              <BriefcaseBusiness size={23} aria-hidden="true" /><span><strong>{job.plan.title}</strong><span>{job.plan.location} · {dateLabel(job.start,profile.timeZone)}</span></span>
              <span><strong>{money(job.plan.workPay+job.plan.equipmentPay)}</strong><span>{clock(job.start,profile.timeZone)} – {clock(job.end,profile.timeZone)}</span></span><ArrowRight size={20} aria-hidden="true" />
            </button>)}</div>}
        </>)}

        {view === 'Calendar' && <WorkerCalendar accountId={account.id} profile={profile} jobs={jobs} accepted={accepted} openJob={openJob} refresh={refresh} />}
        {view === 'Equipment & transport' && <WorkerKit accountId={account.id} profile={profile} refresh={refresh} />}
        {view === 'Profile & verification' && <WorkerProfile account={account} workspace={workspace} profile={profile} photo={photo} edit={onEdit} onDocuments={value=>onUpdate({...workspace,documents:value})} />}
        {view === 'Notifications' && <><h1>Notifications</h1>{notifications.length===0 ? <p className="worker-note">New job offers, work-order changes and verification updates will appear here.</p> :
          <div className="worker-stack">{notifications.map(item=><button className={`worker-job-row ${item.seen ? '' : 'is-unread'}`} key={item.id} type="button" onClick={()=>void openNotification(item)}>
            <Bell size={23} aria-hidden="true" /><span><strong>{item.title}</strong><span>{item.message}</span></span><span>{dateLabel(item.createdAt,profile.timeZone)}</span><ArrowRight size={19} aria-hidden="true" />
          </button>)}</div>}</>}
        {view === 'Document review' && workspace.canReview && <WorkerReviews />}
      </main>
    </div>
  </div>;
}

function WorkerKit({ accountId, profile, refresh }: { accountId:string; profile:Draft; refresh:()=>Promise<void> }) {
  const [draft,setDraft] = useState(profile);
  const [message,setMessage] = useState('');
  const [busy,setBusy] = useState(false);
  async function save(event:FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try { await api(profileUrl,{accountId,profile:draft}); await refresh(); setMessage('Equipment and vehicle saved.'); }
    catch (caught) { setMessage(caught instanceof Error ? caught.message : 'Couldn’t save your equipment.'); }
    finally { setBusy(false); }
  }
  return <><h1>Equipment & transport</h1><p>Tell Doneeo what you can bring to a job.</p>
    <form className="worker-panel worker-fields" onSubmit={event=>void save(event)}>
      <KitFields setup={draft.setup} onChange={change=>setDraft(current=>({...current,setup:{...current.setup,...change}}))} />
      <p className="worker-note">Driver’s licence uploads are managed in Profile & verification.</p>
      {message && <p role="status">{message}</p>}<button className="primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save equipment and vehicle'}</button>
    </form></>;
}

function WorkerCalendar({ accountId, profile, jobs, accepted, openJob, refresh }: {
  accountId:string; profile:Draft; jobs:Job[]; accepted?:Job; openJob:(id:string)=>void; refresh:()=>Promise<void>;
}) {
  const [date,setDate] = useState(accepted ? dateKey(accepted.start,profile.timeZone) : dateKey(Date.now(),profile.timeZone));
  const [draft,setDraft] = useState(profile);
  const [showHours,setShowHours] = useState(false);
  const [message,setMessage] = useState('');
  const [busy,setBusy] = useState(false);
  const booked = jobs.filter(job=>!['OFFERED','DECLINED'].includes(job.status) && dateKey(job.start,profile.timeZone)===date).sort((a,b)=>a.start-b.start);
  const summaryJob = booked.find(job=>job.id===accepted?.id) ?? booked[0];
  const dayIndex = (new Date(`${date}T12:00:00Z`).getUTCDay()+6)%7;
  const available = profile.setup.blockedDates.includes(date) ? undefined : profile.availability.find(hours=>hours.day===days[dayIndex]);
  const displayDate = new Intl.DateTimeFormat('en-CA',{timeZone:'UTC',weekday:'long',month:'short',day:'numeric'}).format(new Date(`${date}T12:00:00Z`));
  const localTimes = new Intl.DateTimeFormat('en-GB',{timeZone:profile.timeZone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  const agenda: ({ job:Job } | { from:string; to:string })[] = [];
  let freeFrom = available?.start;
  for (const job of booked) {
    const start = localTimes.format(job.start), end = localTimes.format(job.end);
    if (freeFrom && available && freeFrom < start && freeFrom < available.end) {
      agenda.push({from:freeFrom,to:start < available.end ? start : available.end});
    }
    agenda.push({job});
    if(freeFrom && end > freeFrom) freeFrom = end;
  }
  if(freeFrom && available && freeFrom < available.end) agenda.push({from:freeFrom,to:available.end});
  async function save(event:FormEvent) {
    event.preventDefault();
    if (draft.availability.some(hours=>hours.start>=hours.end)) { setMessage('Set an end time after the start time.'); return; }
    setBusy(true);
    setMessage('');
    try { await api(profileUrl,{accountId,profile:draft}); await refresh(); setShowHours(false); setMessage('Availability saved.'); }
    catch (caught) { setMessage(caught instanceof Error ? caught.message : 'Couldn’t save your availability.'); }
    finally { setBusy(false); }
  }
  return <><div className="worker-heading-line"><h1>Calendar</h1><button className="outlined" type="button" onClick={()=>{setDraft(profile);setShowHours(!showHours);setMessage('');}}>{showHours?'Close availability':'Edit availability'}</button></div>
    {accepted && <p className="worker-note"><CheckCircle2 size={20} aria-hidden="true" /> Job accepted. Your full job window is reserved.</p>}
    {message && <p role="status">{message}</p>}
    {showHours && <form className="worker-panel worker-fields" onSubmit={event=>void save(event)}><CalendarFields profile={draft} onChange={value=>setDraft(current=>({...current,...value}))} />
      <button className="primary" type="submit" disabled={busy}>{busy?'Saving…':'Save availability'}</button></form>}
    <div className={summaryJob ? 'worker-grid worker-calendar-grid' : undefined}>
    <section className="worker-panel worker-fields worker-calendar">
      <div className="worker-heading-line"><h2>{displayDate}</h2><label>Calendar date<input aria-label="Calendar date" type="date" value={date} onChange={event=>{if(event.target.value)setDate(event.target.value);}} /></label></div>
      {!available && <p className="worker-muted">No availability set for this date.</p>}
      {agenda.map(entry=>{
        if(!('job' in entry))return <div className="worker-free-time" key={entry.from}><strong>{hourLabel(entry.from)} – {hourLabel(entry.to)}</strong><span>Available</span></div>;
        const {job}=entry;
        return <div key={job.id} className="worker-calendar-booking">
        <div className="worker-heading-line"><div><strong>{clock(job.start,profile.timeZone)} – {clock(job.end,profile.timeZone)}</strong><h3>{job.plan.title}</h3></div>{job.id!==summaryJob?.id && <button className="worker-link" type="button" onClick={()=>openJob(job.id)}>View work order</button>}</div>
        <p><LockKeyhole size={17} aria-hidden="true" /> {job.status==='COMPLETED' ? 'Completed work order' : 'Booked · Unavailable for other jobs'}</p>
        <ol className="worker-booking-steps">{job.plan.steps.map(step=><li key={step.fromMinute}>{clock(job.start+step.fromMinute*60000,profile.timeZone)} · {step.label}</li>)}</ol>
        </div>;
      })}
    </section>
    {summaryJob && <aside className="worker-panel worker-fields"><h2>Confirmed work order</h2><h3>{summaryJob.plan.title}</h3><p>{summaryJob.plan.location}</p><p><strong>{money(summaryJob.plan.workPay+summaryJob.plan.equipmentPay)}</strong> agreed pay</p>
      <button className="primary" type="button" onClick={()=>openJob(summaryJob.id)}>Open work order <ArrowRight size={18} aria-hidden="true" /></button>
    </aside>}
    </div></>;
}

function WorkerProfile({ account, workspace, profile, photo, edit, onDocuments }: {
  account:Customer; workspace:Workspace; profile:Draft; photo?:Document; edit:()=>void; onDocuments:(value:Document[])=>void;
}) {
  const [preview,setPreview] = useState(false);
  const role = roles.find(item=>item.value===profile.role);
  const completed = workspace.jobs.filter(job=>job.status==='COMPLETED').length;
  const documents: Document['kind'][] = ['photo','identity',...(profile.role==='professional' ? ['trade' as const]:[]),...(profile.setup.driverLicensed ? ['driver' as const]:[])];
  const identity = workspace.documents.find(document=>document.kind==='identity')?.status==='VERIFIED';
  const trade = workspace.documents.find(document=>document.kind==='trade')?.status==='VERIFIED';
  return <><div className="worker-heading-line"><h1>{preview?'Customer profile preview':'Profile & verification'}</h1><button className="outlined" type="button" onClick={()=>setPreview(!preview)}><Eye size={18} aria-hidden="true" /> {preview?'Back to private profile':'Preview customer view'}</button></div>
    <div className="worker-panel worker-profile-hero">
      {photo ? <img src={`/api/executor/assets/photo?v=${photo.revision}`} alt="Your profile photo" /> : <UserRound size={46} aria-hidden="true" />}
      <div><h2>{preview ? account.name.trim().split(/\s+/)[0] : account.name}</h2><span className="worker-pill">{role?.brand}</span><p>{profile.serviceArea}{preview?'':` · ${profile.setup.radiusKm} km radius`}</p></div>
      <dl className="worker-profile-stats"><div><dt>{workspace.demo?'Sample jobs completed':'Completed jobs'}</dt><dd>{completed}</dd></div><div><dt>Rating</dt><dd>No reviews yet</dd></div></dl>
    </div>
    <div className="worker-grid">
      <div className="worker-panel worker-fields"><h2>Work profile</h2>{profile.setup.about && <p>{profile.setup.about}</p>}
        <ul className="worker-tags">{profile.setup.workTypes.map(item=><li key={item.label}>{item.label}</li>)}</ul>
        {preview ? <p>{identity ? 'Identity verified' : 'Identity verification pending'}{profile.role==='professional' && trade ? ' · Trade licence verified' : ''}</p> : <button className="outlined" type="button" onClick={edit}>Edit profile</button>}
      </div>
      {!preview && <div className="worker-panel worker-fields"><h2>Verification</h2><p><LockKeyhole size={16} aria-hidden="true" /> Your documents are private.</p>
        {workspace.demo && <p className="worker-note">Use sample documents or test files in this preview.</p>}
        <DocumentRows documents={workspace.documents} kinds={documents} accountId={account.id} demo={workspace.demo} onChange={onDocuments} />
      </div>}
    </div>
  </>;
}

function WorkerReviews() {
  const [pending,setPending] = useState<Pending[]>([]);
  const [reason,setReason] = useState('');
  const [selected,setSelected] = useState<string>();
  const [message,setMessage] = useState('');
  const [busy,setBusy] = useState(false);
  useEffect(()=>{let active=true;void api<Pending[]>('/api/executor/reviews').then(value=>{if(active)setPending(value);}).catch(error=>{if(active)setMessage(error.message);});return()=>{active=false;};},[]);
  async function review(item: Pending, status: 'VERIFIED'|'NEEDS_UPDATE') {
    setBusy(true);
    setMessage('');
    try {
      await api(`/api/executor/reviews/${item.accountId}/${item.document.kind}`,{revision:item.document.revision,status,note:status==='NEEDS_UPDATE'?reason:''});
      setPending(await api<Pending[]>('/api/executor/reviews'));
      setSelected(undefined);
      setReason('');
      setMessage('Review saved.');
    } catch (caught) { setMessage(caught instanceof Error ? caught.message : 'Couldn’t save the review.'); }
    finally { setBusy(false); }
  }
  return <><h1>Document review</h1>{message && <p role="status">{message}</p>}{pending.length===0 && <p>No documents awaiting review.</p>}
    {pending.map(item=><div className="worker-panel worker-fields" key={item.document.revision}><h2>{documentLabels[item.document.kind]}</h2><p>{item.name}</p>
      <a className="worker-link" href={`/api/executor/reviews/${item.accountId}/${item.document.kind}`}>Download for review</a>
      <div className="worker-actions"><button className="outlined" type="button" disabled={busy} onClick={()=>{setSelected(item.document.revision);setReason('');}}>Request update</button><button className="primary" type="button" disabled={busy} onClick={()=>void review(item,'VERIFIED')}>Mark verified</button></div>
      {selected===item.document.revision && <form className="worker-fields" onSubmit={event=>{event.preventDefault();void review(item,'NEEDS_UPDATE');}}><label>What needs updating?<textarea required maxLength={400} value={reason} onChange={event=>setReason(event.target.value)} /></label><button type="submit" className="primary" disabled={busy||!reason.trim()}>Send update request</button></form>}
    </div>)}
  </>;
}
