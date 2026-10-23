import { CalendarCheck, ListOrdered } from 'lucide-react';
import { PageHeader } from './ui';

/** Long-form legal text: last-updated date, a small table of contents, then numbered sections. */
export function LegalPage({ title, intro, updated, sections, tocLabel }: { title: string; intro: string; updated: string; sections: { heading: string; body: string[] }[]; tocLabel?: string }) {
  return (
    <>
      <PageHeader title={title} intro={intro} />
      <div className="section pub-body">
        <div className="container container-narrow stack">
          <p className="pub-meta">
            <CalendarCheck size={16} aria-hidden="true" />
            <span>{updated}</span>
          </p>
          {tocLabel && (
            <nav className="card card-tight legal-toc" aria-labelledby="legal-toc-title">
              <h2 id="legal-toc-title" className="pub-subhead">
                <ListOrdered size={18} aria-hidden="true" />
                {tocLabel}
              </h2>
              <ol>
                {sections.map((s, i) => (
                  <li key={s.heading}>
                    <a href={`#section-${i + 1}`}>{s.heading}</a>
                  </li>
                ))}
              </ol>
            </nav>
          )}
          <article className="card legal-doc">
            {sections.map((s, i) => (
              <section key={s.heading} id={`section-${i + 1}`} className="legal-section">
                <h2>{s.heading}</h2>
                {s.body.map((p) => (
                  <p key={p}>{p}</p>
                ))}
              </section>
            ))}
          </article>
        </div>
      </div>
    </>
  );
}
