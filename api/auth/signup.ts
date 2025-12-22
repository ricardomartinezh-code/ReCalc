import { UNIVERSITY_DOMAINS } from "./config";
import { getSql } from "./db";
import { createSalt, hashPassword } from "./password";
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

  const domain = email.split("@")[1] ?? "";
  if (!allowedDomains.includes(domain)) {
    sendJson(res, 403, { error: "Dominio no permitido para esta universidad." });
    return;
  }

  if (password.length < 6) {
    sendJson(res, 400, { error: "La contraseña debe tener al menos 6 caracteres." });
    return;
  }

  try {
    const sql = getSql();
    const salt = createSalt();
    const passwordHash = hashPassword(password, salt);
    const result = await sql`
      INSERT INTO users (email, password_hash, salt, university_slug)
      VALUES (${email}, ${passwordHash}, ${salt}, ${slug})
      ON CONFLICT (email) DO NOTHING
      RETURNING email;
    `;

    if (!result.length) {
      sendJson(res, 409, { error: "El correo ya está registrado." });
      return;
    }

    sendJson(res, 200, { email: result[0].email });
  } catch (err) {
    sendJson(res, 500, { error: "Error al registrar el usuario." });
  }
}
