import React, { useMemo, useState } from "react";

type UniversityKey = "unidep";

type UniversityOption = {
  key: UniversityKey;
  label: string;
  path: string;
};

const UNIVERSITIES: UniversityOption[] = [
  { key: "unidep", label: "UNIDEP", path: "/unidep" },
];

export default function LandingPage() {
  const [selected, setSelected] = useState<UniversityKey | "">("");

  const selectedUniversity = useMemo(
    () => UNIVERSITIES.find((u) => u.key === selected) ?? null,
    [selected]
  );

  const start = () => {
    if (!selectedUniversity) return;
    window.location.assign(selectedUniversity.path);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900/50 shadow-2xl px-6 py-8 md:px-10 md:py-10 recalc-fade-up">
        <header className="text-center space-y-2">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
            ReCalc Scholarship
          </h1>
          <p className="text-sm md:text-base text-slate-300 max-w-xl mx-auto">
            Calcula el porcentaje de beca y la colegiatura estimada según tu
            programa, modalidad, plan y promedio.
          </p>
        </header>

        <div className="mt-8 grid gap-4">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-300 uppercase tracking-wide">
              Selecciona tu Universidad
            </label>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value as UniversityKey)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-slate-50 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-400/70 focus:ring-offset-2 focus:ring-offset-slate-950"
            >
              <option value="" disabled>
                Selecciona una opción
              </option>
              {UNIVERSITIES.map((u) => (
                <option key={u.key} value={u.key}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={start}
            disabled={!selectedUniversity}
            className={`rounded-xl px-5 py-3 text-sm font-semibold uppercase tracking-wide text-slate-950 shadow-md transition ${
              selectedUniversity
                ? "bg-emerald-500 shadow-emerald-500/30 hover:bg-emerald-400"
                : "bg-slate-700 text-slate-300 cursor-not-allowed"
            }`}
          >
            Iniciar
          </button>
        </div>

        <footer className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-center">
          <img
            src="/branding/relead-logo.gif"
            alt="ReLead"
            className="h-32 sm:h-40 md:h-48 w-auto opacity-90"
            loading="lazy"
          />
        </footer>
      </div>
    </div>
  );
}
