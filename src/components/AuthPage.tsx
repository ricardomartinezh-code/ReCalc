import React, { useEffect, useMemo, useState } from "react";
import { SignIn, SignUp, useUser } from "@stackframe/react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { UNIVERSITY_DOMAINS, UNIVERSITY_LABELS } from "../data/authConfig";
import { getSelectedSlug, setSelectedSlug } from "../utils/selection";

type AuthMode = "sign-in" | "sign-up";

type UniversityOption = {
  key: keyof typeof UNIVERSITY_LABELS;
  label: string;
};

const UNIVERSITIES: UniversityOption[] = Object.entries(UNIVERSITY_LABELS).map(
  ([key, label]) => ({ key: key as keyof typeof UNIVERSITY_LABELS, label })
);

const normalizeSlug = (slug: string) => slug.trim().toLowerCase();

const resolveInitialSlug = () => {
  const stored = normalizeSlug(getSelectedSlug());
  if (!stored) return "";
  const keys = Object.keys(UNIVERSITY_LABELS);
  return keys.includes(stored) ? stored : "";
};

export default function AuthPage() {
  const { mode } = useParams();
  const [activeSlug, setActiveSlug] = useState(resolveInitialSlug);
  const navigate = useNavigate();
  const location = useLocation();
  const user = useUser({ or: "return-null" });

  const selectedUniversity = useMemo(
    () => UNIVERSITIES.find((u) => u.key === activeSlug) ?? null,
    [activeSlug]
  );

  const authMode: AuthMode = mode === "sign-up" ? "sign-up" : "sign-in";
  const domainHint = useMemo(() => {
    if (!activeSlug) return "";
    const domains = UNIVERSITY_DOMAINS[activeSlug as keyof typeof UNIVERSITY_DOMAINS];
    if (!domains?.length) return "";
    return domains.map((domain) => `@${domain.replace(/^@/, "")}`).join(" o ");
  }, [activeSlug]);
  const searchParams = new URLSearchParams(location.search);
  const errorParam = searchParams.get("error");

  useEffect(() => {
    if (!activeSlug) return;
    setSelectedSlug(activeSlug);
  }, [activeSlug]);

  useEffect(() => {
    if (!user || !activeSlug) return;
    navigate(`/${activeSlug}`, { replace: true });
  }, [activeSlug, navigate, user]);

  return (
    <div className="recalc-auth min-h-screen min-h-[100dvh] bg-slate-950 text-slate-50 flex items-center justify-center p-3 sm:p-4 md:p-6">
      <div className="w-full max-w-2xl lg:max-w-3xl rounded-2xl border border-slate-800 bg-slate-900/60 shadow-2xl px-6 py-7 md:px-10 md:py-9 lg:px-12 lg:py-10 backdrop-blur-sm recalc-fade-up">
        <header className="text-center space-y-3">
          <div className="flex flex-col items-center gap-2">
            <img
              src="/branding/logo-recalc.png"
              alt="ReCalc Scholarship"
              className="h-[120px] sm:h-[136px] md:h-[150px] w-auto max-w-[420px] sm:max-w-[480px] md:max-w-[520px] object-contain drop-shadow-[0_10px_24px_rgba(0,0,0,0.45)]"
              loading="lazy"
            />
            {selectedUniversity ? (
              <span className="text-xs uppercase tracking-[0.4em] text-slate-400">
                {selectedUniversity.label}
              </span>
            ) : null}
          </div>
          <p className="text-sm md:text-base text-slate-300 max-w-xl mx-auto">
            Accede con tu cuenta institucional para entrar al panel.
          </p>
        </header>

        <div className="mt-8 grid gap-6">
          {errorParam === "domain" ? (
            <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              Solo se permiten correos {domainHint || "institucionales"}.
            </div>
          ) : null}
          {!selectedUniversity ? (
            <div className="space-y-2 rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-4 text-sm text-slate-300">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
                Selecciona universidad
              </p>
              <select
                value={activeSlug}
                onChange={(event) => setActiveSlug(event.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-slate-50 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-400/70 focus:ring-offset-2 focus:ring-offset-slate-950"
              >
                <option value="" disabled>
                  Elige una opción
                </option>
                {UNIVERSITIES.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/auth/sign-in")}
              className={`rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-wide transition border ${
                authMode === "sign-in"
                  ? "bg-emerald-500/20 border-emerald-400 text-emerald-200"
                  : "border-slate-700 text-slate-300 hover:border-slate-500"
              }`}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              onClick={() => navigate("/auth/sign-up")}
              className={`rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-wide transition border ${
                authMode === "sign-up"
                  ? "bg-emerald-500/20 border-emerald-400 text-emerald-200"
                  : "border-slate-700 text-slate-300 hover:border-slate-500"
              }`}
            >
              Crear cuenta
            </button>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-5 text-sm text-slate-200">
            {authMode === "sign-up" ? (
              <SignUp fullPage={false} automaticRedirect={false} />
            ) : (
              <SignIn fullPage={false} automaticRedirect={false} />
            )}
          </div>
        </div>

        <footer className="mt-8 pt-5 border-t border-slate-800/60 flex flex-col items-center justify-center gap-2 text-center">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="text-xs uppercase tracking-[0.3em] text-slate-400 hover:text-slate-200 transition"
          >
            Volver al inicio
          </button>
        </footer>
      </div>
    </div>
  );
}
