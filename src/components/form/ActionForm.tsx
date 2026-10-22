'use client';

import { createContext, useActionState, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { CircleAlert, CircleCheck } from 'lucide-react';
import type { FormState } from '@/server/actions';
import type { ClientValidationMessages } from './client-messages';
import { focusField, validateForm } from './client-validation';

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

interface FormContextValue {
  state: FormState;
  pending: boolean;
}

const FormContext = createContext<FormContextValue>({ state: { status: 'idle' }, pending: false });

export function useFormContext() {
  return useContext(FormContext);
}

/** Errors found in the browser for the current server state (`serverTs`). */
interface ClientCheck {
  errors: Record<string, string>;
  serverTs: number | undefined;
  attempt: number;
  first: string | null;
}

/**
 * Form wired to a server action. Works before JavaScript loads (progressive enhancement);
 * once hydrated it shows translated errors/success inline and refills fields after errors.
 *
 * With `clientMessages` it also checks required fields, mobile number format and matching
 * passwords in the browser before sending, and shows the same translated messages inline. The
 * server still validates everything; without JavaScript the form simply posts as before.
 */
export function ActionForm({
  action,
  children,
  className = 'form',
  id,
  'aria-label': ariaLabel,
  render,
  clientMessages,
}: {
  action: Action;
  children?: ReactNode;
  className?: string;
  id?: string;
  'aria-label'?: string;
  /** Optional content rendered from the latest state (e.g. a revealed number). */
  render?: (state: FormState) => ReactNode;
  /** Plain strings from clientValidationMessages(t); enables the browser-side checks. */
  clientMessages?: ClientValidationMessages;
}) {
  const [serverState, formAction, pending] = useActionState(action, { status: 'idle' } as FormState);
  const [check, setCheck] = useState<ClientCheck | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const messageRef = useRef<HTMLDivElement>(null);

  // Browser-side errors apply until the server answers again (its state gets a new ts).
  // Once every flagged field is fixed, the old messages (browser or server) are cleared too.
  const clientActive = !!clientMessages && !!check && check.serverTs === serverState.ts;
  const state: FormState = !clientActive
    ? serverState
    : Object.keys(check.errors).length > 0
      ? { ...serverState, status: 'error', message: clientMessages.summary, fieldErrors: check.errors }
      : { ...serverState, status: 'idle', message: undefined, fieldErrors: undefined };

  useEffect(() => {
    if (serverState.status === 'error' && serverState.message) messageRef.current?.focus();
  }, [serverState]);

  // After a blocked submission, move focus to the first field that needs attention. Runs after
  // render so the field already has aria-invalid and its error text when it is announced.
  const focusedAttempt = useRef(0);
  useEffect(() => {
    if (!check || check.attempt === focusedAttempt.current) return;
    focusedAttempt.current = check.attempt;
    if (check.first && formRef.current) focusField(formRef.current, check.first);
  }, [check]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (!clientMessages) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    if (submitter && (submitter as HTMLButtonElement).formNoValidate) return;
    const result = validateForm(event.currentTarget, clientMessages);
    if (!result.first) {
      if (check) setCheck(null);
      return;
    }
    event.preventDefault();
    setCheck({ errors: result.errors, serverTs: serverState.ts, attempt: (check?.attempt ?? 0) + 1, first: result.first });
  };

  // Once a field is corrected, its message goes away; untouched fields keep theirs.
  const onChange = (event: FormEvent<HTMLFormElement>) => {
    if (!clientActive || !clientMessages) return;
    const name = (event.target as HTMLInputElement).name;
    if (!name || (!check.errors[name] && !(name === 'password' && check.errors.confirmPassword))) return;
    const fresh = validateForm(event.currentTarget, clientMessages).errors;
    const errors = Object.fromEntries(Object.entries(check.errors).flatMap(([k]) => (fresh[k] ? [[k, fresh[k]]] : [])));
    setCheck({ ...check, errors });
  };

  return (
    <FormContext.Provider value={{ state, pending }}>
      <form
        ref={formRef}
        action={formAction}
        className={className}
        id={id}
        aria-label={ariaLabel}
        noValidate
        aria-busy={pending}
        onSubmit={clientMessages ? onSubmit : undefined}
        onChange={clientActive ? onChange : undefined}
      >
        {state.message && (
          <div
            ref={messageRef}
            tabIndex={-1}
            className={`alert ${state.status === 'error' ? 'alert-error' : 'alert-success'}`}
            role={state.status === 'error' ? 'alert' : 'status'}
          >
            {state.status === 'error' ? <CircleAlert size={20} aria-hidden="true" /> : <CircleCheck size={20} aria-hidden="true" />}
            <p style={{ margin: 0 }}>{state.message}</p>
          </div>
        )}
        {children}
        {render?.(state)}
      </form>
    </FormContext.Provider>
  );
}

export function SubmitButton({ label, pendingLabel, className = 'btn btn-primary', name, value }: { label: string; pendingLabel?: string; className?: string; name?: string; value?: string }) {
  const { pending } = useFormContext();
  return (
    <button type="submit" className={className} disabled={pending} name={name} value={value}>
      {pending && pendingLabel ? pendingLabel : label}
    </button>
  );
}
