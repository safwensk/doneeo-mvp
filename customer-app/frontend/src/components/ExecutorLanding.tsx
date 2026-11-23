import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ArrowRight, CalendarDays, CheckCircle2, ClipboardList, HardHat,
  Layers3, Menu, ReceiptText, Truck, UserRound, UsersRound, Wrench, X,
} from 'lucide-react';
import '../executor-landing.css';

type ProfileDraft = {
  name: string;
  email: string;
  city: string;
  role: '' | 'helper' | 'professional';
};

const draftKey = 'doneeo.executor-profile-draft.v1';
const emptyDraft: ProfileDraft = { name: '', email: '', city: '', role: '' };

function readDraft(): ProfileDraft {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(draftKey) || 'null');
    if (!value || typeof value !== 'object') return { ...emptyDraft };
    const draft = value as Record<string, unknown>;
    if (typeof draft.name !== 'string' || typeof draft.email !== 'string'
      || typeof draft.city !== 'string'
      || (draft.role !== 'helper' && draft.role !== 'professional')) return { ...emptyDraft };
    return {
      name: draft.name.slice(0, 100), email: draft.email.slice(0, 254),
      city: draft.city.slice(0, 150), role: draft.role,
    };
  } catch {
    return { ...emptyDraft };
  }
}

const requestRows = [
  { icon: ClipboardList, label: 'Clear scope & your role', description: 'See the tasks and expected result' },
  { icon: Layers3, label: 'Proposed rate', description: 'Based on the job and your relevant profile' },
  { icon: Truck, label: 'Equipment & pickup', description: 'Your listed equipment plus rentals if needed' },
  { icon: UsersRound, label: 'Working together', description: 'Other helpers or professionals coordinated' },
  { icon: CalendarDays, label: 'Schedule', description: 'Matched only to available calendar slots' },
];

const organizedSteps = [
  { icon: ClipboardList, title: 'Order confirmed', description: 'Your agreed role, scope, rate and schedule are locked in.' },
  { icon: CalendarDays, title: 'Calendar managed', description: 'Doneeo only considers your profile when your calendar shows availability for the job. Accepted work is added to your calendar.' },
  { icon: Truck, title: 'Equipment & team coordinated', description: 'Use listed equipment. Rentals, pickup and extra teammates are arranged when needed.' },
  { icon: CheckCircle2, title: 'Plan & progress visible', description: 'Follow steps, updates and coordination through completion.' },
];

export default function ExecutorLanding() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [draft, setDraft] = useState<ProfileDraft>(readDraft);
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState('');
  const planDialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    document.title = 'Work with Doneeo — Bring your skills';
    document.querySelector('meta[name="description"]')?.setAttribute('content',
      'Bring your skills. Doneeo matches suitable job requests to local helpers and licensed professionals, with clear plans and calendar-based availability.');
  }, []);

  function updateDraft(field: keyof ProfileDraft, value: string) {
    setDraft(current => ({ ...current, [field]: value }));
    setSaved(false);
    setFormError('');
  }

  function saveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = { ...draft, name: draft.name.trim(), email: draft.email.trim(), city: draft.city.trim() };
    if (!normalized.name || !normalized.city || !normalized.role) {
      setFormError('Please add your name, city or service area, and the role you want to explore.');
      return;
    }
    try {
      localStorage.setItem(draftKey, JSON.stringify(normalized));
      setDraft(normalized);
      setSaved(true);
      setFormError('');
    } catch {
      setFormError('This browser could not save your draft. Please allow local storage and try again.');
    }
  }

  function clearDraft() {
    try {
      localStorage.removeItem(draftKey);
      setDraft({ ...emptyDraft });
      setSaved(false);
      setFormError('');
    } catch {
      setFormError('This browser could not clear the saved draft. Please check its storage settings.');
    }
  }

  return <div className="executor-page">
    <a className="skip" href="#executor-main">Skip to content</a>
    <header className="executor-nav" id="executor-top">
      <div className="executor-container executor-nav-inner">
        <a className="executor-brand" href="/" aria-label="Doneeo customer homepage">
          <img src="/images/doneeo-logo.png" alt="Doneeo" width="178" height="51" />
        </a>
        <nav className="executor-desktop-links" aria-label="Executor page">
          <a href="#the-work">The work</a>
          <a href="#who-can-join">Who can join</a>
          <a href="#how-doneeo-helps">How Doneeo helps</a>
        </nav>
        <div className="executor-nav-actions">
          <a className="executor-customer-link" href="/">For customers</a>
          <a className="primary" href="#join-doneeo">Join Doneeo</a>
          <button className="executor-menu-toggle" type="button" onClick={() => setMenuOpen(open => !open)}
            aria-expanded={menuOpen} aria-controls="executor-mobile-menu" aria-label={menuOpen ? 'Close menu' : 'Open menu'}>
            {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
      </div>
      {menuOpen && <nav className="executor-mobile-menu" id="executor-mobile-menu" aria-label="Executor mobile navigation">
        <a href="#the-work" onClick={() => setMenuOpen(false)}>The work</a>
        <a href="#who-can-join" onClick={() => setMenuOpen(false)}>Who can join</a>
        <a href="#how-doneeo-helps" onClick={() => setMenuOpen(false)}>How Doneeo helps</a>
        <a href="/">For customers</a>
      </nav>}
    </header>

    <main className="executor-container" id="executor-main">
      <section className="executor-hero" id="the-work" aria-labelledby="executor-heading">
        <div className="executor-hero-copy">
          <span className="executor-eyebrow"><UsersRound size={21} aria-hidden="true" />Local helpers & licensed professionals</span>
          <h1 id="executor-heading">Bring your skills.<br /><em>We match you with<br className="executor-heading-break" /> work that fits.</em></h1>
          <p>Doneeo matches job requests to your skills, profile and available calendar slots. You accept the work that suits you. We handle the plan, calendar, team coordination, equipment arrangements, billing and payments.</p>
          <a className="primary executor-start" href="#join-doneeo">Start my Doneeo profile <ArrowRight size={24} aria-hidden="true" /></a>
          <p className="executor-reassurance"><CheckCircle2 size={26} aria-hidden="true" /><span>No professional qualification needed for suitable local-helper work.</span></p>
        </div>

        <div className="executor-request-card">
          <div className="executor-request-top"><h2>Review a suitable request</h2><span>Example only</span></div>
          <h3 className="executor-request-title"><span><Wrench size={31} aria-hidden="true" /></span>Help get a workspace ready to use</h3>
          <dl className="executor-request-rows">
            {requestRows.map(row => <div key={row.label}>
              <dt><row.icon size={25} aria-hidden="true" /><strong>{row.label}</strong></dt>
              <dd>{row.description}</dd>
            </div>)}
          </dl>
          <div className="executor-request-bottom">
            <button className="outlined" type="button" onClick={() => planDialog.current?.showModal()}>Review the full plan <ArrowRight size={20} aria-hidden="true" /></button>
            <span>Accept the jobs that suit you.</span>
          </div>
        </div>
      </section>

      <section className="executor-roles" id="who-can-join" aria-labelledby="executor-roles-heading">
        <h2 id="executor-roles-heading">Your abilities matter. <em>There's a role to explore.</em></h2>
        <div className="executor-role-grid">
          <article className="executor-role-card">
            <img src="/images/executor-local-helper-v1.png" alt="A local helper in a green shirt outside a home" width="1200" height="675" loading="lazy" decoding="async" />
            <div className="executor-role-copy"><span><UserRound size={39} aria-hidden="true" /></span><div>
              <h3>Local helper</h3>
              <p>Practical skills and free time. No professional qualification needed for suitable helper tasks.</p>
            </div></div>
          </article>
          <article className="executor-role-card">
            <img src="/images/executor-professional-v1.png" alt="A professional in navy workwear and a white hard hat at a worksite" width="1200" height="675" loading="lazy" decoding="async" />
            <div className="executor-role-copy"><span><HardHat size={39} aria-hidden="true" /></span><div>
              <h3>Licensed professional</h3>
              <p>Put your qualifications and experience to work on requests that need them.</p>
            </div></div>
          </article>
        </div>
        <p className="executor-team-note">If the job needs more than one person, Doneeo coordinates the team and the handoffs.</p>
      </section>

      <section className="executor-organized" id="how-doneeo-helps" aria-labelledby="executor-organized-heading">
        <h2 id="executor-organized-heading">Once you accept, <em>Doneeo keeps it organized.</em></h2>
        <div className="executor-organized-grid">
          {organizedSteps.map(step => <div key={step.title}>
            <step.icon size={46} strokeWidth={1.8} aria-hidden="true" />
            <h3>{step.title}</h3><p>{step.description}</p>
          </div>)}
        </div>
      </section>

      <section className="executor-terms-grid" aria-label="Rates and payments">
        <article><div className="executor-terms-title"><Layers3 size={53} strokeWidth={1.8} aria-hidden="true" /><h2>Fair proposed rates.<br />Clear before you accept.</h2></div>
          <p>See the work, responsibilities, equipment and payment terms. Doneeo proposes the rate based on the request and your relevant skills, experience and profile. You decide what suits you.</p>
        </article>
        <article><div className="executor-terms-title"><ReceiptText size={53} strokeWidth={1.8} aria-hidden="true" /><h2>Billing and payments<br />are handled.</h2></div>
          <p>Doneeo manages customer invoicing and the payment process around the agreed job. You can focus on the work and follow its progress in one place.</p>
        </article>
      </section>

      <section className="executor-join" id="join-doneeo" aria-labelledby="executor-join-heading">
        <h2 id="executor-join-heading">Your skills and free time can <em>help your community.</em></h2>
        <p className="executor-preview-note" id="executor-preview-note">Test preview: this form saves a profile draft only in this browser. Live applications, matching and payments are not available yet.</p>
        <form className="executor-join-form" onSubmit={saveDraft} aria-describedby="executor-preview-note">
          <div className="executor-form-row"><label htmlFor="executor-name">Name</label><input id="executor-name" name="name" autoComplete="name" required maxLength={100} value={draft.name} onChange={event => updateDraft('name', event.target.value)} /></div>
          <div className="executor-form-row"><label htmlFor="executor-email">Email</label><input id="executor-email" name="email" type="email" autoComplete="email" required maxLength={254} value={draft.email} onChange={event => updateDraft('email', event.target.value)} /></div>
          <div className="executor-form-row"><label htmlFor="executor-city">City or service area</label><input id="executor-city" name="city" autoComplete="address-level2" required maxLength={150} value={draft.city} onChange={event => updateDraft('city', event.target.value)} /></div>
          <fieldset className="executor-role-choice"><legend>I'd like to join as</legend><div>
            <label><input name="executor-role" type="radio" value="helper" required checked={draft.role === 'helper'} onChange={() => updateDraft('role', 'helper')} />Local helper</label>
            <label><input name="executor-role" type="radio" value="professional" required checked={draft.role === 'professional'} onChange={() => updateDraft('role', 'professional')} />Licensed professional</label>
          </div></fieldset>
          <div className="executor-form-actions"><button className="primary" type="submit">{saved ? 'Draft saved' : 'Join Doneeo'} {saved ? <CheckCircle2 size={21} aria-hidden="true" /> : <ArrowRight size={21} aria-hidden="true" />}</button>
            {(draft.name || draft.email || draft.city || draft.role) && <button className="executor-clear-draft" type="button" onClick={clearDraft}>Clear draft</button>}
          </div>
          <div aria-live="polite" aria-atomic="true">
            {saved && <p className="executor-form-success" role="status"><CheckCircle2 size={22} aria-hidden="true" /><span>Your preview profile draft is saved on this device. No application has been submitted and no account has been created.</span></p>}
          </div>
          {formError && <p className="executor-form-error" role="alert">{formError}</p>}
          <p className="executor-next-note">Next: your skills, calendar availability and equipment. Add qualifications where the work requires them.</p>
        </form>
      </section>
    </main>

    <footer className="executor-container executor-footer">
      <a href="/" aria-label="Doneeo customer homepage"><img src="/images/doneeo-logo.png" alt="Doneeo" width="119" height="34" /></a>
      <a href="/">For customers</a><a href="/#trust">Support</a>
      <span>Test preview · Job matching and payments are not yet live.</span>
    </footer>

    <dialog className="executor-plan-dialog" ref={planDialog} aria-labelledby="executor-plan-heading">
      <form method="dialog"><button className="executor-dialog-close" aria-label="Close example plan"><X size={23} aria-hidden="true" /></button></form>
      <span className="executor-dialog-eyebrow">Illustrative request · no booking</span>
      <h2 id="executor-plan-heading">Help get a workspace ready to use</h2>
      <p>Every request starts with a clear scope, a proposed rate and a schedule you can review before accepting.</p>
      <ol className="executor-example-plan">
        <li><strong>Understand the result</strong><span>Confirm what needs to be ready, access details and any specialist work.</span></li>
        <li><strong>Plan your role and resources</strong><span>See your tasks, who you work with, equipment and any rental pickup.</span></li>
        <li><strong>Check the schedule and rate</strong><span>Your calendar must show availability for the job before your profile is considered. Review the proposed rate and payment terms.</span></li>
        <li><strong>Accept, then follow the plan</strong><span>Once accepted, the agreed scope, role, rate and schedule are confirmed. Follow coordination and progress through completion.</span></li>
      </ol>
      <p className="executor-dialog-note">This example has no live job, price or payment. No work is booked from this preview.</p>
      <a className="primary" href="#join-doneeo" onClick={() => planDialog.current?.close()}>Start my Doneeo profile <ArrowRight size={20} aria-hidden="true" /></a>
    </dialog>
  </div>;
}
