import { OAuth2Client } from "google-auth-library";
import { setCors } from "../../server/auth/response.js";

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() ?? "";
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() ?? "";
const REDIRECT_URL = process.env.GOOGLE_OAUTH_REDIRECT_URL?.trim() ?? "";

export default function handler(req: any, res: any) {
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
  const client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);
  const url = client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  res.statusCode = 302;
  res.setHeader("Location", url);
  res.end();
}
