import type { Metadata } from 'next';
import { CircleCheck, Download, Smartphone } from 'lucide-react';
import { getI18n } from '@/i18n/server';
import { ANDROID_APP, isInApp } from '@/components/site/android-app';
import { Alert, PageHeader } from '@/components/ui';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.app.title, description: t.app.metaDescription };
}

/** Download page for the Android app (a signed APK in public/downloads that opens this website). */
export default async function AppDownloadPage() {
  const { t, n } = await getI18n();
  const a = t.app;
  if (await isInApp()) {
    return (
      <>
        <PageHeader title={a.inAppTitle} />
        <div className="section pub-body">
          <div className="container container-narrow">
            <Alert tone="success">{a.inAppBody}</Alert>
          </div>
        </div>
      </>
    );
  }
  return (
    <>
      <PageHeader title={a.title} intro={a.intro} />
      <div className="section pub-body">
        <div className="container container-narrow stack">
          <section className="card stack app-download" aria-labelledby="android-title">
            <h2 id="android-title" className="pub-panel-title">
              <Smartphone size={20} aria-hidden="true" />
              {a.androidTitle}
            </h2>
            <a className="btn btn-primary btn-block" href={ANDROID_APP.href} download>
              <Download size={18} aria-hidden="true" />
              {a.download}
            </a>
            <p className="small muted app-download-meta">
              <CircleCheck size={16} aria-hidden="true" />
              <span>
                {a.details(n(ANDROID_APP.version), n(ANDROID_APP.sizeMb))} · {a.free}
              </span>
            </p>
          </section>

          <section className="stack-sm" aria-labelledby="steps-title">
            <h2 id="steps-title" className="pub-panel-title">
              {a.stepsTitle}
            </h2>
            <ol className="steps app-steps">
              {a.steps.map((s) => (
                <li key={s.title}>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </li>
              ))}
            </ol>
          </section>

          <Alert tone="warning">{a.warning}</Alert>

          <section className="card card-muted stack-sm" aria-labelledby="iphone-title">
            <h2 id="iphone-title" className="pub-panel-title">
              {a.iphoneTitle}
            </h2>
            <p style={{ margin: 0 }}>{a.iphoneBody}</p>
          </section>
        </div>
      </div>
    </>
  );
}
