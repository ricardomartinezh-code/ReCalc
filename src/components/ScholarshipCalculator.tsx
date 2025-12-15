import React, { useEffect, useMemo, useState } from "react";
import costosData from "../data/costos_2026.json";
import CornerLogo from "./CornerLogo";

type Nivel = "licenciatura" | "salud" | "maestria" | "preparatoria";
type Modalidad = "presencial" | "online" | "mixta";
type Tier = "T1" | "T2" | "T3";
type Programa = "nuevo" | "regreso";

interface RangoPromedio {
  min: number;
  max: number;
}

interface CostoItem {
  nivel: Nivel;
  modalidad: Modalidad;
  plan: number;
  tier?: Tier;
  rango: RangoPromedio;
  porcentaje: number;
  monto: number;
}

interface PlantelInfo {
  name: string;
  licTier?: Tier;
  saludTier?: Tier;
}

const PLANTEL_TIER_RAW: Record<string, string[]> = {
  T1: [
    "Agua Prieta",
    "Aguascalientes",
    "Altamira",
    "Cananea",
    "Cd. del Carmen",
    "Ca. Mante",
    "Cd. Obregón",
    "Teocaltiche",
    "Veracruz",
  ],
  T2: [
    "Chihuahua",
    "Culiacán",
    "Ensenada",
    "Los Cabos",
    "Mexicali",
    "Nogales",
    "Puerto Peñasco",
    "Querétaro",
    "Saltillo",
    "Torreón",
    "Tuxpan",
    "Zacatecas",
  ],
  T3: ["Hermosillo", "La Paz", "Tijuana"],
  SaludT1: ["Aguascalientes", "Veracruz"],
  SaludT2: ["Chihuahua", "Culiacán", "Querétaro", "Mexicali", "Saltillo"],
  SaludT3: ["Hermosillo", "Tijuana"],
};

function buildPlanteles(): PlantelInfo[] {
  const byName: Record<string, PlantelInfo> = {};

  (Object.entries(PLANTEL_TIER_RAW) as [string, string[]][]).forEach(
    ([key, lista]) => {
      const isSalud = key.startsWith("Salud");
      const tierKey = (isSalud ? key.replace("Salud", "") : key) as Tier;

      lista.forEach((name) => {
        if (!byName[name]) {
          byName[name] = { name };
        }
        if (isSalud) {
          byName[name].saludTier = tierKey;
        } else {
          byName[name].licTier = tierKey;
        }
      });
    }
  );

  return Object.values(byName).sort((a, b) => a.name.localeCompare(b.name));
}

const PLANTELES: PlantelInfo[] = buildPlanteles();

const normalizarTexto = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const obtenerPrecioListaEspecial = (
  nivel: Nivel | "",
  modalidad: Modalidad | "",
  plan: number | "",
  plantel: string
): number | null => {
  if (!nivel || !modalidad || !plan || !plantel) {
    return null;
  }

  const esEscolarOMixta =
    modalidad === "presencial" || modalidad === "mixta";
  const plantelNorm = normalizarTexto(plantel);

  if (esEscolarOMixta && nivel === "licenciatura") {
        // Excepciones 2026 por plantel (precio lista)
    if (plantelNorm === "chihuahua") {
      if (plan === 11) return 3336;
      if (plan === 9) return 4379;
    }

    if (plantelNorm === "culiacan" || plantelNorm === "queretaro") {
      if (plan === 11) return 3710;
      if (plan === 9) return 4594;
    }

    // Aguascalientes / Altamira / Veracruz: solo plan 11
    if (
      plantelNorm === "aguascalientes" ||
      plantelNorm === "altamira" ||
      plantelNorm === "veracruz"
    ) {
      if (plan === 11) return 3268;
    }
  }

  if (esEscolarOMixta && nivel === "salud") {
    if (plantelNorm === "chihuahua") {
      return 3988;
    }
  }

  return null;
};

const COSTOS: CostoItem[] = costosData as CostoItem[];

interface SearchableSelectProps {
  label: string;
  placeholder?: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  accent?: "emerald" | "violet";
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  label,
  placeholder = "Selecciona una opción",
  options,
  value,
  onChange,
  disabled,
  accent = "emerald",
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filteredOptions = useMemo(() => {
    const q = query.toLowerCase();
    return options.filter((opt) => opt.toLowerCase().includes(q));
  }, [options, query]);

  const selectedLabel = value || placeholder;

  return (
    <div className="space-y-1 [@media(max-height:700px)]:space-y-0">
      <label className="block text-xs font-medium text-slate-300 uppercase tracking-wide">
        {label}
      </label>
      <div className="relative">
        <button
          type="button"
          className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 ${
            accent === "violet"
              ? "focus:ring-violet-400/70"
              : "focus:ring-emerald-400/70"
          }
            ${
              disabled
                ? "cursor-not-allowed border-slate-700 bg-slate-800/60 text-slate-500"
                : "border-slate-700 bg-slate-900/60 hover:border-slate-500"
            }
          `}
          onClick={() => {
            if (!disabled) setOpen((prev) => !prev);
          }}
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
          <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 shadow-xl">
            {options.length > 6 && (
              <div className="border-b border-slate-800 p-2">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar..."
                  className={`w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 ${
                    accent === "violet"
                      ? "focus:border-violet-400 focus:ring-violet-400"
                      : "focus:border-emerald-400 focus:ring-emerald-400"
                  }`}
                />
              </div>
            )}
            <ul className="max-h-60 overflow-y-auto py-1 text-sm">
              {filteredOptions.length === 0 && (
                <li className="px-3 py-2 text-xs text-slate-500">
                  Sin resultados
                </li>
              )}
              {filteredOptions.map((opt) => (
                <li key={opt}>
                  <button
                    type="button"
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-800/80 ${
                      opt === value
                        ? accent === "violet"
                          ? "text-violet-300"
                          : "text-emerald-300"
                        : "text-slate-100"
                    }`}
                    onClick={() => {
                      onChange(opt);
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <span>{opt}</span>
                    {opt === value && (
                      <span
                        className={`text-[10px] uppercase tracking-wide ${
                          accent === "violet"
                            ? "text-violet-400"
                            : "text-emerald-400"
                        }`}
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

const ScholarshipCalculator: React.FC = () => {
  const [programa, setPrograma] = useState<Programa>("nuevo");
  const [nivel, setNivel] = useState<Nivel | "">("");
  const [modalidad, setModalidad] = useState<Modalidad | "">("");
  const [plan, setPlan] = useState<number | "">("");
  const [plantel, setPlantel] = useState<string>("");
  const [promedio, setPromedio] = useState<string>("");

  const [resultadoMonto, setResultadoMonto] = useState<number | null>(null);
  const [resultadoPorcentaje, setResultadoPorcentaje] = useState<number | null>(
    null
  );
  const [precioLista, setPrecioLista] = useState<number | null>(null);
  const [error, setError] = useState<string>("");

  const costos = COSTOS;
  const isRegreso = programa === "regreso";
  const accent = isRegreso ? "violet" : "emerald";

  const nivelesDisponibles = useMemo(() => {
    const set = new Set<Nivel>();
    costos.forEach((c) => set.add(c.nivel));
    return Array.from(set).sort();
  }, [costos]);

  const modalidadesDisponibles = useMemo(() => {
    if (!nivel) return [];
    const set = new Set<Modalidad>();
    costos
      .filter((c) => c.nivel === nivel)
      .forEach((c) => set.add(c.modalidad));
    const modalidades = Array.from(set);
    const filtradas =
      nivel === "salud"
        ? modalidades.filter((m) => m !== "mixta")
        : modalidades;
    const orden: Modalidad[] = ["presencial", "mixta", "online"];
    return filtradas.sort((a, b) => orden.indexOf(a) - orden.indexOf(b));
  }, [costos, nivel]);

  const planesDisponibles = useMemo(() => {
    if (!nivel || !modalidad) return [];
    const set = new Set<number>();
    costos
      .filter((c) => c.nivel === nivel && c.modalidad === modalidad)
      .forEach((c) => set.add(c.plan));
    return Array.from(set).sort((a, b) => a - b);
  }, [costos, nivel, modalidad]);

  const plantelesDisponibles = useMemo(() => {
    const requierePlantel =
      (nivel === "licenciatura" || nivel === "salud") && modalidad !== "online";

    if (!requierePlantel) {
      return [];
    }

    if (nivel === "licenciatura") {
      return PLANTELES.filter((p) => p.licTier).map((p) => p.name);
    }
    if (nivel === "salud") {
      return PLANTELES.filter((p) => p.saludTier).map((p) => p.name);
    }
    return [];
  }, [nivel, modalidad]);

  const getTierForPlantel = (niv: Nivel | "", name: string): Tier | undefined => {
    if (!name) return undefined;
    const info = PLANTELES.find((p) => p.name === name);
    if (!info) return undefined;
    if (niv === "salud") return info.saludTier;
    if (niv === "licenciatura") return info.licTier;
    return undefined;
  };

  useEffect(() => {
    if (!nivel || !modalidad || !plan) {
      setPrecioLista(null);
      return;
    }

    const requierePlantel =
      (nivel === "licenciatura" || nivel === "salud") && modalidad !== "online";

    if (requierePlantel && !plantel) {
      setPrecioLista(null);
      return;
    }

    let tier: Tier | undefined;
    if (requierePlantel) {
      tier = getTierForPlantel(nivel, plantel || "");
      if (!tier) {
        setPrecioLista(null);
        return;
      }
    }

    const candidatos = costos.filter((c) => {
      if (c.nivel !== nivel || c.modalidad !== modalidad || c.plan !== plan) {
        return false;
      }
      if (requierePlantel) {
        return c.tier === tier;
      }
      return true;
    });

    if (!candidatos.length) {
      setPrecioLista(null);
      return;
    }

    const especial = obtenerPrecioListaEspecial(
      nivel,
      modalidad,
      plan,
      plantel || ""
    );

    if (especial !== null) {
      setPrecioLista(especial);
      return;
    }

    const referencia = candidatos[0];

    if (referencia.porcentaje >= 100) {
      setPrecioLista(null);
      return;
    }

    const base = referencia.monto / (1 - referencia.porcentaje / 100);
    const baseRedondeado = Math.round(base * 100) / 100;
    setPrecioLista(baseRedondeado);
  }, [costos, nivel, modalidad, plan, plantel]);

  const handleCalcular = () => {
    setError("");
    setResultadoMonto(null);
    setResultadoPorcentaje(null);

    if (!nivel || !modalidad || !plan) {
      setError("Completa nivel, modalidad y plan de estudios.");
      return;
    }

    const requierePlantel =
      (nivel === "licenciatura" || nivel === "salud") && modalidad !== "online";

    if (requierePlantel && !plantel) {
      setError("Selecciona un plantel para esta línea de negocio.");
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

    let tier: Tier | undefined;
    if (requierePlantel) {
      tier = getTierForPlantel(nivel, plantel || "");
      if (!tier) {
        setError("No se encontró el tier para el plantel seleccionado.");
        return;
      }
    }

    const candidatos = costos.filter((c) => {
      if (c.nivel !== nivel || c.modalidad !== modalidad || c.plan !== plan) {
        return false;
      }
      if (requierePlantel) {
        return c.tier === tier;
      }
      return true;
    });

    const match = candidatos.find((c) => {
      const min = c.rango.min - 1e-6;
      const max = c.rango.max + 1e-6;
      return promedioNum >= min && promedioNum <= max;
    });

    if (!match) {
      setError("No se encontró un costo para esa combinación de datos y promedio.");
      return;
    }

    const especial = obtenerPrecioListaEspecial(
      nivel,
      modalidad,
      plan,
      plantel || ""
    );

    let porcentajeAplicado = match.porcentaje;

    if (isRegreso) {
      if (modalidad === "online") {
        const candidatosNoOnline = costos
          .filter((c) => {
            if (c.nivel !== nivel || c.plan !== plan) return false;
            if (c.modalidad === "online") return false;
            return c.modalidad === "presencial" || c.modalidad === "mixta";
          })
          .sort((a, b) => {
            if (a.modalidad !== b.modalidad) {
              return a.modalidad === "presencial" ? -1 : 1;
            }
            const rankTier = (t?: Tier) =>
              t === "T1" ? 0 : t === "T2" ? 1 : t === "T3" ? 2 : 3;
            return rankTier(a.tier) - rankTier(b.tier);
          });

        const matchNoOnline = candidatosNoOnline.find((c) => {
          const min = c.rango.min - 1e-6;
          const max = c.rango.max + 1e-6;
          return promedioNum >= min && promedioNum <= max;
        });

        if (matchNoOnline) {
          porcentajeAplicado = matchNoOnline.porcentaje;
        }
      }

      porcentajeAplicado = Math.min(porcentajeAplicado, 25);
    }

    const base =
      especial !== null
        ? especial
        : match.porcentaje >= 100
          ? null
          : match.monto / (1 - match.porcentaje / 100);

    if (base === null) {
      setError("No se pudo calcular el precio lista para esta combinación.");
      return;
    }

    const montoFinal =
      Math.round(base * (1 - porcentajeAplicado / 100) * 100) / 100;

    setResultadoMonto(montoFinal);
    setResultadoPorcentaje(porcentajeAplicado);
  };

  const limpiar = () => {
    setPrograma("nuevo");
    setNivel("");
    setModalidad("");
    setPlan("");
    setPlantel("");
    setPromedio("");
    setResultadoMonto(null);
    setResultadoPorcentaje(null);
    setPrecioLista(null);
    setError("");
  };

  return (
    <div
      className={`min-h-screen text-slate-50 flex items-center justify-center p-4 [@media(max-height:700px)]:items-start [@media(max-height:700px)]:p-2 ${
        isRegreso
          ? "bg-gradient-to-br from-violet-950 via-slate-950 to-slate-950"
          : "bg-slate-950"
      }`}
    >
      <CornerLogo />
      <div
        className={`w-full max-w-4xl rounded-2xl border bg-slate-900/80 shadow-2xl px-5 py-6 md:px-8 md:py-8 space-y-6 [@media(max-height:700px)]:px-4 [@media(max-height:700px)]:py-4 [@media(max-height:700px)]:space-y-4 ${
          isRegreso
            ? "border-violet-800/50 shadow-violet-500/10"
            : "border-slate-800 shadow-emerald-500/10"
        }`}
      >
	        <header className="space-y-1 text-center">
	          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight [@media(max-height:700px)]:text-lg">
	            ReCalc Scholarship
	          </h1>
	          <p className="text-sm text-slate-300 max-w-2xl mx-auto [@media(max-height:700px)]:hidden">
	            Selecciona la línea de negocio, modalidad, plan de estudios y plantel.
	            Luego ingresa el promedio y obtén el porcentaje de beca y el monto mensual
	            de colegiatura.
	          </p>
	        </header>

        {error && (
          <div className="rounded-xl border border-red-500/60 bg-red-500/10 px-4 py-2 text-sm text-red-100">
            {error}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <SearchableSelect
            label="Programa"
            options={["Nuevo ingreso", "Regreso"]}
            value={programa === "regreso" ? "Regreso" : "Nuevo ingreso"}
            onChange={(val) => {
              setPrograma(val === "Regreso" ? "regreso" : "nuevo");
              setResultadoMonto(null);
              setResultadoPorcentaje(null);
              setError("");
            }}
            placeholder="Selecciona programa"
            accent={accent}
          />

          <SearchableSelect
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
              setResultadoMonto(null);
              setResultadoPorcentaje(null);
            }}
            placeholder="Selecciona nivel"
            disabled={!nivelesDisponibles.length}
            accent={accent}
          />

          <SearchableSelect
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
              setResultadoMonto(null);
              setResultadoPorcentaje(null);
            }}
            placeholder="Selecciona modalidad"
            disabled={!modalidadesDisponibles.length}
            accent={accent}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <SearchableSelect
            label="Plan de estudios (cuatrimestres)"
            options={planesDisponibles.map((p) => `${p} cuatrimestres`)}
            value={plan ? `${plan} cuatrimestres` : ""}
            onChange={(val) => {
              const num = Number(val.split(" ")[0]);
              setPlan(Number.isNaN(num) ? "" : num);
              setResultadoMonto(null);
              setResultadoPorcentaje(null);
            }}
            placeholder="Selecciona plan"
            disabled={!planesDisponibles.length}
            accent={accent}
          />

          <SearchableSelect
            label={
              (nivel === "licenciatura" || nivel === "salud") && modalidad !== "online"
                ? "Plantel"
                : "Plantel (no aplica)"
            }
            options={plantelesDisponibles}
            value={plantel}
            onChange={(val) => {
              setPlantel(val);
              setResultadoMonto(null);
              setResultadoPorcentaje(null);
            }}
            placeholder={
              (nivel === "licenciatura" || nivel === "salud") && modalidad !== "online"
                ? "Selecciona plantel"
                : "No es necesario para este nivel o modalidad"
            }
            disabled={
              !(
                (nivel === "licenciatura" || nivel === "salud") &&
                modalidad !== "online"
              ) || plantelesDisponibles.length === 0
            }
            accent={accent}
          />
        </div>

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
                  isRegreso
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
              className="rounded-xl border border-slate-600 px-4 py-2 text-xs font-medium uppercase tracking-wide text-slate-200 hover:border-slate-400 hover:bg-slate-800/60 transition"
            >
              Limpiar
            </button>
            <button
              type="button"
              onClick={handleCalcular}
              className={`rounded-xl px-5 py-2.5 text-xs md:text-sm font-semibold uppercase tracking-wide text-slate-950 shadow-md transition ${
                isRegreso
                  ? "bg-violet-500 shadow-violet-500/40 hover:bg-violet-400"
                  : "bg-emerald-500 shadow-emerald-500/40 hover:bg-emerald-400"
              }`}
            >
              Calcular beca
            </button>
          </div>
        </div>

        {precioLista !== null && (
          <section className="mt-4 rounded-2xl border border-slate-700 bg-slate-900/80 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
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
            </div>
          </section>
        )}

        {resultadoMonto !== null && resultadoPorcentaje !== null && (
          <section
            className={`mt-4 rounded-2xl border p-4 md:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 ${
              isRegreso
                ? "border-violet-500/40 bg-violet-500/10"
                : "border-emerald-500/40 bg-emerald-500/10"
            }`}
          >
            <div>
              <p
                className={`text-xs font-semibold uppercase tracking-wide ${
                  isRegreso ? "text-violet-300" : "text-emerald-300"
                }`}
              >
                Resultado de la beca
              </p>
              <p
                className={`mt-1 text-lg md:text-2xl font-semibold ${
                  isRegreso ? "text-violet-100" : "text-emerald-100"
                }`}
              >
                Beca del {resultadoPorcentaje}%
              </p>
              <p
                className={`mt-1 text-sm ${
                  isRegreso ? "text-violet-50/90" : "text-emerald-50/90"
                }`}
              >
                Monto mensual estimado de colegiatura con beca aplicada.
              </p>
            </div>
            <div className="text-right">
              <p
                className={`text-xs font-medium ${
                  isRegreso ? "text-violet-200/80" : "text-emerald-200/80"
                }`}
              >
                Colegiatura mensual
              </p>
              <p
                className={`text-2xl md:text-3xl font-bold ${
                  isRegreso ? "text-violet-300" : "text-emerald-300"
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

        <footer className="mt-6 border-t border-slate-800/60 pt-6 text-[11px] text-slate-400 flex flex-col items-center justify-center gap-2 text-center">
          <div className="flex items-center justify-center gap-2">
            <img
              src="/branding/recalc-logo.gif"
              alt="ReCalc Scholarship logo"
              width={96}
              height={32}
              className="h-8 w-auto object-contain opacity-90"
              loading="lazy"
            />
          </div>
          <span>Powered by ReLead©</span>
        </footer>
      </div>
    </div>
  );
};

export default ScholarshipCalculator;
