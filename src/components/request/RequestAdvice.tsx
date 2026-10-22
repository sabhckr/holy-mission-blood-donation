import type { Messages } from '@/i18n/messages';

export function RequestAdvice({ t }: { t: Messages }) {
  return (
    <div className="card card-accent stack-sm">
      <h2 style={{ fontSize: '1.1rem' }}>{t.request.adviceTitle}</h2>
      <ol className="stack-sm" style={{ paddingLeft: '1.2rem', margin: 0 }}>
        <li>{t.request.advice1}</li>
        <li>{t.request.advice2}</li>
        <li>{t.request.advice3}</li>
        <li>{t.request.advice4}</li>
      </ol>
    </div>
  );
}
