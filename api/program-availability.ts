import { GoogleAuth, OAuth2Client } from "google-auth-library";
import { sendJson, setCors } from "../server/auth/response.js";

const SHEET_ID =
  process.env.GOOGLE_SHEET_AVAILABILITY_ID ??
  "1LffTC1go3FFGPcSIEuhK0grDKH2WOEmW79jz_8JrAlo";
const CREDENTIALS = process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON ?? "";
const OAUTH_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID ?? "";
const OAUTH_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "";
const OAUTH_REDIRECT_URL = process.env.GOOGLE_OAUTH_REDIRECT_URL ?? "";
const OAUTH_REFRESH_TOKEN = process.env.GOOGLE_SHEETS_OAUTH_REFRESH_TOKEN ?? "";
const CACHE_TTL_MS = 60_000;

let cache: { timestamp: number; data: any[] } | null = null;

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const parseAvailability = (raw: unknown) => {
  if (raw === true) return true;
  if (raw === false) return false;
  const rawText = String(raw ?? "").trim();
  const normalized = normalizeText(rawText);
  if (!normalized) return false;
  for (const char of rawText) {
    const code = char.codePointAt(0);
    if (code === 0x2713 || code === 0x2714 || code === 0x2705) {
      return true;
    }
  }
  if ("si" === normalized || "true" === normalized || "1" === normalized || "disponible" === normalized || "activo" === normalized || "verdadero" === normalized) {
    return true;
  }
  if ("no" === normalized || "false" === normalized || "0" === normalized || "no disponible" === normalized || "inactivo" === normalized || "falso" === normalized) {
    return false;
  }
  return false;
};
const isTruthyCell = (value: string, needles: string[]) => {
  const normalized = normalizeText(value);
  return needles.some((needle) => normalized.includes(needle));
};



const getAccessToken = async () => {
  if (OAUTH_REFRESH_TOKEN) {
    if (!OAUTH_CLIENT_ID || !OAUTH_CLIENT_SECRET) {
      throw new Error("OAuth client credentials missing.");
    }
    const oauth = new OAuth2Client(
      OAUTH_CLIENT_ID,
      OAUTH_CLIENT_SECRET,
      OAUTH_REDIRECT_URL || undefined
    );
    oauth.setCredentials({ refresh_token: OAUTH_REFRESH_TOKEN });
    const token = await oauth.getAccessToken();
    return typeof token === "string" ? token : token?.token ?? "";
  }

  if (!CREDENTIALS) {
    throw new Error("Missing service account credentials.");
  }
  let parsed: any;
  try {
    parsed = JSON.parse(CREDENTIALS);
  } catch (err) {
    throw new Error("Invalid service account JSON.");
  }
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
    throw new Error(`Failed to load spreadsheet metadata (${response.status}).`);
  }
  const data = (await response.json()) as {
    sheets?: Array<{ properties?: { title?: string } }>;
  };
  return (data.sheets ?? [])
    .map((sheet) => sheet.properties?.title ?? "")
    .filter(Boolean);
};

const fetchSheetValues = async (token: string, sheetName: string) => {
  const range = encodeURIComponent(`${sheetName}!A1:AZ`);
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?valueRenderOption=UNFORMATTED_VALUE`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!response.ok) {
    throw new Error(`Failed to load spreadsheet values (${response.status}).`);
  }
  const data = (await response.json()) as { values?: string[][] };
  return data.values ?? [];
};

const buildAvailability = (
  rows: unknown[][],
  plantelName: string
): { entries: any[]; debug: any } => {
  if (!rows.length) {
    return {
      entries: [],
      debug: { plantel: plantelName, warnings: ["Hoja sin datos."] },
    };
  }
  const normalizedRows = rows.map((row) =>
    row.map((cell) => String(cell ?? ""))
  );
  const warnings: string[] = [];
  const headerIndex = normalizedRows.findIndex((row) => {
    const hasC1 = row.some((cell) => normalizeText(cell).includes("c1"));
    const has2026 = row.some((cell) => normalizeText(cell).includes("2026"));
    return hasC1 && has2026;
  });
  if (headerIndex < 0) {
    return {
      entries: [],
      debug: {
        plantel: plantelName,
        warnings: ["No se encontro el encabezado C1 2026."],
      },
    };
  }

  const yearSearchEnd = Math.min(headerIndex + 6, normalizedRows.length - 1);
  let yearIndex = -1;
  for (let i = headerIndex; i <= yearSearchEnd; i += 1) {
    if (normalizedRows[i].some((cell) => normalizeText(cell) === "2026")) {
      yearIndex = i;
      break;
    }
  }
  if (yearIndex < 0) {
    warnings.push("No se encontro la fila de 2026; se asumio la misma fila.");
    yearIndex = headerIndex;
  }

  const modalidadSearchEnd = Math.min(yearIndex + 4, normalizedRows.length - 1);
  let modalidadIndex = -1;
  for (let i = yearIndex; i <= modalidadSearchEnd; i += 1) {
    if (
      normalizedRows[i].some((cell) =>
        isTruthyCell(cell, ["escolarizado", "ejecutivo"])
      )
    ) {
      modalidadIndex = i;
      break;
    }
  }
  if (modalidadIndex < 0) {
    warnings.push("No se encontro la fila de modalidades; se uso la fila siguiente.");
    modalidadIndex = Math.min(yearIndex + 1, normalizedRows.length - 1);
  }

  const modalidadRow = normalizedRows[modalidadIndex] ?? [];
  const escolarizadoCols = modalidadRow
    .map((cell, idx) => (isTruthyCell(cell, ["escolarizado"]) ? idx : -1))
    .filter((idx) => idx >= 0);
  const ejecutivoCols = modalidadRow
    .map((cell, idx) => (isTruthyCell(cell, ["ejecutivo"]) ? idx : -1))
    .filter((idx) => idx >= 0);
  let escolarizadoCol = escolarizadoCols[0] ?? -1;
  let ejecutivoCol = ejecutivoCols[0] ?? -1;
  if (escolarizadoCol < 0) escolarizadoCol = 2;
  if (ejecutivoCol < 0) ejecutivoCol = 3;

  const headerRow = normalizedRows[headerIndex] ?? [];
  const horariosHeaderCol = headerRow.findIndex(
    (cell) => normalizeText(cell) === "horarios"
  );
  const scheduleEscolarizadoCol =
    horariosHeaderCol >= 0
      ? escolarizadoCols.find((idx) => idx > horariosHeaderCol) ?? -1
      : -1;
  const scheduleEjecutivoCol =
    horariosHeaderCol >= 0
      ? ejecutivoCols.find((idx) => idx > horariosHeaderCol) ?? -1
      : -1;

  const horariosIndex = normalizedRows.findIndex((row) =>
    row.some((cell) => normalizeText(cell) === "horarios")
  );

  const endIndex =
    horariosIndex > modalidadIndex ? horariosIndex : normalizedRows.length;
  const entries = normalizedRows
    .slice(modalidadIndex + 1, endIndex)
    .reduce<any[]>((acc, row, rowIndex) => {
      const programa = String(row[1] ?? row[0] ?? "").trim();
      if (!programa) return acc;
      const programaNorm = normalizeText(programa);
      if (["modular", "longitudinal"].includes(programaNorm)) return acc;
      if (programaNorm === "programa" || programaNorm === "programas") return acc;
      const escolarizadoRaw = row[escolarizadoCol];
      const ejecutivoRaw = row[ejecutivoCol];
      if (escolarizadoCol >= 0) {
        const horarioEscolarizado =
          scheduleEscolarizadoCol >= 0
            ? String(row[scheduleEscolarizadoCol] ?? "").trim()
            : "";
        acc.push({
          id: `sheet-${plantelName}-${rowIndex}-presencial`,
          plantel: plantelName,
          programa,
          modalidad: "presencial",
          horario: horarioEscolarizado,
          activo: parseAvailability(escolarizadoRaw),
        });
      }
      if (ejecutivoCol >= 0) {
        const horarioEjecutivo =
          scheduleEjecutivoCol >= 0
            ? String(row[scheduleEjecutivoCol] ?? "").trim()
            : "";
        acc.push({
          id: `sheet-${plantelName}-${rowIndex}-mixta`,
          plantel: plantelName,
          programa,
          modalidad: "mixta",
          horario: horarioEjecutivo,
          activo: parseAvailability(ejecutivoRaw),
        });
      }
      return acc;
    }, []);

  return {
    entries,
    debug: {
      plantel: plantelName,
      headerIndex,
      yearIndex,
      modalidadIndex,
      escolarizadoCol,
      ejecutivoCol,
      horariosIndex,
      horariosHeaderCol,
      scheduleEscolarizadoCol,
      scheduleEjecutivoCol,
      entries: entries.length,
      warnings,
      sample: entries.slice(0, 5).map((entry) => ({
        programa: entry.programa,
        modalidad: entry.modalidad,
        activo: entry.activo,
        horario: entry.horario,
      })),
    },
  };
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
  const results = allRows.map(({ sheetName, rows }) =>
    buildAvailability(rows, sheetName)
  );
  return {
    availability: results.flatMap((result) => result.entries),
    debug: results.map((result) => result.debug),
  };
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

  const url = new URL(req.url ?? "", "http://localhost");
  const wantsDebug = url.searchParams.get("debug") === "1";
  const noCache = url.searchParams.get("noCache") === "1";
  try {
    if (!noCache && cache && Date.now() - cache.timestamp < CACHE_TTL_MS) {
      sendJson(res, 200, { availability: cache.data });
      return;
    }
    const { availability, debug } = await fetchAvailability();
    cache = { timestamp: Date.now(), data: availability };
    sendJson(res, 200, wantsDebug ? { availability, debug } : { availability });
  } catch (err) {
    const details =
      err instanceof Error ? err.message : "Error desconocido.";
    sendJson(
      res,
      500,
      wantsDebug
        ? { error: "No fue posible leer la disponibilidad.", details }
        : { error: "No fue posible leer la disponibilidad." }
    );
  }
}
