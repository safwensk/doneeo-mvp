import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight, CalendarDays, ClipboardList, HardHat,
  Layers3, Menu, ReceiptText, Truck, UserRound, UsersRound, Wrench, X,
} from 'lucide-react';
import '../executor-landing.css';

const requestRows = [
  { icon: UserRound, label: 'Your role', description: 'Local helper or licensed professional' },
  { icon: Layers3, label: 'Proposed rate', description: 'Based on the job and your relevant profile' },
  { icon: Truck, label: 'Equipment', description: 'Use listed equipment or arrange rentals if needed' },
  { icon: UsersRound, label: 'Team', description: 'Other helpers or professionals coordinated by Doneeo' },
  { icon: CalendarDays, label: 'Schedule', description: 'Matched to your available calendar slots' },
];

const organizedSteps = [
  { icon: ClipboardList, title: 'Plan the job', description: 'We define the tasks, equipment and people the job needs.' },
  { icon: CalendarDays, title: 'Match and schedule', description: 'We send you jobs based on your profile and only when your calendar shows you’re available.' },
  { icon: Truck, title: 'Coordinate the work', description: 'Once you accept, we confirm the work order and arrange the team, equipment and handoffs.' },
  { icon: ReceiptText, title: 'Invoice and pay', description: 'We handle customer invoicing and track payments against the agreed work order.' },
];

export default function ExecutorLanding() {
  const [menuOpen, setMenuOpen] = useState(false);
  const planDialog = useRef<HTMLDialogElement>(null);
  const profileDialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    document.title = 'Work with Doneeo — Bring your skills';
    document.querySelector('meta[name="description"]')?.setAttribute('content',
      'Bring your skills. Doneeo matches suitable job requests to local helpers and licensed professionals, with clear plans and calendar-based availability.');
  }, []);

  function openProfilePreview() {
    setMenuOpen(false);
    planDialog.current?.close();
    profileDialog.current?.showModal();
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
          <button className="primary" type="button" aria-haspopup="dialog" onClick={openProfilePreview}>Start my profile</button>
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
          <span className="executor-eyebrow"><UsersRound size={21} aria-hidden="true" />Work with Doneeo</span>
          <h1 id="executor-heading">Bring your skills.<br /><em>We match you with<br className="executor-heading-break" /> work that fits.</em></h1>
          <p>Set up your profile and tell us when you’re available. Doneeo sends you work that fits your skills and calendar. Review the plan and accept the jobs that suit you.</p>
          <button className="primary executor-start" type="button" aria-haspopup="dialog" onClick={openProfilePreview}>Start my Doneeo profile <ArrowRight size={24} aria-hidden="true" /></button>
        </div>

        <div className="executor-request-card">
          <div className="executor-request-top"><h2>Review a job request</h2><span>Example</span></div>
          <h3 className="executor-request-title"><span><Wrench size={31} aria-hidden="true" /></span>Help get a workspace ready to use</h3>
          <dl className="executor-request-rows">
            {requestRows.map(row => <div key={row.label}>
              <dt><row.icon size={25} aria-hidden="true" /><strong>{row.label}</strong></dt>
              <dd>{row.description}</dd>
            </div>)}
          </dl>
          <div className="executor-request-bottom">
            <button className="outlined" type="button" onClick={() => planDialog.current?.showModal()}>See the plan before you accept or decline <ArrowRight size={18} aria-hidden="true" /></button>
          </div>
        </div>
      </section>

      <section className="executor-roles" id="who-can-join" aria-labelledby="executor-roles-heading">
        <h2 id="executor-roles-heading">Put your time, tools and skills <em>to work.</em></h2>
        <div className="executor-role-grid">
          <article className="executor-role-card">
            <img src="/images/recruitment-helpers-v1.webp" alt="A woman and man wearing green Doneeo Helper shirts" width="1200" height="751" loading="lazy" decoding="async" />
            <div className="executor-role-copy"><span><UserRound size={39} aria-hidden="true" /></span><div>
              <h3>Doneeo Helper</h3>
              <p className="executor-role-label">Local helper</p>
              <p>No experience needed for suitable local tasks. Put your free time to work, list any equipment you have, and get ready for your first job.</p>
            </div></div>
          </article>
          <article className="executor-role-card">
            <img src="/images/recruitment-professionals-v1.webp" alt="A woman and man wearing navy Doneeo Pro shirts and white hard hats" width="1200" height="751" loading="lazy" decoding="async" />
            <div className="executor-role-copy"><span><HardHat size={39} aria-hidden="true" /></span><div>
              <h3>Doneeo Pro</h3>
              <p className="executor-role-label">Licensed professional</p>
              <p>Put your licence and experience to work on jobs that need them. Add your qualifications and availability so Doneeo can send you suitable requests.</p>
            </div></div>
          </article>
        </div>
      </section>

      <section className="executor-organized" id="how-doneeo-helps" aria-labelledby="executor-organized-heading">
        <h2 id="executor-organized-heading">Set up your profile. <em>Doneeo handles the rest.</em></h2>
        <p className="executor-organized-intro">From the customer’s request to a clear work order, we plan and coordinate the job through completion.</p>
        <div className="executor-organized-grid">
          {organizedSteps.map(step => <div key={step.title}>
            <step.icon size={46} strokeWidth={1.8} aria-hidden="true" />
            <h3>{step.title}</h3><p>{step.description}</p>
          </div>)}
        </div>
      </section>

      <section className="executor-terms-grid" aria-label="Review and follow your work order">
        <article><div className="executor-terms-title"><Layers3 size={44} strokeWidth={1.8} aria-hidden="true" /><div>
          <h2>Know what you’re accepting</h2>
          <p>See your role, schedule, equipment and proposed rate before you accept.</p>
        </div></div>
        </article>
        <article><div className="executor-terms-title"><ReceiptText size={44} strokeWidth={1.8} aria-hidden="true" /><div>
          <h2>Follow the job in one place</h2>
          <p>See the confirmed work order, next steps and updates through completion.</p>
        </div></div>
        </article>
      </section>

      <section className="executor-join" id="join-doneeo" aria-labelledby="executor-join-heading">
        <h2 id="executor-join-heading">Create your Doneeo profile</h2>
        <p className="executor-join-copy">Sign in or create an account, then choose Local helper or Licensed professional.</p>
        <button className="primary executor-start" type="button" aria-haspopup="dialog" aria-describedby="executor-profile-status" onClick={openProfilePreview}>
          Start my Doneeo profile <ArrowRight size={24} aria-hidden="true" />
        </button>
        <p className="executor-profile-status" id="executor-profile-status">Worker registration is coming soon.</p>
      </section>
    </main>

    <footer className="executor-container executor-footer">
      <a href="/" aria-label="Doneeo customer homepage"><img src="/images/doneeo-logo.png" alt="Doneeo" width="119" height="34" /></a>
      <a href="/">For customers</a><a href="/#trust">Support</a>
      <span>Preview. Job matching and payments are not live.</span>
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
      <button className="primary" type="button" aria-haspopup="dialog" onClick={openProfilePreview}>Start my Doneeo profile <ArrowRight size={20} aria-hidden="true" /></button>
    </dialog>

    <dialog className="executor-plan-dialog" ref={profileDialog} aria-labelledby="executor-profile-heading" aria-describedby="executor-registration-note">
      <form method="dialog"><button className="executor-dialog-close" aria-label="Close profile preview"><X size={23} aria-hidden="true" /></button></form>
      <h2 id="executor-profile-heading">Create your Doneeo profile</h2>
      <p id="executor-registration-note">Worker registration is coming soon. Here’s how you’ll get started.</p>
      <ol className="executor-example-plan">
        <li><strong>Sign in or create an account</strong><span>Start with your Doneeo account.</span></li>
        <li><strong>Choose your role</strong><span>Join as a Local helper or Licensed professional.</span></li>
        <li><strong>Complete your profile</strong><span>Add your skills, service area, availability and equipment. Include your qualifications for licensed work.</span></li>
      </ol>
    </dialog>
  </div>;
}
