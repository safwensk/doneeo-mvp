import { ArrowRight, BadgeCheck, CalendarDays, CheckCircle2, ClipboardList, Layers, ListChecks, ReceiptText, ShieldCheck, Users, Wrench } from 'lucide-react';

const executionOptions = [
  {
    title: 'Verified professionals',
    icon: ShieldCheck,
    description: 'The expertise your job requires, with licensed professionals where the work calls for them.',
    detail: 'For specialized, technical or regulated work.',
  },
  {
    title: 'Verified local helpers',
    icon: Users,
    description: 'Trusted local help for work that can be completed safely without specialist qualifications.',
    detail: 'A practical, affordable option for simpler tasks.',
  },
  {
    title: 'Combined teams',
    icon: Layers,
    description: 'Professionals and helpers working together, with the right skills assigned to each task.',
    detail: 'For complex projects and requests with multiple tasks.',
  },
];

const coordinationDetails = [
  {
    title: 'The equipment is part of the plan.',
    icon: Wrench,
    description: 'Doneeo checks what the executor can bring and what you already have. If something is missing, the plan includes the rental and pickup needed so the team arrives prepared.',
  },
  {
    title: 'One clear bill. One transaction.',
    icon: ReceiptText,
    description: 'See the people, equipment, rentals and fees in one detailed price. Review what is included and approve the full plan before you place your order.',
  },
  {
    title: 'Follow every step to completion.',
    icon: ListChecks,
    description: 'A transparent tracker shows each planned step, who is responsible and real-time progress, from preparation and arrival to completion and your final review.',
  },
];

export default function LandingPlan({ onStart }: { onStart: (initial?: string) => void }) {
  return <>
    <section id="plans" className="container plans-section">
      <div className="plans-copy">
        <div className="heading">
          <h2>The right plan.<br/><em>The best value for your needs.</em></h2>
          <p>Doneeo understands your request and architects the solution around its complexity. We compare the skills, people and equipment needed to recommend the lowest suitable cost based on available quotes, with the right qualifications for the work.</p>
        </div>
        <div className="plan-features">
          <div><BadgeCheck/><strong>The right expertise</strong><span>Matched to each task</span></div>
          <div><Wrench/><strong>Equipment covered</strong><span>Bring, reuse or rent</span></div>
          <div><ReceiptText/><strong>One clear price</strong><span>Detailed before approval</span></div>
          <div><ClipboardList/><strong>A complete plan</strong><span>From setup to completion</span></div>
        </div>
        <button onClick={() => onStart()} className="text-action">Find the right approach for my request <ArrowRight size={16}/></button>
      </div>
      <div className="plan-photo">
        <img src="/images/woman.webp" alt="Customer reviewing her Doneeo plan at her laptop" loading="lazy"/>
      </div>
    </section>

    <section className="container execution-section" aria-labelledby="execution-heading">
      <h2 id="execution-heading" className="execution-mobile-heading">The right executor <em>for your need.</em></h2>
      <img className="executor-comparison" src="/images/executor-comparison.png" width="912" height="131" alt="Choose the right executor for your need: verified professionals for specialist work, or local helpers for simpler tasks." loading="lazy"/>
      <p className="execution-intro">You do not need to know who to call. Doneeo recommends the right fit, whether your request needs one person or a coordinated team.</p>
      <div className="execution-grid">
        {executionOptions.map(option => <article className="execution-card" key={option.title}>
          <div className="execution-card-title"><option.icon size={24} aria-hidden="true"/><h3>{option.title}</h3></div>
          <p>{option.description}</p>
          <span className="execution-fit"><CheckCircle2 size={16} aria-hidden="true"/>{option.detail}</span>
        </article>)}
      </div>
      <p className="execution-note">These are ways to carry out the work. Your need defines the solution.</p>
    </section>

    <section className="container coordination-section" aria-labelledby="coordination-heading">
      <div className="heading center">
        <h2>Every person. Every tool.<br/><em>One coordinated plan.</em></h2>
        <p>No calling around, chasing unclear answers or coordinating several people yourself. Tell Doneeo the outcome you need. We work out who, how and what it takes.</p>
      </div>
      <div className="coordination-grid">
        {coordinationDetails.map(detail => <article className="coordination-card" key={detail.title}>
          <detail.icon size={27} aria-hidden="true"/>
          <h3>{detail.title}</h3>
          <p>{detail.description}</p>
        </article>)}
      </div>
      <div className="recurring-callout">
        <div className="recurring-copy"><CalendarDays size={28} aria-hidden="true"/><div><h3>Once or on repeat. Doneeo takes care of it.</h3><p>A one-time request or recurring work, organized around your needs, with a clear scope and schedule to approve.</p></div></div>
        <button className="outlined" onClick={() => onStart()}>Tell us what you need <ArrowRight size={17}/></button>
      </div>
    </section>
  </>;
}
