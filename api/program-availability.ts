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
  if (["✓", "✔", "✅"].includes(raw?.trim())) {
    return true;
  }
  if (["no", "false", "0", "no disponible", "inactivo"].includes(normalized)) {
    return false;
  }
  return true;
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

const buildAvailability = (rows: string[][], plantelName: string) => {
  if (!rows.length) return [];
  const normalizedRows = rows.map((row) => row.map((cell) => String(cell ?? "")));
  const headerIndex = normalizedRows.findIndex((row) =>
    row.some((cell) => normalizeText(cell) === "c1 2026")
  );
  if (headerIndex < 0) return [];

  const yearIndex = normalizedRows.findIndex(
    (row, idx) =>
      idx > headerIndex && row.some((cell) => normalizeText(cell) === "2026")
  );
  if (yearIndex < 0) return [];

  const modalidadIndex = yearIndex + 1;
  const modalidadRow = normalizedRows[modalidadIndex] ?? [];
  let escolarizadoCol = modalidadRow.findIndex(
    (cell) => normalizeText(cell) === "escolarizado"
  );
  let ejecutivoCol = modalidadRow.findIndex(
    (cell) => normalizeText(cell) === "ejecutivo"
  );
  if (escolarizadoCol < 0) escolarizadoCol = 2;
  if (ejecutivoCol < 0) ejecutivoCol = 3;

  const horariosIndex = normalizedRows.findIndex((row) =>
    row.some((cell) => normalizeText(cell) === "horarios")
  );
  const scheduleColumns = [7, 8, 9, 10];

  return normalizedRows.slice(modalidadIndex + 1).reduce<any[]>(
    (acc, row, rowIndex) => {
      const programa = String(row[1] ?? "").trim();
      if (!programa) return acc;
      const escolarizadoRaw = String(row[escolarizadoCol] ?? "");
      const ejecutivoRaw = String(row[ejecutivoCol] ?? "");
      const horariosRaw = scheduleColumns
        .map((idx) => String(row[idx] ?? "").trim())
        .filter(Boolean)
        .join(" / ");
      const horario = horariosIndex >= 0 ? horariosRaw : "";

      if (escolarizadoCol >= 0) {
        acc.push({
          id: `sheet-${plantelName}-${rowIndex}-presencial`,
          plantel: plantelName,
          programa,
          modalidad: "presencial",
          horario,
          activo: parseAvailability(escolarizadoRaw),
        });
      }
      if (ejecutivoCol >= 0) {
        acc.push({
          id: `sheet-${plantelName}-${rowIndex}-mixta`,
          plantel: plantelName,
          programa,
          modalidad: "mixta",
          horario,
          activo: parseAvailability(ejecutivoRaw),
        });
      }
      return acc;
    },
    []
  );
};

const fetchAvailability = async () => {
  const token = await getAccessToken();
  const sheetNames = await fetchSheetNames(token);
  const allRows = await Promise.all(
    sheetNames.map(async (sheetName) => ({
      sheetName,
      rows: await fetchSheetValues(token, sheetName),
    }))
  );
  return allRows.flatMap(({ sheetName, rows }) =>
    buildAvailability(rows, sheetName)
  );
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
