import { UNIVERSITY_DOMAINS, getEmailDomain, isAllowedDomain } from "./config.js";
import { isAdminEmail } from "./admin.js";
import { getSql } from "./db.js";
import { createSalt, hashPassword } from "./password.js";
import { sendJson, setCors } from "./response.js";

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

export default async function handler(req: any, res: any) {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Método no permitido." });
    return;
  }

  const body = parseBody(req);
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  const slug = String(body?.slug ?? "").trim().toLowerCase();

  if (!email || !password || !slug) {
    sendJson(res, 400, { error: "Faltan datos requeridos." });
    return;
  }

  const allowedDomains = UNIVERSITY_DOMAINS[slug as keyof typeof UNIVERSITY_DOMAINS];
  if (!allowedDomains) {
    sendJson(res, 400, { error: "Universidad no configurada." });
    return;
  }
  const domain = getEmailDomain(email);
  if (!domain) {
    sendJson(res, 400, { error: "Correo inválido." });
    return;
  }
  if (!isAdminEmail(email) && !isAllowedDomain(domain, allowedDomains)) {
    sendJson(res, 403, { error: "Dominio no permitido para esta universidad." });
    return;
  }

  if (password.length < 6) {
    sendJson(res, 400, { error: "La contraseña debe tener al menos 6 caracteres." });
    return;
  }

  try {
    const sql = await getSql();
    const existing = await sql`
      SELECT email, university_slug, auth_provider
      FROM users
      WHERE email = ${email}
      LIMIT 1;
    `;
    const existingRows = (Array.isArray(existing) ? existing : existing.rows ?? []) as Array<{
      email: string;
      university_slug: string;
      auth_provider: string;
    }>;
    if (existingRows.length && existingRows[0].university_slug !== slug) {
      sendJson(res, 403, { error: "Acceso no autorizado para este panel." });
      return;
    }
    const salt = createSalt();
    const passwordHash = hashPassword(password, salt);
    const result = await sql`
      INSERT INTO users (email, password_hash, salt, university_slug, auth_provider)
      VALUES (${email}, ${passwordHash}, ${salt}, ${slug}, 'password')
      ON CONFLICT (email) DO UPDATE
      SET password_hash = EXCLUDED.password_hash,
          salt = EXCLUDED.salt,
          auth_provider = CASE
            WHEN users.auth_provider IN ('google', 'both') THEN 'both'
            ELSE 'password'
          END
      RETURNING email;
    `;

    const rows = (Array.isArray(result) ? result : result.rows ?? []) as Array<{
      email: string;
    }>;

    if (!rows.length) {
      sendJson(res, 500, { error: "No fue posible registrar el usuario." });
      return;
    }

    sendJson(res, 200, { email: rows[0].email });
  } catch (err) {
    sendJson(res, 500, { error: "Error al registrar el usuario." });
  }
}



