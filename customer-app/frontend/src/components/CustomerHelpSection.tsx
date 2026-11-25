import { useEffect, useRef } from 'react';
import { ArrowRight } from 'lucide-react';
import '../customer-help-section.css';

const helpExamples = [
  {
    title: 'An extra hand',
    description: 'Move boxes, organize the garage or get help with part of a job.',
    image: 'help-extra-hand-v1.webp',
  },
  {
    title: 'The whole job handled',
    description: 'Hand off a project from planning through completion.',
    image: 'help-whole-job-v1.webp',
  },
  {
    title: 'Recurring help',
    description: 'Weekly cleaning, dog walks or regular errands.',
    image: 'help-recurring-v1.webp',
  },
];

const providerOptions = [
  {
    title: 'Verified local helper',
    description: 'Practical help for everyday tasks.',
    image: 'help-role-helper-v1.webp',
  },
  {
    title: 'Licensed Doneeo Pro',
    description: 'For work that requires a license.',
    image: 'help-role-pro-v1.webp',
  },
  {
    title: 'Coordinated team',
    description: 'Helpers and pros working together.',
    image: 'help-role-team-v1.webp',
  },
];

export default function CustomerHelpSection({ onStart }: { onStart: () => void }) {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (location.hash !== '#customer-help') return;

    function scrollToHelp() {
      if (location.hash === '#customer-help') {
        sectionRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
      }
    }

    scrollToHelp();
    if (document.readyState === 'complete') return;
    window.addEventListener('load', scrollToHelp, { once: true });
    return () => window.removeEventListener('load', scrollToHelp);
  }, []);

  return (
    <section ref={sectionRef} id="customer-help" className="container customer-help" aria-labelledby="customer-help-heading">
      <header className="customer-help-heading">
        <h2 id="customer-help-heading">From an extra hand <em>to the whole job.</em></h2>
        <p>Tell us what needs doing. We’ll plan what it takes.</p>
      </header>

      <div className="customer-help-layout">
        <div className="customer-help-needs">
          <h3>What you need help with</h3>
          <ul className="customer-help-examples">
            {helpExamples.map(({ title, description, image }) => (
              <li key={title}>
                <img src={`/images/${image}`} alt="" width="640" height="512" loading="lazy" decoding="async" />
                <div>
                  <h4>{title}</h4>
                  <p>{description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="customer-help-people">
          <h3>Who Doneeo can bring in</h3>
          <ul className="customer-help-providers">
            {providerOptions.map(({ title, description, image }) => (
              <li key={title}>
                <img src={`/images/${image}`} alt="" width="320" height="200" loading="lazy" decoding="async" />
                <div>
                  <h4>{title}</h4>
                  <p>{description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="customer-help-callout">
        <p>Doneeo works out the steps, people and equipment, then recommends the best available option. Review the plan and price before you approve.</p>
        <button type="button" className="primary" onClick={() => onStart()}>
          Tell Doneeo what you need <ArrowRight size={20} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
