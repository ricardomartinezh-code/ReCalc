import { UNIVERSITY_DOMAINS, getEmailDomain, isAllowedDomain } from "./config";
import { getSql } from "./db";
import { verifyPassword } from "./password";
import { sendJson, setCors } from "./response";

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

  try {
    const sql = await getSql();
    const result = await sql`
      SELECT email, password_hash, salt, university_slug
      FROM users
      WHERE email = ${email}
      LIMIT 1;
    `;

    const rows = Array.isArray(result) ? result : result.rows ?? [];

    if (!rows.length) {
      sendJson(res, 401, { error: "Credenciales inválidas." });
      return;
    }

    const user = rows[0] as {
      email: string;
      password_hash: string;
      salt: string;
      university_slug: string;
    };

    if (user.university_slug !== slug) {
      sendJson(res, 403, { error: "Acceso no autorizado para este panel." });
      return;
    }
    const domain = getEmailDomain(email);
    if (!domain) {
      sendJson(res, 400, { error: "Correo inválido." });
      return;
    }
    if (!isAllowedDomain(domain, allowedDomains)) {
      sendJson(res, 403, { error: "Dominio no permitido para esta universidad." });
      return;
    }

    const valid = verifyPassword(password, user.salt, user.password_hash);
    if (!valid) {
      sendJson(res, 401, { error: "Credenciales inválidas." });
      return;
    }

    sendJson(res, 200, { email: user.email });
  } catch (err) {
    sendJson(res, 500, { error: "Error al validar credenciales." });
  }
}

