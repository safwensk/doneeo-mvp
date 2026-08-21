import Link from "next/link";

import {
  CANONICAL_ARCHITECTURE_VERSION,
  DOMAIN_LAYERS,
  PLATFORM_LAYERS,
} from "../../lib/canonical-architecture";

export default function ArchitecturePage() {
  const activeLayers = DOMAIN_LAYERS.filter(layer => layer.readiness === "ACTIVE").length;

  return (
    <main className="architecture-page">
      <header className="architecture-nav">
        <Link className="architecture-brand" href="/">DONEEO</Link>
        <nav aria-label="Architecture navigation">
          <Link href="/">Customer planner</Link>
          <Link href="/data">Data controls</Link>
        </nav>
      </header>

      <section className="architecture-hero">
        <div>
          <small>CANONICAL OPERATING ARCHITECTURE · V{CANONICAL_ARCHITECTURE_VERSION}</small>
          <h1>One continuous WorkCase from request to continuity.</h1>
          <p>
            Every layer consumes a versioned artifact, makes one owned decision,
            and publishes the single artifact that authorizes the next layer.
          </p>
        </div>
        <aside>
          <strong>{DOMAIN_LAYERS.length}</strong><span>domain layers</span>
          <strong>{PLATFORM_LAYERS.length}</strong><span>shared platforms</span>
          <strong>{activeLayers}</strong><span>live MVP engines</span>
        </aside>
      </section>

      <section className="architecture-principle" aria-label="Master continuity principle">
        <b>ONE MASTER IDENTITY</b>
        <span>WorkCase</span><i>→</i><span>JobOrder</span><i>→</i><span>Versioned artifacts</span><i>→</i><span>Outcome</span>
      </section>

      <section className="architecture-section">
        <div className="architecture-section-title">
          <div><small>L01–L13</small><h2>Domain flow</h2></div>
          <p>Orange layers are active in the MVP. Green layers have their guarded control contract ready for implementation.</p>
        </div>
        <ol className="architecture-layer-grid">
          {DOMAIN_LAYERS.map(layer => (
            <li className={layer.readiness === "ACTIVE" ? "is-active" : "is-ready"} key={layer.id}>
              <div className="architecture-layer-head">
                <b>{layer.id}</b>
                <em>{layer.readiness === "ACTIVE" ? "ACTIVE" : "CONTROL READY"}</em>
              </div>
              <h3>{layer.title}</h3>
              <p>{layer.purpose}</p>
              <dl>
                <div><dt>Publishes</dt><dd>{layer.authoritativeArtifact}</dd></div>
                <div><dt>Owner</dt><dd>{layer.decisionOwner.replaceAll("_", " ")}</dd></div>
              </dl>
              <footer>{layer.platforms.join(" · ")}</footer>
            </li>
          ))}
        </ol>
      </section>

      <section className="architecture-section architecture-platform-section">
        <div className="architecture-section-title">
          <div><small>P01–P09</small><h2>Shared platforms</h2></div>
          <p>These capabilities serve every domain layer; they are not repeated inside each workflow.</p>
        </div>
        <div className="architecture-platform-grid">
          {PLATFORM_LAYERS.map(platform => (
            <article key={platform.id}>
              <b>{platform.id}</b>
              <div><h3>{platform.title}</h3><p>{platform.purpose}</p></div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
