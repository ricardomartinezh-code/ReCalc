import { isAdminEmail } from "../../server/auth/admin.js";
import { getSql } from "../../server/auth/db.js";
import { sendJson, setCors } from "../../server/auth/response.js";

const CACHE_HISTORY_LIMIT = 3;

const parseBody = (req: any) => {
  if (!req?.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch (err) {
      return {};
    }
  }
  return req.body;
};

const normalize = (value: string | null | undefined) =>
  String(value ?? "").trim().toLowerCase();

const matchesEntry = (entry: any, target: any) =>
  normalize(entry?.plantel) === normalize(target?.plantel) &&
  normalize(entry?.programa) === normalize(target?.programa) &&
  normalize(entry?.modalidad) === normalize(target?.modalidad);

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

  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Metodo no permitido." });
    return;
  }

  const body = parseBody(req);
  const slug = String(req?.query?.slug ?? body?.slug ?? "")
    .trim()
    .toLowerCase();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const target = body?.entry ?? body ?? {};

  if (!slug) {
    sendJson(res, 400, { error: "Slug requerido." });
    return;
  }
  if (!email) {
    sendJson(res, 400, { error: "Correo requerido." });
    return;
  }
  if (!isAdminEmail(email)) {
    sendJson(res, 403, { error: "Acceso no autorizado." });
    return;
  }
  if (
    !normalize(target?.plantel) ||
    !normalize(target?.programa) ||
    !normalize(target?.modalidad)
  ) {
    sendJson(res, 400, { error: "Datos incompletos para eliminar." });
    return;
  }

  try {
    const sql = await getSql();
    const result = await sql`
      SELECT payload
      FROM availability_cache
      WHERE slug = ${slug}
      LIMIT 1;
    `;
    const rows = Array.isArray(result) ? result : (result as any).rows ?? [];
    if (!rows.length) {
      sendJson(res, 404, { error: "No hay cache disponible para este slug." });
      return;
    }
    const payload = rows[0]?.payload ?? {};
    const availability = Array.isArray(payload?.availability)
      ? payload.availability
      : [];
    const debug = Array.isArray(payload?.debug) ? payload.debug : [];
    const nextAvailability = availability.filter(
      (entry: any) => !matchesEntry(entry, target)
    );
    if (nextAvailability.length === availability.length) {
      sendJson(res, 404, { error: "Programa no encontrado en cache." });
      return;
    }
    const updatedPayload = { availability: nextAvailability, debug };
    const updatedAt = await saveAvailabilityCache(slug, updatedPayload);
    sendJson(res, 200, {
      availability: nextAvailability,
      updatedAt: updatedAt.toISOString(),
    });
  } catch (err) {
    sendJson(res, 500, { error: "No fue posible eliminar del cache." });
  }
}
