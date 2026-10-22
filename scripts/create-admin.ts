import { createInterface } from 'node:readline';
import { eq } from 'drizzle-orm';
import { migrationDatabaseUrl } from '../src/server/config';
import { closeDb, getDb } from '../src/server/db/client';
import { users } from '../src/server/db/schema';
import { normalizeBdPhone } from '../src/server/domain/phone';
import { audit } from '../src/server/services/audit';
import { createAccount } from '../src/server/services/accounts';
import { loadEnv } from './env';

loadEnv();

/** Reads a line from the terminal without echoing it. */
function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const output = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
    output._writeToOutput = (s: string) => {
      if (s.includes(question)) output.output.write(s);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

/**
 * Creates the first platform administrator, or promotes an existing account.
 * Usage: ADMIN_PHONE=01XXXXXXXXX ADMIN_NAME="Name" npm run admin:create
 * The password is asked for without echo (or taken from ADMIN_PASSWORD). To create the admin on
 * the live site, also set DATABASE_URL to the production connection string.
 */
const url = migrationDatabaseUrl();
if (url) process.env.DATABASE_URL = url;
const phone = normalizeBdPhone(process.env.ADMIN_PHONE ?? '');
const name = (process.env.ADMIN_NAME ?? '').trim();
if (!phone) throw new Error('ADMIN_PHONE must be a valid Bangladeshi mobile number');

const db = getDb();
const [existing] = await db.select().from(users).where(eq(users.phone, phone));
if (existing) {
  await db.update(users).set({ role: 'admin', updatedAt: new Date() }).where(eq(users.id, existing.id));
  await audit(db, { actor: null, action: 'admin.role_changed', targetType: 'user', targetId: existing.id, metadata: { from: existing.role, to: 'admin', via: 'cli' } });
  console.log('Existing account promoted to administrator');
} else {
  if (!name) throw new Error('ADMIN_NAME is required for a new account');
  const password = process.env.ADMIN_PASSWORD ?? (await askHidden('Password for the new administrator (12+ characters): '));
  if (password.length < 12) throw new Error('Use a password of at least 12 characters for an administrator');
  const user = await db.transaction(async (tx) => {
    const created = await createAccount(tx, { phone, password, displayName: name });
    await tx.update(users).set({ role: 'admin' }).where(eq(users.id, created.id));
    await audit(tx, { actor: null, action: 'admin.created', targetType: 'user', targetId: created.id, metadata: { via: 'cli' } });
    return created;
  });
  console.log(`Administrator created (${user.id})`);
}
await closeDb();
