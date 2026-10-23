'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * On phones the section nav is a sideways-scrolling row of chips; bring the current one into
 * view so people can see where they are. Only moves the row, never the page.
 */
export function ScrollCurrentIntoView({ navId }: { navId: string }) {
  const pathname = usePathname();
  useEffect(() => {
    const list = document.getElementById(navId)?.querySelector('ul');
    const current = list?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!list || !current || list.scrollWidth <= list.clientWidth) return;
    const offset = current.getBoundingClientRect().left - list.getBoundingClientRect().left;
    list.scrollLeft = Math.max(0, list.scrollLeft + offset - (list.clientWidth - current.offsetWidth) / 2);
  }, [navId, pathname]);
  return null;
}
