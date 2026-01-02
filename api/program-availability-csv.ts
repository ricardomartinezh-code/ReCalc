import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sendJson, setCors } from "../server/auth/response.js";
import { getSql } from "../server/auth/db.js";

const CACHE_HISTORY_LIMIT = 3;

const resolvePayloadPath = () => {
  const fromEnv = process.env.AVAILABILITY_PAYLOAD_PATH?.trim();
  if (fromEnv) return fromEnv;
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  return path.join(__dirname, "..", "scripts", "availability_payload.json");
};

const loadPayload = async () => {
  const payloadPath = resolvePayloadPath();
  const raw = await fs.readFile(payloadPath, "utf8");
  const parsed = JSON.parse(raw);
  return {
    availability: Array.isArray(parsed?.availability) ? parsed.availability : [],
    debug: Array.isArray(parsed?.debug) ? parsed.debug : [],
  };
};

const saveAvailabilityCache = async (slug: string, payload: any) => {
  const sql = await getSql();
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
        LIMIT ${CACHE_HISTORY_LIMIT}
      );
  `;
  const rows = Array.isArray(result) ? result : (result as any).rows ?? [];
  return rows[0]?.updated_at ? new Date(rows[0].updated_at) : new Date();
};

export default async function handler(req: any, res: any) {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "POST" && req.method !== "GET") {
    sendJson(res, 405, { error: "Metodo no permitido." });
    return;
  }

  const url = new URL(req.url ?? "", "http://localhost");
  const slug = String(url.searchParams.get("slug") ?? "unidep")
    .trim()
    .toLowerCase();
  const wantsDebug = url.searchParams.get("debug") === "1";

  try {
    const payload = await loadPayload();
    const updatedAt = await saveAvailabilityCache(slug, payload);
    sendJson(
      res,
      200,
      wantsDebug
        ? { ...payload, updatedAt: updatedAt.toISOString() }
        : { availability: payload.availability, updatedAt: updatedAt.toISOString() }
    );
  } catch (err) {
    const details = err instanceof Error ? err.message : "Error desconocido.";
    sendJson(res, 500, {
      error: "No fue posible actualizar desde CSV.",
      details,
    });
  }
}
