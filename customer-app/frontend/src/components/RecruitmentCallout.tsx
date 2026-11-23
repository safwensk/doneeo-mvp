import { useEffect, useRef } from 'react';
import { ArrowRight, HardHat, UserRound } from 'lucide-react';
import '../recruitment-callout.css';

export default function RecruitmentCallout() {
  const sectionRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (window.location.hash === '#executors') {
      sectionRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
  }, []);

  return <section ref={sectionRef} id="executors" className="container recruitment-callout" aria-labelledby="recruitment-heading">
    <div className="recruitment-copy">
      <h2 id="recruitment-heading">Work with Doneeo</h2>
      <p>Get started in a few simple steps and land<br className="recruitment-line-break" /> <strong>your first job</strong> with Doneeo.</p>
      <a className="primary recruitment-join" href="/executors">Join Doneeo <ArrowRight size={25} aria-hidden="true" /></a>
    </div>
    <div className="recruitment-roles">
      <figure className="recruitment-role">
        <img src="/images/recruitment-helpers-v1.png" width="1200" height="750" loading="lazy" decoding="async"
          alt="A woman and man wearing green Doneeo helper T-shirts" />
        <figcaption>
          <UserRound aria-hidden="true" />
          <div><strong>Doneeo Helper</strong><span>Local helper</span></div>
        </figcaption>
      </figure>
      <figure className="recruitment-role">
        <img src="/images/recruitment-professionals-v1.png" width="1200" height="750" loading="lazy" decoding="async"
          alt="A woman and man wearing navy Doneeo professional shirts and white hard hats" />
        <figcaption>
          <HardHat aria-hidden="true" />
          <div><strong>Doneeo Pro</strong><span>Licensed professional</span></div>
        </figcaption>
      </figure>
    </div>
  </section>;
}
