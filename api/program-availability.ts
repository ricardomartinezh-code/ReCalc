import { GoogleAuth } from "google-auth-library";
import { sendJson, setCors } from "./auth/response.js";

const SHEET_ID =
  process.env.GOOGLE_SHEET_AVAILABILITY_ID ??
  "1LffTC1go3FFGPcSIEuhK0grDKH2WOEmW79jz_8JrAlo";
const CREDENTIALS = process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON ?? "";
const CACHE_TTL_MS = 60_000;

let cache: { timestamp: number; data: any[] } | null = null;

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const parseAvailability = (raw: string) => {
  const normalized = normalizeText(raw);
  if (!normalized) return true;
  if (["si", "sí", "true", "1", "disponible", "activo"].includes(normalized)) {
    return true;
  }
  if (["no", "false", "0", "no disponible", "inactivo"].includes(normalized)) {
    return false;
  }
  return true;
};

const mapHeaders = (headers: string[]) => {
  let plantelIdx = -1;
  let programaIdx = -1;
  let disponibilidadIdx = -1;

  headers.forEach((raw, index) => {
    const header = normalizeText(raw);
    if (plantelIdx < 0 && header.includes("plantel")) plantelIdx = index;
    if (
      programaIdx < 0 &&
      (header.includes("programa") ||
        header.includes("licenciatura") ||
        header.includes("carrera"))
    ) {
      programaIdx = index;
    }
    if (
      disponibilidadIdx < 0 &&
      (header.includes("dispon") ||
        header.includes("estatus") ||
        header.includes("activo"))
    ) {
      disponibilidadIdx = index;
    }
  });

  return { plantelIdx, programaIdx, disponibilidadIdx };
};

const getAccessToken = async () => {
  if (!CREDENTIALS) throw new Error("Missing service account credentials.");
  const parsed = JSON.parse(CREDENTIALS);
  const auth = new GoogleAuth({
    credentials: parsed,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  return typeof token === "string" ? token : token?.token ?? "";
};

const fetchSheetNames = async (token: string) => {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets.properties.title`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!response.ok) {
    throw new Error("Failed to load spreadsheet metadata.");
  }
  const data = (await response.json()) as {
    sheets?: Array<{ properties?: { title?: string } }>;
  };
  return (data.sheets ?? [])
    .map((sheet) => sheet.properties?.title ?? "")
    .filter(Boolean);
};

const fetchSheetValues = async (token: string, sheetName: string) => {
  const range = encodeURIComponent(`${sheetName}!A1:Z`);
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!response.ok) {
    throw new Error("Failed to load spreadsheet values.");
  }
  const data = (await response.json()) as { values?: string[][] };
  return data.values ?? [];
};

const buildAvailability = (rows: string[][]) => {
  if (!rows.length) return [];
  const headers = rows[0] ?? [];
  const { plantelIdx, programaIdx, disponibilidadIdx } = mapHeaders(headers);
  if (plantelIdx < 0 || programaIdx < 0) return [];

  return rows.slice(1).reduce<any[]>((acc, row, rowIndex) => {
    const plantel = String(row[plantelIdx] ?? "").trim();
    const programa = String(row[programaIdx] ?? "").trim();
    if (!plantel || !programa) return acc;
    const disponibilidadRaw =
      disponibilidadIdx >= 0 ? String(row[disponibilidadIdx] ?? "") : "";
    acc.push({
      id: `sheet-${rowIndex}`,
      plantel,
      programa,
      activo: parseAvailability(disponibilidadRaw),
    });
    return acc;
  }, []);
};

const fetchAvailability = async () => {
  const token = await getAccessToken();
  const sheetNames = await fetchSheetNames(token);
  const allRows = await Promise.all(
    sheetNames.map((sheetName) => fetchSheetValues(token, sheetName))
  );
  return allRows.flatMap((rows) => buildAvailability(rows));
};

export default async function handler(req: any, res: any) {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Metodo no permitido." });
    return;
  }

  try {
    if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS) {
      sendJson(res, 200, { availability: cache.data });
      return;
    }
    const availability = await fetchAvailability();
    cache = { timestamp: Date.now(), data: availability };
    sendJson(res, 200, { availability });
  } catch (err) {
    sendJson(res, 500, { error: "No fue posible leer la disponibilidad." });
  }
}
