import { OAuth2Client } from "google-auth-library";
import { UNIVERSITY_DOMAINS, getEmailDomain, isAllowedDomain } from "./config";
import { getSql } from "./db";
import { sendJson, setCors } from "./response";

const getClientId = () => process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
const client = new OAuth2Client(getClientId() || undefined);

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
    sendJson(res, 405, { error: "Metodo no permitido." });
    return;
  }

  const body = parseBody(req);
  const credential = String(body?.credential ?? "").trim();
  const slug = String(body?.slug ?? "").trim().toLowerCase();

  if (!credential || !slug) {
    sendJson(res, 400, { error: "Faltan datos requeridos." });
    return;
  }

  const allowedDomains = UNIVERSITY_DOMAINS[slug as keyof typeof UNIVERSITY_DOMAINS];
  if (!allowedDomains) {
    sendJson(res, 400, { error: "Universidad no configurada." });
    return;
  }

  const clientId = getClientId();
  if (!clientId) {
    sendJson(res, 500, { error: "GOOGLE_CLIENT_ID no configurado." });
    return;
  }

  try {
    const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
    const payload = ticket.getPayload();
    const email = payload?.email?.toLowerCase() ?? "";
    const emailVerified = Boolean(payload?.email_verified);

    if (!email || !emailVerified) {
      sendJson(res, 401, { error: "No fue posible validar el correo con Google." });
      return;
    }

    const domain = getEmailDomain(email);
    if (!domain) {
      sendJson(res, 400, { error: "Correo invalido." });
      return;
    }
    if (!isAllowedDomain(domain, allowedDomains)) {
      sendJson(res, 403, { error: "Dominio no permitido para esta universidad." });
      return;
    }

    const sql = await getSql();
    const existing = await sql`
      SELECT email, university_slug, auth_provider
      FROM users
      WHERE email = ${email}
      LIMIT 1;
    `;
    const rows = Array.isArray(existing) ? existing : existing.rows ?? [];
    if (rows.length) {
      const user = rows[0] as { email: string; university_slug: string; auth_provider: string };
      if (user.university_slug !== slug) {
        sendJson(res, 403, { error: "Acceso no autorizado para este panel." });
        return;
      }
      if (user.auth_provider === "password") {
        sendJson(res, 403, { error: "Usa correo y contrasena para iniciar sesion." });
        return;
      }
      sendJson(res, 200, { email: user.email });
      return;
    }

    const result = await sql`
      INSERT INTO users (email, password_hash, salt, university_slug, auth_provider)
      VALUES (${email}, ${null}, ${null}, ${slug}, 'google')
      RETURNING email;
    `;
    const inserted = Array.isArray(result) ? result : result.rows ?? [];
    if (!inserted.length) {
      sendJson(res, 500, { error: "No fue posible registrar el usuario." });
      return;
    }

    sendJson(res, 200, { email: inserted[0].email });
  } catch (err) {
    sendJson(res, 500, { error: "Error al validar credenciales con Google." });
  }
}
