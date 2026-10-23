import { Ban, ClipboardCheck, Hospital, TestTube } from 'lucide-react';
import type { Messages } from '@/i18n/messages';

/** "Do this first": the four things to check before (or while) looking for a donor. */
export function RequestAdvice({ t }: { t: Messages }) {
  const items = [
    [Hospital, t.request.advice1],
    [ClipboardCheck, t.request.advice2],
    [TestTube, t.request.advice3],
    [Ban, t.request.advice4],
  ] as const;
  return (
    <section className="card card-accent advice-card" aria-labelledby="advice-title">
      <h2 id="advice-title">{t.request.adviceTitle}</h2>
      <ul className="advice-list">
        {items.map(([Icon, text]) => (
          <li key={text}>
            <Icon size={20} aria-hidden="true" />
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
