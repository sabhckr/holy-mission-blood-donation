'use client';

import { createContext, useActionState, useContext, useEffect, useRef, type ReactNode } from 'react';
import { CircleAlert, CircleCheck } from 'lucide-react';
import type { FormState } from '@/server/actions';

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

interface FormContextValue {
  state: FormState;
  pending: boolean;
}

const FormContext = createContext<FormContextValue>({ state: { status: 'idle' }, pending: false });

export function useFormContext() {
  return useContext(FormContext);
}

/**
 * Form wired to a server action. Works before JavaScript loads (progressive enhancement);
 * once hydrated it shows translated errors/success inline and refills fields after errors.
 */
export function ActionForm({
  action,
  children,
  className = 'form',
  id,
  'aria-label': ariaLabel,
  render,
}: {
  action: Action;
  children?: ReactNode;
  className?: string;
  id?: string;
  'aria-label'?: string;
  /** Optional content rendered from the latest state (e.g. a revealed number). */
  render?: (state: FormState) => ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, { status: 'idle' } as FormState);
  const messageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.status === 'error' && state.message) messageRef.current?.focus();
  }, [state]);
  return (
    <FormContext.Provider value={{ state, pending }}>
      <form action={formAction} className={className} id={id} aria-label={ariaLabel} noValidate aria-busy={pending}>
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
