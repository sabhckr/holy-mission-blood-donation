import { headers } from 'next/headers';

/**
 * The Android app, served from public/downloads. When a new build is copied there, update the
 * version and size here (see mobile/README.md).
 */
export const ANDROID_APP = { href: '/downloads/lakshmipur-blood.apk', version: 1.1, sizeMb: 3.2 };

/** The app appends this to its browser's user agent (appendUserAgent in mobile/capacitor.config.json). */
const APP_USER_AGENT = 'LakshmipurBloodApp';

/** True inside the app, where links to download the app are pointless. */
export async function isInApp(): Promise<boolean> {
  return (await headers()).get('user-agent')?.includes(APP_USER_AGENT) ?? false;
}
