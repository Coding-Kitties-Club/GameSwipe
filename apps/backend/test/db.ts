import { pool } from "../src/db";

export async function resetDb(): Promise<void> {
    await pool.query(`
    TRUNCATE TABLE
      member_sessions,
      members,
      rooms
    RESTART IDENTITY
    CASCADE
  `);
}

export async function closeDb(): Promise<void> {
    await pool.end();
}