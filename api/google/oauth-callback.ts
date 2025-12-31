import { OAuth2Client } from "google-auth-library";
import { setCors } from "../../server/auth/response.js";

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "";
const REDIRECT_URL = process.env.GOOGLE_OAUTH_REDIRECT_URL ?? "";

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

export default async function handler(req: any, res: any) {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URL) {
    res.statusCode = 500;
    res.end("OAuth client not configured.");
    return;
  }
  const code = String(req.query?.code ?? "");
  if (!code) {
    res.statusCode = 400;
    res.end("Missing code.");
    return;
  }
  try {
    const client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);
    const { tokens } = await client.getToken(code);
    const refreshToken = tokens.refresh_token ?? "";
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(`<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>OAuth ReCalc</title>
    <style>
      body { font-family: Arial, sans-serif; background:#0f172a; color:#e2e8f0; padding:24px; }
      .card { max-width: 720px; background:#111827; border:1px solid #334155; border-radius:12px; padding:20px; }
      code { display:block; background:#0b1220; border:1px solid #1e293b; padding:12px; border-radius:8px; color:#f8fafc; word-break: break-all; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Token de actualizacion</h1>
      <p>Guarda este valor en Vercel como <strong>GOOGLE_SHEETS_OAUTH_REFRESH_TOKEN</strong>.</p>
      <code>${escapeHtml(refreshToken || "NO_REFRESH_TOKEN")}</code>
      <p>Si ves NO_REFRESH_TOKEN, vuelve a intentar y asegúrate de aprobar el acceso.</p>
    </div>
  </body>
</html>`);
  } catch (err) {
    res.statusCode = 500;
    res.end("Failed to exchange code.");
  }
}
