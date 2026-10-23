'use client';

import { useEffect, useRef } from 'react';
import { useFormContext } from './ActionForm';

type Saved = { at: number; values: Record<string, string | boolean | string[]> };
type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

const MAX_AGE_MS = 2 * 3600 * 1000;
const SKIP_TYPES = new Set(['password', 'hidden', 'file', 'submit', 'button', 'reset']);

function fields(form: HTMLFormElement): Field[] {
  return Array.from(form.elements).filter(
    (el): el is Field =>
      (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) && !!el.name && !(el instanceof HTMLInputElement && SKIP_TYPES.has(el.type)),
  );
}

function collect(form: HTMLFormElement): Saved['values'] {
  const values: Saved['values'] = {};
  for (const el of fields(form)) {
    if (el instanceof HTMLInputElement && el.type === 'radio') {
      if (el.checked) values[el.name] = el.value;
    } else if (el instanceof HTMLInputElement && el.type === 'checkbox') {
      // Several checkboxes can share a name (e.g. service areas): keep the checked values.
      const group = form.querySelectorAll<HTMLInputElement>(`input[type="checkbox"][name="${CSS.escape(el.name)}"]`);
      values[el.name] = group.length > 1 ? Array.from(group).filter((c) => c.checked).map((c) => c.value) : el.checked;
    } else {
      values[el.name] = el.value;
    }
  }
  return values;
}

/** Sets a value the way typing would, so React-controlled fields update their state too. */
function setValue(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
}

function restore(form: HTMLFormElement, values: Saved['values']) {
  for (const el of fields(form)) {
    if (!(el.name in values)) continue;
    const value = values[el.name];
    if (el instanceof HTMLInputElement && el.type === 'radio') el.checked = el.value === value;
    else if (el instanceof HTMLInputElement && el.type === 'checkbox') el.checked = Array.isArray(value) ? value.includes(el.value) : value === true;
    else if (typeof value === 'string' && el.value !== value) setValue(el, value);
  }
}

/**
 * Keeps an unfinished form in this browser tab (sessionStorage), so switching the language — which
 * reloads the page — or an accidental reload does not lose what was typed. Passwords and hidden
 * fields are never stored, drafts older than two hours are ignored, and the draft is removed as soon
 * as the form is sent. Without JavaScript nothing is stored.
 */
export function FormDraft({ name }: { name: string }) {
  const marker = useRef<HTMLSpanElement>(null);
  const { state } = useFormContext();
  const key = `hm-draft:${name}`;
  const initialStatus = useRef(state.status);

  useEffect(() => {
    const form = marker.current?.closest('form');
    if (!form) return;
    try {
      // Only fill an untouched form; after a server error the form already shows what was sent.
      const saved = initialStatus.current === 'idle' ? (JSON.parse(sessionStorage.getItem(key) ?? 'null') as Saved | null) : null;
      if (saved && Date.now() - saved.at < MAX_AGE_MS) restore(form, saved.values);
    } catch {
      // Storage can be unavailable (private mode); the form still works.
    }
    const save = () => {
      try {
        sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), values: collect(form) } satisfies Saved));
      } catch {
        // Ignore: saving the draft is a convenience only.
      }
    };
    // Once sent, the draft is no longer needed: on an error the server refills the form itself.
    const clear = () => {
      try {
        sessionStorage.removeItem(key);
      } catch {
        // Nothing to clean up.
      }
    };
    form.addEventListener('input', save);
    form.addEventListener('change', save);
    form.addEventListener('submit', clear);
    return () => {
      form.removeEventListener('input', save);
      form.removeEventListener('change', save);
      form.removeEventListener('submit', clear);
    };
  }, [key]);

  useEffect(() => {
    if (state.status !== 'success') return;
    try {
      sessionStorage.removeItem(key);
    } catch {
      // Nothing to clean up.
    }
  }, [state.status, key]);

  return <span ref={marker} hidden />;
}
