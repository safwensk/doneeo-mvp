import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, HardHat, UserRound } from 'lucide-react';
import { api, ApiError, currentCustomer, signOut, type Customer } from '../lib/api';
import AuthPanel from './AuthPanel';
import '../executor-landing.css';
import '../executor-profile.css';

const profileUrl = '/api/executor/profile';
const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const;
type Day = typeof days[number];
type Role = 'helper' | 'professional';
type Hours = { day: Day; start: string; end: string };
type Profile = {
  role: Role;
  serviceArea: string;
  skills: string;
  equipment: string;
  timeZone: string;
  availability: Hours[];
  qualifications: { trade: string; region: string } | null;
};

const roles = [
  { value: 'helper', label: 'Local helper', brand: 'Doneeo Helper', icon: UserRound,
    description: 'For suitable work that doesn’t require a professional licence.' },
  { value: 'professional', label: 'Licensed professional', brand: 'Doneeo Pro', icon: HardHat,
    description: 'For work that uses your professional qualifications.' },
] as const;

const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const timeZones = [...new Set(['UTC', browserZone, ...(Intl.supportedValuesOf?.('timeZone') ?? [])])];
const timeZoneOptions = timeZones.map(zone => <option key={zone} value={zone}>{zone.replaceAll('_', ' ')}</option>);

type Session = { state: 'checking' | 'signed-out' | 'unavailable' } | { state: 'signed-in'; account: Customer };

export default function ExecutorProfilePage() {
  const [session, setSession] = useState<Session>({ state: 'checking' });
  const [retry, setRetry] = useState(0);
  const [signingOut, setSigningOut] = useState(false);
  const [sessionMessage, setSessionMessage] = useState('');

  useEffect(() => {
    document.title = 'Your Doneeo profile';
  }, []);

  useEffect(() => {
    let active = true;
    void currentCustomer().then(account => {
      if (active) setSession(account ? { state: 'signed-in', account } : { state: 'signed-out' });
    }).catch(() => {
      if (active) setSession({ state: 'unavailable' });
    });
    return () => { active = false; };
  }, [retry]);

  const requireSignIn = useCallback(() => {
    setSessionMessage('Please sign in again to continue with your profile.');
    setSession({ state: 'signed-out' });
  }, []);

  async function logout() {
    setSigningOut(true);
    setSessionMessage('');
    try {
      await signOut();
      setSession({ state: 'signed-out' });
    } catch {
      setSessionMessage('Doneeo couldn’t sign you out. Please try again.');
    } finally {
      setSigningOut(false);
    }
  }

  return <div className="executor-page executor-profile-page">
    <a className="skip" href="#executor-profile-main">Skip to content</a>
    <header className="executor-profile-header">
      <div className="executor-container">
        <a className="executor-brand" href="/executors">
          <img src="/images/doneeo-logo.png" alt="Doneeo" width="178" height="51" />
        </a>
        <a className="executor-profile-back" href="/executors"><ArrowLeft size={18} aria-hidden="true" /> Work with Doneeo</a>
        {session.state === 'signed-in' && <button className="executor-profile-link" type="button" disabled={signingOut} onClick={() => void logout()}>{signingOut ? 'Signing out…' : 'Sign out'}</button>}
      </div>
    </header>
    <main className="executor-profile-main" id="executor-profile-main">
      {sessionMessage && <p className="executor-profile-error" role="status">{sessionMessage}</p>}
      {session.state === 'checking' && <p role="status">Checking your Doneeo account…</p>}
      {session.state === 'unavailable' && <>
        <h1>Open your Doneeo profile</h1>
        <p role="alert">Doneeo couldn’t check your account. Please try again.</p>
        <button className="primary" type="button" onClick={() => {
          setSession({ state: 'checking' });
          setRetry(count => count + 1);
        }}>Try again</button>
      </>}
      {session.state === 'signed-out' && <AuthPanel request="" purpose="executor" onSuccess={account => {
        setSessionMessage('');
        setSession({ state: 'signed-in', account });
      }} />}
      {session.state === 'signed-in' && <ProfileWorkspace key={session.account.id} accountId={session.account.id} onSessionExpired={requireSignIn} />}
    </main>
    <footer className="executor-profile-footer">Test preview. Job matching and payments are not live.</footer>
  </div>;
}

function ProfileWorkspace({ accountId, onSessionExpired }: { accountId: string; onSessionExpired: () => void }) {
  const [profile, setProfile] = useState<Profile | null>();
  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    void api<Profile | null>(profileUrl).then(value => {
      if (active) setProfile(value);
    }).catch(error => {
      if (!active) return;
      if (error instanceof ApiError && error.status === 401) onSessionExpired();
      else setLoadError('Doneeo couldn’t load your profile. Please try again.');
    });
    return () => { active = false; };
  }, [onSessionExpired, retry]);

  if (loadError) return <>
    <h1>Open your Doneeo profile</h1>
    <p role="alert">{loadError}</p>
    <button className="primary" type="button" onClick={() => {
      setLoadError('');
      setRetry(count => count + 1);
    }}>Try again</button>
  </>;
  if (profile === undefined) return <p role="status">Loading your profile…</p>;
  return <ProfileEditor existing={profile} accountId={accountId} />;
}

function ProfileEditor({ existing, accountId }: { existing: Profile | null; accountId: string }) {
  const [step, setStep] = useState<'role' | 'details' | 'saved'>(existing ? 'saved' : 'role');
  const [role, setRole] = useState<Role | ''>(existing?.role ?? '');
  const [serviceArea, setServiceArea] = useState(existing?.serviceArea ?? '');
  const [skills, setSkills] = useState(existing?.skills ?? '');
  const [equipment, setEquipment] = useState(existing?.equipment ?? '');
  const [timeZone, setTimeZone] = useState(existing?.timeZone ?? browserZone);
  const [availability, setAvailability] = useState<Hours[]>(existing?.availability ?? []);
  const [trade, setTrade] = useState(existing?.qualifications?.trade ?? '');
  const [region, setRegion] = useState(existing?.qualifications?.region ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const selectedRole = roles.find(option => option.value === role);

  useEffect(() => { heading.current?.focus(); }, [step]);

  function toggleDay(day: Day, enabled: boolean) {
    setAvailability(current => enabled
      ? [...current, { day, start: '09:00', end: '17:00' }]
      : current.filter(hours => hours.day !== day));
  }

  function setHours(day: Day, field: 'start' | 'end', value: string) {
    setAvailability(current => current.map(hours => hours.day === day ? { ...hours, [field]: value } : hours));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!role || saving) return;
    setError('');
    if (availability.some(hours => hours.start >= hours.end)) {
      setError('Choose an end time after the start time on each available day.');
      return;
    }
    setSaving(true);
    try {
      const profile: Profile = {
        role, serviceArea, skills, equipment, timeZone, availability,
        qualifications: role === 'professional' ? { trade, region } : null,
      };
      const saved = await api<Profile>(profileUrl, { accountId, profile });
      setServiceArea(saved.serviceArea);
      setSkills(saved.skills);
      setEquipment(saved.equipment);
      setTrade(saved.qualifications?.trade ?? '');
      setRegion(saved.qualifications?.region ?? '');
      setStep('saved');
    } catch (caught) {
      setError(caught instanceof ApiError && caught.status === 401
        ? 'Your session ended. Reopen this page to sign in again.'
        : caught instanceof ApiError ? caught.message : 'Doneeo couldn’t save your profile. Your entries are here so you can retry.');
    } finally {
      setSaving(false);
    }
  }

  if (step === 'role') return <section className="executor-profile-card">
    <h1 ref={heading} tabIndex={-1}>Choose your role</h1>
    <p>How would you like to work with Doneeo?</p>
    <form className="executor-profile-form" onSubmit={event => {
      event.preventDefault();
      if (role) setStep('details');
    }}>
      <fieldset className="executor-profile-roles" aria-label="Doneeo role">
        {roles.map(option => <label key={option.value} className="executor-profile-option">
          <input type="radio" name="executor-role" value={option.value} checked={role === option.value} onChange={() => setRole(option.value)} required />
          <span className="executor-profile-icon"><option.icon size={28} aria-hidden="true" /></span>
          <span><strong>{option.label}</strong><span>{option.description}</span></span>
        </label>)}
      </fieldset>
      <button className="primary" type="submit" disabled={!role}>Continue to my profile <ArrowRight size={19} aria-hidden="true" /></button>
      <p className="executor-profile-hint">Next, add your skills, service area, availability and equipment.</p>
    </form>
  </section>;

  if (step === 'saved') return <section className="executor-profile-card">
    <CheckCircle2 className="executor-profile-success" size={36} aria-hidden="true" />
    <h1 ref={heading} tabIndex={-1}>Your Doneeo profile</h1>
    <p>Your profile is saved. You can update it as your skills or schedule change.</p>
    <dl className="executor-profile-summary">
      <div><dt>Role</dt><dd>{selectedRole?.brand}</dd></div>
      <div><dt>Service area</dt><dd>{serviceArea}</dd></div>
      <div><dt>Availability</dt><dd>{availability.length ? `${availability.length} ${availability.length === 1 ? 'day' : 'days'} each week` : 'No weekly hours set'}</dd></div>
    </dl>
    {role === 'professional' && <p className="executor-profile-hint">Your trade and licensing region are saved. Licence verification is a separate step.</p>}
    <button className="primary" type="button" onClick={() => setStep('details')}>Edit my profile <ArrowRight size={19} aria-hidden="true" /></button>
  </section>;

  return <section className="executor-profile-card">
    <div className="executor-profile-role-line">
      <span>{selectedRole?.brand}</span>
      <button className="executor-profile-link" type="button" disabled={saving} onClick={() => { setError(''); setStep('role'); }}>Change role</button>
    </div>
    <h1 ref={heading} tabIndex={-1}>Set up your profile</h1>
    <p>Tell Doneeo what you can do, where you work and when you’re available.</p>
    <form className="executor-profile-form" onSubmit={event => void save(event)}>
      <fieldset className="executor-profile-fields" aria-label="Work details" disabled={saving}>
        <label>City or service area<input value={serviceArea} onChange={event => setServiceArea(event.target.value)} required maxLength={150} placeholder="e.g. Toronto and North York" /></label>
        <label>Skills and experience<textarea value={skills} onChange={event => setSkills(event.target.value)} required maxLength={600} rows={3} placeholder="Tell us what kinds of work you can help with" /></label>
        <label>Equipment you can bring <span className="executor-profile-hint">Optional</span><textarea value={equipment} onChange={event => setEquipment(event.target.value)} maxLength={600} rows={2} placeholder="List the equipment you own or can bring to a job" /></label>
      </fieldset>

      {role === 'professional' && <fieldset className="executor-profile-fields" disabled={saving}>
        <legend>Professional qualifications</legend>
        <label>Licensed trade<input value={trade} onChange={event => setTrade(event.target.value)} required maxLength={120} placeholder="e.g. Electrician" /></label>
        <label>Licensing region<input value={region} onChange={event => setRegion(event.target.value)} required maxLength={120} placeholder="e.g. Ontario" /></label>
      </fieldset>}

      <fieldset className="executor-profile-calendar" disabled={saving}>
        <legend>Weekly availability</legend>
        <p className="executor-profile-hint" id="executor-availability-help">Choose the days and hours you can work. Leave a day unchecked when you’re unavailable.</p>
        <label className="executor-profile-timezone">Time zone
          <select value={timeZone} onChange={event => setTimeZone(event.target.value)}>
            {existing && !timeZones.includes(existing.timeZone) && <option value={existing.timeZone}>{existing.timeZone}</option>}
            {timeZoneOptions}
          </select>
        </label>
        <div className="executor-profile-days" aria-describedby="executor-availability-help">
          {days.map(day => {
            const hours = availability.find(slot => slot.day === day);
            const label = day[0] + day.slice(1).toLowerCase();
            return <div className="executor-profile-day" key={day}>
              <label className="executor-profile-day-toggle"><input type="checkbox" checked={Boolean(hours)} onChange={event => toggleDay(day, event.target.checked)} />{label}</label>
              {hours && <div className="executor-profile-hours">
                <label>Start<span className="sr-only"> time for {label}</span><input type="time" required value={hours.start} onChange={event => setHours(day, 'start', event.target.value)} /></label>
                <label>End<span className="sr-only"> time for {label}</span><input type="time" required value={hours.end} onChange={event => setHours(day, 'end', event.target.value)} /></label>
              </div>}
            </div>;
          })}
        </div>
      </fieldset>

      {error && <p className="executor-profile-error" role="alert">{error}</p>}
      <button className="primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save my profile'} <ArrowRight size={19} aria-hidden="true" /></button>
    </form>
  </section>;
}

