import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Workspace from '../github/app/page';

export default function DoneeoWorkspace(props: {
  accountId: string;
  initialRequest: string;
  onStarted: () => void;
  onSignOut: () => void;
}) {
  const [surface, setSurface] = useState<ShadowRoot | null>(null);
  useEffect(() => {
    const previous = document.title;
    document.title = 'Doneeo · Customer workspace';
    window.scrollTo(0, 0);
    return () => { document.title = previous; };
  }, []);

  // The GitHub stylesheet includes its own reset and design tokens. A shadow
  // root preserves that complete visual system without restyling the landing page.
  return <div data-testid="doneeo-workspace" ref={element => {
    if (element && !element.shadowRoot) setSurface(element.attachShadow({ mode: 'open' }));
  }}>
    {surface && createPortal(<>
      <link rel="stylesheet" href="/workspace.css" />
      <Workspace {...props} />
    </>, surface)}
  </div>;
}
