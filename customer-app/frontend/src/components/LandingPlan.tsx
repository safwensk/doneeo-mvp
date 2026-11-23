import { ArrowRight, CalendarDays, CheckCircle2, ChevronRight, Circle, HardHat, Layers, ReceiptText, ShieldCheck, Target, Users } from 'lucide-react';

const executionOptions = [
  { id: 'professional', title: 'Verified professional', icon: ShieldCheck, image: 'verified-professional-v2.png', description: 'Licensed expertise for specialized or regulated work.' },
  { id: 'helper', title: 'Verified local helper', icon: Users, image: 'verified-helper-v2.png', description: 'Local support for suitable everyday tasks.' },
  { id: 'team', title: 'Combined team', icon: Layers, image: 'combined-team-v2.png', description: 'The right mix of skills for complex, multi-task work.' },
];

const coordinationDetails = [
  { title: 'Equipment, ready before arrival', icon: HardHat, description: 'Check what you and the executor already have. Arrange rentals and pickup when needed.' },
  { title: 'One detailed bill', icon: ReceiptText, description: 'People, equipment, transport and fees, itemized in one transaction.' },
  { title: 'Every step visible', icon: CheckCircle2, description: 'See who is responsible, what is next, and progress through to completion.' },
];

const planDetails = [
  { title: 'Outcome and scope', summary: 'What will be completed', icon: Target, description: 'Doneeo clarifies your need, defines what is included, and sets out what a completed result looks like.' },
  { title: 'People and responsibilities', summary: 'The right skills for each task', icon: Users, description: 'The approach can include qualified professionals, verified local helpers or a combined team, with clear responsibilities for each step.' },
  { title: 'Equipment and preparation', summary: 'What is available and what to arrange', icon: CalendarDays, description: 'The plan checks equipment you or the executor can provide, then includes any rental, collection and preparation needed before arrival.' },
  { title: 'Schedule and itemized cost', summary: 'Ready for your review', icon: ReceiptText, description: 'Review the sequence, milestones and itemized estimate for people, equipment, transport and fees before approving the work.' },
];

function IllustrativePlan({ onStart }: { onStart: () => void }) {
  return <div className="illustrative-plan" aria-labelledby="plan-preview-heading">
    <div className="plan-preview-heading">
      <h3 id="plan-preview-heading">Your plan, at a glance</h3>
      <span>Illustrative plan</span>
    </div>
    <div className="plan-preview-details">
      {planDetails.map(detail => <details key={detail.title}>
        <summary>
          <detail.icon size={23} aria-hidden="true"/>
          <span><strong>{detail.title}</strong><small>{detail.summary}</small></span>
          <ChevronRight className="plan-detail-chevron" size={16} aria-hidden="true"/>
        </summary>
        <p className="plan-detail-copy">{detail.description}</p>
      </details>)}
    </div>
    <div className="plan-preview-progress">
      <h4>Follow the agreed plan</h4>
      <ol aria-label="Illustrative progress, showing preparation as the first step">
        {['Prepare', 'Arrive', 'Complete', 'Review'].map((stage, index) => <li key={stage} className={index === 0 ? 'current' : undefined}>
          {index === 0 ? <CheckCircle2 size={25} aria-hidden="true"/> : <Circle size={25} aria-hidden="true"/>}
          <span>{stage}</span>
        </li>)}
      </ol>
    </div>
    <div className="plan-preview-footer">
      <small>Work starts after your approval.</small>
      <button className="outlined" onClick={onStart}>Review the plan <ArrowRight size={15} aria-hidden="true"/></button>
    </div>
  </div>;
}

export default function LandingPlan({ onStart }: { onStart: (initial?: string) => void }) {
  return <>
    <section id="plans" className="container plans-section">
      <div className="plans-copy">
        <div className="heading">
          <h2>The right plan.<br/><em>The best value for your needs.</em></h2>
          <p>Doneeo understands your need, architects the solution, and matches the people, equipment and steps to the complexity of the work.</p>
          <p>You see the scope, schedule and itemized cost before you approve.</p>
        </div>
      </div>
      <div className="plan-photo">
        <img src="/images/customer-planning-v2.png" width="1774" height="887" alt="Customer reviewing a plan on her laptop" loading="lazy"/>
      </div>
    </section>

    <section className="container execution-section" aria-labelledby="execution-heading">
      <div className="heading">
        <h2 id="execution-heading">The right people. <em>For the right reason.</em></h2>
        <p>Doneeo recommends the approach. You approve the plan.</p>
      </div>
      <div className="execution-grid">
        {executionOptions.map(option => <article className="execution-card" key={option.id} aria-labelledby={`execution-${option.id}`}>
          <img src={`/images/${option.image}`} width="512" height="512" alt="" loading="lazy"/>
          <div className="execution-card-copy">
            <div className="execution-card-title"><option.icon size={25} aria-hidden="true"/><h3 id={`execution-${option.id}`}>{option.title}</h3></div>
            <p>{option.description}</p>
          </div>
        </article>)}
      </div>
      <p className="execution-note">A suitable solution at the lowest practical cost, based on available quotes.</p>
    </section>

    <section className="container coordination-section" aria-labelledby="coordination-heading">
      <div className="coordination-copy">
        <div className="heading">
          <h2 id="coordination-heading">Everything clear.<br/><em>Before you say yes.</em></h2>
          <p>One plan for the work. One view of what happens next.</p>
        </div>
        <div className="coordination-details">
          {coordinationDetails.map(detail => <div className="coordination-row" key={detail.title}>
            <detail.icon size={35} aria-hidden="true"/>
            <div><h3>{detail.title}</h3><p>{detail.description}</p></div>
          </div>)}
        </div>
      </div>
      <IllustrativePlan onStart={() => onStart()}/>
    </section>

    <section className="container recurring-callout" aria-labelledby="recurring-heading">
      <div className="recurring-copy">
        <h2 id="recurring-heading">Once or on repeat. <em>Doneeo takes care of it.</em></h2>
        <p>One-time requests and recurring work, coordinated around your needs.</p>
      </div>
      <button className="primary" onClick={() => onStart()}>Tell Doneeo what you need <ArrowRight size={17} aria-hidden="true"/></button>
    </section>
  </>;
}
