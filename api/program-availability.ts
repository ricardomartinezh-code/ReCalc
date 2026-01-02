import { GoogleAuth, OAuth2Client } from "google-auth-library";
import { sendJson, setCors } from "../server/auth/response.js";
import { getSql } from "../server/auth/db.js";

const SHEET_ID =
  process.env.GOOGLE_SHEET_AVAILABILITY_ID ??
  "1LffTC1go3FFGPcSIEuhK0grDKH2WOEmW79jz_8JrAlo";
const CREDENTIALS = process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON ?? "";
const OAUTH_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() ?? "";
const OAUTH_CLIENT_SECRET =
  process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() ?? "";
const OAUTH_REDIRECT_URL = process.env.GOOGLE_OAUTH_REDIRECT_URL?.trim() ?? "";
const OAUTH_REFRESH_TOKEN =
  process.env.GOOGLE_SHEETS_OAUTH_REFRESH_TOKEN?.trim() ?? "";
const CACHE_TTL_MS = 600_000;

let cache: { timestamp: number; data: any[] } | null = null;

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const toTitleCase = (value: string) =>
  value
    .toLowerCase()
    .split(" ")
    .map((part) => {
      if (!part) return part;
      return part[0].toUpperCase() + part.slice(1);
    })
    .join(" ");

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

const isIgnoredSheet = (sheetName: string) =>
  normalizeText(sheetName) === "oferta general";

const resolveAvailabilityFromRow = (row: string[]) => {
  const normalizedCells = row.map((cell) => normalizeText(cell));
  const valueCell = row.find((cell, idx) => {
    const value = normalizedCells[idx];
    if (!value) return false;
    return (
      value === "true" ||
      value === "false" ||
      value === "si" ||
      value === "no" ||
      value === "1" ||
      value === "0" ||
      value === "verdadero" ||
      value === "falso" ||
      value === "disponible" ||
      value === "no disponible"
    );
  });
  if (valueCell) return parseAvailability(valueCell);
  return true;
};

type SheetLinkData = {
  linksByRow: Map<number, string>;
  linksByCell: Map<string, string>;
  hiddenRows: Set<number>;
};

const buildOnlineAvailability = (
  rows: unknown[][],
  plantelName: string,
  linkData: SheetLinkData
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
  const headerMatches: Array<{
    rowIndex: number;
    colIndex: number;
    label: string;
  }> = [];

  normalizedRows.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      const normalized = normalizeText(cell);
      if (!normalized) return;
      const isOnlineHeader = normalized.includes("online");
      if (!isOnlineHeader) return;
      if (normalized.includes("licenciatura")) {
        headerMatches.push({
          rowIndex,
          colIndex,
          label: "licenciatura online",
        });
        return;
      }
      if (normalized.includes("posgrados") || normalized.includes("maestria")) {
        headerMatches.push({
          rowIndex,
          colIndex,
          label: "posgrados online",
        });
      }
    });
  });

  if (!headerMatches.length) {
    warnings.push("No se encontraron encabezados de online.");
  }

  const entries: any[] = [];
  const sortedHeaders = headerMatches.sort(
    (a, b) => a.rowIndex - b.rowIndex || a.colIndex - b.colIndex
  );

  const resolveLink = (rowIndex: number, colIndex: number) =>
    linkData.linksByCell.get(`${rowIndex}:${colIndex}`) ??
    linkData.linksByRow.get(rowIndex) ??
    "";

  sortedHeaders.forEach((header, idx) => {
    const endRow =
      sortedHeaders.find((next) => next.rowIndex > header.rowIndex)?.rowIndex ??
      normalizedRows.length;
    for (let i = header.rowIndex + 1; i < endRow; i += 1) {
      if (linkData.hiddenRows.has(i)) continue;
      const row = normalizedRows[i] ?? [];
      const cell = row[header.colIndex] ?? "";
      const programa = toTitleCase(String(cell ?? "").trim());
      if (!programa) continue;
      const normalized = normalizeText(programa);
      if (normalized.includes("online") && normalized.includes("licenciatura")) {
        continue;
      }
      if (normalized.includes("online") && normalized.includes("posgrados")) {
        continue;
      }
      if (normalized === "programa" || normalized === "programas") continue;
      const planUrl = resolveLink(i, header.colIndex);
      entries.push({
        id: `sheet-${plantelName}-${header.label}-${i}-${header.colIndex}-online`,
        plantel: plantelName,
        programa,
        modalidad: "online",
        horario: "",
        planUrl,
        activo: true,
      });
    }
  });

  return {
    entries,
    debug: {
      plantel: plantelName,
      mode: "online",
      sections: sortedHeaders.map((header) => ({
        index: header.rowIndex,
        label: header.label,
        col: header.colIndex,
      })),
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




const parseHyperlinkFormula = (formula: string) => {
  const match = formula.match(/HYPERLINK\("([^"]+)"[;,]/i);
  return match ? match[1] : "";
};

const extractCellLink = (cell: any) => {
  if (!cell || typeof cell !== "object") return "";
  if (typeof cell.hyperlink === "string" && cell.hyperlink) {
    return cell.hyperlink;
  }
  const runs = Array.isArray(cell.textFormatRuns) ? cell.textFormatRuns : [];
  for (const run of runs) {
    const uri = run?.format?.link?.uri;
    if (typeof uri === "string" && uri) return uri;
  }
  const formula = cell.userEnteredValue?.formulaValue;
  if (typeof formula === "string" && formula) {
    const link = parseHyperlinkFormula(formula);
    if (link) return link;
  }
  return "";
};

const fetchSheetLinks = async (token: string, sheetName: string) => {
  const range = encodeURIComponent(`${sheetName}!A:Z`);
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?ranges=${range}&includeGridData=true&fields=sheets.data.rowData.values(formattedValue,hyperlink,textFormatRuns,userEnteredValue),sheets.data.rowMetadata(hiddenByUser,hiddenByFilter)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!response.ok) {
    throw new Error(`Failed to load spreadsheet links (${response.status}).`);
  }
  const data = (await response.json()) as any;
  const rowData = data?.sheets?.[0]?.data?.[0]?.rowData ?? [];
  const rowMetadata = data?.sheets?.[0]?.data?.[0]?.rowMetadata ?? [];
  const linksByRow = new Map<number, string>();
  const linksByCell = new Map<string, string>();
  const hiddenRows = new Set<number>();
  rowData.forEach((row: any, index: number) => {
    const values = Array.isArray(row?.values) ? row.values : [];
    values.forEach((cell: any, colIndex: number) => {
      const link = extractCellLink(cell);
      if (!link) return;
      linksByCell.set(`${index}:${colIndex}`, link);
      if (!linksByRow.has(index)) {
        linksByRow.set(index, link);
      }
    });
  });
  rowMetadata.forEach((meta: any, index: number) => {
    if (meta?.hiddenByUser || meta?.hiddenByFilter) {
      hiddenRows.add(index);
    }
  });
  return { linksByRow, linksByCell, hiddenRows };
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
  plantelName: string,
  linkData: SheetLinkData
): { entries: any[]; debug: any } => {
  if (isIgnoredSheet(plantelName)) {
    return {
      entries: [],
      debug: { plantel: plantelName, warnings: ["Hoja ignorada."] },
    };
  }
  if (normalizeText(plantelName).includes("online")) {
    return buildOnlineAvailability(rows, plantelName, linkData);
  }
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

  const headerRow = normalizedRows[headerIndex] ?? [];
  const horariosHeaderCol = headerRow.findIndex(
    (cell) => normalizeText(cell) === "horarios"
  );
  const availabilityEscolarizadoCols =
    horariosHeaderCol >= 0
      ? escolarizadoCols.filter((idx) => idx < horariosHeaderCol)
      : escolarizadoCols;
  const availabilityEjecutivoCols =
    horariosHeaderCol >= 0
      ? ejecutivoCols.filter((idx) => idx < horariosHeaderCol)
      : ejecutivoCols;

  let escolarizadoCol =
    availabilityEscolarizadoCols[0] ?? escolarizadoCols[0] ?? -1;
  let ejecutivoCol =
    availabilityEjecutivoCols[0] ?? ejecutivoCols[0] ?? -1;
  if (escolarizadoCol < 0) escolarizadoCol = 2;
  if (ejecutivoCol < 0) ejecutivoCol = 3;
  const scheduleEscolarizadoCol =
    horariosHeaderCol >= 0
      ? escolarizadoCols.find((idx) => idx > horariosHeaderCol) ?? -1
      : -1;
  const scheduleEjecutivoCol =
    horariosHeaderCol >= 0
      ? ejecutivoCols.find((idx) => idx > horariosHeaderCol) ?? -1
      : -1;
  const scheduleEscolarizadoFallback =
    scheduleEscolarizadoCol >= 0 ? scheduleEscolarizadoCol : 7;
  const scheduleEjecutivoFallback =
    scheduleEjecutivoCol >= 0 ? scheduleEjecutivoCol : 8;

  const horariosIndex = normalizedRows.findIndex((row) =>
    row.some((cell) => normalizeText(cell) === "horarios")
  );

  const endIndex =
    horariosIndex > modalidadIndex ? horariosIndex : normalizedRows.length;
  const entries = normalizedRows
    .slice(modalidadIndex + 1, endIndex)
    .reduce<any[]>((acc, row, rowIndex) => {
      const programa = toTitleCase(String(row[1] ?? row[0] ?? "").trim());
      if (!programa) return acc;
      const programaNorm = normalizeText(programa);
      if (["modular", "longitudinal"].includes(programaNorm)) return acc;
      if (programaNorm === "programa" || programaNorm === "programas") return acc;
      const escolarizadoRaw = row[escolarizadoCol];
      const ejecutivoRaw = row[ejecutivoCol];
      const realRowIndex = modalidadIndex + 1 + rowIndex;
      if (linkData.hiddenRows.has(realRowIndex)) return acc;
      const programCol = row[1] ? 1 : 0;
      const planUrl =
        linkData.linksByCell.get(`${realRowIndex}:${programCol}`) ??
        linkData.linksByRow.get(realRowIndex) ??
        "";
      const escolarizadoActivo =
        escolarizadoCol >= 0 ? parseAvailability(escolarizadoRaw) : false;
      const ejecutivoActivo =
        ejecutivoCol >= 0 ? parseAvailability(ejecutivoRaw) : false;
      if (!escolarizadoActivo && !ejecutivoActivo) {
        return acc;
      }
      if (escolarizadoCol >= 0 && escolarizadoActivo) {
        const horarioEscolarizado =
          scheduleEscolarizadoFallback >= 0
            ? String(row[scheduleEscolarizadoFallback] ?? "").trim()
            : "";
        acc.push({
          id: `sheet-${plantelName}-${rowIndex}-presencial`,
          plantel: plantelName,
          programa,
          modalidad: "presencial",
          horario: horarioEscolarizado,
          planUrl,
          activo: escolarizadoActivo,
        });
      }
      if (ejecutivoCol >= 0 && ejecutivoActivo) {
        const horarioEjecutivo =
          scheduleEjecutivoFallback >= 0
            ? String(row[scheduleEjecutivoFallback] ?? "").trim()
            : "";
        acc.push({
          id: `sheet-${plantelName}-${rowIndex}-mixta`,
          plantel: plantelName,
          programa,
          modalidad: "mixta",
          horario: horarioEjecutivo,
          planUrl,
          activo: ejecutivoActivo,
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
      scheduleEscolarizadoFallback,
      scheduleEjecutivoFallback,
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

const pruneAvailabilityEntries = (entries: any[]) =>
  entries.filter((entry) => {
    if (!entry?.activo) return false;
    const plantel = String(entry?.plantel ?? "").trim();
    const programa = String(entry?.programa ?? "").trim();
    const modalidad = String(entry?.modalidad ?? "").trim();
    return Boolean(plantel && programa && modalidad);
  });

const fetchAvailability = async () => {
  const token = await getAccessToken();
  const sheetNames = await fetchSheetNames(token);
  const allRows = await Promise.all(
    sheetNames.map(async (sheetName) => {
      const [rows, linkData] = await Promise.all([
        fetchSheetValues(token, sheetName),
        fetchSheetLinks(token, sheetName),
      ]);
      return { sheetName, rows, linkData };
    })
  );
  const results = allRows.map(({ sheetName, rows, linkData }) =>
    buildAvailability(rows, sheetName, linkData)
  );
  const availability = results.flatMap((result) => result.entries);
  const debug = results.map((result) => result.debug);

  const normalizeKey = (value: string) =>
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

  const planUrlByProgram = new Map<string, string>();
  availability.forEach((entry) => {
    if (String(entry.modalidad ?? "").toLowerCase() === "online") return;
    const planUrl = String(entry.planUrl ?? "").trim();
    const programKey = normalizeKey(String(entry.programa ?? ""));
    if (!planUrl || !programKey) return;
    if (!planUrlByProgram.has(programKey)) {
      planUrlByProgram.set(programKey, planUrl);
    }
  });

  const missingOnlinePlans = new Set<string>();
  availability.forEach((entry) => {
    if (String(entry.modalidad ?? "").toLowerCase() !== "online") return;
    if (String(entry.planUrl ?? "").trim()) return;
    const programKey = normalizeKey(String(entry.programa ?? ""));
    if (!programKey) return;
    const fallback = planUrlByProgram.get(programKey);
    if (fallback) {
      entry.planUrl = fallback;
    } else {
      missingOnlinePlans.add(String(entry.programa ?? "").trim());
    }
  });

  if (missingOnlinePlans.size) {
    debug.push({
      plantel: "online",
      warnings: [
        "Faltan planes de estudio para programas online.",
        ...Array.from(missingOnlinePlans).sort((a, b) => a.localeCompare(b, "es")),
      ],
    });
  }

  return { availability: pruneAvailabilityEntries(availability), debug };
};

const getAvailabilityCache = async (slug: string) => {
  const sql = await getSql();
  const result = await sql`
    SELECT payload, updated_at
    FROM availability_cache
    WHERE slug = ${slug}
    LIMIT 1;
  `;
  const rows = Array.isArray(result) ? result : (result as any).rows ?? [];
  if (!rows.length) return null;
  return {
    payload: rows[0]?.payload ?? null,
    updatedAt: rows[0]?.updated_at ? new Date(rows[0].updated_at) : null,
  };
};

const saveAvailabilityCache = async (slug: string, payload: any) => {
  const sql = await getSql();
  const result = await sql`
    INSERT INTO availability_cache (slug, payload, updated_at)
    VALUES (${slug}, ${payload}, NOW())
    ON CONFLICT (slug)
    DO UPDATE SET payload = EXCLUDED.payload,
                  updated_at = EXCLUDED.updated_at
    RETURNING updated_at;
  `;
  await sql`
    INSERT INTO availability_cache_history (slug, payload, created_at)
    VALUES (${slug}, ${payload}, NOW());
  `;
  await sql`
    DELETE FROM availability_cache_history
    WHERE slug = ${slug}
      AND id NOT IN (
        SELECT id
        FROM availability_cache_history
        WHERE slug = ${slug}
        ORDER BY created_at DESC
        LIMIT 3
      );
  `;
  const rows = Array.isArray(result) ? result : (result as any).rows ?? [];
  return rows[0]?.updated_at ? new Date(rows[0].updated_at) : new Date();
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
  const wantsRefresh = url.searchParams.get("refresh") === "1";
  const wantsCacheOnly = url.searchParams.get("cache") === "1";
  const slug = String(url.searchParams.get("slug") ?? "unidep")
    .trim()
    .toLowerCase();
  try {
    const cached = await getAvailabilityCache(slug);
    const cacheAge = cached?.updatedAt
      ? Date.now() - cached.updatedAt.getTime()
      : Number.POSITIVE_INFINITY;
    const cacheFresh = cacheAge < CACHE_TTL_MS;

    if ((!wantsRefresh || wantsCacheOnly) && cached?.payload && (cacheFresh || wantsCacheOnly)) {
      const payload = cached.payload as { availability?: any[]; debug?: any[] };
      const availability = pruneAvailabilityEntries(
        Array.isArray(payload.availability) ? payload.availability : []
      );
      sendJson(
        res,
        200,
        wantsDebug
          ? { availability, debug: payload.debug }
          : {
              availability,
              updatedAt: cached.updatedAt?.toISOString() ?? null,
            }
      );
      return;
    }
    if (wantsCacheOnly) {
      sendJson(
        res,
        404,
        wantsDebug
          ? { error: "No hay cache disponible para este slug." }
          : { error: "No hay cache disponible para este slug." }
      );
      return;
    }

    const { availability, debug } = await fetchAvailability();
    const payload = { availability, debug };
    cache = { timestamp: Date.now(), data: availability };
    const updatedAt = await saveAvailabilityCache(slug, payload);
    sendJson(
      res,
      200,
      wantsDebug
        ? { availability, debug, updatedAt: updatedAt.toISOString() }
        : { availability, updatedAt: updatedAt.toISOString() }
    );
  } catch (err) {
    const details =
      err instanceof Error ? err.message : "Error desconocido.";
    const cached = await getAvailabilityCache(
      String(url.searchParams.get("slug") ?? "unidep")
        .trim()
        .toLowerCase()
    );
    if (cached?.payload && details.includes("(429)")) {
      const payload = cached.payload as { availability?: any[]; debug?: any[] };
      const availability = pruneAvailabilityEntries(
        Array.isArray(payload.availability) ? payload.availability : []
      );
      sendJson(
        res,
        200,
        wantsDebug
          ? {
              availability,
              debug: payload.debug,
              warning: "Cuota limitada; se uso cache reciente.",
              details,
            }
          : {
              availability,
              updatedAt: cached.updatedAt?.toISOString() ?? null,
            }
      );
      return;
    }
    if (details.includes("(429)")) {
      sendJson(
        res,
        429,
        wantsDebug
          ? { error: "Cuota limitada de Google Sheets.", details }
          : { error: "Cuota limitada de Google Sheets." }
      );
      return;
    }
    sendJson(
      res,
      500,
      wantsDebug
        ? { error: "No fue posible leer la disponibilidad.", details }
        : { error: "No fue posible leer la disponibilidad." }
    );
  }
}
