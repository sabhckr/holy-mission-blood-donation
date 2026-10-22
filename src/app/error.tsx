'use client';

import { useEffect } from 'react';

/**
 * Error boundary. It cannot read the server dictionary, so it shows both languages
 * (text comes from the shared dictionary file, not hardcoded here).
 */
import { common } from '@/i18n/messages/common';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="container section">
      <div className="alert alert-error" role="alert">
        <div className="stack-sm">
          <p style={{ fontWeight: 700 }} lang="bn">
            {common.bn.error.title}
          </p>
          <p lang="bn">{common.bn.error.body}</p>
          <p style={{ fontWeight: 700 }} lang="en">
            {common.en.error.title}
          </p>
          <p lang="en">{common.en.error.body}</p>
          <button className="btn" type="button" onClick={reset}>
            {common.bn.actions.tryAgain} / {common.en.actions.tryAgain}
          </button>
        </div>
      </div>
    </div>
  );
}
