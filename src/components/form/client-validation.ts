import { normalizeBdPhone } from '@/server/domain/phone';
import type { ClientValidationMessages, RequiredMessageKey } from './client-messages';

/**
 * Browser-side checks that run before a form is sent. They only catch what the server would
 * certainly reject (empty required fields, a malformed mobile number, mismatched passwords), so
 * they never block a submission the server would accept; every other rule stays on the server.
 *
 * A field is required when it has the `required` attribute or aria-required="true" (radio groups:
 * any radio in the group). A field may name a more specific message with data-required-key.
 */
type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function isControl(el: Element): el is Control {
  return el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement;
}

const SKIPPED_TYPES = new Set(['hidden', 'submit', 'button', 'reset', 'image', 'file']);

function isRequired(el: Control) {
  return el.required || el.getAttribute('aria-required') === 'true';
}

function requiredMessage(el: Element, fallback: string, messages: ClientValidationMessages) {
  const key = (el.getAttribute('data-required-key') ?? el.closest('[data-required-key]')?.getAttribute('data-required-key')) as RequiredMessageKey | null;
  return key && key in messages ? messages[key] : fallback;
}

/** Hidden by the page (not just inside a closed <details>, which we can open). */
function isHiddenByPage(el: Control) {
  return !!el.closest('[hidden], [inert]');
}

export interface ClientValidationResult {
  errors: Record<string, string>;
  /** Name of the first invalid field in document order, to move focus to. */
  first: string | null;
}

export function validateForm(form: HTMLFormElement, messages: ClientValidationMessages): ClientValidationResult {
  const errors: Record<string, string> = {};
  let first: string | null = null;
  const add = (name: string, message: string) => {
    if (errors[name]) return;
    errors[name] = message;
    first ??= name;
  };
  const radioGroups = new Set<string>();

  for (const el of Array.from(form.elements)) {
    if (!isControl(el) || !el.name || el.disabled || isHiddenByPage(el)) continue;
    if (el instanceof HTMLInputElement && SKIPPED_TYPES.has(el.type)) continue;

    if (el instanceof HTMLInputElement && el.type === 'radio') {
      if (radioGroups.has(el.name)) continue;
      radioGroups.add(el.name);
      const group = Array.from(form.elements).filter((r): r is HTMLInputElement => r instanceof HTMLInputElement && r.type === 'radio' && r.name === el.name && !r.disabled);
      if (group.some(isRequired) && !group.some((r) => r.checked)) add(el.name, requiredMessage(el, messages.required, messages));
      continue;
    }

    if (el instanceof HTMLInputElement && el.type === 'checkbox') {
      if (isRequired(el) && !el.checked) add(el.name, requiredMessage(el, messages.mustAccept, messages));
      continue;
    }

    const value = el.value.trim();
    if (!value) {
      if (isRequired(el)) add(el.name, requiredMessage(el, messages.required, messages));
      continue;
    }
    if (el instanceof HTMLInputElement && el.type === 'tel' && !normalizeBdPhone(value)) add(el.name, messages.invalidPhone);
  }

  // Same rule as the server: both typed and different. Passwords are compared untrimmed.
  const password = form.elements.namedItem('password');
  const confirm = form.elements.namedItem('confirmPassword');
  if (password instanceof HTMLInputElement && confirm instanceof HTMLInputElement && password.value && confirm.value && password.value !== confirm.value) {
    add(confirm.name, messages.passwordMismatch);
  }
  // Focus order follows the page, not the order the checks ran in.
  const firstInPage = Array.from(form.elements).find((el): el is Control => isControl(el) && !!errors[el.name]);
  first = firstInPage?.name ?? first;
  return { errors, first };
}

/** Moves focus to a field by name, opening any closed <details> around it first. */
export function focusField(form: HTMLFormElement, name: string) {
  const item = form.elements.namedItem(name);
  const el = item instanceof RadioNodeList ? (item[0] as HTMLElement | undefined) : (item as HTMLElement | null);
  if (!el) return;
  for (let d = el.closest('details'); d; d = d.parentElement?.closest('details') ?? null) d.open = true;
  el.focus();
}
