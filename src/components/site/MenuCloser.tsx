'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

const OPEN_MENUS = 'details[data-menu][open]';

function closeAll(except?: Element | null) {
  document.querySelectorAll(OPEN_MENUS).forEach((menu) => {
    if (menu !== except) menu.removeAttribute('open');
  });
}

/**
 * The header lives in the root layout, which stays mounted between pages, so its <details> menus
 * would stay open after a link is followed. Close them on navigation, on a tap outside and on Escape.
 * Without JavaScript the menus still open and close normally.
 */
export function MenuCloser() {
  const pathname = usePathname();
  useEffect(() => closeAll(), [pathname]);
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      closeAll(target?.closest('details[data-menu]'));
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const open = document.querySelector<HTMLDetailsElement>(OPEN_MENUS);
      if (!open) return;
      open.removeAttribute('open');
      open.querySelector<HTMLElement>('summary')?.focus();
    };
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);
  return null;
}
