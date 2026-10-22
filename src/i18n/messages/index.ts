import type { Locale } from '../config';
import { account } from './account';
import { admin } from './admin';
import { auth } from './auth';
import { common } from './common';
import { community } from './community';
import { donor } from './donor';
import { errors } from './errors';
import { help } from './help';
import { home } from './home';
import { legal } from './legal';
import { notifications } from './notifications';
import { request } from './request';
import { search } from './search';
import { validation } from './validation';

/** Every namespace, each with `bn` and `en`. Add new namespaces here. */
export const namespaces = { common, home, search, donor, auth, account, community, request, admin, help, legal, notifications, validation, errors };

type Namespaces = typeof namespaces;
export type Messages = { [K in keyof Namespaces]: Namespaces[K]['bn'] };

const cache = new Map<Locale, Messages>();

export function getMessages(locale: Locale): Messages {
  const cached = process.env.NODE_ENV === 'production' ? cache.get(locale) : undefined;
  if (cached) return cached;
  const messages = Object.fromEntries(Object.entries(namespaces).map(([key, value]) => [key, value[locale]])) as Messages;
  cache.set(locale, messages);
  return messages;
}
