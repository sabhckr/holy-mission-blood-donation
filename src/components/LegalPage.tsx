import { PageHeader } from './ui';

export function LegalPage({ title, intro, updated, sections }: { title: string; intro: string; updated: string; sections: { heading: string; body: string[] }[] }) {
  return (
    <>
      <PageHeader title={title} intro={intro} />
      <div className="container container-narrow section stack-lg">
        <p className="small muted">{updated}</p>
        {sections.map((s) => (
          <section key={s.heading} className="stack-sm">
            <h2>{s.heading}</h2>
            {s.body.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </section>
        ))}
      </div>
    </>
  );
}
