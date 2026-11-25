import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, HardHat, LockKeyhole, Plus, Trash2, Upload, UserRound } from 'lucide-react';
import { api } from '../lib/api';
import { days, documentLabels, profileUrl, roles, timeZones, toDraft, uploadDocument, workTypes,
  type Document, type Draft, type Hours, type Kind, type Profile, type Setup, type Workspace } from '../lib/executor';

export function DocumentRows({ documents, kinds, accountId, demo, onChange }: {
  documents: Document[]; kinds: Kind[]; accountId: string; demo: boolean; onChange: (documents: Document[]) => void;
}) {
  const [busy, setBusy] = useState<Kind | null>(null);
  const [error, setError] = useState('');
  const statusText = { READY:'Added', IN_REVIEW:'In review', VERIFIED:'Verified', NEEDS_UPDATE:'Needs update' };
  async function upload(kind: Kind, file?: File) {
    setBusy(kind);
    setError('');
    try { onChange(await uploadDocument(accountId, kind, file)); }
    catch (problem) { setError(problem instanceof Error ? problem.message : 'The upload could not be saved.'); }
    finally { setBusy(null); }
  }
  return <div className="worker-docs">
    {kinds.map(kind => {
      const document = documents.find(item => item.kind === kind);
      const label = documentLabels[kind];
      return <div className="worker-document" key={kind}>
        <div><strong>{label}</strong><span className={`worker-pill ${document?.status === 'NEEDS_UPDATE' ? 'is-warning' : ''}`}>{document ? statusText[document.status] : kind === 'photo' ? 'Optional' : 'Required'}</span></div>
        {document?.note && <p>{document.note}</p>}
        <div className="worker-doc-actions">
          <label className="outlined worker-upload"><Upload size={17} aria-hidden="true" />{busy === kind ? 'Uploading…' : document ? `Replace ${label.toLowerCase()}` : `Upload ${label.toLowerCase()}`}
            <input type="file" accept={kind === 'photo' ? 'image/jpeg,image/png' : 'image/jpeg,image/png,application/pdf'} disabled={busy !== null}
              onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) void upload(kind, file); }} />
          </label>
          {demo && kind !== 'photo' && !document && <button className="worker-link" type="button" disabled={busy !== null} onClick={() => void upload(kind)}>Use sample {label.toLowerCase()}</button>}
          {document?.hasFile && kind !== 'photo' && <a className="worker-link" href={`/api/executor/assets/${kind}`}>Download my file</a>}
        </div>
      </div>;
    })}
    {error && <p role="alert" className="worker-error">{error}</p>}
  </div>;
}

export function KitFields({ setup, onChange }: { setup: Setup; onChange: (change: Partial<Setup>) => void }) {
  const [item, setItem] = useState('');
  function addItem() {
    const value = item.trim();
    if (value && !setup.kit.some(known => known.toLowerCase() === value.toLowerCase()) && setup.kit.length < 30) {
      onChange({ kit: [...setup.kit, value] });
      setItem('');
    }
  }
  return <div className="worker-fields">
    <h2>My equipment kit</h2>
    {setup.kit.length === 0 && <p className="worker-muted">Add the items you can bring to a job.</p>}
    {setup.kit.map(value => <div className="worker-kit-item" key={value}>
      <CheckCircle2 size={19} aria-hidden="true" /><span>{value}</span>
      <button className="worker-icon" type="button" aria-label={`Remove ${value}`} onClick={() => onChange({ kit: setup.kit.filter(known => known !== value) })}><Trash2 size={17} aria-hidden="true" /></button>
    </div>)}
    <div className="worker-inline-field">
      <label>Equipment name<input value={item} onChange={event => setItem(event.target.value)} maxLength={70} placeholder="e.g. Cordless drill and bits"
        onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addItem(); } }} /></label>
      <button className="outlined" type="button" disabled={!item.trim() || setup.kit.length >= 30} onClick={addItem}><Plus size={18} aria-hidden="true" /> Add equipment</button>
    </div>
    <p className="worker-note">Doneeo can arrange rentals for individual jobs.</p>
    <h2>Vehicle</h2>
    <label>Vehicle type <small>Optional</small><select value={setup.vehicle?.type ?? ''} onChange={event => onChange({ vehicle: event.target.value ? { type: event.target.value, cargo: setup.vehicle?.cargo ?? '' } : null })}>
      <option value="">No vehicle listed</option>
      {['Car','SUV','Pickup','Cargo van','Truck','Other'].map(type => <option key={type}>{type}</option>)}
    </select></label>
    {setup.vehicle && <label>Cargo space <small>Optional</small><input value={setup.vehicle.cargo} maxLength={150} placeholder="Tools and small loads" onChange={event => onChange({ vehicle: { type: setup.vehicle!.type, cargo: event.target.value } })} /></label>}
  </div>;
}

export function CalendarFields({ profile, onChange }: { profile: Draft; onChange: (change: Partial<Draft>) => void }) {
  const [blocked, setBlocked] = useState('');
  function updateHours(day: Hours['day'], hours: Hours | null) {
    const others = profile.availability.filter(item => item.day !== day);
    onChange({ availability: hours ? [...others, hours] : others });
  }
  function blockDate() {
    if (blocked && !profile.setup.blockedDates.includes(blocked) && profile.setup.blockedDates.length < 100) {
      onChange({ setup: { ...profile.setup, blockedDates: [...profile.setup.blockedDates, blocked].sort() } });
      setBlocked('');
    }
  }
  return <div className="worker-fields">
    <h2>Weekly availability</h2>
    <p className="worker-muted">Doneeo matches you only when your calendar shows the entire job window is free.</p>
    <label>Time zone<select value={profile.timeZone} onChange={event => onChange({ timeZone: event.target.value })}>
      {!timeZones.includes(profile.timeZone) && <option value={profile.timeZone}>{profile.timeZone}</option>}
      {timeZones.map(zone => <option key={zone} value={zone}>{zone.replaceAll('_', ' ')}</option>)}
    </select></label>
    <div className="worker-week">
      {days.map(day => {
        const hours = profile.availability.find(item => item.day === day);
        const label = day[0]+day.slice(1).toLowerCase();
        return <div className="worker-day" key={day}>
          <label className="worker-check"><input type="checkbox" checked={Boolean(hours)} onChange={event => updateHours(day, event.target.checked ? { day, start:'09:00', end:'17:00' } : null)} /> {label}</label>
          {hours && <div className="worker-time-pair">
            <label>Start<span className="sr-only"> time for {label}</span><input type="time" required value={hours.start} onChange={event => updateHours(day,{...hours,start:event.target.value})} /></label>
            <label>End<span className="sr-only"> time for {label}</span><input type="time" required value={hours.end} onChange={event => updateHours(day,{...hours,end:event.target.value})} /></label>
          </div>}
        </div>;
      })}
    </div>
    <div className="worker-inline-field">
      <label>Block a date<input type="date" value={blocked} onChange={event => setBlocked(event.target.value)} /></label>
      <button className="outlined" type="button" disabled={!blocked} onClick={blockDate}><CalendarDays size={17} aria-hidden="true" /> Block date</button>
    </div>
    {profile.setup.blockedDates.map(date => <div className="worker-kit-item" key={date}><span>{date}</span><button className="worker-icon" type="button" aria-label={`Unblock ${date}`} onClick={() => onChange({setup:{...profile.setup,blockedDates:profile.setup.blockedDates.filter(s=>s!==date)}})}><Trash2 size={17} aria-hidden="true" /></button></div>)}
  </div>;
}

const steps = ['role','location','skills','kit','verification'] as const;
const headings = ['Choose your role','Work location','Types of work','Equipment & availability','Verification'];

export default function ExecutorOnboarding({ accountId, initial, workspace, onDocuments, onFinish, onPause, editing }: {
  accountId: string; initial: Profile | null; workspace: Workspace; onDocuments: (value: Document[]) => void;
  onFinish: (profile: Profile) => void; onPause: () => void; editing: boolean;
}) {
  const [profile, setProfile] = useState(() => toDraft(initial));
  const [index, setIndex] = useState(initial?.role && !editing ? initial.setup?.address.street ? 2 : 1 : 0);
  const [extraSkill, setExtraSkill] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const step = steps[index];
  const { setup } = profile;
  const skillOptions = [...new Set([...workTypes,...setup.workTypes.map(skill=>skill.label)])];
  const documentKinds: Kind[] = ['identity', ...(profile.role === 'professional' ? ['trade' as const] : []), ...(setup.driverLicensed === true ? ['driver' as const] : [])];
  const uploadsReady = setup.driverLicensed !== null && documentKinds.every(kind => workspace.documents.some(document => document.kind === kind));

  useEffect(() => { heading.current?.focus(); }, [index]);

  function change(value: Partial<Draft>) { setProfile(current => ({ ...current, ...value })); }
  function updateSetup(value: Partial<Setup>) { setProfile(current => ({ ...current, setup: { ...current.setup, ...value } })); }
  function go(next: number) { setError(''); setIndex(next); }

  async function save(draft: boolean) {
    setBusy(true);
    setError('');
    try {
      const saved = await api<Profile>(draft ? `${profileUrl}/draft` : profileUrl, { accountId, profile });
      if (draft) onPause(); else onFinish(saved);
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'Your profile could not be saved.'); }
    finally { setBusy(false); }
  }

  function addSkill() {
    const value = extraSkill.trim();
    if (value && setup.workTypes.length < 24 && !setup.workTypes.some(skill => skill.label.toLowerCase() === value.toLowerCase())) {
      updateSetup({ workTypes:[...setup.workTypes,{ label:value, level:'assist' }] });
      setExtraSkill('');
    }
  }

  function next(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (step === 'skills' && setup.workTypes.length === 0) { setError('Choose at least one skill or add your own.'); return; }
    if (step === 'kit' && profile.availability.some(hours => hours.start >= hours.end)) { setError('Set an end time after the start time for each available day.'); return; }
    if (step === 'verification') { if (uploadsReady) void save(false); return; }
    go(index + 1);
  }

  return <section className="worker-onboarding">
    <div className="worker-step-header">
      <nav aria-label="Profile setup" className="worker-steps">
        {headings.map((label, i) => <button key={label} type="button" disabled={i > index || busy} aria-current={i === index ? 'step' : undefined} onClick={() => go(i)}>{label}</button>)}
      </nav>
      <button type="button" className="worker-link" disabled={busy} onClick={() => void save(true)}>Save and finish later</button>
    </div>
    <h1 ref={heading} tabIndex={-1}>{headings[index]}</h1>
    <form className="worker-fields" onSubmit={next}>
      {step === 'role' && <div className="worker-panel worker-fields">
        <p>How would you like to work with Doneeo?</p>
        {roles.map(option => <label className="worker-role-option" key={option.value}>
          <input type="radio" name="worker-role" required checked={profile.role === option.value} onChange={() => change({ role:option.value })} />
          {option.value === 'helper' ? <UserRound aria-hidden="true" /> : <HardHat aria-hidden="true" />}
          <span><strong>{option.label}</strong><span>{option.description}</span></span>
        </label>)}
      </div>}

      {step === 'location' && <div className="worker-panel worker-fields">
        <p>Add the address you normally work from.</p>
        <div className="worker-address">
          {([
            ['street','Street address','address-line1',150], ['unit','Unit (optional)','address-line2',35],
            ['city','City','address-level2',80], ['region','Province or state','address-level1',80],
            ['postalCode','Postal code','postal-code',24], ['country','Country','country-name',80],
          ] as const).map(([field,label,autocomplete,maxLength]) => <label key={field}>{label}
            <input autoComplete={autocomplete} required={field !== 'unit'} maxLength={maxLength} value={setup.address[field]}
              onChange={event => updateSetup({ address:{...setup.address,[field]:event.target.value} })} />
          </label>)}
        </div>
        <label>Travel radius (km)<input type="number" min={1} max={150} required value={setup.radiusKm || ''} onChange={event => updateSetup({radiusKm:Number(event.target.value)})} /></label>
        <p className="worker-note"><LockKeyhole size={17} aria-hidden="true" /> Your exact address is private.</p>
      </div>}

      {step === 'skills' && <div className="worker-panel worker-fields">
        <p>Select the work you can do and set a level for each skill.</p>
        <div className="worker-skill-grid">
          {skillOptions.map(label => {
            const chosen = setup.workTypes.find(skill => skill.label === label);
            return <div className="worker-skill" key={label}>
              <label className="worker-check"><input type="checkbox" checked={Boolean(chosen)} disabled={!chosen && setup.workTypes.length >= 24}
                onChange={event => updateSetup({workTypes:event.target.checked ? [...setup.workTypes,{ label, level:'assist' }] : setup.workTypes.filter(skill=>skill.label!==label)})} /> {label}</label>
              {chosen && <label>Ability level <span className="sr-only">for {label}</span><select value={chosen.level} onChange={event => {
                const level = event.target.value === 'assist' ? 'assist' : 'independent';
                updateSetup({workTypes:setup.workTypes.map(skill=>skill.label===label ? {...skill,level} : skill)});
              }}><option value="assist">Can assist</option><option value="independent">Can do independently</option></select></label>}
            </div>;
          })}
        </div>
        <div className="worker-inline-field"><label>Another skill<input value={extraSkill} maxLength={70} onChange={event=>setExtraSkill(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();addSkill();}}} /></label>
          <button type="button" className="outlined" onClick={addSkill} disabled={!extraSkill.trim() || setup.workTypes.length >= 24}><Plus size={17} aria-hidden="true" /> Add skill</button></div>
        <label>About you <small>Optional</small><textarea rows={3} maxLength={600} value={setup.about} onChange={event=>updateSetup({about:event.target.value})} /></label>
      </div>}

      {step === 'kit' && <div className="worker-grid">
        <div className="worker-panel"><KitFields setup={setup} onChange={updateSetup} /></div>
        <div className="worker-panel"><CalendarFields profile={profile} onChange={change} /></div>
      </div>}

      {step === 'verification' && <div className="worker-panel worker-fields">
        <p className="worker-note"><LockKeyhole size={17} aria-hidden="true" /> Your documents are private.</p>
        {workspace.demo && <p className="worker-note">Use sample documents or test files in this preview.</p>}
        {profile.role === 'professional' && <div className="worker-address">
          <label>Licensed trade<input required maxLength={120} value={profile.qualifications?.trade ?? ''} onChange={event=>change({qualifications:{trade:event.target.value,region:profile.qualifications?.region ?? ''}})} /></label>
          <label>Licensing region<input required maxLength={120} value={profile.qualifications?.region ?? ''} onChange={event=>change({qualifications:{trade:profile.qualifications?.trade ?? '',region:event.target.value}})} /></label>
        </div>}
        <fieldset className="worker-driver"><legend>Do you have a driver’s licence?</legend>
          {[true,false].map(value=><label className="worker-check" key={String(value)}><input type="radio" name="driver-licence" required checked={setup.driverLicensed===value} onChange={()=>updateSetup({driverLicensed:value})} />{value ? 'Yes' : 'No'}</label>)}
        </fieldset>
        <DocumentRows documents={workspace.documents} kinds={documentKinds} accountId={accountId} demo={workspace.demo} onChange={onDocuments} />
      </div>}

      {error && <p className="worker-error" role="alert">{error}</p>}
      <div className="worker-actions">
        {index > 0 ? <button className="worker-link" type="button" disabled={busy} onClick={()=>go(index-1)}><ArrowLeft size={18} aria-hidden="true" /> Back</button> : editing ? <button className="worker-link" type="button" onClick={onPause}>Back to workspace</button> : <a className="worker-link" href="/executors">Work with Doneeo</a>}
        <button className="primary" type="submit" disabled={busy || (step === 'verification' && !uploadsReady)}>
          {busy ? 'Saving…' : step === 'verification' ? 'Submit for review' : step === 'kit' ? 'Continue to verification' : 'Continue'} <ArrowRight size={18} aria-hidden="true" />
        </button>
      </div>
    </form>
  </section>;
}
