import Link from 'next/link';
import type { Messages } from '@/i18n/messages';

/** Short footer: service area and safety in one line each, then the essential links. */
export function SiteFooter({ t }: { t: Messages }) {
  const f = t.common.footer;
  return (
    <footer className="site-footer">
      <div className="container">
        <p className="footer-safety">{f.safety}</p>
        <div className="footer-inner">
          <span>{f.copyright(String(new Date().getFullYear()))}</span>
          <nav className="footer-links" aria-label={f.links}>
            <Link href="/help">{f.help}</Link>
            <Link href="/communities">{t.common.nav.communities}</Link>
            <Link href="/privacy">{f.privacy}</Link>
            <Link href="/terms">{f.terms}</Link>
            <Link href="/contact">{f.contact}</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
