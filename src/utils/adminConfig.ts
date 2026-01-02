export type AdminBenefitRule = {
  modalidad: string;
  plantel: string[] | string;
  lineaNegocio: string;
  activo: boolean;
  porcentaje: number;
  comentario?: string;
};

export type AdminPriceOverride = {
  programa: string;
  nivel: string;
  modalidad: string;
  plan: number;
  plantel: string;
  precioLista: number;
};

export type AdminShortcut = {
  id: string;
  label: string;
  url: string;
  programas: string[];
};

export type AdminMateriaOverride = {
  programa: string;
  modalidad: string;
  plantel: string;
  materias: number;
  precio: number;
};

export type AdminProgramAvailability = {
  id: string;
  plantel: string;
  programa: string;
  modalidad: string;
  horario: string;
  planUrl?: string;
  activo: boolean;
};

export type AdminAdjustment = {
  id: string;
  titulo: string;
  descripcion: string;
  programa: string;
  nivel: string;
  modalidad: string;
  plan: string;
  plantel: string;
  activo: boolean;
  aplica: "ui" | "calculo" | "ambos";
  tipo: "monto" | "porcentaje";
  valor: number;
};

export type AdminConfig = {
  version: number;
  enabled: boolean;
  defaults: {
    beneficio: {
      rules: AdminBenefitRule[];
    };
  };
  priceOverrides: AdminPriceOverride[];
  materiaOverrides: AdminMateriaOverride[];
  shortcuts: AdminShortcut[];
  programAvailability: AdminProgramAvailability[];
  adjustments: AdminAdjustment[];
};

const STORAGE_PREFIX = "recalc_admin_config_cache_";
const EVENT_NAME = "recalc-admin-config-updated";

const emptyConfig = (): AdminConfig => ({
  version: 1,
  enabled: true,
  defaults: {
    beneficio: {
      rules: [],
    },
  },
  priceOverrides: [],
  materiaOverrides: [],
  shortcuts: [],
  programAvailability: [],
  adjustments: [],
});

const normalizeValue = (value: string) => value.trim().toLowerCase();

const normalizeAny = (value: string) => {
  const normalized = normalizeValue(value);
  return normalized === "todos" ? "*" : normalized;
};

const scoreMatch = (value: string, target: string) => {
  if (value === "*") return 1;
  if (value === target) return 2;
  return -1;
};

const normalizeConfig = (config?: AdminConfig | null): AdminConfig => {
  if (!config || typeof config !== "object") return emptyConfig();
  const fallback = emptyConfig();
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
          ? config.defaults.beneficio.rules.map((rule) => {
              const rawPlantel = Array.isArray(rule.plantel)
                ? rule.plantel
                : typeof rule.plantel === "string"
                  ? [rule.plantel]
                  : [];
              const normalizedPlantel = rawPlantel
                .map((entry) => String(entry ?? "").trim())
                .filter(Boolean);
              return {
                modalidad: String(rule.modalidad ?? "*"),
                plantel: normalizedPlantel.length ? normalizedPlantel : ["*"],
                lineaNegocio: String(rule.lineaNegocio ?? "*"),
                activo: typeof rule.activo === "boolean" ? rule.activo : false,
                porcentaje: Number(rule.porcentaje ?? 0),
                comentario: String(rule.comentario ?? ""),
              };
            })
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
          planUrl: String(entry.planUrl ?? ""),
          activo: typeof entry.activo === "boolean" ? entry.activo : true,
        }))
      : [],
    adjustments: Array.isArray(config.adjustments) ? config.adjustments : [],
  };
};

export function getAdminConfig(slug: string): AdminConfig {
  if (typeof window === "undefined") return emptyConfig();
  const key = `${STORAGE_PREFIX}${slug}`;
  const raw = window.localStorage.getItem(key);
  if (!raw) return emptyConfig();
  try {
    const parsed = JSON.parse(raw) as AdminConfig;
    return normalizeConfig(parsed);
  } catch (err) {
    return emptyConfig();
  }
}

export function saveAdminConfig(slug: string, config: AdminConfig) {
  if (typeof window === "undefined") return;
  const key = `${STORAGE_PREFIX}${slug}`;
  window.localStorage.setItem(key, JSON.stringify(config));
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { slug } }));
}

export function clearAdminConfig(slug: string) {
  if (typeof window === "undefined") return;
  const key = `${STORAGE_PREFIX}${slug}`;
  window.localStorage.removeItem(key);
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { slug } }));
}

export async function fetchAdminConfig(slug: string): Promise<AdminConfig> {
  const response = await fetch(
    `/api/admin/config?slug=${encodeURIComponent(slug)}`,
    { method: "GET" }
  );
  if (!response.ok) {
    throw new Error("No fue posible cargar la configuracion admin.");
  }
  const data = (await response.json().catch(() => ({}))) as {
    config?: AdminConfig | null;
  };
  return normalizeConfig(data?.config);
}

export async function updateAdminConfig(
  slug: string,
  email: string,
  config: AdminConfig
): Promise<AdminConfig> {
  const response = await fetch("/api/admin/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug, email, config }),
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(data?.error ?? "No fue posible guardar la configuracion.");
  }
  const data = (await response.json().catch(() => ({}))) as {
    config?: AdminConfig | null;
  };
  return normalizeConfig(data?.config);
}

export function onAdminConfigUpdate(handler: (slug: string) => void) {
  if (typeof window === "undefined") return () => undefined;
  const listener = (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    const detailSlug = String(event.detail?.slug ?? "");
    if (detailSlug) handler(detailSlug);
  };
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}

export function resolveDefaultBenefit(
  config: AdminConfig,
  modalidad: string,
  plantel: string,
  lineaNegocio: string
) {
  if (!config.enabled) return null;
  const normalizedModalidad = normalizeValue(modalidad);
  const normalizedPlantel = normalizeValue(plantel);
  const normalizedLinea = normalizeValue(lineaNegocio);
  let best: AdminBenefitRule | null = null;
  let bestScore = -1;
  config.defaults.beneficio.rules.forEach((rule) => {
    const ruleModalidad = normalizeAny(rule.modalidad);
    const planteles = Array.isArray(rule.plantel)
      ? rule.plantel
      : typeof rule.plantel === "string"
        ? [rule.plantel]
        : [];
    const plantelScore = planteles.reduce((score, entry) => {
      const value = normalizeAny(String(entry ?? ""));
      return Math.max(score, scoreMatch(value, normalizedPlantel));
    }, -1);
    const ruleLinea = normalizeAny(rule.lineaNegocio);
    const modalidadScore = scoreMatch(ruleModalidad, normalizedModalidad);
    const lineaScore = scoreMatch(ruleLinea, normalizedLinea);
    if (modalidadScore < 0 || plantelScore < 0 || lineaScore < 0) return;
    const total = modalidadScore + plantelScore + lineaScore;
    if (total > bestScore) {
      bestScore = total;
      best = rule;
    }
  });
  return best;
}

export function resolvePriceOverride(
  config: AdminConfig,
  criteria: {
    programa: string;
    nivel: string;
    modalidad: string;
    plan: number;
    plantel: string;
  }
) {
  if (!config.enabled) return null;
  const targetPrograma = normalizeValue(criteria.programa);
  const targetNivel = normalizeValue(criteria.nivel);
  const targetModalidad = normalizeValue(criteria.modalidad);
  const targetPlan = Number(criteria.plan);
  const targetPlantel = normalizeValue(criteria.plantel);
  let best: AdminPriceOverride | null = null;
  let bestScore = -1;
  config.priceOverrides.forEach((entry) => {
    if (normalizeValue(entry.programa) !== targetPrograma) return;
    if (normalizeValue(entry.nivel) !== targetNivel) return;
    if (normalizeValue(entry.modalidad) !== targetModalidad) return;
    if (Number(entry.plan) !== targetPlan) return;
    const plantelScore = scoreMatch(normalizeAny(entry.plantel), targetPlantel);
    if (plantelScore < 0) return;
    if (plantelScore > bestScore) {
      bestScore = plantelScore;
      best = entry;
    }
  });
  return best;
}

export function resolveMateriaOverride(
  config: AdminConfig,
  criteria: {
    programa: string;
    modalidad: string;
    plantel: string;
    materias: number;
  }
) {
  if (!config.enabled) return null;
  const targetPrograma = normalizeValue(criteria.programa);
  const targetModalidad = normalizeValue(criteria.modalidad);
  const targetPlantel = normalizeValue(criteria.plantel);
  const targetMaterias = Number(criteria.materias);
  let best: AdminMateriaOverride | null = null;
  let bestScore = -1;
  config.materiaOverrides.forEach((entry) => {
    if (normalizeValue(entry.programa) !== targetPrograma) return;
    if (Number(entry.materias) !== targetMaterias) return;
    const modalidadScore = scoreMatch(
      normalizeAny(entry.modalidad),
      targetModalidad
    );
    if (modalidadScore < 0) return;
    const plantelScore = scoreMatch(
      normalizeAny(entry.plantel),
      targetPlantel
    );
    if (plantelScore < 0) return;
    const total = modalidadScore + plantelScore;
    if (total > bestScore) {
      bestScore = total;
      best = entry;
    }
  });
  return best;
}

const matchField = (value: string, target: string) => {
  const score = scoreMatch(normalizeAny(value), target);
  return score >= 0;
};

const matchPlan = (value: string, target: number) => {
  const normalized = normalizeAny(value);
  if (normalized === "*") return true;
  return Number(normalized) === Number(target);
};

export function resolveAdjustments(
  config: AdminConfig,
  criteria: {
    programa: string;
    nivel: string;
    modalidad: string;
    plan: number;
    plantel: string;
  }
) {
  if (!config.enabled) return [];
  const targetPrograma = normalizeValue(criteria.programa);
  const targetNivel = normalizeValue(criteria.nivel);
  const targetModalidad = normalizeValue(criteria.modalidad);
  const targetPlantel = normalizeValue(criteria.plantel);
  const targetPlan = Number(criteria.plan);
  return config.adjustments.filter((entry) => {
    if (!entry.activo) return false;
    if (!matchField(entry.programa, targetPrograma)) return false;
    if (!matchField(entry.nivel, targetNivel)) return false;
    if (!matchField(entry.modalidad, targetModalidad)) return false;
    if (!matchPlan(entry.plan, targetPlan)) return false;
    if (!matchField(entry.plantel, targetPlantel)) return false;
    return true;
  });
}

export function resolveProgramAvailability(
  config: AdminConfig,
  criteria: { plantel: string },
  entriesOverride?: AdminProgramAvailability[]
) {
  if (!config.enabled) return [];
  const targetPlantel = normalizeValue(criteria.plantel);
  const entries = entriesOverride ?? config.programAvailability;
  return entries.filter((entry) => {
    if (!entry.programa?.trim()) return false;
    return scoreMatch(normalizeAny(entry.plantel), targetPlantel) >= 0;
  });
}
