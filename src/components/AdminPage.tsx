import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import costosMetaData from "../data/costos_2026_meta.json";
import { UNIVERSITY_LABELS } from "../data/authConfig";
import { isAdminEmail } from "../data/adminAccess";
import { getStoredSession } from "../utils/auth";
import {
  AdminBenefitRule,
  AdminConfig,
  AdminAdjustment,
  AdminMateriaOverride,
  AdminPriceOverride,
  AdminProgramAvailability,
  AdminShortcut,
  clearAdminConfig,
  fetchAdminConfig,
  getAdminConfig,
  resolveDefaultBenefit,
  saveAdminConfig,
  updateAdminConfig,
} from "../utils/adminConfig";

type Modalidad = "presencial" | "online" | "mixta";
type Nivel = "licenciatura" | "salud" | "maestria" | "preparatoria";
type Programa = "nuevo" | "regreso" | "academia";
type AvailabilityDebugEntry = {
  plantel: string;
  headerIndex?: number;
  yearIndex?: number;
  modalidadIndex?: number;
  escolarizadoCol?: number;
  ejecutivoCol?: number;
  horariosIndex?: number;
  horariosHeaderCol?: number;
  scheduleEscolarizadoCol?: number;
  scheduleEjecutivoCol?: number;
  entries?: number;
  warnings?: string[];
  sample?: Array<{
    programa?: string;
    modalidad?: string;
    activo?: boolean;
    horario?: string;
  }>;
};

const modalidadOptions: Array<{ value: string; label: string }> = [
  { value: "*", label: "Todas" },
  { value: "presencial", label: "Presencial" },
  { value: "online", label: "Online" },
  { value: "mixta", label: "Mixta" },
];

const nivelOptions: Array<{ value: Nivel; label: string }> = [
  { value: "licenciatura", label: "Licenciatura" },
  { value: "salud", label: "Salud" },
  { value: "maestria", label: "Maestria" },
  { value: "preparatoria", label: "Preparatoria" },
];

const programaOptions: Array<{ value: Programa; label: string }> = [
  { value: "nuevo", label: "Nuevo ingreso" },
  { value: "regreso", label: "Regreso" },
  { value: "academia", label: "Academia" },
];

const programaOptionsAll = [
  { value: "*", label: "Todos" },
  ...programaOptions,
];

const nivelOptionsAll = [
  { value: "*", label: "Todos" },
  ...nivelOptions,
];

const lineaOptionsAll = [
  { value: "*", label: "Todas" },
  ...nivelOptions,
];

const ADMIN_SLUGS = ["unidep", "utc", "ula"];
const ADMIN_LAST_SLUG_KEY = "recalc_admin_last_slug";
const ADMIN_DRAFT_PREFIX = "recalc_admin_draft_";

const emptyConfig = (): AdminConfig => ({
  version: 1,
  enabled: true,
  defaults: { beneficio: { rules: [] } },
  priceOverrides: [],
  materiaOverrides: [],
  shortcuts: [],
  programAvailability: [],
  adjustments: [],
});

const buildId = () => `rule-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const normalizeLocalConfig = (config?: AdminConfig | null): AdminConfig => {
  const fallback = emptyConfig();
  if (!config || typeof config !== "object") return fallback;
  return {
    ...fallback,
    ...config,
    enabled:
      typeof config.enabled === "boolean" ? config.enabled : fallback.enabled,
    defaults: {
      ...fallback.defaults,
      ...(config.defaults ?? {}),
      beneficio: {
        ...fallback.defaults.beneficio,
        ...(config.defaults?.beneficio ?? {}),
        rules: Array.isArray(config.defaults?.beneficio?.rules)
          ? config.defaults.beneficio.rules
          : [],
      },
    },
    priceOverrides: Array.isArray(config.priceOverrides)
      ? config.priceOverrides
      : [],
    materiaOverrides: Array.isArray(config.materiaOverrides)
      ? config.materiaOverrides
      : [],
    shortcuts: Array.isArray(config.shortcuts) ? config.shortcuts : [],
    programAvailability: Array.isArray(config.programAvailability)
      ? config.programAvailability.map((entry) => ({
          id: String(entry.id ?? ""),
          plantel: String(entry.plantel ?? ""),
          programa: String(entry.programa ?? ""),
          modalidad: String(entry.modalidad ?? "presencial"),
          horario: String(entry.horario ?? ""),
          activo: typeof entry.activo === "boolean" ? entry.activo : true,
        }))
      : [],
    adjustments: Array.isArray(config.adjustments) ? config.adjustments : [],
  };
};

export default function AdminPage() {
  const { slug } = useParams();
  const normalizedSlug = String(slug ?? "").trim().toLowerCase();
  const session = getStoredSession();

  if (!session) {
    return <Navigate to="/auth/unidep" replace />;
  }

  if (!isAdminEmail(session.email)) {
    return <Navigate to="/" replace />;
  }

  const availableSlugs = useMemo(() => {
    const keys = new Set(Object.keys(UNIVERSITY_LABELS));
    ADMIN_SLUGS.forEach((entry) => keys.add(entry));
    return Array.from(keys).sort((a, b) => a.localeCompare(b, "es"));
  }, []);

  const slugLocked = Boolean(normalizedSlug);

  const getInitialSlug = () => {
    if (normalizedSlug) return normalizedSlug;
    if (session.slug) return session.slug;
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(ADMIN_LAST_SLUG_KEY) ?? "";
  };

  const [activeSlug, setActiveSlug] = useState(getInitialSlug);
  const activeLabel =
    UNIVERSITY_LABELS[activeSlug as keyof typeof UNIVERSITY_LABELS] ??
    activeSlug.toUpperCase();

  const plantelOptions = useMemo(() => {
    const entries = Object.keys(costosMetaData.planteles ?? {});
    return entries.sort((a, b) => a.localeCompare(b, "es"));
  }, []);

  const [config, setConfig] = useState<AdminConfig>(() =>
    getAdminConfig(activeSlug || normalizedSlug)
  );
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [availabilityDebug, setAvailabilityDebug] = useState<
    AvailabilityDebugEntry[] | null
  >(null);
  const [availabilityEntries, setAvailabilityEntries] = useState<
    AdminProgramAvailability[]
  >([]);
  const [availabilityUpdatedAt, setAvailabilityUpdatedAt] = useState("");
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");
  const [availabilityFetchedAt, setAvailabilityFetchedAt] = useState("");
  const [previewLinea, setPreviewLinea] = useState<Nivel | "*">("licenciatura");
  const [previewModalidad, setPreviewModalidad] = useState("presencial");
  const [previewPlantel, setPreviewPlantel] = useState("*");
  const [availabilitySearch, setAvailabilitySearch] = useState("");
  const [availabilityFilterPlantel, setAvailabilityFilterPlantel] =
    useState("*");
  const [availabilityFilterModalidad, setAvailabilityFilterModalidad] =
    useState("*");
  const [availabilityFilterLinea, setAvailabilityFilterLinea] = useState("*");
  const [availabilityCollapsed, setAvailabilityCollapsed] = useState(true);
  const [benefitSearch, setBenefitSearch] = useState("");
  const [benefitFilterActivo, setBenefitFilterActivo] = useState("all");
  const [benefitFilterPlantel, setBenefitFilterPlantel] = useState("*");
  const [benefitFilterModalidad, setBenefitFilterModalidad] = useState("*");
  const [benefitFilterLinea, setBenefitFilterLinea] = useState("*");
  const [benefitCollapsed, setBenefitCollapsed] = useState(true);
  const [benefitPlantelOpen, setBenefitPlantelOpen] = useState<number | null>(
    null
  );
  const [benefitPlantelQuery, setBenefitPlantelQuery] = useState<
    Record<number, string>
  >({});

  const previewRule = useMemo(
    () =>
      resolveDefaultBenefit(
        config,
        previewModalidad,
        previewPlantel,
        previewLinea === "*" ? "*" : previewLinea
      ),
    [config, previewLinea, previewModalidad, previewPlantel]
  );

  const normalizeProgramaText = (value: string) =>
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

  const resolveLineaNegocio = (programa: string) => {
    const normalized = normalizeProgramaText(programa);
    const saludTargets = [
      "enfermeria",
      "fisioterapia",
      "psicologia",
      "nutricion",
    ];
    if (saludTargets.some((target) => normalized.includes(target))) {
      return "salud";
    }
    if (normalized.includes("bachiller")) {
      return "preparatoria";
    }
    if (normalized.includes("maestr")) {
      return "maestria";
    }
    return "licenciatura";
  };

  useEffect(() => {
    if (benefitPlantelOpen === null) return;
    const handlePointerDown = (event: MouseEvent | PointerEvent) => {
      const target = event.target as Element | null;
      if (!target) return;
      const container = target.closest(
        `[data-benefit-plantel-index="${benefitPlantelOpen}"]`
      );
      if (!container) {
        setBenefitPlantelOpen(null);
      }
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [benefitPlantelOpen]);

  const adjustmentFieldClass =
    "w-full md:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.5rem)] rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100";
  const adjustmentWideClass =
    "w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100";

  const loadDraft = (slugValue: string) => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(`${ADMIN_DRAFT_PREFIX}${slugValue}`);
      if (!raw) return null;
      return normalizeLocalConfig(JSON.parse(raw) as AdminConfig);
    } catch (err) {
      return null;
    }
  };

  const saveDraft = (slugValue: string, nextConfig: AdminConfig) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        `${ADMIN_DRAFT_PREFIX}${slugValue}`,
        JSON.stringify(nextConfig)
      );
    } catch (err) {
      // Ignore storage failures
    }
  };

  const clearDraft = (slugValue: string) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(`${ADMIN_DRAFT_PREFIX}${slugValue}`);
    } catch (err) {
      // Ignore storage failures
    }
  };

  const updateConfig = (updater: (prev: AdminConfig) => AdminConfig) => {
    if (!activeSlug) return;
    setConfig((prev) => {
      const next = updater(prev);
      setIsDirty(true);
      saveDraft(activeSlug, next);
      return next;
    });
  };

  const refreshConfig = async () => {
    if (!activeSlug) return;
    if (isDirty) {
      setError("Hay cambios sin guardar. Guarda o limpia antes de actualizar.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const remote = await fetchAdminConfig(activeSlug);
      setConfig(remote);
      saveAdminConfig(activeSlug, remote);
    } catch (err) {
      setError("No fue posible cargar la configuracion del servidor.");
    } finally {
      setLoading(false);
    }
  };

  const refreshAvailabilityDebug = async (
    mode: "refresh" | "cache" | "csv"
  ) => {
    setAvailabilityLoading(true);
    setAvailabilityError("");
    try {
      const endpoint =
        mode === "csv"
          ? `/api/program-availability-csv?debug=1&slug=${encodeURIComponent(
              activeSlug || "unidep"
            )}`
          : `/api/program-availability?debug=1${
              mode === "refresh" ? "&refresh=1" : "&cache=1"
            }&slug=${encodeURIComponent(activeSlug || "unidep")}`;
      const response = await fetch(endpoint, {
        method: mode === "csv" ? "POST" : "GET",
      });
      const data = (await response.json().catch(() => ({}))) as {
        availability?: AdminProgramAvailability[];
        debug?: AvailabilityDebugEntry[];
        warning?: string;
        updatedAt?: string | null;
        error?: string;
        details?: string;
      };
      if (!response.ok) {
        throw new Error(
          data?.details || data?.error || "No fue posible leer disponibilidad."
        );
      }
      setAvailabilityEntries(
        Array.isArray(data.availability) ? data.availability : []
      );
      setAvailabilityDebug(Array.isArray(data.debug) ? data.debug : []);
      setAvailabilityUpdatedAt(data.updatedAt ?? "");
      if (data?.warning) {
        setAvailabilityError(data.warning);
      }
      setAvailabilityFetchedAt(new Date().toLocaleString("es-MX"));
    } catch (err) {
      setAvailabilityError(
        err instanceof Error
          ? err.message
          : "No fue posible leer disponibilidad."
      );
    } finally {
      setAvailabilityLoading(false);
    }
  };

  const loadAvailabilityCache = async () =>
    refreshAvailabilityDebug("cache");

  const refreshAvailabilityFromSheets = async () =>
    refreshAvailabilityDebug("refresh");
  const refreshAvailabilityFromCsv = async () =>
    refreshAvailabilityDebug("csv");

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!activeSlug) return;
      setLoading(true);
      setError("");
      setIsDirty(false);
      const cached = getAdminConfig(activeSlug);
      setConfig(cached);
      const draft = loadDraft(activeSlug);
      if (draft) {
        setConfig(draft);
        setIsDirty(true);
        setLoading(false);
        return;
      }
      try {
        const remote = await fetchAdminConfig(activeSlug);
        if (!active) return;
        setConfig(remote);
        saveAdminConfig(activeSlug, remote);
        await loadAvailabilityCache();
      } catch (err) {
        if (!active) return;
        setError("No fue posible cargar la configuracion del servidor.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [activeSlug]);

  useEffect(() => {
    if (!activeSlug || typeof window === "undefined") return;
    window.localStorage.setItem(ADMIN_LAST_SLUG_KEY, activeSlug);
  }, [activeSlug]);

  const updateBenefitRule = (index: number, patch: Partial<AdminBenefitRule>) =>
    updateConfig((prev) => {
      const next = [...prev.defaults.beneficio.rules];
      next[index] = { ...next[index], ...patch };
      return {
        ...prev,
        defaults: {
          ...prev.defaults,
          beneficio: { ...prev.defaults.beneficio, rules: next },
        },
      };
    });

  const normalizeBenefitPlanteles = (value: AdminBenefitRule["plantel"]) => {
    if (Array.isArray(value)) {
      const cleaned = value.map((entry) => String(entry ?? "").trim()).filter(Boolean);
      return cleaned.length ? cleaned : ["*"];
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed ? [trimmed] : ["*"];
    }
    return ["*"];
  };

  const toggleBenefitPlantel = (index: number, plantelValue: string) =>
    updateBenefitRule(index, {
      plantel: (() => {
        const current = normalizeBenefitPlanteles(
          config.defaults.beneficio.rules[index]?.plantel
        );
        if (plantelValue === "*") {
          return ["*"];
        }
        const withoutAll = current.filter((entry) => entry !== "*");
        if (withoutAll.includes(plantelValue)) {
          const next = withoutAll.filter((entry) => entry !== plantelValue);
          return next.length ? next : ["*"];
        }
        return [...withoutAll, plantelValue];
      })(),
    });

  const updateOverride = (index: number, patch: Partial<AdminPriceOverride>) =>
    updateConfig((prev) => {
      const next = [...prev.priceOverrides];
      next[index] = { ...next[index], ...patch };
      return { ...prev, priceOverrides: next };
    });

const updateShortcut = (index: number, patch: Partial<AdminShortcut>) =>
  updateConfig((prev) => {
    const next = [...prev.shortcuts];
    next[index] = { ...next[index], ...patch };
    return { ...prev, shortcuts: next };
  });

  const updateMateriaOverride = (
    index: number,
    patch: Partial<AdminMateriaOverride>
  ) =>
    updateConfig((prev) => {
      const next = [...prev.materiaOverrides];
      next[index] = { ...next[index], ...patch };
      return { ...prev, materiaOverrides: next };
    });

  const updateAdjustment = (index: number, patch: Partial<AdminAdjustment>) =>
    updateConfig((prev) => {
      const next = [...prev.adjustments];
      next[index] = { ...next[index], ...patch };
      return { ...prev, adjustments: next };
    });

  const updateProgramAvailability = (
    index: number,
    patch: Partial<AdminProgramAvailability>
  ) =>
    updateConfig((prev) => {
      const next = [...prev.programAvailability];
      next[index] = { ...next[index], ...patch };
      return { ...prev, programAvailability: next };
    });

  const [availabilityExpanded, setAvailabilityExpanded] = useState<Record<string, boolean>>({});

  const normalizeAvailabilityValue = (value: string) =>
    value.trim().toLowerCase();

  const buildAvailabilityKey = (entry: AdminProgramAvailability) => {
    const plantelKey = normalizeAvailabilityValue(entry.plantel ?? "");
    const programaKey = normalizeAvailabilityValue(entry.programa ?? "");
    const modalidadKey = normalizeAvailabilityValue(entry.modalidad ?? "");
    if (!plantelKey || !programaKey || !modalidadKey) return "";
    return `${plantelKey}::${programaKey}::${modalidadKey}`;
  };

  const findAvailabilityOverrideIndex = (entry: AdminProgramAvailability) =>
    config.programAvailability.findIndex((item) =>
      buildAvailabilityKey(item) === buildAvailabilityKey(entry)
    );

  const upsertAvailabilityOverride = (
    entry: AdminProgramAvailability,
    patch: Partial<AdminProgramAvailability>
  ) =>
    updateConfig((prev) => {
      const next = [...prev.programAvailability];
      const idx = prev.programAvailability.findIndex((item) =>
        buildAvailabilityKey(item) === buildAvailabilityKey(entry)
      );
      if (idx >= 0) {
        next[idx] = { ...next[idx], ...patch };
      } else {
        next.push({
          id: buildId(),
          plantel: entry.plantel ?? "",
          programa: entry.programa ?? "",
          modalidad: entry.modalidad ?? "presencial",
          horario: entry.horario ?? "",
          planUrl: entry.planUrl ?? "",
          activo: typeof entry.activo === "boolean" ? entry.activo : true,
          ...patch,
        });
      }
      return { ...prev, programAvailability: next };
    });

  const removeAvailabilityOverride = (entry: AdminProgramAvailability) =>
    updateConfig((prev) => {
      const next = prev.programAvailability.filter(
        (item) => buildAvailabilityKey(item) !== buildAvailabilityKey(entry)
      );
      return { ...prev, programAvailability: next };
    });

  const handleDeleteAvailability = async (entry: AdminProgramAvailability) => {
    if (!session || !activeSlug) return;
    if (typeof window !== "undefined") {
      const ok = window.confirm(
        "Esto elimina el programa del cache en BD. Â¿Continuar?"
      );
      if (!ok) return;
    }
    setAvailabilityLoading(true);
    setAvailabilityError("");
    try {
      const response = await fetch("/api/admin/availability-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: activeSlug,
          email: session.email,
          entry: {
            plantel: entry.plantel,
            programa: entry.programa,
            modalidad: entry.modalidad,
          },
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        availability?: AdminProgramAvailability[];
        updatedAt?: string | null;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data?.error || "No fue posible eliminar del cache.");
      }
      setAvailabilityEntries(
        Array.isArray(data.availability) ? data.availability : []
      );
      setAvailabilityUpdatedAt(data.updatedAt ?? "");
      setAvailabilityFetchedAt(new Date().toLocaleString("es-MX"));
      updateConfig((prev) => ({
        ...prev,
        programAvailability: prev.programAvailability.filter(
          (item) => buildAvailabilityKey(item) !== buildAvailabilityKey(entry)
        ),
      }));
    } catch (err) {
      setAvailabilityError(
        err instanceof Error
          ? err.message
          : "No fue posible eliminar del cache."
      );
    } finally {
      setAvailabilityLoading(false);
    }
  };

  const availabilityMerged = useMemo(() => {
    const map = new Map<
      string,
      AdminProgramAvailability & { source: "sheet" | "override" | "admin" }
    >();
    availabilityEntries.forEach((entry) => {
      const key = buildAvailabilityKey(entry);
      if (!key) return;
      map.set(key, { ...entry, source: "sheet" });
    });
    config.programAvailability.forEach((entry) => {
      const key = buildAvailabilityKey(entry);
      if (!key) return;
      if (entry.activo === false) {
        map.delete(key);
        return;
      }
      const existing = map.get(key);
      map.set(key, {
        ...existing,
        ...entry,
        planUrl: entry.planUrl?.trim() ? entry.planUrl : existing?.planUrl ?? "",
        source: existing ? "override" : "admin",
      });
    });
    return Array.from(map.values());
  }, [availabilityEntries, config.programAvailability]);

  const availabilityPlantelOptions = useMemo(() => {
    const planteles = new Set<string>();
    availabilityMerged.forEach((entry) => {
      const plantel = String(entry.plantel ?? "").trim();
      if (plantel) planteles.add(plantel);
    });
    return Array.from(planteles).sort((a, b) => a.localeCompare(b, "es"));
  }, [availabilityMerged]);

  const availabilityFiltered = useMemo(() => {
    const search = availabilitySearch.trim().toLowerCase();
    return availabilityMerged.filter((entry) => {
      if (availabilityFilterPlantel !== "*") {
        if (String(entry.plantel ?? "").trim() !== availabilityFilterPlantel) {
          return false;
        }
      }
      if (availabilityFilterModalidad !== "*") {
        if (String(entry.modalidad ?? "").trim() !== availabilityFilterModalidad) {
          return false;
        }
      }
      if (availabilityFilterLinea !== "*") {
        const linea = resolveLineaNegocio(String(entry.programa ?? ""));
        if (linea !== availabilityFilterLinea) return false;
      }
      if (search) {
        const target = `${entry.programa ?? ""} ${entry.plantel ?? ""} ${
          entry.modalidad ?? ""
        }`.toLowerCase();
        if (!target.includes(search)) return false;
      }
      return true;
    });
  }, [
    availabilityMerged,
    availabilitySearch,
    availabilityFilterPlantel,
    availabilityFilterModalidad,
    availabilityFilterLinea,
  ]);

  const availabilityOnlineCounts = useMemo(() => {
    const lic = new Set<string>();
    const mae = new Set<string>();
    availabilityMerged.forEach((entry) => {
      if (String(entry.modalidad ?? "").toLowerCase() !== "online") return;
      const programa = String(entry.programa ?? "").trim();
      if (!programa) return;
      const linea = resolveLineaNegocio(programa);
      if (linea === "licenciatura") lic.add(programa.toLowerCase());
      if (linea === "maestria") mae.add(programa.toLowerCase());
    });
    return { lic: lic.size, mae: mae.size };
  }, [availabilityMerged]);

  const availabilityByPlantel = useMemo(() => {
    const byPlantel = new Map<string, (AdminProgramAvailability & { source: string })[]>();
    availabilityFiltered.forEach((entry) => {
      const plantelKey = String(entry.plantel ?? "").trim();
      if (!plantelKey) return;
      const list = byPlantel.get(plantelKey) ?? [];
      list.push(entry);
      byPlantel.set(plantelKey, list);
    });
    byPlantel.forEach((list, plantelKey) => {
      list.sort((a, b) =>
        String(a.programa ?? "").localeCompare(String(b.programa ?? ""), "es") ||
        String(a.modalidad ?? "").localeCompare(String(b.modalidad ?? ""), "es")
      );
    });
    return byPlantel;
  }, [availabilityFiltered]);

  const availabilityPlantels = useMemo(() => {
    return Array.from(availabilityByPlantel.keys()).sort((a, b) =>
      a.localeCompare(b, "es")
    );
  }, [availabilityByPlantel]);

  const availabilityDebugByPlantel = useMemo(() => {
    const map = new Map<string, AvailabilityDebugEntry>();
    (availabilityDebug ?? []).forEach((entry) => {
      map.set(String(entry.plantel ?? ""), entry);
    });
    return map;
  }, [availabilityDebug]);

  const toggleAvailabilityPlantel = (plantel: string) =>
    setAvailabilityExpanded((prev) => ({
      ...prev,
      [plantel]: !prev[plantel],
    }));

  const handleAddAvailabilityProgram = (plantel: string) =>
    updateConfig((prev) => ({
      ...prev,
      programAvailability: [
        ...prev.programAvailability,
        {
          id: buildId(),
          plantel,
          programa: "Nuevo programa",
          modalidad: "presencial",
          horario: "",
          activo: true,
        },
      ],
    }));

  const clearAvailabilityOverrides = () =>
    updateConfig((prev) => ({
      ...prev,
      programAvailability: [],
    }));

  const benefitRulesFiltered = useMemo(() => {
    const search = benefitSearch.trim().toLowerCase();
    return config.defaults.beneficio.rules.filter((rule) => {
      if (benefitFilterActivo === "active" && !rule.activo) return false;
      if (benefitFilterActivo === "inactive" && rule.activo) return false;
      if (benefitFilterModalidad !== "*" && rule.modalidad !== benefitFilterModalidad) {
        return false;
      }
      if (benefitFilterLinea !== "*" && rule.lineaNegocio !== benefitFilterLinea) {
        return false;
      }
      if (benefitFilterPlantel !== "*") {
        const planteles = normalizeBenefitPlanteles(rule.plantel);
        if (!planteles.includes("*") && !planteles.includes(benefitFilterPlantel)) {
          return false;
        }
      }
      if (search) {
        const target = `${rule.modalidad} ${rule.lineaNegocio} ${rule.porcentaje} ${
          rule.comentario ?? ""
        }`.toLowerCase();
        if (!target.includes(search)) return false;
      }
      return true;
    });
  }, [
    config.defaults.beneficio.rules,
    benefitSearch,
    benefitFilterActivo,
    benefitFilterModalidad,
    benefitFilterLinea,
    benefitFilterPlantel,
  ]);


  const handleSave = async () => {
    if (!session) return;
    if (!activeSlug) {
      setError("Selecciona un slug para guardar.");
      return;
    }
    setSaved(false);
    setSaving(true);
    setError("");
    try {
      const updated = await updateAdminConfig(
        activeSlug,
        session.email,
        config
      );
      setConfig(updated);
      saveAdminConfig(activeSlug, updated);
      setSaved(true);
      setIsDirty(false);
      clearDraft(activeSlug);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No fue posible guardar la configuracion."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!session) return;
    if (!activeSlug) {
      setError("Selecciona un slug para reiniciar.");
      return;
    }
    if (typeof window !== "undefined") {
      const ok = window.confirm(
        "Esto borra los ajustes personalizados y restaura los valores originales. ¿Continuar?"
      );
      if (!ok) return;
    }
    const empty = emptyConfig();
    clearAdminConfig(activeSlug);
    setConfig(empty);
    setSaved(false);
    setSaving(true);
    setError("");
    try {
      const updated = await updateAdminConfig(
        activeSlug,
        session.email,
        empty
      );
      setConfig(updated);
      saveAdminConfig(activeSlug, updated);
      setSaved(true);
      setIsDirty(false);
      clearDraft(activeSlug);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No fue posible reiniciar la configuracion."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-slate-950 text-slate-50 p-4 sm:p-6 md:p-8">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <header className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                Panel admin
              </p>
              <h1 className="text-xl font-semibold text-slate-100">
                {activeSlug ? `${activeLabel} · ${activeSlug}/admin` : "Admin"}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <label className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                  Slug
                </label>
                <select
                  value={activeSlug}
                  onChange={(event) => setActiveSlug(event.target.value)}
                  disabled={slugLocked}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 disabled:cursor-not-allowed disabled:text-slate-500"
                >
                  <option value="" disabled>
                    Selecciona slug
                  </option>
                  {availableSlugs.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <span
                  className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${
                    config.enabled
                      ? "border-emerald-400/50 text-emerald-200"
                      : "border-slate-600 text-slate-400"
                  }`}
                >
                  {config.enabled ? "Activo" : "Inactivo"}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    updateConfig((prev) => ({
                      ...prev,
                      enabled: !prev.enabled,
                    }))
                  }
                  className="rounded-full border border-slate-700 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300 hover:border-slate-400 hover:text-slate-100 transition"
                >
                  {config.enabled ? "Desactivar" : "Activar"}
                </button>
                {isDirty ? (
                  <span className="rounded-full border border-amber-400/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200">
                    Sin guardar
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleReset}
                disabled={saving || loading}
                className={`rounded-xl border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                  saving || loading
                    ? "cursor-not-allowed border-slate-800 text-slate-500"
                    : "border-slate-700 text-slate-300 hover:border-rose-400/70 hover:text-rose-200"
                }`}
              >
                Reset
              </button>
              <button
                type="button"
                onClick={refreshConfig}
                disabled={saving || loading}
                className={`rounded-xl border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                  saving || loading
                    ? "cursor-not-allowed border-slate-800 text-slate-500"
                    : "border-slate-700 text-slate-300 hover:border-slate-400 hover:text-slate-100"
                }`}
              >
                Actualizar ahora
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || loading}
                className={`rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-950 shadow-emerald-500/40 transition ${
                  saving || loading
                    ? "cursor-not-allowed bg-slate-700 text-slate-300"
                    : "bg-emerald-500 hover:bg-emerald-400"
                }`}
              >
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-400">
            Esta configuracion se guarda en el servidor y aplica globalmente.
          </p>
          {loading ? (
            <div className="rounded-xl border border-slate-700/70 bg-slate-950/70 px-3 py-2 text-xs text-slate-300">
              Cargando configuracion...
            </div>
          ) : null}
          {error ? (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              {error}
            </div>
          ) : null}
          {saved ? (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
              Cambios guardados.
            </div>
          ) : null}
        </header>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
                Descuentos adicionales por defecto
              </h2>
              <p className="text-xs text-slate-400">
                Define linea de negocio, modalidad, plantel y porcentaje del descuento.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                updateConfig((prev) => ({
                  ...prev,
                  defaults: {
                    ...prev.defaults,
                    beneficio: {
                      ...prev.defaults.beneficio,
                      rules: [
                        ...prev.defaults.beneficio.rules,
                        {
                          lineaNegocio: "*",
                          modalidad: "*",
                          plantel: ["*"],
                          activo: false,
                          porcentaje: 10,
                          comentario: "",
                        },
                      ],
                    },
                  },
                }))
              }
              className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-300 hover:border-slate-400 hover:text-slate-100 transition"
            >
              Agregar regla
            </button>
          </div>
          <div className="grid gap-2 md:grid-cols-[2fr_1fr_1fr_1fr]">
            <label className="space-y-1 text-[10px] uppercase tracking-[0.2em] text-slate-500">
              <span>Buscar</span>
              <input
                value={benefitSearch}
                onChange={(event) => setBenefitSearch(event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
                placeholder="Buscar comentario o regla..."
              />
            </label>
            <label className="space-y-1 text-[10px] uppercase tracking-[0.2em] text-slate-500">
              <span>Linea</span>
              <select
                value={benefitFilterLinea}
                onChange={(event) => setBenefitFilterLinea(event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
              >
                {lineaOptionsAll.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-[10px] uppercase tracking-[0.2em] text-slate-500">
              <span>Modalidad</span>
              <select
                value={benefitFilterModalidad}
                onChange={(event) =>
                  setBenefitFilterModalidad(event.target.value)
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
              >
                {modalidadOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-[10px] uppercase tracking-[0.2em] text-slate-500">
              <span>Plantel</span>
              <select
                value={benefitFilterPlantel}
                onChange={(event) => setBenefitFilterPlantel(event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
              >
                <option value="*">Todos los planteles</option>
                {plantelOptions.map((plantel) => (
                  <option key={plantel} value={plantel}>
                    {plantel}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span>Estado:</span>
              <select
                value={benefitFilterActivo}
                onChange={(event) => setBenefitFilterActivo(event.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-100"
              >
                <option value="all">Todos</option>
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
              </select>
            </div>
            <button
              type="button"
              onClick={() => setBenefitCollapsed((prev) => !prev)}
              className="rounded-full border border-slate-700 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300 hover:border-slate-400 hover:text-slate-100 transition"
            >
              {benefitCollapsed ? "Mostrar resultados" : "Ocultar resultados"}
            </button>
          </div>
          <div className="space-y-3">
            {benefitCollapsed ? (
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-400">
                Resultados ocultos. Usa el buscador o filtros y luego despliega.
              </div>
            ) : null}
            {!benefitCollapsed && (
              <div className="grid grid-cols-2 gap-3 text-[10px] uppercase tracking-[0.2em] text-slate-500 md:grid-cols-[1.1fr_1.1fr_1.3fr_.8fr_.8fr_1.4fr_auto]">
              <span>Linea</span>
              <span>Modalidad</span>
              <span>Plantel</span>
              <span>Estado</span>
              <span>%</span>
              <span>Comentario</span>
              <span></span>
              </div>
            )}
            {!benefitCollapsed &&
              benefitRulesFiltered.map((rule, index) => (
              <div
                key={`${rule.modalidad}-${rule.plantel}-${index}`}
                className="grid gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3 md:grid-cols-[1.1fr_1.1fr_1.3fr_.8fr_.8fr_1.4fr_auto] md:items-center"
              >
                <div className="space-y-1">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500 md:hidden">
                    Linea
                  </span>
                  <select
                    value={rule.lineaNegocio ?? "*"}
                    onChange={(event) =>
                      updateBenefitRule(index, {
                        lineaNegocio: event.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
                  >
                    {nivelOptionsAll.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500 md:hidden">
                    Modalidad
                  </span>
                  <select
                    value={rule.modalidad}
                    onChange={(event) =>
                      updateBenefitRule(index, { modalidad: event.target.value })
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
                  >
                    {modalidadOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500 md:hidden">
                    Plantel
                  </span>
                  <div
                    className="relative"
                    data-benefit-plantel-index={index}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setBenefitPlantelOpen((prev) =>
                          prev === index ? null : index
                        )
                      }
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-left text-xs text-slate-100"
                    >
                      {(() => {
                        const selected = normalizeBenefitPlanteles(rule.plantel);
                        if (selected.includes("*")) return "Todos los planteles";
                        return `${selected.length} plantel${selected.length === 1 ? "" : "es"}`;
                      })()}
                    </button>
                    {benefitPlantelOpen === index ? (
                      <div className="absolute z-20 mt-1 w-full min-w-[220px] rounded-lg border border-slate-700 bg-slate-950/95 p-2 text-xs text-slate-200 shadow-xl">
                        <input
                          type="text"
                          value={benefitPlantelQuery[index] ?? ""}
                          onChange={(event) =>
                            setBenefitPlantelQuery((prev) => ({
                              ...prev,
                              [index]: event.target.value,
                            }))
                          }
                          placeholder="Buscar plantel..."
                          className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 placeholder:text-slate-500"
                        />
                        <label className="mt-2 flex items-center gap-2 rounded-md px-2 py-1 hover:bg-slate-800/70">
                          <input
                            type="checkbox"
                            className="accent-emerald-500"
                            checked={normalizeBenefitPlanteles(rule.plantel).includes("*")}
                            onChange={() => toggleBenefitPlantel(index, "*")}
                          />
                          Todos los planteles
                        </label>
                        <div className="mt-2 max-h-40 overflow-y-auto border-t border-slate-800 pt-2 space-y-1">
                          {plantelOptions
                            .filter((plantel) =>
                              plantel
                                .toLowerCase()
                                .includes(
                                  (benefitPlantelQuery[index] ?? "")
                                    .toLowerCase()
                                    .trim()
                                )
                            )
                            .map((plantel) => (
                              <label
                                key={plantel}
                                className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-slate-800/70"
                              >
                                <input
                                  type="checkbox"
                                  className="accent-emerald-500"
                                  checked={normalizeBenefitPlanteles(rule.plantel).includes(plantel)}
                                  onChange={() => toggleBenefitPlantel(index, plantel)}
                                />
                                {plantel}
                              </label>
                            ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500 md:hidden">
                    Estado
                  </span>
                  <select
                    value={rule.activo ? "si" : "no"}
                    onChange={(event) =>
                      updateBenefitRule(index, {
                        activo: event.target.value === "si",
                      })
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
                  >
                    <option value="si">Activo</option>
                    <option value="no">Inactivo</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500 md:hidden">
                    %
                  </span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={rule.porcentaje}
                    onChange={(event) =>
                      updateBenefitRule(index, {
                        porcentaje: Number(event.target.value || 0),
                      })
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
                    placeholder="%"
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500 md:hidden">
                    Comentario
                  </span>
                  <input
                    value={rule.comentario ?? ""}
                    onChange={(event) =>
                      updateBenefitRule(index, { comentario: event.target.value })
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
                    placeholder="Comentario (opcional)"
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    updateConfig((prev) => ({
                      ...prev,
                      defaults: {
                        ...prev.defaults,
                        beneficio: {
                          ...prev.defaults.beneficio,
                          rules: prev.defaults.beneficio.rules.filter(
                            (_, idx) => idx !== index
                          ),
                        },
                      },
                    }))
                  }
                  className="rounded-lg border border-slate-700 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-300 hover:border-rose-400/70 hover:text-rose-200 transition"
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-200">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
              Vista previa en UI publica
            </p>
            <div className="mt-2 grid gap-2 md:grid-cols-3">
              <select
                value={previewLinea}
                onChange={(event) => setPreviewLinea(event.target.value as Nivel | "*")}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
              >
                {nivelOptionsAll.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={previewModalidad}
                onChange={(event) => setPreviewModalidad(event.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
              >
                {modalidadOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={previewPlantel}
                onChange={(event) => setPreviewPlantel(event.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
              >
                <option value="*">Todos los planteles</option>
                {plantelOptions.map((plantel) => (
                  <option key={plantel} value={plantel}>
                    {plantel}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-3 rounded-lg border border-slate-800/80 bg-slate-900/40 px-3 py-2">
              {previewRule ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-emerald-500/50 px-2 py-0.5 text-[10px] uppercase tracking-wide text-emerald-200">
                    {previewRule.activo ? "Activo" : "Inactivo"}
                  </span>
                  <span className="text-xs text-slate-100">
                    {previewRule.porcentaje}% de beneficio
                  </span>
                  {previewRule.comentario ? (
                    <span className="text-[11px] text-amber-100">
                      {previewRule.comentario}
                    </span>
                  ) : null}
                </div>
              ) : (
                <span className="text-xs text-slate-400">
                  Sin beneficio configurado para esta combinacion.
                </span>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
                Disponibilidad de programas (Sheets + overrides)
              </h2>
              <p className="text-xs text-slate-400">
                Diagnostico de lectura y ajustes manuales por plantel.
              </p>
              {availabilityUpdatedAt ? (
                <p className="mt-1 text-[11px] text-slate-500">
                  Ultima actualizacion cache:{" "}
                  {new Date(availabilityUpdatedAt).toLocaleString("es-MX")}
                </p>
              ) : null}
              <p className="mt-1 text-[11px] text-slate-500">
                Online: {availabilityOnlineCounts.lic} licenciaturas ·{" "}
                {availabilityOnlineCounts.mae} maestrias
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={loadAvailabilityCache}
                disabled={availabilityLoading}
                className={`rounded-xl border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                  availabilityLoading
                    ? "cursor-not-allowed border-slate-800 text-slate-500"
                    : "border-slate-700 text-slate-300 hover:border-slate-400 hover:text-slate-100"
                }`}
              >
                {availabilityLoading ? "Cargando..." : "Cargar cache"}
              </button>
              <button
                type="button"
                onClick={refreshAvailabilityFromSheets}
                disabled={availabilityLoading}
                className={`rounded-xl border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                  availabilityLoading
                    ? "cursor-not-allowed border-slate-800 text-slate-500"
                    : "border-emerald-500/60 text-emerald-200 hover:border-emerald-300 hover:text-emerald-100"
                }`}
              >
                {availabilityLoading ? "Leyendo..." : "Actualizar lectura"}
              </button>
              <button
                type="button"
                onClick={refreshAvailabilityFromCsv}
                disabled={availabilityLoading}
                className={`rounded-xl border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                  availabilityLoading
                    ? "cursor-not-allowed border-slate-800 text-slate-500"
                    : "border-cyan-500/60 text-cyan-200 hover:border-cyan-300 hover:text-cyan-100"
                }`}
              >
                {availabilityLoading ? "Leyendo..." : "Actualizar desde CSV"}
              </button>
              <button
                type="button"
                onClick={clearAvailabilityOverrides}
                disabled={availabilityLoading}
                className={`rounded-xl border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                  availabilityLoading
                    ? "cursor-not-allowed border-slate-800 text-slate-500"
                    : "border-rose-500/60 text-rose-200 hover:border-rose-300 hover:text-rose-100"
                }`}
              >
                Limpiar overrides
              </button>
              {availabilityFetchedAt ? (
                <span className="text-xs text-slate-400">
                  Ultima lectura: {availabilityFetchedAt}
                </span>
              ) : null}
            </div>
          </div>
          {availabilityError ? (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              {availabilityError}
            </div>
          ) : null}
          <div className="grid gap-2 md:grid-cols-[2fr_1fr_1fr_1fr]">
            <label className="space-y-1 text-[10px] uppercase tracking-[0.2em] text-slate-500">
              <span>Buscar</span>
              <input
                value={availabilitySearch}
                onChange={(event) => setAvailabilitySearch(event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
                placeholder="Buscar programa o plantel..."
              />
            </label>
            <label className="space-y-1 text-[10px] uppercase tracking-[0.2em] text-slate-500">
              <span>Linea</span>
              <select
                value={availabilityFilterLinea}
                onChange={(event) =>
                  setAvailabilityFilterLinea(event.target.value)
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
              >
                {lineaOptionsAll.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-[10px] uppercase tracking-[0.2em] text-slate-500">
              <span>Modalidad</span>
              <select
                value={availabilityFilterModalidad}
                onChange={(event) =>
                  setAvailabilityFilterModalidad(event.target.value)
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
              >
                {modalidadOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-[10px] uppercase tracking-[0.2em] text-slate-500">
              <span>Plantel</span>
              <select
                value={availabilityFilterPlantel}
                onChange={(event) =>
                  setAvailabilityFilterPlantel(event.target.value)
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
              >
                <option value="*">Todos los planteles</option>
                {availabilityPlantelOptions.map((plantel) => (
                  <option key={plantel} value={plantel}>
                    {plantel}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <span>{availabilityFiltered.length} registros coinciden.</span>
            <button
              type="button"
              onClick={() => setAvailabilityCollapsed((prev) => !prev)}
              className="rounded-full border border-slate-700 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300 hover:border-slate-400 hover:text-slate-100 transition"
            >
              {availabilityCollapsed ? "Mostrar resultados" : "Ocultar resultados"}
            </button>
          </div>
          {availabilityPlantels.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-400">
              Sin datos de disponibilidad cargados.
            </div>
          ) : availabilityCollapsed ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-400">
              Resultados ocultos. Usa filtros y despliega cuando necesites.
            </div>
          ) : (
            <div className="space-y-4">
              {availabilityPlantels.map((plantel) => {
                const entries = availabilityByPlantel.get(plantel) ?? [];
                const debug = availabilityDebugByPlantel.get(plantel);
                const expanded = availabilityExpanded[plantel];
                const preview = entries.slice(0, 5);
                return (
                  <div
                    key={plantel}
                    className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-100">
                          {plantel}
                        </p>
                        <p className="text-[11px] uppercase tracking-wide text-slate-400">
                          {entries.length} registros
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => toggleAvailabilityPlantel(plantel)}
                          className="rounded-full border border-slate-700 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300 hover:border-slate-400 hover:text-slate-100 transition"
                        >
                          {expanded ? "Ocultar listado" : "Ver listado completo"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddAvailabilityProgram(plantel)}
                          className="rounded-full border border-slate-700 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300 hover:border-emerald-400/70 hover:text-emerald-200 transition"
                        >
                          Agregar programa
                        </button>
                      </div>
                    </div>
                    {debug?.warnings?.length ? (
                      <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
                        {debug.warnings.join(" ")}
                      </div>
                    ) : null}
                    {!expanded ? (
                      <div className="space-y-2 text-xs text-slate-200">
                        {preview.map((entry, idx) => (
                          <div
                            key={`${plantel}-preview-${idx}`}
                            className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-800/70 bg-slate-900/40 px-3 py-2"
                          >
                            <span className="font-semibold text-slate-100">
                              {entry.programa}
                            </span>
                            <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                              {entry.modalidad}
                            </span>
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                                entry.activo
                                  ? "border-emerald-400/50 text-emerald-200"
                                  : "border-rose-400/50 text-rose-200"
                              }`}
                            >
                              {entry.activo ? "Disponible" : "No disponible"}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {entries.map((entry, idx) => {
                          const isEditable = entry.source === "admin";
                          const isOverride = entry.source === "override";
                          return (
                            <div
                              key={`${plantel}-${idx}`}
                              className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-800/70 bg-slate-900/40 px-3 py-2 text-xs"
                            >
                              {isEditable ? (
                                <input
                                  value={entry.programa}
                                  onChange={(event) =>
                                    updateProgramAvailability(
                                      findAvailabilityOverrideIndex(entry),
                                      { programa: event.target.value }
                                    )
                                  }
                                  className="flex-1 min-w-[220px] rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
                                  placeholder="Programa academico"
                                />
                              ) : (
                                <span className="flex-1 min-w-[220px] font-semibold text-slate-100">
                                  {entry.programa}
                                </span>
                              )}
                              <select
                                value={entry.modalidad}
                                onChange={(event) =>
                                  isEditable
                                    ? updateProgramAvailability(
                                        findAvailabilityOverrideIndex(entry),
                                        { modalidad: event.target.value }
                                      )
                                    : undefined
                                }
                                disabled={!isEditable}
                                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 disabled:cursor-not-allowed disabled:text-slate-500"
                              >
                                <option value="presencial">Escolarizado</option>
                                <option value="mixta">Ejecutivo</option>
                                <option value="online">Online</option>
                              </select>
                              <input
                                value={entry.horario ?? ""}
                                onChange={(event) =>
                                  upsertAvailabilityOverride(entry, {
                                    horario: event.target.value,
                                  })
                                }
                                className="min-w-[220px] flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
                                placeholder="Horario"
                              />
                              <input
                                value={entry.planUrl ?? ""}
                                onChange={(event) =>
                                  upsertAvailabilityOverride(entry, {
                                    planUrl: event.target.value,
                                  })
                                }
                                className="min-w-[220px] flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
                                placeholder="URL plan de estudios"
                              />
                              <label className="flex items-center gap-2 text-[11px] text-slate-300">
                                <input
                                  type="checkbox"
                                  className="accent-emerald-500"
                                  checked={Boolean(entry.activo)}
                                  onChange={(event) =>
                                    upsertAvailabilityOverride(entry, {
                                      activo: event.target.checked,
                                    })
                                  }
                                />
                                Disponible
                              </label>
                              <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                                {isOverride ? "override" : entry.source}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleDeleteAvailability(entry)}
                                className="rounded-lg border border-slate-700 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-300 hover:border-rose-400/70 hover:text-rose-200 transition"
                              >
                                Eliminar
                              </button>
                              {isEditable || isOverride ? (
                                <button
                                  type="button"
                                  onClick={() => removeAvailabilityOverride(entry)}
                                  className="rounded-lg border border-slate-700 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-300 hover:border-slate-400 hover:text-slate-100 transition"
                                >
                                  Quitar override
                                </button>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
                Correcciones de materias (Regresos)
              </h2>
              <p className="text-xs text-slate-400">
                Overrides por materias inscritas. Se aplican sobre los precios base.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                updateConfig((prev) => ({
                  ...prev,
                  materiaOverrides: [
                    ...prev.materiaOverrides,
                    {
                      programa: "regreso",
                      modalidad: "*",
                      plantel: "*",
                      materias: 1,
                      precio: 0,
                    },
                  ],
                }))
              }
              className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-300 hover:border-slate-400 hover:text-slate-100 transition"
            >
              Agregar correccion de materias
            </button>
          </div>
          <div className="space-y-3">
            {(config.materiaOverrides ?? []).map((override, index) => (
              <div
                key={`${override.programa}-${override.materias}-${index}`}
                className="grid gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3 md:grid-cols-[1fr_1fr_1.2fr_.7fr_.9fr_auto]"
              >
                <select
                  value={override.programa}
                  onChange={(event) =>
                    updateMateriaOverride(index, { programa: event.target.value })
                  }
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
                >
                  {programaOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  value={override.modalidad}
                  onChange={(event) =>
                    updateMateriaOverride(index, { modalidad: event.target.value })
                  }
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
                >
                  {modalidadOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  value={override.plantel}
                  onChange={(event) =>
                    updateMateriaOverride(index, { plantel: event.target.value })
                  }
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
                >
                  <option value="*">Todos los planteles</option>
                  {plantelOptions.map((plantel) => (
                    <option key={plantel} value={plantel}>
                      {plantel}
                    </option>
                  ))}
                </select>
                <select
                  value={override.materias}
                  onChange={(event) =>
                    updateMateriaOverride(index, {
                      materias: Number(event.target.value) || 1,
                    })
                  }
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
                >
                  {[1, 2, 3, 4, 5].map((value) => (
                    <option key={value} value={value}>
                      {value} materia{value === 1 ? "" : "s"}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={override.precio}
                  onChange={(event) =>
                    updateMateriaOverride(index, {
                      precio: Number(event.target.value),
                    })
                  }
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
                  placeholder="Precio"
                />
                <button
                  type="button"
                  onClick={() =>
                    updateConfig((prev) => ({
                      ...prev,
                      materiaOverrides: prev.materiaOverrides.filter(
                        (_, idx) => idx !== index
                      ),
                    }))
                  }
                  className="rounded-lg border border-slate-700 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-300 hover:border-rose-400/70 hover:text-rose-200 transition"
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
                Anadir bloque
              </h2>
              <p className="text-xs text-slate-400">
                Agrega tarjetas opcionales que pueden afectar la UI y/o el calculo.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                updateConfig((prev) => ({
                  ...prev,
                  adjustments: [
                    ...prev.adjustments,
                    {
                      id: buildId(),
                      titulo: "Ajuste adicional",
                      descripcion: "",
                      programa: "*",
                      nivel: "*",
                      modalidad: "*",
                      plan: "*",
                      plantel: "*",
                      activo: true,
                      aplica: "ui",
                      tipo: "monto",
                      valor: 0,
                    },
                  ],
                }))
              }
              className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-300 hover:border-slate-400 hover:text-slate-100 transition"
            >
              Agregar bloque
            </button>
          </div>
          <div className="space-y-3">
            {(config.adjustments ?? []).map((adjustment, index) => (
              <div
                key={adjustment.id || `${adjustment.titulo}-${index}`}
                className="flex flex-wrap gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3"
              >
                <input
                  value={adjustment.titulo}
                  onChange={(event) =>
                    updateAdjustment(index, { titulo: event.target.value })
                  }
                  className={adjustmentFieldClass}
                  placeholder="Titulo"
                />
                <input
                  value={adjustment.descripcion}
                  onChange={(event) =>
                    updateAdjustment(index, { descripcion: event.target.value })
                  }
                  className={adjustmentWideClass}
                  placeholder="Descripcion"
                />
                <select
                  value={adjustment.programa}
                  onChange={(event) =>
                    updateAdjustment(index, { programa: event.target.value })
                  }
                  className={adjustmentFieldClass}
                >
                  {programaOptionsAll.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  value={adjustment.nivel}
                  onChange={(event) =>
                    updateAdjustment(index, { nivel: event.target.value })
                  }
                  className={adjustmentFieldClass}
                >
                  {nivelOptionsAll.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  value={adjustment.modalidad}
                  onChange={(event) =>
                    updateAdjustment(index, { modalidad: event.target.value })
                  }
                  className={adjustmentFieldClass}
                >
                  {modalidadOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <input
                  value={adjustment.plan}
                  onChange={(event) =>
                    updateAdjustment(index, { plan: event.target.value })
                  }
                  className={adjustmentFieldClass}
                  placeholder="Plan o *"
                />
                <select
                  value={adjustment.plantel}
                  onChange={(event) =>
                    updateAdjustment(index, { plantel: event.target.value })
                  }
                  className={adjustmentFieldClass}
                >
                  <option value="*">Todos</option>
                  {plantelOptions.map((plantel) => (
                    <option key={plantel} value={plantel}>
                      {plantel}
                    </option>
                  ))}
                </select>
                <select
                  value={adjustment.aplica}
                  onChange={(event) =>
                    updateAdjustment(index, {
                      aplica: event.target.value as AdminAdjustment["aplica"],
                    })
                  }
                  className={adjustmentFieldClass}
                >
                  <option value="ui">Solo UI</option>
                  <option value="calculo">Solo calculo</option>
                  <option value="ambos">UI + calculo</option>
                </select>
                <div className={`flex items-center gap-2 ${adjustmentFieldClass}`}>
                  <select
                    value={adjustment.tipo}
                    onChange={(event) =>
                      updateAdjustment(index, {
                        tipo: event.target.value as AdminAdjustment["tipo"],
                      })
                    }
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
                  >
                    <option value="monto">Monto</option>
                    <option value="porcentaje">%</option>
                  </select>
                  <input
                    type="number"
                    value={adjustment.valor}
                    onChange={(event) =>
                      updateAdjustment(index, {
                        valor: Number(event.target.value),
                      })
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
                    placeholder="Valor"
                  />
                </div>
                <label className="flex w-full items-center gap-2 text-[11px] text-slate-300 md:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.5rem)]">
                  <input
                    type="checkbox"
                    className="accent-emerald-500"
                    checked={adjustment.activo}
                    onChange={(event) =>
                      updateAdjustment(index, { activo: event.target.checked })
                    }
                  />
                  Activo
                </label>
                <button
                  type="button"
                  onClick={() =>
                    updateConfig((prev) => ({
                      ...prev,
                      adjustments: prev.adjustments.filter(
                        (_, idx) => idx !== index
                      ),
                    }))
                  }
                  className="w-full rounded-lg border border-slate-700 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-300 hover:border-rose-400/70 hover:text-rose-200 transition md:w-auto"
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
                Correcciones rapidas de precio
              </h2>
              <p className="text-xs text-slate-400">
                Sobrescribe precio lista para combinaciones especificas.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                updateConfig((prev) => ({
                  ...prev,
                  priceOverrides: [
                    ...prev.priceOverrides,
                    {
                      programa: "nuevo",
                      nivel: "licenciatura",
                      modalidad: "presencial",
                      plan: 1,
                      plantel: "*",
                      precioLista: 0,
                    },
                  ],
                }))
              }
              className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-300 hover:border-slate-400 hover:text-slate-100 transition"
            >
              Agregar correccion
            </button>
          </div>
          <div className="hidden md:grid md:grid-cols-[1fr_1fr_1fr_.7fr_1.3fr_1fr_auto] gap-3 text-[10px] uppercase tracking-[0.2em] text-slate-500">
            <span>Programa</span>
            <span>Nivel</span>
            <span>Modalidad</span>
            <span>Plan</span>
            <span>Plantel</span>
            <span>Precio lista</span>
            <span></span>
          </div>
          <div className="space-y-3">
            {config.priceOverrides.map((override, index) => (
              <div
                key={`${override.programa}-${override.nivel}-${override.plan}-${index}`}
                className="grid gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3 md:grid-cols-[1fr_1fr_1fr_.7fr_1.3fr_1fr_auto]"
              >
                <select
                  value={override.programa}
                  onChange={(event) =>
                    updateOverride(index, {
                      programa: event.target.value,
                    })
                  }
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
                >
                  {programaOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  value={override.nivel}
                  onChange={(event) =>
                    updateOverride(index, { nivel: event.target.value })
                  }
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
                >
                  {nivelOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  value={override.modalidad}
                  onChange={(event) =>
                    updateOverride(index, { modalidad: event.target.value })
                  }
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
                >
                  {modalidadOptions
                    .filter((option) => option.value !== "*")
                    .map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                </select>
                <input
                  type="number"
                  min="1"
                  value={override.plan}
                  onChange={(event) =>
                    updateOverride(index, {
                      plan: Number(event.target.value || 0),
                    })
                  }
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
                  placeholder="Plan"
                />
                <select
                  value={override.plantel}
                  onChange={(event) =>
                    updateOverride(index, { plantel: event.target.value })
                  }
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
                >
                  <option value="*">Todos los planteles</option>
                  {plantelOptions.map((plantel) => (
                    <option key={plantel} value={plantel}>
                      {plantel}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0"
                  value={override.precioLista}
                  onChange={(event) =>
                    updateOverride(index, {
                      precioLista: Number(event.target.value || 0),
                    })
                  }
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
                  placeholder="Precio lista"
                />
                <button
                  type="button"
                  onClick={() =>
                    updateConfig((prev) => ({
                      ...prev,
                      priceOverrides: prev.priceOverrides.filter(
                        (_, idx) => idx !== index
                      ),
                    }))
                  }
                  className="rounded-lg border border-slate-700 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-300 hover:border-rose-400/70 hover:text-rose-200 transition"
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
                Botones de acceso directo
              </h2>
              <p className="text-xs text-slate-400">
                Crea enlaces directos para compartir o abrir rutas externas.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                updateConfig((prev) => ({
                  ...prev,
                  shortcuts: [
                    ...prev.shortcuts,
                    {
                      id: buildId(),
                      label: "Acceso rapido",
                      url: "",
                      programas: ["nuevo", "regreso", "academia"],
                    },
                  ],
                }))
              }
              className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-300 hover:border-slate-400 hover:text-slate-100 transition"
            >
              Agregar acceso directo
            </button>
          </div>
          <div className="space-y-3">
            {config.shortcuts.map((shortcut, index) => {
              const programas =
                shortcut.programas && shortcut.programas.length
                  ? shortcut.programas
                  : ["nuevo", "regreso", "academia"];
              return (
                <div
                  key={shortcut.id || `${shortcut.label}-${index}`}
                  className="grid gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3 md:grid-cols-[1.2fr_2fr_auto]"
                >
                  <input
                    value={shortcut.label}
                    onChange={(event) =>
                      updateShortcut(index, { label: event.target.value })
                    }
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
                    placeholder="Etiqueta"
                  />
                  <input
                    value={shortcut.url}
                    onChange={(event) =>
                      updateShortcut(index, {
                        url: event.target.value,
                      })
                    }
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
                    placeholder="https://..."
                  />
                  <div className="flex flex-wrap items-center gap-2 md:col-span-2">
                    {programaOptions.map((option) => {
                      const selected = programas.includes(option.value);
                      return (
                        <label
                          key={`${shortcut.id}-${option.value}`}
                          className={`flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide transition ${
                            selected
                              ? "border-emerald-500/50 text-emerald-200"
                              : "border-slate-700 text-slate-300"
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="accent-emerald-500"
                            checked={selected}
                            onChange={() => {
                              const current = programas;
                              const next = selected
                                ? current.filter((entry) => entry !== option.value)
                                : [...current, option.value];
                              updateShortcut(index, { programas: next });
                            }}
                          />
                          {option.label}
                        </label>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      updateConfig((prev) => ({
                        ...prev,
                        shortcuts: prev.shortcuts.filter((_, idx) => idx !== index),
                      }))
                    }
                    className="rounded-lg border border-slate-700 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-300 hover:border-rose-400/70 hover:text-rose-200 transition"
                  >
                    Quitar
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
