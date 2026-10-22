import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { migrationDatabaseUrl } from '../src/server/config';
import { closeDb, getDb } from '../src/server/db/client';
import { locations } from '../src/server/db/schema';
import { loadEnv } from './env';

loadEnv();

interface Node {
  code: string;
  name_en: string;
  name_bn: string;
}
interface Division extends Node {
  districts: (Node & { upazilas: Node[] })[];
}

type Level = 'division' | 'district' | 'upazila';

/**
 * Seeds the Bangladesh location hierarchy (8 divisions, 64 districts, 494 upazilas) from
 * data/bd-locations.json (MIT, github.com/nuhil/bangladesh-geocode). Idempotent: rows are
 * matched by code; names edited by administrators are left alone. One query per level, so it
 * stays fast against a remote database.
 * No donors, organisations or requests are seeded — the site starts empty and honest.
 */
export async function seedLocations(): Promise<{ divisions: number; districts: number; upazilas: number }> {
  const db = getDb();
  const data = JSON.parse(readFileSync('data/bd-locations.json', 'utf8')) as { divisions: Division[] };
  const row = (node: Node, level: Level, parentId: number | null) => ({
    code: node.code,
    level,
    parentId,
    nameBn: node.name_bn.normalize('NFC'),
    nameEn: node.name_en.normalize('NFC'),
  });
  const upsert = async (tx: Parameters<Parameters<typeof db.transaction>[0]>[0], rows: ReturnType<typeof row>[]) => {
    const saved = await tx
      .insert(locations)
      .values(rows)
      .onConflictDoUpdate({ target: locations.code, set: { parentId: sql`excluded.parent_id`, level: sql`excluded.level` } })
      .returning({ id: locations.id, code: locations.code });
    return new Map(saved.map((r) => [r.code, r.id]));
  };
  const districts = data.divisions.flatMap((d) => d.districts.map((x) => ({ division: d.code, district: x })));
  const upazilas = districts.flatMap(({ district }) => district.upazilas.map((u) => ({ district: district.code, upazila: u })));
  await db.transaction(async (tx) => {
    const divisionIds = await upsert(tx, data.divisions.map((d) => row(d, 'division', null)));
    const districtIds = await upsert(tx, districts.map(({ division, district }) => row(district, 'district', divisionIds.get(division)!)));
    await upsert(tx, upazilas.map(({ district, upazila }) => row(upazila, 'upazila', districtIds.get(district)!)));
  });
  return { divisions: data.divisions.length, districts: districts.length, upazilas: upazilas.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const url = migrationDatabaseUrl();
  if (url) process.env.DATABASE_URL = url;
  console.log('Seeded locations', await seedLocations());
  await closeDb();
}
