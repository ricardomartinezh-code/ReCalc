import fs from "node:fs/promises";
import process from "node:process";
import { neon } from "@neondatabase/serverless";

const slug = process.argv[2] ?? "unidep";
const payloadPath = process.argv[3] ?? "scripts/availability_payload.json";
const connectionString = process.env.DATABASE_URL?.trim();

if (!connectionString) {
  console.error("DATABASE_URL no configurado.");
  process.exit(1);
}

const payloadRaw = await fs.readFile(payloadPath, "utf8");
const payload = JSON.parse(payloadRaw);

const sql = neon(connectionString);

const result = await sql`
  INSERT INTO availability_cache (slug, payload, updated_at)
  VALUES (${slug}, ${payload}, NOW())
  ON CONFLICT (slug)
  DO UPDATE SET payload = EXCLUDED.payload,
                updated_at = EXCLUDED.updated_at
  RETURNING updated_at;
`;

await sql`
  INSERT INTO availability_cache_history (slug, payload, created_at)
  VALUES (${slug}, ${payload}, NOW());
`;

await sql`
  DELETE FROM availability_cache_history
  WHERE slug = ${slug}
    AND id NOT IN (
      SELECT id
      FROM availability_cache_history
      WHERE slug = ${slug}
      ORDER BY created_at DESC
      LIMIT 3
    );
`;

const updatedAt = result?.[0]?.updated_at ?? null;
console.log(`Cache updated for ${slug}. updated_at=${updatedAt}`);
