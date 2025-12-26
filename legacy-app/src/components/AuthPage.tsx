import React, { useEffect, useMemo, useState } from "react";
import { UNIVERSITY_DOMAINS, UNIVERSITY_LABELS } from "../data/authConfig";
import { getEmailDomain, isAllowedDomain, setStoredSession } from "../utils/auth";

type AuthMode = "signin" | "signup";

type AuthPageProps = {
  slug?: string;
};

const PASSWORD_MIN_LENGTH = 6;

export default function AuthPage({ slug }: AuthPageProps) {
  const normalizedSlug = (slug ?? "").toLowerCase();
  const initialSlug =
    normalizedSlug && UNIVERSITY_DOMAINS[normalizedSlug as keyof typeof UNIVERSITY_DOMAINS]
      ? normalizedSlug
      : "";
  const [activeSlug, setActiveSlug] = useState(initialSlug);

  useEffect(() => {
    if (
      normalizedSlug &&
      UNIVERSITY_DOMAINS[normalizedSlug as keyof typeof UNIVERSITY_DOMAINS] &&
      normalizedSlug !== activeSlug
    ) {
      setActiveSlug(normalizedSlug);
    }
  }, [activeSlug, normalizedSlug]);

  const allowedDomains = activeSlug
    ? UNIVERSITY_DOMAINS[activeSlug as keyof typeof UNIVERSITY_DOMAINS]
    : undefined;
  const label =
    activeSlug && allowedDomains
      ? UNIVERSITY_LABELS[activeSlug as keyof typeof UNIVERSITY_LABELS]
      : "";

  const domainHint = useMemo(() => {
    if (!allowedDomains?.length) return "";
    const entries = allowedDomains
      .map((domain) => {
        const normalized = domain.trim().toLowerCase();
        if (!normalized) return "";
        const cleaned = normalized.startsWith("@") ? normalized.slice(1) : normalized;
        return cleaned.startsWith("*.") ? cleaned.slice(2) : cleaned;
      })
      .filter(Boolean);
    const unique = Array.from(new Set(entries));
    return unique.map((domain) => `@${domain}`).join(" o ");
  }, [allowedDomains]);

  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isValidSlug = Boolean(allowedDomains);
  const availableUniversities = useMemo(
    () =>
      Object.keys(UNIVERSITY_DOMAINS).map((key) => ({
        key,
        label: UNIVERSITY_LABELS[key as keyof typeof UNIVERSITY_LABELS] ?? key,
      })),
    []
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (!isValidSlug) {
      setError("Universidad no disponible para acceso.");
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      setError("Completa tu correo y contraseña.");
      return;
    }

    if (mode === "signup") {
      const domain = getEmailDomain(trimmedEmail);
      if (!isAllowedDomain(domain, allowedDomains)) {
        setError(`Solo se permiten correos ${domainHint}.`);
        return;
      }
      if (trimmedPassword.length < PASSWORD_MIN_LENGTH) {
        setError("La contraseña debe tener al menos 6 caracteres.");
        return;
      }
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmedEmail,
          password: trimmedPassword,
          slug: activeSlug,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        email?: string;
        error?: string;
      };

      if (!response.ok) {
        setError(data?.error ?? "No fue posible autenticar.");
        return;
      }

      setStoredSession({ email: data.email ?? trimmedEmail, slug: activeSlug });
      window.location.assign(`/${activeSlug}`);
    } catch (err) {
      setError("No fue posible conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-slate-950 text-slate-50 flex items-center justify-center p-3 sm:p-4 md:p-6">
      <div className="w-full max-w-2xl lg:max-w-3xl rounded-2xl border border-slate-800 bg-slate-900/60 shadow-2xl px-6 py-7 md:px-10 md:py-9 lg:px-12 lg:py-10 backdrop-blur-sm recalc-fade-up">
        <header className="text-center space-y-3">
          <div className="flex flex-col items-center gap-2">
            <img
              src="/branding/logo-recalc.png"
              alt="ReCalc Scholarship"
              className="h-[120px] sm:h-[136px] md:h-[150px] w-auto max-w-[420px] sm:max-w-[480px] md:max-w-[520px] object-contain drop-shadow-[0_10px_24px_rgba(0,0,0,0.45)]"
              loading="lazy"
            />
            {label ? (
              <span className="text-xs uppercase tracking-[0.4em] text-slate-400">
                {label}
              </span>
            ) : null}
          </div>
          <p className="text-sm md:text-base text-slate-300 max-w-xl mx-auto">
            Accede con tu cuenta institucional para entrar al panel.
          </p>
        </header>

        <div className="mt-8 grid gap-6">
          {!isValidSlug ? (
            <div className="space-y-2 rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-4 text-sm text-slate-300">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
                Selecciona universidad
              </p>
              <select
                value={activeSlug}
                onChange={(event) => {
                  setActiveSlug(event.target.value);
                  setError("");
                }}
                className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-slate-50 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-400/70 focus:ring-offset-2 focus:ring-offset-slate-950"
              >
                <option value="" disabled>
                  Elige una opción
                </option>
                {availableUniversities.map((option) => (
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
              onClick={() => setMode("signin")}
              className={`rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-wide transition border ${
                mode === "signin"
                  ? "bg-emerald-500/20 border-emerald-400 text-emerald-200"
                  : "border-slate-700 text-slate-300 hover:border-slate-500"
              }`}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-wide transition border ${
                mode === "signup"
                  ? "bg-emerald-500/20 border-emerald-400 text-emerald-200"
                  : "border-slate-700 text-slate-300 hover:border-slate-500"
              }`}
            >
              Crear cuenta
            </button>
          </div>

          <form onSubmit={submit} className="grid gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-300 uppercase tracking-wide">
                Correo institucional
              </label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder={domainHint ? `nombre${domainHint}` : "correo@universidad.edu"}
                className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-slate-50 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-400/70 focus:ring-offset-2 focus:ring-offset-slate-950"
              />
              {mode === "signup" && domainHint ? (
                <p className="text-xs text-slate-400">Solo se aceptan {domainHint}.</p>
              ) : null}
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-300 uppercase tracking-wide">
                Contraseña
              </label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="Mínimo 6 caracteres"
                className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-slate-50 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-400/70 focus:ring-offset-2 focus:ring-offset-slate-950"
              />
            </div>

            {error ? (
              <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className={`rounded-xl px-5 py-3 text-sm font-semibold uppercase tracking-wide text-slate-950 shadow-md transition ${
                loading
                  ? "bg-slate-700 text-slate-300 cursor-not-allowed"
                  : "bg-emerald-500 shadow-emerald-500/30 hover:bg-emerald-400"
              }`}
            >
              {loading
                ? "Procesando..."
                : mode === "signin"
                  ? "Iniciar sesión"
                  : "Crear cuenta"}
            </button>
          </form>

          {!isValidSlug ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm text-slate-300">
              La universidad seleccionada no tiene acceso habilitado.
            </div>
          ) : null}
        </div>

        <footer className="mt-8 pt-5 border-t border-slate-800/60 flex flex-col items-center justify-center gap-2 text-center">
          <button
            type="button"
            onClick={() => window.location.assign("/")}
            className="text-xs uppercase tracking-[0.3em] text-slate-400 hover:text-slate-200 transition"
          >
            Volver al inicio
          </button>
        </footer>
      </div>
    </div>
  );
}
