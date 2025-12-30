import { getSql } from "../auth/db.js";
import { isAdminEmail } from "../auth/admin.js";
import { sendJson, setCors } from "../auth/response.js";

const emptyConfig = {
  version: 1,
  enabled: true,
  defaults: { beneficio: { rules: [] } },
  priceOverrides: [],
  materiaOverrides: [],
  shortcuts: [],
  programAvailability: [],
  adjustments: [],
};

function parseBody(req: any) {
  if (!req?.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch (err) {
      return {};
    }
  }
  return req.body;
}

function normalizeConfig(config: any) {
  if (!config || typeof config !== "object") return emptyConfig;
  return {
    ...emptyConfig,
    ...config,
    enabled:
      typeof config.enabled === "boolean" ? config.enabled : emptyConfig.enabled,
    defaults: {
      ...emptyConfig.defaults,
      ...(config.defaults ?? {}),
      beneficio: {
        ...emptyConfig.defaults.beneficio,
        ...(config.defaults?.beneficio ?? {}),
        rules: Array.isArray(config.defaults?.beneficio?.rules)
          ? config.defaults.beneficio.rules
          : [],
      },
    },
    priceOverrides: Array.isArray(config.priceOverrides)
      ? config.priceOverrides
      : [],
    materiaOverrides: Array.isArray(config.materiaOverrides)
      ? config.materiaOverrides
      : [],
    shortcuts: Array.isArray(config.shortcuts) ? config.shortcuts : [],
    programAvailability: Array.isArray(config.programAvailability)
      ? config.programAvailability.map((entry: any) => ({
          id: String(entry?.id ?? ""),
          plantel: String(entry?.plantel ?? ""),
          programa: String(entry?.programa ?? ""),
          modalidad: String(entry?.modalidad ?? "presencial"),
          horario: String(entry?.horario ?? ""),
          activo: typeof entry?.activo === "boolean" ? entry.activo : true,
        }))
      : [],
    adjustments: Array.isArray(config.adjustments) ? config.adjustments : [],
  };
}

export default async function handler(req: any, res: any) {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  const body = parseBody(req);
  const slug = String(req?.query?.slug ?? body?.slug ?? "")
    .trim()
    .toLowerCase();

  if (!slug) {
    sendJson(res, 400, { error: "Slug requerido." });
    return;
  }

  try {
    const sql = await getSql();

    if (req.method === "GET") {
      const result = await sql`
        SELECT config
        FROM admin_config
        WHERE slug = ${slug}
        LIMIT 1;
      `;
      const rows = Array.isArray(result) ? result : result.rows ?? [];
      const config = rows.length ? rows[0].config : null;
      sendJson(res, 200, { config: normalizeConfig(config) });
      return;
    }

    if (req.method === "PUT") {
      const email = String(body?.email ?? "").trim().toLowerCase();
      if (!email) {
        sendJson(res, 400, { error: "Correo requerido." });
        return;
      }
      if (!isAdminEmail(email)) {
        sendJson(res, 403, { error: "Acceso no autorizado." });
        return;
      }
      const normalized = normalizeConfig(body?.config);
      await sql`
        INSERT INTO admin_config (slug, config, updated_by)
        VALUES (${slug}, ${normalized}, ${email})
        ON CONFLICT (slug)
        DO UPDATE SET config = EXCLUDED.config,
                      updated_by = EXCLUDED.updated_by,
                      updated_at = NOW();
      `;
      sendJson(res, 200, { config: normalized });
      return;
    }

    sendJson(res, 405, { error: "Metodo no permitido." });
  } catch (err) {
    sendJson(res, 500, { error: "Error al procesar la configuracion." });
  }
}
