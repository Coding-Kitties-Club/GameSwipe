import { pool } from "../src/db";

async function tableExists(name: string): Promise<boolean> {
  const res = await pool.query<{ exists: boolean }>(
    `
    SELECT to_regclass($1) IS NOT NULL AS exists
    `,
    [`public.${name}`]
  );
  return Boolean(res.rows[0]?.exists);
}

export async function resetDb(): Promise<void> {
  const tables = ["steam_identities", "member_sessions", "members", "rooms"];

  const present: string[] = [];
  for (const t of tables) {
    if (await tableExists(t)) present.push(t);
  }

  if (present.length === 0) return;

  await pool.query(`
    TRUNCATE TABLE
      ${present.map((t) => `"${t}"`).join(",\n      ")}
    RESTART IDENTITY CASCADE;
  `);
}

export async function closeDb(): Promise<void> {
  await pool.end();
}
