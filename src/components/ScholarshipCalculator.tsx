import React, { useEffect, useMemo, useState } from "react";
import costosFlatRulesData from "../data/costos_2026_flat_rules.json";
import costosMetaData from "../data/costos_2026_meta.json";
import regresoMateriasData from "../data/regreso_materias.json";
import { clearStoredSession } from "../utils/auth";
import {
  fetchAdminConfig,
  getAdminConfig,
  onAdminConfigUpdate,
  resolveAdjustments,
  resolveDefaultBenefit,
  resolveMateriaOverride,
  resolveProgramAvailability,
  resolvePriceOverride,
} from "../utils/adminConfig";
import type { AdminProgramAvailability } from "../utils/adminConfig";

type Nivel = "licenciatura" | "salud" | "maestria" | "preparatoria";
type Modalidad = "presencial" | "online" | "mixta";
type Tier = "T1" | "T2" | "T3";
type Programa = "nuevo" | "regreso" | "academia";
type ProgramaDataKey = "nuevo_ingreso" | "reingreso";
type UniversityKey = "unidep";

interface RangoPromedio {
  min: number;
  max: number;
}

interface CostoRule {
  nivel: Nivel;
  modalidad: Modalidad;
  plan: number;
  tier?: Tier | null;
  plantel?: string;
  rango: RangoPromedio;
  porcentaje: number;
  monto: number;
  programa: ProgramaDataKey;
  origen?: string;
}

interface CargoItem {
  codigo: string;
  concepto: string;
  costo: number;
}

interface PlantelOfertaItem {
  neto: number;
  becas: Record<string, number>;
}

interface PlantelMeta {
  tier: Tier | null;
  oferta: Partial<Record<Nivel, Record<string, PlantelOfertaItem>>>;
  cargos?: Record<string, CargoItem[]>;
}

interface CostosMeta {
  version: string;
  disponibilidad: Record<string, string[]>;
  planteles: Record<string, PlantelMeta>;
}

interface RegresoMateriasData {
  version: string;
  materias: Record<
    string,
    {
      presencial: Record<string, number>;
      online: Record<string, number>;
    }
  >;
}

const COSTOS_RULES: CostoRule[] = costosFlatRulesData as CostoRule[];
const COSTOS_META: CostosMeta = costosMetaData as CostosMeta;
const REGRESO_MATERIAS: RegresoMateriasData =
  regresoMateriasData as RegresoMateriasData;

const resolveProgramaKey = (p: Programa): ProgramaDataKey =>
  p === "nuevo" ? "nuevo_ingreso" : "reingreso";

const resolveReferenciaRule = (
  rules: CostoRule[],
  plantelValue: string,
  tier?: Tier
) => {
  if (!rules.length) return undefined;
  if (plantelValue) {
    const porPlantel = rules.find((c) => c.plantel === plantelValue);
    if (porPlantel) return porPlantel;
  }
  if (tier) {
    const porTier = rules.find((c) => c.tier === tier && !c.plantel);
    if (porTier) return porTier;
  }
  return rules[0];
};

const normalizarCargos = (cargos: Record<string, CargoItem[]>) => {
  const normalizados = Object.entries(cargos)
    .map(([categoria, items]) => ({
      categoria,
      items: [...items]
        .map((item) => ({
          codigo: item.codigo,
          concepto: item.concepto,
          costo: item.costo,
        }))
        .sort((a, b) => a.codigo.localeCompare(b.codigo, "es")),
    }))
    .sort((a, b) => a.categoria.localeCompare(b.categoria, "es"));
  return JSON.stringify(normalizados);
};

interface ScholarshipCalculatorProps {
  university?: UniversityKey;
  initialProgram?: Programa;
}

interface SearchableSelectProps {
  id: string;
  openId: string | null;
  setOpenId: (id: string | null) => void;
  label: string;
  placeholder?: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  accent?: "emerald" | "violet" | "amber";
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  id,
  openId,
  setOpenId,
  label,
  placeholder = "Selecciona una opción",
  options,
  value,
  onChange,
  disabled,
  accent = "emerald",
}) => {
  const [query, setQuery] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);
  const open = openId === id;
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const listRef = React.useRef<HTMLUListElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const buttonRef = React.useRef<HTMLButtonElement | null>(null);
  const listId = `${id}-listbox`;

  const filteredOptions = useMemo(() => {
    const q = query.toLowerCase();
    return options.filter((opt) => opt.toLowerCase().includes(q));
  }, [options, query]);
  const selectedIndex = useMemo(
    () => filteredOptions.findIndex((opt) => opt === value),
    [filteredOptions, value]
  );

  const selectedLabel = value || placeholder;
  const accentRing =
    accent === "violet"
      ? "focus:ring-violet-400/70"
      : accent === "amber"
        ? "focus:ring-amber-400/70"
        : "focus:ring-emerald-400/70";
  const accentInput =
    accent === "violet"
      ? "focus:border-violet-400 focus:ring-violet-400"
      : accent === "amber"
        ? "focus:border-amber-400 focus:ring-amber-400"
        : "focus:border-emerald-400 focus:ring-emerald-400";
  const accentSelected =
    accent === "violet"
      ? "text-violet-300"
      : accent === "amber"
        ? "text-amber-300"
        : "text-emerald-300";
  const accentTag =
    accent === "violet"
      ? "text-violet-400"
      : accent === "amber"
        ? "text-amber-400"
        : "text-emerald-400";
  const highlightTone =
    accent === "violet"
      ? "bg-violet-500/10 text-violet-200"
      : accent === "amber"
        ? "bg-amber-500/10 text-amber-200"
        : "bg-emerald-500/10 text-emerald-200";

  useEffect(() => {
    if (!open) {
      setQuery("");
      setHighlightIndex(0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const nextIndex = selectedIndex >= 0 ? selectedIndex : 0;
    setHighlightIndex(nextIndex);
  }, [open, selectedIndex]);

  useEffect(() => {
    if (!open) return;
    if (highlightIndex >= filteredOptions.length) {
      setHighlightIndex(Math.max(filteredOptions.length - 1, 0));
      return;
    }
    const list = listRef.current;
    if (!list) return;
    const active = list.querySelector(
      `[data-index="${highlightIndex}"]`
    ) as HTMLElement | null;
    active?.scrollIntoView({ block: "nearest" });
  }, [open, highlightIndex, filteredOptions.length]);

  const commitSelection = (opt: string) => {
    onChange(opt);
    setOpenId(null);
    setQuery("");
  };

  const openDropdown = (focusSearch = false) => {
    if (disabled) return;
    setOpenId(id);
    if (focusSearch && options.length > 6) {
      window.requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      window.requestAnimationFrame(() => buttonRef.current?.focus());
    }
  };

  const stepHighlight = (delta: number) => {
    if (!filteredOptions.length) return;
    setHighlightIndex((prev) => {
      const next = Math.max(0, Math.min(prev + delta, filteredOptions.length - 1));
      return next;
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (disabled) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      if (!open) openDropdown(true);
      else inputRef.current?.focus();
      return;
    }
    if (event.altKey && event.key === "ArrowDown") {
      event.preventDefault();
      openDropdown(true);
      return;
    }
    if (event.altKey && event.key === "ArrowUp") {
      event.preventDefault();
      setOpenId(null);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        openDropdown();
        return;
      }
      stepHighlight(1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        openDropdown();
        return;
      }
      stepHighlight(-1);
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      if (!open) {
        openDropdown();
        return;
      }
      stepHighlight(1);
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      if (!open) {
        openDropdown();
        return;
      }
      stepHighlight(-1);
      return;
    }
    if (event.key === "Home" && open) {
      event.preventDefault();
      setHighlightIndex(0);
      return;
    }
    if (event.key === "End" && open) {
      event.preventDefault();
      setHighlightIndex(Math.max(filteredOptions.length - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      if (!open) {
        event.preventDefault();
        openDropdown();
        return;
      }
      const opt = filteredOptions[highlightIndex];
      if (opt) {
        event.preventDefault();
        commitSelection(opt);
      }
      return;
    }
    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpenId(null);
      return;
    }
    if (!open && event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
      openDropdown(true);
      setQuery(event.key);
    }
  };

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenId(null);
      }
    };

    const onPointerDown = (event: MouseEvent | PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (!containerRef.current) return;
      if (!containerRef.current.contains(target)) {
        setOpenId(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, setOpenId]);

  return (
    <div className="space-y-1 [@media(max-height:700px)]:space-y-0">
      <label className="block text-xs font-medium text-slate-300 uppercase tracking-wide">
        {label}
      </label>
      <div ref={containerRef} className="relative">
        <button
          type="button"
          ref={buttonRef}
          role="combobox"
          aria-controls={listId}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-activedescendant={
            open && filteredOptions[highlightIndex]
              ? `${id}-option-${highlightIndex}`
              : undefined
          }
          className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 hover:-translate-y-[1px] hover:shadow-lg ${
            accentRing
          }
            ${
              disabled
                ? "cursor-not-allowed border-slate-700 bg-slate-800/60 text-slate-500"
                : "border-slate-700 bg-slate-950/60 hover:border-slate-500"
            }
          `}
          onClick={() => {
            if (disabled) return;
            setOpenId(open ? null : id);
          }}
          onKeyDown={handleKeyDown}
        >
          <span className={value ? "text-slate-50" : "text-slate-500"}>
            {selectedLabel}
          </span>
          <svg
            className={`h-4 w-4 text-slate-400 transition-transform ${
              open ? "rotate-180" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M6 9l6 6 6-6"
            />
          </svg>
        </button>

        {open && !disabled && (
          <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-700 bg-slate-950/95 shadow-2xl backdrop-blur-sm recalc-pop">
            {options.length > 6 && (
              <div className="border-b border-slate-800 p-2">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar..."
                  ref={inputRef}
                  onKeyDown={handleKeyDown}
                  className={`w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 ${
                    accentInput
                  }`}
                />
              </div>
            )}
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              className="max-h-60 overflow-y-auto py-1 text-sm"
            >
              {filteredOptions.length === 0 && (
                <li className="px-3 py-2 text-xs text-slate-500">
                  Sin resultados
                </li>
              )}
              {filteredOptions.map((opt, index) => (
                <li key={opt}>
                  <button
                    type="button"
                    id={`${id}-option-${index}`}
                    data-index={index}
                    role="option"
                    aria-selected={opt === value}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition ${
                      index === highlightIndex
                        ? highlightTone
                        : "text-slate-100 hover:bg-slate-800/80"
                    } ${opt === value ? accentSelected : ""}`}
                    onClick={() => {
                      commitSelection(opt);
                    }}
                    onMouseEnter={() => setHighlightIndex(index)}
                  >
                    <span>{opt}</span>
                    {opt === value && (
                      <span
                        className={`text-[10px] uppercase tracking-wide ${accentTag}`}
                      >
                        seleccionado
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

const ScholarshipCalculator: React.FC<ScholarshipCalculatorProps> = ({
  university = "unidep",
  initialProgram,
}) => {
  const [programa, setPrograma] = useState<Programa>(initialProgram ?? "nuevo");
  const [nivel, setNivel] = useState<Nivel | "">("");
  const [modalidad, setModalidad] = useState<Modalidad | "">("");
  const [plan, setPlan] = useState<number | "">("");
  const [plantel, setPlantel] = useState<string>("");
  const [plantelExtras, setPlantelExtras] = useState<string>("");
  const [materiasInscritas, setMateriasInscritas] = useState<number | "">("");
  const [programaAcademico, setProgramaAcademico] = useState<string>("");
  const [promedio, setPromedio] = useState<string>("");

  const [resultadoMonto, setResultadoMonto] = useState<number | null>(null);
  const [resultadoPorcentaje, setResultadoPorcentaje] = useState<number | null>(
    null
  );
  const [resultadoEtiqueta, setResultadoEtiqueta] = useState<string | null>(null);
  const [precioLista, setPrecioLista] = useState<number | null>(null);
  const [error, setError] = useState<string>("");

  const isRegreso = programa === "regreso";
  const isAcademia = programa === "academia";
  const isProgramaExtras = isRegreso || isAcademia;
  const accent = isRegreso ? "violet" : isAcademia ? "amber" : "emerald";
  const extrasTone = isAcademia ? "amber" : "violet";

  const [extrasActivos, setExtrasActivos] = useState(
    initialProgram === "academia"
  );
  const [extrasAbiertos, setExtrasAbiertos] = useState(
    initialProgram === "academia"
  );
  const [extrasSeleccionados, setExtrasSeleccionados] = useState<string[]>([]);
  const [openSelectId, setOpenSelectId] = useState<string | null>(null);
  const [beneficioActivo, setBeneficioActivo] = useState(false);
  const [beneficioPorcentaje, setBeneficioPorcentaje] = useState<number>(10);
  const [adminConfig, setAdminConfig] = useState(() =>
    getAdminConfig(university)
  );
  const [availabilityRemote, setAvailabilityRemote] = useState<
    AdminProgramAvailability[]
  >([]);

  const handleLogout = () => {
    clearStoredSession();
    window.location.assign("/");
  };

  const extrasCatalogo = useMemo(() => {
    const entries = Object.entries(COSTOS_META.planteles ?? {}).filter(
      ([, meta]) => meta?.cargos && Object.keys(meta.cargos).length > 0
    );

    if (entries.length === 0) {
      return {
        planteles: [] as string[],
        baseCargos: null as Record<string, CargoItem[]> | null,
        hasVariaciones: false,
      };
    }

    const contador = new Map<string, number>();
    const cargosPorClave = new Map<string, Record<string, CargoItem[]>>();

    entries.forEach(([plantelKey, meta]) => {
      const cargos = meta.cargos as Record<string, CargoItem[]>;
      const clave = normalizarCargos(cargos);
      contador.set(clave, (contador.get(clave) ?? 0) + 1);
      cargosPorClave.set(clave, cargos);
    });

    let claveBase = "";
    let maxCount = -1;
    contador.forEach((count, key) => {
      if (count > maxCount) {
        maxCount = count;
        claveBase = key;
      }
    });

    return {
      planteles: entries
        .map(([plantelKey]) => plantelKey)
        .sort((a, b) => a.localeCompare(b, "es")),
      baseCargos: claveBase ? cargosPorClave.get(claveBase) ?? null : null,
      hasVariaciones: contador.size > 1,
    };
  }, []);

  const requierePlantel = useMemo(() => {
    if (!nivel || !modalidad) return false;
    return (
      (nivel === "licenciatura" ||
        nivel === "salud" ||
        nivel === "preparatoria") &&
      modalidad !== "online"
    );
  }, [nivel, modalidad]);

  const plantelBaseResolvido = useMemo(() => {
    if (!nivel || !modalidad) return "";
    if (modalidad === "online") return "ONLINE";
    return requierePlantel ? plantel : "";
  }, [nivel, modalidad, requierePlantel, plantel]);

  const tierResolvido = useMemo((): Tier | undefined => {
    if (!requierePlantel) return undefined;
    if (!plantelBaseResolvido) return undefined;
    const tier = COSTOS_META.planteles?.[plantelBaseResolvido]?.tier ?? null;   
    return tier ?? undefined;
  }, [requierePlantel, plantelBaseResolvido]);

  const adminOverride = useMemo(() => {
    if (!nivel || !modalidad || !plan) return null;
    if (requierePlantel && !plantel) return null;
    const plantelKey = modalidad === "online" ? "ONLINE" : plantel;
    return resolvePriceOverride(adminConfig, {
      programa,
      nivel,
      modalidad,
      plan: Number(plan),
      plantel: plantelKey || "",
    });
  }, [adminConfig, nivel, modalidad, plan, plantel, programa, requierePlantel]);

  const nivelesDisponibles = useMemo(() => {
    const set = new Set<Nivel>();
    COSTOS_RULES.forEach((c) => set.add(c.nivel));
    return Array.from(set).sort();
  }, []);

  const modalidadesDisponibles = useMemo(() => {
    if (!nivel) return [];
    const set = new Set<Modalidad>();
    COSTOS_RULES.filter((c) => c.nivel === nivel)
      .forEach((c) => set.add(c.modalidad));
    const modalidades = Array.from(set);
    const filtradas =
      nivel === "salud"
        ? modalidades.filter((m) => m !== "mixta")
        : modalidades;
    const orden: Modalidad[] = ["presencial", "mixta", "online"];
    return filtradas.sort((a, b) => orden.indexOf(a) - orden.indexOf(b));
  }, [nivel]);

  const planesDisponibles = useMemo(() => {
    if (!nivel || !modalidad) return [];
    const set = new Set<number>();
    COSTOS_RULES.filter((c) => c.nivel === nivel && c.modalidad === modalidad)
      .forEach((c) => set.add(c.plan));
    return Array.from(set).sort((a, b) => a - b);
  }, [nivel, modalidad]);

  const plantelesDisponibles = useMemo(() => {
    if (!requierePlantel) {
      return [];
    }

    const key =
      nivel === "licenciatura"
        ? "licenciatura_presencial_mixta"
        : nivel === "salud"
          ? "salud_presencial"
          : "preparatoria_presencial_mixta";

    const lista = COSTOS_META.disponibilidad?.[key] ?? [];
    if (lista.length > 0) {
      return [...lista].sort((a, b) => a.localeCompare(b, "es"));
    }

    const derived = Object.entries(COSTOS_META.planteles ?? {})
      .filter(([plantelKey, meta]) => {
        if (plantelKey === "ONLINE") return false;
        const ofertaNivel = meta?.oferta?.[nivel as Nivel];
        return Boolean(ofertaNivel && Object.keys(ofertaNivel).length > 0);
      })
      .map(([plantelKey]) => plantelKey);

    return derived.sort((a, b) => a.localeCompare(b, "es"));
  }, [nivel, requierePlantel]);

  const extrasPlantelKey = useMemo(() => {
    if (!isAcademia) return plantelBaseResolvido;
    if (plantelExtras) return plantelExtras;
    return "";
  }, [isAcademia, plantelBaseResolvido, plantelExtras]);

  const extrasDisponibles = useMemo(() => {
    if (!isProgramaExtras) return null;
    if (isAcademia) {
      if (extrasPlantelKey) {
        return COSTOS_META.planteles?.[extrasPlantelKey]?.cargos ?? null;
      }
      return extrasCatalogo.baseCargos ?? null;
    }
    if (!plantelBaseResolvido) return null;
    return COSTOS_META.planteles?.[plantelBaseResolvido]?.cargos ?? null;
  }, [
    extrasCatalogo.baseCargos,
    extrasPlantelKey,
    isAcademia,
    isProgramaExtras,
    plantelBaseResolvido,
  ]);

  const extrasOrdenados = useMemo(() => {
    if (!extrasDisponibles) {
      return { principales: [], compactos: [] } as {
        principales: { categoria: string; items: CargoItem[]; count: number }[];
        compactos: { categoria: string; items: CargoItem[]; count: number }[];
      };
    }
    const entries = Object.entries(extrasDisponibles).map(
      ([categoria, items]) => ({
        categoria,
        items,
        count: items.length,
      })
    );
    entries.sort(
      (a, b) => b.count - a.count || a.categoria.localeCompare(b.categoria, "es")
    );
    return {
      principales: entries.filter((entry) => entry.count > 4),
      compactos: entries.filter((entry) => entry.count <= 4),
    };
  }, [extrasDisponibles]);

  const extrasTotal = useMemo(() => {
    if (!isProgramaExtras || !extrasActivos || !extrasDisponibles) return 0;
    const selected = new Set(extrasSeleccionados);
    let total = 0;
    Object.values(extrasDisponibles).forEach((items) => {
      items.forEach((item) => {
        if (selected.has(item.codigo)) total += item.costo;
      });
    });
    return Math.round(total * 100) / 100;
  }, [extrasActivos, extrasDisponibles, extrasSeleccionados, isProgramaExtras]);

  const beneficiosDisponibles = [10, 15, 20, 25, 30];

  const mostrarSelectorExtrasPlantel =
    isAcademia && extrasCatalogo.hasVariaciones;
  const extrasPlantelOpciones = mostrarSelectorExtrasPlantel
    ? ["Base general", ...extrasCatalogo.planteles]
    : [];
  const extrasPlantelEtiqueta = isAcademia
    ? extrasPlantelKey ||
      (mostrarSelectorExtrasPlantel ? "Base general" : "General")
    : plantelBaseResolvido || (requierePlantel ? "Selecciona uno" : "—");
  const extrasToggleDisabled =
    !extrasDisponibles || (!isAcademia && !plantelBaseResolvido);
  const extrasFaltaPlantel =
    !isAcademia && requierePlantel && !plantelBaseResolvido;

  useEffect(() => {
    setExtrasSeleccionados([]);
  }, [extrasPlantelKey]);

  useEffect(() => {
    if (!initialProgram) return;
    setPrograma(initialProgram);
    const activarExtras = initialProgram === "academia";
    setExtrasActivos(activarExtras);
    setExtrasAbiertos(activarExtras);
    setExtrasSeleccionados([]);
    setBeneficioActivo(false);
    setBeneficioPorcentaje(10);
    setPlantelExtras("");
  }, [initialProgram]);

  useEffect(() => {
    let active = true;
    const loadRemote = async () => {
      try {
        const remote = await fetchAdminConfig(university);
        if (active) setAdminConfig(remote);
      } catch (err) {
        if (active) setAdminConfig(getAdminConfig(university));
      }
    };
    setAdminConfig(getAdminConfig(university));
    void loadRemote();
    const interval = window.setInterval(loadRemote, 10000);
    const unsubscribe = onAdminConfigUpdate((slug) => {
      if (slug === university) {
        setAdminConfig(getAdminConfig(university));
      }
    });
    return () => {
      active = false;
      window.clearInterval(interval);
      unsubscribe();
    };
  }, [university]);

  useEffect(() => {
    let active = true;
    const loadAvailability = async () => {
      try {
        const response = await fetch(
          `/api/program-availability?slug=${encodeURIComponent(university)}`
        );
        if (!response.ok) return;
        const data = (await response.json().catch(() => ({}))) as {
          availability?: AdminProgramAvailability[];
        };
        if (!active) return;
        if (Array.isArray(data.availability)) {
          setAvailabilityRemote(data.availability);
        }
      } catch (err) {
        // Ignore availability failures
      }
    };
    void loadAvailability();
    const interval = window.setInterval(loadAvailability, 60000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [university]);

  const benefitRule = useMemo(() => {
    if (!modalidad || isRegreso) return null;
    const plantelKey = modalidad === "online" ? "ONLINE" : plantel;
    const lineaNegocio = nivel || "*";
    return resolveDefaultBenefit(
      adminConfig,
      modalidad,
      plantelKey || "",
      lineaNegocio
    );
  }, [adminConfig, modalidad, plantel, nivel, isRegreso]);

  const benefitComment = useMemo(() => {
    if (!benefitRule?.comentario) return "";
    return benefitRule.comentario.trim();
  }, [benefitRule]);

  useEffect(() => {
    if (!modalidad || isRegreso) return;
    if (!benefitRule) {
      setBeneficioActivo(false);
      setBeneficioPorcentaje(10);
      return;
    }
    setBeneficioActivo(benefitRule.activo);
    setBeneficioPorcentaje(benefitRule.porcentaje);
  }, [benefitRule, modalidad, isRegreso]);

  useEffect(() => {
    if (!nivel || !modalidad || !plan) {
      setPrecioLista(null);
      return;
    }

    if (requierePlantel && !plantel) {
      setPrecioLista(null);
      return;
    }

    const plantelKey = modalidad === "online" ? "ONLINE" : plantel;

    if (adminOverride && Number.isFinite(adminOverride.precioLista)) {
      setPrecioLista(Math.round(adminOverride.precioLista * 100) / 100);
      return;
    }

    if (isRegreso && nivel === "licenciatura") {
      if (!materiasInscritas) {
        setPrecioLista(null);
        return;
      }
      const modalidadKey = modalidad === "online" ? "online" : "presencial";
      const materiaOverride = resolveMateriaOverride(adminConfig, {
        programa,
        modalidad,
        plantel: plantelKey || "",
        materias: Number(materiasInscritas),
      });
      if (materiaOverride && Number.isFinite(materiaOverride.precio)) {
        setPrecioLista(Math.round(materiaOverride.precio * 100) / 100);
        return;
      }
      const materiasValue =
        REGRESO_MATERIAS.materias?.[plantelKey]?.[modalidadKey]?.[
          String(materiasInscritas)
        ];
      if (typeof materiasValue === "number") {
        setPrecioLista(Math.round(materiasValue * 100) / 100);
        return;
      }
    }

    const oferta =
      plantelKey && COSTOS_META.planteles?.[plantelKey]?.oferta?.[nivel]?.[
        String(plan)
      ];

    if (typeof oferta?.neto === "number") {
      setPrecioLista(Math.round(oferta.neto * 100) / 100);
      return;
    }

    const programaKey = resolveProgramaKey(programa);
    const baseRules = COSTOS_RULES.filter((c) => {
      if (c.programa !== programaKey) return false;
      return c.nivel === nivel && c.modalidad === modalidad && c.plan === plan;
    });
    const referencia = resolveReferenciaRule(
      baseRules,
      requierePlantel ? plantel : "",
      tierResolvido
    );

    if (!referencia || referencia.porcentaje >= 100) {
      setPrecioLista(null);
      return;
    }

    const base = referencia.monto / (1 - referencia.porcentaje / 100);
    setPrecioLista(Math.round(base * 100) / 100);
  }, [
    nivel,
    modalidad,
    plan,
    plantel,
    requierePlantel,
    tierResolvido,
    programa,
    adminOverride,
    materiasInscritas,
    isRegreso,
  ]);

  const handleCalcular = () => {
    setError("");
    setResultadoMonto(null);
    setResultadoPorcentaje(null);
    setResultadoEtiqueta(null);

    if (!nivel || !modalidad || !plan) {
      setError("Completa nivel, modalidad y plan de estudios.");
      return;
    }

    if (requierePlantel && !plantel) {
      setError("Selecciona un plantel para esta línea de negocio.");
      return;
    }

    if (isRegreso && nivel === "licenciatura" && !materiasInscritas) {
      setError("Selecciona las materias inscritas.");
      return;
    }

    if (!promedio) {
      setError("Ingresa el promedio del estudiante.");
      return;
    }

    const promedioNumRaw = Number(String(promedio).replace(",", "."));
    if (Number.isNaN(promedioNumRaw) || promedioNumRaw <= 0 || promedioNumRaw > 10) {
      setError("Ingresa un promedio válido entre 0 y 10.");
      return;
    }

    const promedioNum = Math.round(promedioNumRaw * 10) / 10;
    const sinAccesoBeca = promedioNum < 7;

    const programaKey = resolveProgramaKey(programa);
    const plantelKey = modalidad === "online" ? "ONLINE" : plantel;
    const oferta =
      plantelKey && COSTOS_META.planteles?.[plantelKey]?.oferta?.[nivel]?.[
        String(plan)
      ];

    const baseRules = COSTOS_RULES.filter((c) => {
      if (c.programa !== programaKey) return false;
      return c.nivel === nivel && c.modalidad === modalidad && c.plan === plan;
    });
    const tieneReglaPlantel = Boolean(
      plantel && baseRules.some((rule) => rule.plantel === plantel)
    );
    const tieneOferta = typeof oferta?.neto === "number";

    if (
      requierePlantel &&
      modalidad !== "online" &&
      !tierResolvido &&
      !tieneReglaPlantel &&
      !tieneOferta
    ) {
      setError("No se encontró el tier para el plantel seleccionado.");
      return;
    }
    let candidatos = baseRules;
    if (requierePlantel && plantel) {
      const porPlantel = baseRules.filter((c) => c.plantel === plantel);
      if (porPlantel.length) {
        candidatos = porPlantel;
      } else if (tierResolvido) {
        candidatos = baseRules.filter(
          (c) => c.tier === tierResolvido && !c.plantel
        );
      }
    }

    const match = sinAccesoBeca
      ? undefined
      : candidatos.find((c) => {
          const min = c.rango.min - 1e-6;
          const max = c.rango.max + 1e-6;
          return promedioNum >= min && promedioNum <= max;
        });

    if (!sinAccesoBeca && !match) {
      setError(
        "No se encontró un costo para esa combinación de datos, programa y promedio."
      );
      return;
    }

    let porcentajeAplicado = match ? match.porcentaje : 0;
    if (isProgramaExtras) {
      porcentajeAplicado = Math.min(porcentajeAplicado, 25);
    }

    const materiaOverride =
      isRegreso && nivel === "licenciatura" && materiasInscritas
        ? resolveMateriaOverride(adminConfig, {
            programa,
            modalidad,
            plantel: plantelKey || "",
            materias: Number(materiasInscritas),
          })
        : null;

    const materiasPrecio =
      isRegreso && nivel === "licenciatura" && materiasInscritas
        ? REGRESO_MATERIAS.materias?.[plantelKey]?.[
            modalidad === "online" ? "online" : "presencial"
          ]?.[String(materiasInscritas)]
        : null;

    let base: number | null =
      adminOverride && Number.isFinite(adminOverride.precioLista)
        ? adminOverride.precioLista
        : materiaOverride && Number.isFinite(materiaOverride.precio)
          ? materiaOverride.precio
        : typeof materiasPrecio === "number"
          ? materiasPrecio
        : typeof oferta?.neto === "number"
          ? oferta.neto
        : null;

    if (base === null) {
      const referencia = match
        ? match
        : resolveReferenciaRule(
            baseRules,
            requierePlantel ? plantel : "",
            tierResolvido
          );
      if (!referencia || referencia.porcentaje >= 100) {
        setError("No se pudo calcular el precio lista para esta combinación.");
        return;
      }
      base = referencia.monto / (1 - referencia.porcentaje / 100);
    }

    const extrasAplicados = isProgramaExtras && extrasActivos ? extrasTotal : 0;
    const colegiaturaConBeca =
      Math.round(base * (1 - porcentajeAplicado / 100) * 100) / 100;
    const descuentoExtra = beneficioActivo ? beneficioPorcentaje : 0;
    const colegiaturaConBeneficio = descuentoExtra
      ? Math.round(colegiaturaConBeca * (1 - descuentoExtra / 100) * 100) / 100
      : colegiaturaConBeca;
    const ajustesCalculo = resolveAdjustments(adminConfig, {
      programa,
      nivel,
      modalidad,
      plan: Number(plan),
      plantel: plantelKey || "",
    }).filter((entry) => entry.aplica === "calculo" || entry.aplica === "ambos");
    const ajustesTotal = ajustesCalculo.reduce((total, entry) => {
      const valor = Number(entry.valor) || 0;
      if (entry.tipo === "porcentaje") {
        return total + (colegiaturaConBeneficio * valor) / 100;
      }
      return total + valor;
    }, 0);
    const montoFinal =
      Math.round(
        (colegiaturaConBeneficio + extrasAplicados + ajustesTotal) * 100
      ) / 100;

    setResultadoMonto(montoFinal);
    setResultadoPorcentaje(porcentajeAplicado);
    setResultadoEtiqueta(sinAccesoBeca ? "Sin acceso a beca" : null);
  };

  const limpiar = () => {
    setPrograma("nuevo");
    setNivel("");
    setModalidad("");
    setPlan("");
    setPlantel("");
    setPlantelExtras("");
    setMateriasInscritas("");
    setProgramaAcademico("");
    setPromedio("");
    setResultadoMonto(null);
    setResultadoPorcentaje(null);
    setResultadoEtiqueta(null);
    setPrecioLista(null);
    setError("");
    setExtrasActivos(false);
    setExtrasAbiertos(false);
    setExtrasSeleccionados([]);
    setBeneficioActivo(false);
    setBeneficioPorcentaje(10);
    setOpenSelectId(null);
  };

  const programSelect = (
    <SearchableSelect
      id="programa"
      openId={openSelectId}
      setOpenId={setOpenSelectId}
      label="Programa"
      options={["Nuevo ingreso", "Regreso", "Academia"]}
      value={
        programa === "regreso"
          ? "Regreso"
          : programa === "academia"
            ? "Academia"
            : "Nuevo ingreso"
      }
      onChange={(val) => {
        const nextPrograma =
          val === "Regreso"
            ? "regreso"
            : val === "Academia"
              ? "academia"
              : "nuevo";
        setPrograma(nextPrograma);
        setMateriasInscritas("");
        setProgramaAcademico("");
        setResultadoMonto(null);
        setResultadoPorcentaje(null);
        setError("");
        const activarExtras = nextPrograma === "academia";
        setExtrasActivos(activarExtras);
        setExtrasAbiertos(activarExtras);
        setExtrasSeleccionados([]);
        setBeneficioActivo(false);
        setBeneficioPorcentaje(10);
        setPlantelExtras("");
      }}
      placeholder="Selecciona programa"
      accent={accent}
    />
  );

  const nivelSelect = (
    <SearchableSelect
      id="nivel"
      openId={openSelectId}
      setOpenId={setOpenSelectId}
      label="Línea de negocio"
      options={nivelesDisponibles.map((n) => n.charAt(0).toUpperCase() + n.slice(1))}
      value={
        nivel ? nivel.charAt(0).toUpperCase() + nivel.slice(1) : ""
      }
      onChange={(val) => {
        const normalizado = val.toLowerCase() as Nivel;
        setNivel(normalizado);
        setModalidad("");
        setPlan("");
        setPlantel("");
        setMateriasInscritas("");
        setProgramaAcademico("");
        setResultadoMonto(null);
        setResultadoPorcentaje(null);
        setExtrasActivos(false);
        setExtrasAbiertos(false);
        setExtrasSeleccionados([]);
      }}
      placeholder="Selecciona nivel"
      disabled={!nivelesDisponibles.length}
      accent={accent}
    />
  );

  const modalidadSelect = (
    <SearchableSelect
      id="modalidad"
      openId={openSelectId}
      setOpenId={setOpenSelectId}
      label="Modalidad"
      options={modalidadesDisponibles.map(
        (m) => m.charAt(0).toUpperCase() + m.slice(1)
      )}
      value={
        modalidad
          ? modalidad.charAt(0).toUpperCase() + modalidad.slice(1)
          : ""
      }
      onChange={(val) => {
        const normalizado = val.toLowerCase() as Modalidad;
        setModalidad(normalizado);
        setPlan("");
        setPlantel("");
        setMateriasInscritas("");
        setProgramaAcademico("");
        setResultadoMonto(null);
        setResultadoPorcentaje(null);
        setExtrasSeleccionados([]);
      }}
      placeholder="Selecciona modalidad"
      disabled={!modalidadesDisponibles.length}
      accent={accent}
    />
  );

  const planSelect = (
    <SearchableSelect
      id="plan"
      openId={openSelectId}
      setOpenId={setOpenSelectId}
      label="Plan de estudios (cuatrimestres)"
      options={planesDisponibles.map((p) => `${p} cuatrimestres`)}
      value={plan ? `${plan} cuatrimestres` : ""}
      onChange={(val) => {
        const num = Number(val.split(" ")[0]);
        setPlan(Number.isNaN(num) ? "" : num);
        setMateriasInscritas("");
        setProgramaAcademico("");
        setResultadoMonto(null);
        setResultadoPorcentaje(null);
        setExtrasSeleccionados([]);
      }}
      placeholder="Selecciona plan"
      disabled={!planesDisponibles.length}
      accent={accent}
    />
  );

  const plantelSelect = (
    <SearchableSelect
      id="plantel"
      openId={openSelectId}
      setOpenId={setOpenSelectId}
      label={
        requierePlantel
          ? isAcademia
            ? "Plantel base"
            : "Plantel"
          : isAcademia
            ? "Plantel base (no aplica)"
            : "Plantel (no aplica)"
      }
      options={plantelesDisponibles}
      value={plantel}
      onChange={(val) => {
        setPlantel(val);
        setMateriasInscritas("");
        setProgramaAcademico("");
        setResultadoMonto(null);
        setResultadoPorcentaje(null);
        setExtrasSeleccionados([]);
      }}
      placeholder={
        requierePlantel
          ? isAcademia
            ? "Selecciona plantel base"
            : "Selecciona plantel"
          : "No es necesario para este nivel o modalidad"
      }
      disabled={!requierePlantel || plantelesDisponibles.length === 0}
      accent={accent}
    />
  );

  const adminShortcuts = useMemo(
    () =>
      adminConfig.shortcuts.filter((entry) => {
        if (!entry.label?.trim() || !entry.url?.trim()) return false;
        const scopes = entry.programas ?? [];
        if (!scopes.length) return true;
        return scopes.includes(programa);
      }),
    [adminConfig.shortcuts, programa]
  );

  const ajustesAplicables = useMemo(() => {
    if (!nivel || !modalidad || !plan) return [];
    const plantelKey = modalidad === "online" ? "ONLINE" : plantel;
    return resolveAdjustments(adminConfig, {
      programa,
      nivel,
      modalidad,
      plan: Number(plan),
      plantel: plantelKey || "",
    });
  }, [adminConfig, nivel, modalidad, plan, plantel, programa]);

  const ajustesUI = useMemo(
    () =>
      ajustesAplicables.filter(
        (entry) => entry.aplica === "ui" || entry.aplica === "ambos"
      ),
    [ajustesAplicables]
  );

  const availabilityMerged = useMemo(() => {
    const map = new Map<string, AdminProgramAvailability>();
    const buildKey = (entry: AdminProgramAvailability) => {
      const plantelKey = String(entry.plantel ?? "").trim().toLowerCase();
      const programaKey = String(entry.programa ?? "").trim().toLowerCase();
      const modalidadKey = String(entry.modalidad ?? "").trim().toLowerCase();
      if (!plantelKey || !programaKey || !modalidadKey) return "";
      return `${plantelKey}::${programaKey}::${modalidadKey}`;
    };
    availabilityRemote.forEach((entry) => {
      const key = buildKey(entry);
      if (!key) return;
      map.set(key, entry);
    });
    adminConfig.programAvailability.forEach((entry) => {
      const key = buildKey(entry);
      if (!key) return;
      map.set(key, entry);
    });
    return Array.from(map.values());
  }, [availabilityRemote, adminConfig.programAvailability]);


  const plantelDisponibilidadKey =
    modalidad === "online" ? "ONLINE" : plantel;

  const programasDisponibles = useMemo(() => {
    if (nivel !== "licenciatura") return [];
    const plantelKey = plantelDisponibilidadKey;
    if (!plantelKey) return [];
    const entries = resolveProgramAvailability(
      adminConfig,
      { plantel: plantelKey },
      availabilityMerged
    );
    const unique = new Set(
      entries
        .map((entry) => entry.programa?.trim())
        .filter((entry): entry is string => Boolean(entry))
    );
    return Array.from(unique).sort((a, b) => a.localeCompare(b, "es"));
  }, [adminConfig, availabilityMerged, nivel, plantelDisponibilidadKey]);

  const disponibilidadDetalle = useMemo(() => {
    if (nivel !== "licenciatura") return null;
    const plantelKey = plantelDisponibilidadKey;
    if (!plantelKey || !programaAcademico) return null;
    const normalized = programaAcademico.trim().toLowerCase();
    const entries = resolveProgramAvailability(
      adminConfig,
      { plantel: plantelKey },
      availabilityMerged
    ).filter((entry) => entry.programa?.trim().toLowerCase() === normalized);
    if (!entries.length) return { status: "sin_registro", modalidades: [] };

    const modalidadLabels: Record<string, string> = {
      presencial: "Escolarizado",
      mixta: "Ejecutivo",
      online: "Online",
    };

    const modalidadesMap = new Map<string, string[]>();
    entries.forEach((entry) => {
      if (!entry.activo) return;
      const modalidadKey = String(entry.modalidad ?? "").trim().toLowerCase();
      if (!modalidadKey) return;
      const horario = String(entry.horario ?? "").trim();
      const existing = modalidadesMap.get(modalidadKey) ?? [];
      if (horario && !existing.includes(horario)) {
        modalidadesMap.set(modalidadKey, [...existing, horario]);
      } else if (!horario && !existing.length) {
        modalidadesMap.set(modalidadKey, existing);
      }
    });

    const modalidades = Array.from(modalidadesMap.entries()).map(
      ([modalidad, horarios]) => ({
        modalidad,
        label: modalidadLabels[modalidad] ?? modalidad,
        horarios,
      })
    );

    const disponible = modalidades.length > 0;
    return { status: disponible ? "disponible" : "no_disponible", modalidades };
  }, [
    adminConfig,
    availabilityMerged,
    nivel,
    plantelDisponibilidadKey,
    programaAcademico,
  ]);


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
      return { key: "salud", label: "Salud" };
    }
    if (normalized.includes("bachiller")) {
      return { key: "preparatoria", label: "Bachillerato" };
    }
    if (normalized.includes("maestr")) {
      return { key: "maestria", label: "Maestría" };
    }
    return { key: "licenciatura", label: "Licenciatura" };
  };
  const lineaNegocioPrograma = useMemo(() => {
    if (!programaAcademico) return null;
    return resolveLineaNegocio(programaAcademico);
  }, [programaAcademico]);

  const disponibilidadEtiqueta = useMemo(() => {
    if (disponibilidadDetalle?.status !== "disponible") return null;
    const modalidades = disponibilidadDetalle.modalidades ?? [];
    const keys = new Set(modalidades.map((entry) => entry.modalidad));
    const hasPresencial = keys.has("presencial");
    const hasMixta = keys.has("mixta");
    if (hasPresencial && hasMixta) return "Ambas";
    if (hasPresencial) return "Presencial";
    if (hasMixta) return "Ejecutivo";
    if (keys.has("online")) return "Online";
    return "Disponible";
  }, [disponibilidadDetalle]);

  const planUrl = useMemo(() => {
    if (!plantelDisponibilidadKey || !programaAcademico) return "";
    const normalized = programaAcademico.trim().toLowerCase();
    const entries = resolveProgramAvailability(
      adminConfig,
      { plantel: plantelDisponibilidadKey },
      availabilityMerged
    ).filter((entry) => entry.programa?.trim().toLowerCase() === normalized);
    const match = entries.find((entry) => entry.planUrl?.trim());
    return match?.planUrl ?? "";
  }, [
    adminConfig,
    availabilityMerged,
    plantelDisponibilidadKey,
    programaAcademico,
  ]);

  const materiasOpciones = useMemo(
    () => [
      "1 materia",
      "2 materias",
      "3 materias",
      "4 materias (plan completo 11 cuatrimestres)",
      "5 materias (plan base Salud y Bachillerato; 9 cuatrimestres)",
    ],
    []
  );

  const materiasSelect = (
    <SearchableSelect
      id="materias"
      openId={openSelectId}
      setOpenId={setOpenSelectId}
      label="Materias inscritas"
      options={materiasOpciones}
      value={materiasInscritas ? materiasOpciones[materiasInscritas - 1] : ""}
      onChange={(val) => {
        const num = Number(val.split(" ")[0]);
        setMateriasInscritas(Number.isNaN(num) ? "" : num);
        setResultadoMonto(null);
        setResultadoPorcentaje(null);
      }}
      placeholder="Selecciona materias"
      disabled={!isRegreso || nivel !== "licenciatura"}
      accent={accent}
    />
  );

  const programaAcademicoSelect = (
    <SearchableSelect
      id="programa-academico"
      openId={openSelectId}
      setOpenId={setOpenSelectId}
      label="Programa académico"
      options={programasDisponibles}
      value={programaAcademico}
      onChange={(val) => setProgramaAcademico(val)}
      placeholder={
        requierePlantel && !plantel
          ? "Selecciona plantel en el flujo principal"
          : "Selecciona programa"
      }
      disabled={
        (requierePlantel && !plantel) || programasDisponibles.length === 0
      }
      accent={accent}
    />
  );

  const [availabilityEnabled, setAvailabilityEnabled] = useState(
    !isAcademia
  );

  useEffect(() => {
    setAvailabilityEnabled(!isAcademia);
  }, [isAcademia]);

  const availabilitySection = (
    <section className="rounded-2xl border border-slate-800/70 bg-slate-950/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
            Disponibilidad de programas por plantel
          </p>
          <p className="mt-1 text-sm text-slate-200">
            Selecciona un programa académico para conocer su disponibilidad.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {isAcademia && (
            <button
              type="button"
              onClick={() => setAvailabilityEnabled((prev) => !prev)}
              className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] transition ${
                availabilityEnabled
                  ? "border-emerald-400/50 text-emerald-200"
                  : "border-slate-700 text-slate-400"
              }`}
            >
              {availabilityEnabled ? "Activo" : "Inactivo"}
            </button>
          )}
          {lineaNegocioPrograma && (
            <span className="rounded-full border border-slate-700 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">
              {lineaNegocioPrograma.label}
            </span>
          )}
        </div>
      </div>
      {isAcademia && !availabilityEnabled ? (
        <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 text-xs text-slate-400">
          Activa este panel para consultar disponibilidad.
        </div>
      ) : (
        <>
          <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] items-end">
            <div className="grid gap-3 md:grid-cols-2">
              {programaAcademicoSelect}
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                Modalidad ofertada
              </span>
              <div
                className={`rounded-lg border px-4 py-2 text-xs font-semibold uppercase tracking-wide ${
                  disponibilidadDetalle?.status === "disponible"
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                    : disponibilidadDetalle?.status === "no_disponible"
                      ? "border-rose-500/40 bg-rose-500/10 text-rose-200"
                      : "border-slate-700 bg-slate-900/50 text-slate-300"
                }`}
              >
                {requierePlantel && !plantel
                  ? "Selecciona plantel en el flujo principal"
                  : programasDisponibles.length === 0
                    ? "Sin disponibilidad cargada"
                    : !programaAcademico
                      ? "Selecciona un programa"
                      : disponibilidadDetalle?.status === "disponible"
                        ? disponibilidadEtiqueta ?? "Disponible"
                        : disponibilidadDetalle?.status === "no_disponible"
                          ? "No disponible"
                          : "Sin registro"}
              </div>
            </div>
          </div>
          {disponibilidadDetalle?.status === "disponible" &&
            disponibilidadDetalle.modalidades.length > 0 && (
              <div className="mt-3 grid gap-2 text-xs text-slate-200">
                {disponibilidadDetalle.modalidades.map((entry) => (
                  <div
                    key={entry.modalidad}
                    className="flex flex-col gap-1 rounded-lg border border-slate-800/70 bg-slate-900/40 px-3 py-2"
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      {entry.label}
                    </span>
                    {entry.horarios?.length ? (
                      <span className="text-slate-200">
                        Horario: {entry.horarios.join(" / ")}
                      </span>
                    ) : (
                      <span className="text-slate-400">
                        Horario no disponible
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          {planUrl ? (
            <div className="mt-3">
              <a
                href={planUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200 transition hover:border-emerald-400/70 hover:text-emerald-200"
              >
                Descargar plan de estudios
              </a>
            </div>
          ) : null}
        </>
      )}
    </section>
  );

  return (
    <div
      className={`min-h-screen min-h-[100dvh] text-slate-50 flex items-center justify-center p-3 sm:p-4 md:p-6 [@media(max-height:700px)]:items-start [@media(max-height:700px)]:p-2 ${
        isAcademia
          ? "bg-gradient-to-br from-amber-950 via-slate-950 to-slate-950"
          : isRegreso
            ? "bg-gradient-to-br from-violet-950 via-slate-950 to-slate-950"
            : "bg-slate-950"
      }`}
    >
        <div
          className={`w-full max-w-4xl lg:max-w-5xl rounded-2xl border bg-slate-900/80 shadow-2xl px-5 py-6 md:px-8 md:py-8 lg:px-10 lg:py-10 space-y-6 backdrop-blur-sm recalc-fade-up [@media(max-height:700px)]:px-4 [@media(max-height:700px)]:py-4 [@media(max-height:700px)]:space-y-4 ${
            isRegreso
              ? "border-violet-800/50 shadow-violet-500/10"
              : "border-slate-800 shadow-emerald-500/10"
          }`}
        >
                <header className="text-center">
                  <div className="flex flex-col gap-3 sm:gap-4">
                    {university === "unidep" && (
                      <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-end sm:items-center">
                        <button
                          type="button"
                          onClick={handleLogout}
                          className="rounded-full border border-slate-700 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300 transition hover:border-rose-400/70 hover:text-rose-200"
                        >
                          Cerrar sesión
                        </button>
                      </div>
                    )}
                    <div className="flex flex-col items-center gap-2">
                      <img
                        src={
                          university === "unidep"
                            ? "/branding/logo-unidep.png"
                            : "/branding/logo-relead.png"
                        }
                        alt={university === "unidep" ? "UNIDEP" : "ReLead"}
                        className="h-[118px] sm:h-[138px] md:h-[152px] w-auto max-w-[460px] sm:max-w-[520px] md:max-w-[580px] object-contain drop-shadow-[0_10px_24px_rgba(0,0,0,0.45)]"
                        loading="lazy"
                      />
                    </div>
                  </div>
                  <p className="text-sm text-slate-300 max-w-2xl mx-auto [@media(max-height:700px)]:hidden">
                    Selecciona la línea de negocio, modalidad, plan de estudios y plantel.
                    Luego ingresa el promedio y obtén el porcentaje de beca y el monto mensual
                    de colegiatura.
                  </p>
                </header>

        {adminShortcuts.length ? (
          <section className="rounded-2xl border border-slate-800/80 bg-slate-950/40 p-3 md:p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
              Accesos directos
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {adminShortcuts.map((shortcut, index) => (
                <a
                  key={`${shortcut.label}-${index}`}
                  href={shortcut.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-slate-700 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-200 hover:border-slate-400 hover:bg-slate-900/60 transition"
                >
                  {shortcut.label}
                </a>
              ))}
            </div>
          </section>
        ) : null}

        {error && (
          <div className="rounded-xl border border-red-500/60 bg-red-500/10 px-4 py-2 text-sm text-red-100">
            {error}
          </div>
        )}

        {isAcademia ? (
          <div className="grid gap-4">{programSelect}</div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              {programSelect}
              {nivelSelect}
              {modalidadSelect}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {planSelect}
              {plantelSelect}
            </div>
            {isRegreso && nivel === "licenciatura" && (
              <div className="grid gap-4 md:grid-cols-2">
                {materiasSelect}
              </div>
            )}
          </>
        )}

        {!isAcademia && availabilitySection}

        {isProgramaExtras && (
          <section
            className={`rounded-2xl border p-3 md:p-4 ${
              isAcademia
                ? "border-amber-800/50 bg-amber-950/20"
                : "border-violet-800/50 bg-violet-950/20"
            }`}
          >
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                  {isAcademia
                    ? "Academia · Costos académicos"
                    : "Regresos · Costos adicionales"}
                </p>
                <p className="mt-1 text-sm text-slate-200">
                  {isAcademia
                    ? "Costos principales de academia. La colegiatura base es opcional."
                    : "Visualiza y (opcionalmente) suma cargos extra al cálculo final."}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span>Plantel costos:</span>
                  <span className="text-slate-200">{extrasPlantelEtiqueta}</span>
                </div>
                {mostrarSelectorExtrasPlantel && (
                  <div className="max-w-xs">
                    <SearchableSelect
                      id="plantel-extras"
                      openId={openSelectId}
                      setOpenId={setOpenSelectId}
                      label="Plantel para costos"
                      options={extrasPlantelOpciones}
                      value={plantelExtras}
                      onChange={(val) => {
                        const next = val === "Base general" ? "" : val;
                        setPlantelExtras(next);
                        setResultadoMonto(null);
                        setResultadoPorcentaje(null);
                        setExtrasSeleccionados([]);
                      }}
                      placeholder="Base general"
                      disabled={!extrasPlantelOpciones.length}
                      accent={extrasTone}
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 md:flex-col md:items-end">
                {isProgramaExtras && (
                  <a
                    href="https://siie-unidep.csweb.mx/"
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border border-slate-700 bg-slate-900/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-200 hover:border-slate-500 hover:bg-slate-900/60 transition"
                  >
                    Accede a SIIE
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setExtrasAbiertos((v) => !v)}
                  className="rounded-xl border border-slate-700 bg-slate-900/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-200 hover:border-slate-500 hover:bg-slate-900/60 transition"
                >
                  {extrasAbiertos ? "Ocultar" : "Ver lista"}
                </button>
              </div>
            </div>

            <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (extrasToggleDisabled) return;
                    setResultadoMonto(null);
                    setResultadoPorcentaje(null);
                    setExtrasActivos((prev) => {
                      const next = !prev;
                      if (next) {
                        setExtrasAbiertos(true);
                      } else {
                        setExtrasSeleccionados([]);
                      }
                      return next;
                    });
                  }}
                  disabled={extrasToggleDisabled}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full border transition ${
                    extrasActivos
                      ? extrasTone === "amber"
                        ? "border-amber-300/60 bg-amber-500/80"
                        : "border-violet-300/60 bg-violet-500/80"
                      : "border-slate-600 bg-slate-800/70"
                  } ${
                    extrasToggleDisabled
                      ? "cursor-not-allowed opacity-50"
                      : "cursor-pointer"
                  }`}
                  aria-pressed={extrasActivos}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-slate-50 shadow transition ${
                      extrasActivos ? "translate-x-5" : "translate-x-1"
                    }`}
                  />
                </button>
                <div>
                  <p className="text-xs font-semibold text-slate-200">
                    {isAcademia
                      ? "Activar costos académicos"
                      : "Activar costos adicionales"}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <p className="text-[11px] text-slate-400">Total extras</p>
                <p className="text-sm font-semibold text-slate-50">
                  {extrasTotal.toLocaleString("es-MX", {
                    style: "currency",
                    currency: "MXN",
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>

            {extrasAbiertos && (
              <div className="mt-3">
                {extrasFaltaPlantel ? (
                  <div className="rounded-xl border border-slate-800/70 bg-slate-950/30 p-4 text-xs text-slate-300">
                    Selecciona un plantel para ver los cargos disponibles.
                  </div>
                ) : !extrasDisponibles ? (
                  <div className="rounded-xl border border-slate-800/70 bg-slate-950/30 p-4 text-xs text-slate-300">
                    No hay cargos disponibles para esta selección.
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {extrasOrdenados.principales.map(({ categoria, items }) => (
                      <div
                        key={categoria}
                        className="rounded-xl border border-slate-800/70 bg-slate-950/30 p-2.5 transition-colors hover:border-slate-700/80"
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">
                          {categoria}
                        </p>
                        <div className="mt-1.5 space-y-1.5">
                          {items.map((item) => {
                            const checked = extrasSeleccionados.includes(item.codigo);
                            const disabled = !extrasActivos;
                            return (
                              <label
                                key={item.codigo}
                                className={`flex items-start justify-between gap-3 rounded-lg border px-3 py-2 transition-colors ${
                                  checked
                                    ? extrasTone === "amber"
                                      ? "border-amber-500/50 bg-amber-500/10"
                                      : "border-violet-500/50 bg-violet-500/10"
                                    : "border-slate-800/70 bg-slate-900/20"
                                } ${disabled ? "opacity-60" : "hover:bg-slate-900/40 cursor-pointer"}`}
                              >
                                <span className="flex items-start gap-2">
                                  <input
                                    type="checkbox"
                                    className={`mt-0.5 ${
                                      extrasTone === "amber"
                                        ? "accent-amber-500"
                                        : "accent-violet-500"
                                    }`}
                                    checked={checked}
                                    disabled={disabled}
                                    onChange={() => {
                                      setExtrasSeleccionados((prev) => {
                                        if (prev.includes(item.codigo)) {
                                          return prev.filter((c) => c !== item.codigo);
                                        }
                                        return [...prev, item.codigo];
                                      });
                                      setResultadoMonto(null);
                                      setResultadoPorcentaje(null);
                                    }}
                                  />
                                  <span>
                                    <span className="block text-xs text-slate-100">
                                      {item.concepto}
                                    </span>
                                    <span className="block text-[11px] text-slate-400">
                                      Código: {item.codigo}
                                    </span>
                                  </span>
                                </span>
                                <span className="text-xs font-semibold text-slate-50">
                                  {item.costo.toLocaleString("es-MX", {
                                    style: "currency",
                                    currency: "MXN",
                                    maximumFractionDigits: 2,
                                  })}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    {extrasOrdenados.compactos.map(({ categoria, items }) => (
                      <div
                        key={categoria}
                        className="rounded-xl border border-slate-800/70 bg-slate-950/30 p-2.5 transition-colors hover:border-slate-700/80 md:col-span-2"
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">
                          {categoria}
                        </p>
                        <div className="mt-1.5 space-y-1.5">
                          {items.map((item) => {
                            const checked = extrasSeleccionados.includes(item.codigo);
                            const disabled = !extrasActivos;
                            return (
                              <label
                                key={item.codigo}
                                className={`flex items-start justify-between gap-3 rounded-lg border px-3 py-2 transition-colors ${
                                  checked
                                    ? extrasTone === "amber"
                                      ? "border-amber-500/50 bg-amber-500/10"
                                      : "border-violet-500/50 bg-violet-500/10"
                                    : "border-slate-800/70 bg-slate-900/20"
                                } ${disabled ? "opacity-60" : "hover:bg-slate-900/40 cursor-pointer"}`}
                              >
                                <span className="flex items-start gap-2">
                                  <input
                                    type="checkbox"
                                    className={`mt-0.5 ${
                                      extrasTone === "amber"
                                        ? "accent-amber-500"
                                        : "accent-violet-500"
                                    }`}
                                    checked={checked}
                                    disabled={disabled}
                                    onChange={() => {
                                      setExtrasSeleccionados((prev) => {
                                        if (prev.includes(item.codigo)) {
                                          return prev.filter((c) => c !== item.codigo);
                                        }
                                        return [...prev, item.codigo];
                                      });
                                      setResultadoMonto(null);
                                      setResultadoPorcentaje(null);
                                    }}
                                  />
                                  <span>
                                    <span className="block text-xs text-slate-100">
                                      {item.concepto}
                                    </span>
                                    <span className="block text-[11px] text-slate-400">
                                      Código: {item.codigo}
                                    </span>
                                  </span>
                                </span>
                                <span className="text-xs font-semibold text-slate-50">
                                  {item.costo.toLocaleString("es-MX", {
                                    style: "currency",
                                    currency: "MXN",
                                    maximumFractionDigits: 2,
                                  })}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {isAcademia && availabilitySection}

        {isAcademia && (
          <section className="rounded-2xl border border-amber-800/40 bg-amber-950/10 p-3 md:p-4">
            <div className="flex flex-col gap-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">
                Colegiatura base
              </p>
              <p className="text-[11px] text-amber-100/80">
                Opcional. Define línea, modalidad, plan y plantel base.
              </p>
            </div>
            <div className="mt-2 grid gap-3 md:grid-cols-2">
              {nivelSelect}
              {modalidadSelect}
              {planSelect}
              {plantelSelect}
            </div>
          </section>
        )}

        {!isRegreso && (
          <section className="rounded-2xl border border-slate-800/70 bg-slate-950/30 p-4 md:p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                  Beneficios adicionales
                </p>
                <p className="mt-1 text-sm text-slate-200">
                  Descuento extra sobre colegiatura. No aplica a costos adicionales.
                </p>
                {beneficioActivo && benefitComment ? (
                  <div className="mt-2 inline-flex items-center gap-2 rounded-lg border border-amber-400/50 bg-amber-400/15 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-100">
                    {benefitComment}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => {
                  setBeneficioActivo((prev) => !prev);
                  setResultadoMonto(null);
                  setResultadoPorcentaje(null);
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full border transition ${
                  beneficioActivo
                    ? accent === "violet"
                      ? "border-violet-300/60 bg-violet-500/80"
                      : accent === "amber"
                        ? "border-amber-300/60 bg-amber-500/80"
                        : "border-emerald-300/60 bg-emerald-500/80"
                    : "border-slate-600 bg-slate-800/70"
                }`}
                aria-pressed={beneficioActivo}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-slate-50 shadow transition ${
                    beneficioActivo ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <SearchableSelect
                id="beneficio"
                openId={openSelectId}
                setOpenId={setOpenSelectId}
                label="Porcentaje extra"
                options={beneficiosDisponibles.map((b) => `${b}%`)}
                value={beneficioActivo ? `${beneficioPorcentaje}%` : ""}
                onChange={(val) => {
                  const num = Number(val.replace("%", "").trim());
                  setBeneficioPorcentaje(Number.isNaN(num) ? 10 : num);
                  setResultadoMonto(null);
                  setResultadoPorcentaje(null);
                  setError("");
                }}
                placeholder="Selecciona porcentaje"
                disabled={!beneficioActivo}
                accent={accent}
              />
            </div>
          </section>
        )}

        <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)] items-end">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-300 uppercase tracking-wide">
              Promedio general
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                step="0.1"
                min="0"
                max="10"
                value={promedio}
                onChange={(e) => setPromedio(e.target.value)}
                placeholder="Ej. 8.5"
                className={`w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2.5 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 ${
                  isAcademia
                    ? "focus:border-amber-400 focus:ring-amber-400/70"
                    : isRegreso
                      ? "focus:border-violet-400 focus:ring-violet-400/70"
                      : "focus:border-emerald-400 focus:ring-emerald-400/70"
                }`}
              />
              <span className="text-xs text-slate-400 hidden md:inline">
                Usa un decimal
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 justify-end">
            <button
              type="button"
              onClick={limpiar}
              className="rounded-xl border border-slate-600 px-4 py-2 text-xs font-medium uppercase tracking-wide text-slate-200 hover:border-slate-400 hover:bg-slate-800/60 hover:-translate-y-[1px] hover:shadow-md active:translate-y-0 transition"
            >
              Limpiar
            </button>
            <button
              type="button"
              onClick={handleCalcular}
              className={`rounded-xl px-5 py-2.5 text-xs md:text-sm font-semibold uppercase tracking-wide text-slate-950 shadow-md hover:-translate-y-[1px] active:translate-y-0 transition ${
                isAcademia
                  ? "bg-amber-500 shadow-amber-500/40 hover:bg-amber-400"
                  : isRegreso
                    ? "bg-violet-500 shadow-violet-500/40 hover:bg-violet-400"
                    : "bg-emerald-500 shadow-emerald-500/40 hover:bg-emerald-400"
              }`}
            >
              Calcular beca
            </button>
          </div>
        </div>

        {precioLista !== null && (
          <section className="mt-4 rounded-2xl border border-slate-700 bg-slate-900/80 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2 shadow-lg recalc-fade-up">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                Precio lista (sin beca)
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium text-slate-400">
                Mensualidad antes de aplicar beca
              </p>
              <p className="text-xl md:text-2xl font-semibold text-slate-50">
                {precioLista.toLocaleString("es-MX", {
                  style: "currency",
                  currency: "MXN",
                  maximumFractionDigits: 2,
                })}
              </p>
              {isProgramaExtras && extrasActivos && extrasTotal > 0 && (
                <div className="mt-2 text-[11px] text-slate-400 space-y-0.5">
                  <div className="flex items-center justify-end gap-2">
                    <span>Extras:</span>
                    <span className="text-slate-200">
                      {extrasTotal.toLocaleString("es-MX", {
                        style: "currency",
                        currency: "MXN",
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <span>Lista + extras:</span>
                    <span className="text-slate-50 font-semibold">
                      {(precioLista + extrasTotal).toLocaleString("es-MX", {
                        style: "currency",
                        currency: "MXN",
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {resultadoMonto !== null && resultadoPorcentaje !== null && (
          <section
            className={`mt-4 rounded-2xl border p-4 md:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 recalc-fade-up ${
              isAcademia
                ? "border-amber-500/40 bg-amber-500/10"
                : isRegreso
                  ? "border-violet-500/40 bg-violet-500/10"
                  : "border-emerald-500/40 bg-emerald-500/10"
            }`}
          >
            <div>
              <p
                className={`text-xs font-semibold uppercase tracking-wide ${
                  isAcademia
                    ? "text-amber-300"
                    : isRegreso
                      ? "text-violet-300"
                      : "text-emerald-300"
                }`}
              >
                Resultado de la beca
              </p>
              <p
                className={`mt-1 text-lg md:text-2xl font-semibold ${
                  isAcademia
                    ? "text-amber-100"
                    : isRegreso
                      ? "text-violet-100"
                      : "text-emerald-100"
                }`}
              >
                {resultadoEtiqueta ?? `Beca del ${resultadoPorcentaje}%`}
              </p>
              <p
                className={`mt-1 text-sm ${
                  isAcademia
                    ? "text-amber-50/90"
                    : isRegreso
                      ? "text-violet-50/90"
                      : "text-emerald-50/90"
                }`}
              >
                {resultadoEtiqueta
                  ? "Monto mensual estimado de colegiatura sin beca."
                  : "Monto mensual estimado de colegiatura con beca aplicada."}
              </p>
              {beneficioActivo && (
                <p
                  className={`mt-1 text-xs ${
                    isAcademia
                      ? "text-amber-200/80"
                      : isRegreso
                        ? "text-violet-200/80"
                        : "text-emerald-200/80"
                  }`}
                >
                  Beneficio adicional aplicado: -{beneficioPorcentaje}% sobre colegiatura.
                </p>
              )}
              {isProgramaExtras && extrasActivos && extrasTotal > 0 && (
                <p
                  className={`mt-1 text-xs ${
                    isAcademia
                      ? "text-amber-200/80"
                      : "text-violet-200/80"
                  }`}
                >
                  Incluye extras (sin aplicar beca):{" "}
                  {extrasTotal.toLocaleString("es-MX", {
                    style: "currency",
                    currency: "MXN",
                    maximumFractionDigits: 2,
                  })}
                </p>
              )}
              {ajustesUI.length > 0 && (
                <div className="mt-2 space-y-1 text-xs text-slate-200/80">
                  {ajustesUI.map((ajuste) => (
                    <p key={ajuste.id || ajuste.titulo}>
                      {ajuste.titulo}:{" "}
                      {ajuste.tipo === "porcentaje"
                        ? `${ajuste.valor}%`
                        : Number(ajuste.valor || 0).toLocaleString("es-MX", {
                            style: "currency",
                            currency: "MXN",
                            maximumFractionDigits: 2,
                          })}
                    </p>
                  ))}
                </div>
              )}
            </div>
            <div className="text-right">
              <p
                className={`text-xs font-medium ${
                  isAcademia
                    ? "text-amber-200/80"
                    : isRegreso
                      ? "text-violet-200/80"
                      : "text-emerald-200/80"
                }`}
              >
                Colegiatura mensual
              </p>
              <p
                className={`text-2xl md:text-3xl font-bold ${
                  isAcademia
                    ? "text-amber-300"
                    : isRegreso
                      ? "text-violet-300"
                      : "text-emerald-300"
                }`}
              >
                {resultadoMonto.toLocaleString("es-MX", {
                  style: "currency",
                  currency: "MXN",
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
          </section>
        )}

        <div className="mt-6 flex items-center justify-center">
          <a
            href="https://www.banxico.org.mx/cep/"
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-slate-700 bg-slate-900/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-200 hover:border-slate-500 hover:bg-slate-900/60 transition"
          >
            Consultar comprobante SPEI
          </a>
        </div>

        <footer className="mt-8 border-t border-slate-800/60 pt-5 text-[11px] text-slate-400 flex flex-col items-center justify-center gap-2 text-center">
          <img
            src="/branding/logo-recalc.png"
            alt="ReCalc Scholarship"
            className="h-[70px] sm:h-[84px] w-auto max-w-[240px] opacity-90 object-contain"
            loading="lazy"
          />
          <p>Powered by ReLead © {new Date().getFullYear()}</p>
        </footer>
      </div>
    </div>
  );
};

export default ScholarshipCalculator;
