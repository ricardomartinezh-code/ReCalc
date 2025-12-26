import React, { useMemo, useState } from "react";
import { UNIVERSITY_DOMAINS } from "../data/authConfig";
import { getEmailDomain, getStoredSession, isAllowedDomain } from "../utils/auth";

type UniversityKey = "unidep" | "utc" | "ula";

type UniversityOption = {
  key: UniversityKey;
  label: string;
};

const UNIVERSITIES: UniversityOption[] = [
  { key: "unidep", label: "UNIDEP" },
  { key: "utc", label: "UTC (bloqueado)" },
  { key: "ula", label: "ULA (bloqueado)" },
];

export default function LandingPage() {
  const [selected, setSelected] = useState<UniversityKey | "">("");
  const session = getStoredSession();
  const emailDomain = session ? getEmailDomain(session.email) : "";
  const hasUnidepAccess =
    Boolean(session) &&
    session.slug === "unidep" &&
    isAllowedDomain(emailDomain, UNIVERSITY_DOMAINS.unidep);

  const selectedUniversity = useMemo(
    () => UNIVERSITIES.find((u) => u.key === selected) ?? null,
    [selected]
  );

  const start = () => {
    if (!selectedUniversity) return;
    if (selectedUniversity.key === "unidep" && hasUnidepAccess) {
      window.location.assign("/unidep");
      return;
    }
    if (selectedUniversity.key === "utc") {
      window.location.assign("/utc");
      return;
    }
    if (selectedUniversity.key === "ula") {
      window.location.assign("/ula");
      return;
    }
    window.location.assign(`/auth/${selectedUniversity.key}`);
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-slate-950 text-slate-50 flex items-center justify-center p-3 sm:p-4 md:p-6">
      <div className="w-full max-w-2xl lg:max-w-3xl rounded-2xl border border-slate-800 bg-slate-900/60 shadow-2xl px-6 py-7 md:px-10 md:py-9 lg:px-12 lg:py-10 backdrop-blur-sm recalc-fade-up">
        <header className="text-center space-y-3">
          <div className="flex flex-col items-center gap-2">
            <img
              src="/branding/logo-recalc.png"
              alt="ReCalc Scholarship"
              className="h-[136px] sm:h-[154px] md:h-[170px] w-auto max-w-[460px] sm:max-w-[520px] md:max-w-[580px] object-contain drop-shadow-[0_10px_24px_rgba(0,0,0,0.45)]"
              loading="lazy"
            />
          </div>
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

        <footer className="mt-8 pt-5 border-t border-slate-800/60 flex flex-col items-center justify-center gap-2 text-center">
          <img
            src="/branding/logo-relead.png"
            alt="ReLead"
            className="h-[64px] w-auto max-w-[200px] opacity-90 object-contain"
            loading="lazy"
          />
        </footer>
      </div>
    </div>
  );
}
