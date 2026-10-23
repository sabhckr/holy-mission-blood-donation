'use client';

import { useEffect } from 'react';
import { RotateCcw, TriangleAlert } from 'lucide-react';
/**
 * Error boundary. It cannot read the server dictionary, so it shows both languages
 * (text comes from the shared dictionary file, not hardcoded here).
 */
import { common } from '@/i18n/messages/common';

export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="auth-page">
      <div className="container auth-column">
        <div className="card auth-card status-card" role="alert">
          <span className="auth-icon auth-icon-error">
            <TriangleAlert size={28} aria-hidden="true" />
          </span>
          <h1 lang="bn">{common.bn.error.title}</h1>
          <p className="auth-intro" lang="bn">
            {common.bn.error.body}
          </p>
          <p className="error-en" lang="en">
            <strong>{common.en.error.title}</strong> {common.en.error.body}
          </p>
          <button className="btn btn-primary btn-lg btn-block" type="button" onClick={() => retry()}>
            <RotateCcw size={20} aria-hidden="true" />
            {common.bn.actions.tryAgain} / {common.en.actions.tryAgain}
          </button>
        </div>
      </div>
    </div>
  );
}
