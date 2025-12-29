import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import costosMetaData from "../data/costos_2026_meta.json";
import { UNIVERSITY_LABELS } from "../data/authConfig";
import { isAdminEmail } from "../data/adminAccess";
import { getStoredSession } from "../utils/auth";
import {
  AdminBenefitRule,
  AdminConfig,
  AdminPriceOverride,
  AdminShortcut,
  clearAdminConfig,
  fetchAdminConfig,
  getAdminConfig,
  saveAdminConfig,
  updateAdminConfig,
} from "../utils/adminConfig";

type Modalidad = "presencial" | "online" | "mixta";
type Nivel = "licenciatura" | "salud" | "maestria" | "preparatoria";
type Programa = "nuevo" | "regreso" | "academia";

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

const ADMIN_SLUGS = ["unidep", "utc", "ula"];
const ADMIN_LAST_SLUG_KEY = "recalc_admin_last_slug";
const ADMIN_DRAFT_PREFIX = "recalc_admin_draft_";

const emptyConfig = (): AdminConfig => ({
  version: 1,
  enabled: true,
  defaults: { beneficio: { rules: [] } },
  priceOverrides: [],
  shortcuts: [],
});

const buildId = () => `rule-${Date.now()}-${Math.random().toString(16).slice(2)}`;

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

  const loadDraft = (slugValue: string) => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(`${ADMIN_DRAFT_PREFIX}${slugValue}`);
      if (!raw) return null;
      return JSON.parse(raw) as AdminConfig;
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
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
              Descuentos adicionales por defecto
            </h2>
            <p className="text-xs text-slate-400">
              Define el porcentaje y si el descuento extra debe estar activo.
            </p>
          </div>
          <div className="space-y-3">
            {config.defaults.beneficio.rules.map((rule, index) => (
              <div
                key={`${rule.modalidad}-${rule.plantel}-${index}`}
                className="grid gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3 md:grid-cols-[1.1fr_1.3fr_.8fr_.8fr_auto]"
              >
                <select
                  value={rule.modalidad}
                  onChange={(event) =>
                    updateBenefitRule(index, { modalidad: event.target.value })
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
                  value={rule.plantel}
                  onChange={(event) =>
                    updateBenefitRule(index, { plantel: event.target.value })
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
                  value={rule.activo ? "si" : "no"}
                  onChange={(event) =>
                    updateBenefitRule(index, {
                      activo: event.target.value === "si",
                    })
                  }
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
                >
                  <option value="si">Activo</option>
                  <option value="no">Inactivo</option>
                </select>
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
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
                  placeholder="%"
                />
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
                          modalidad: "*",
                          plantel: "*",
                          activo: false,
                          porcentaje: 10,
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
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl space-y-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
              Correcciones rapidas de precio
            </h2>
            <p className="text-xs text-slate-400">
              Sobrescribe precio lista para combinaciones especificas.
            </p>
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
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl space-y-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
              Botones de acceso directo
            </h2>
            <p className="text-xs text-slate-400">
              Crea enlaces directos para compartir o abrir rutas externas.
            </p>
          </div>
          <div className="space-y-3">
            {config.shortcuts.map((shortcut, index) => (
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
            ))}
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
                    },
                  ],
                }))
              }
              className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-300 hover:border-slate-400 hover:text-slate-100 transition"
            >
              Agregar acceso directo
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
