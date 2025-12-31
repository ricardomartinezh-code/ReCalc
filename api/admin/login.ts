import { isAdminEmail } from "../auth/admin.js";
import { sendJson, setCors } from "../auth/response.js";

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
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  if (!email || !password) {
    sendJson(res, 400, { error: "Correo y contrasena requeridos." });
    return;
  }

  if (!isAdminEmail(email)) {
    sendJson(res, 403, { error: "Acceso no autorizado." });
    return;
  }

  const expected = String(process.env.ADMIN_PANEL_PASSWORD ?? "");
  if (!expected) {
    sendJson(res, 500, { error: "Credenciales admin no configuradas." });
    return;
  }

  if (password.trim() !== expected) {
    sendJson(res, 401, { error: "Credenciales invalidas." });
    return;
  }

  sendJson(res, 200, { ok: true });
}
