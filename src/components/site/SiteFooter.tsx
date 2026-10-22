import Link from 'next/link';
import type { Messages } from '@/i18n/messages';

export function SiteFooter({ t }: { t: Messages }) {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <h2>{t.common.brand}</h2>
            <p lang="bn" style={{ fontWeight: 700 }}>
              {t.common.slogan}
            </p>
            <p>{t.common.footer.about}</p>
          </div>
          <div>
            <h2>{t.common.footer.links}</h2>
            <ul className="list-plain stack-sm">
              <li>
                <Link href="/donors">{t.common.nav.findDonors}</Link>
              </li>
              <li>
                <Link href="/requests/new">{t.common.nav.newRequest}</Link>
              </li>
              <li>
                <Link href="/communities">{t.common.nav.communities}</Link>
              </li>
              <li>
                <Link href="/register">{t.common.nav.becomeDonor}</Link>
              </li>
            </ul>
          </div>
          <div>
            <h2>{t.common.footer.contact}</h2>
            <ul className="list-plain stack-sm">
              <li>
                <Link href="/help">{t.common.footer.help}</Link>
              </li>
              <li>
                <Link href="/contact">{t.common.footer.contact}</Link>
              </li>
              <li>
                <Link href="/privacy">{t.common.footer.privacy}</Link>
              </li>
              <li>
                <Link href="/terms">{t.common.footer.terms}</Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="footer-note">
          <p>{t.common.footer.medicalNote}</p>
          <p style={{ marginBottom: 0 }}>{t.common.footer.noPayment}</p>
        </div>
      </div>
    </footer>
  );
}
