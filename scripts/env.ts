import { existsSync } from 'node:fs';

/** Load .env.local / .env for CLI scripts (Next.js loads them itself for the web app). */
export function loadEnv(): void {
  for (const file of ['.env.local', '.env']) {
    if (existsSync(file)) {
      try {
        process.loadEnvFile(file);
      } catch {
        // ignore malformed optional env files
      }
    }
  }
}
