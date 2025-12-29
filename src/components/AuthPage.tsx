import React, { useEffect, useMemo, useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { UNIVERSITY_DOMAINS, UNIVERSITY_LABELS } from "../data/authConfig";
import { isAdminEmail } from "../data/adminAccess";
import { getEmailDomain, isAllowedDomain, setStoredSession } from "../utils/auth";
import { getSelectedSlug, setSelectedSlug } from "../utils/selection";

type AuthMode = "signin" | "signup";

type UniversityOption = {
  key: keyof typeof UNIVERSITY_LABELS;
  label: string;
};

const UNIVERSITIES: UniversityOption[] = Object.entries(UNIVERSITY_LABELS).map(
  ([key, label]) => ({ key: key as keyof typeof UNIVERSITY_LABELS, label })
);

const normalizeSlug = (value: string) => value.trim().toLowerCase();

const resolveInitialSlug = (slug?: string) => {
  const fromParam = normalizeSlug(slug ?? "");
  const fromStorage = normalizeSlug(getSelectedSlug());
  const keys = Object.keys(UNIVERSITY_LABELS);
  if (fromParam && keys.includes(fromParam)) return fromParam;
  if (fromStorage && keys.includes(fromStorage)) return fromStorage;
  return "";
};

export default function AuthPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeSlug, setActiveSlug] = useState(() => resolveInitialSlug(slug));
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const hasGoogleAuth = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);
  const canAuth = Boolean(activeSlug);

  useEffect(() => {
    const resolved = resolveInitialSlug(slug);
    if (resolved && resolved !== activeSlug) {
      setActiveSlug(resolved);
    }
  }, [activeSlug, slug]);

  useEffect(() => {
    if (activeSlug) setSelectedSlug(activeSlug);
  }, [activeSlug]);

  const selectedUniversity = useMemo(
    () => UNIVERSITIES.find((u) => u.key === activeSlug) ?? null,
    [activeSlug]
  );

  const allowedDomains = activeSlug
    ? UNIVERSITY_DOMAINS[activeSlug as keyof typeof UNIVERSITY_DOMAINS]
    : undefined;

  const domainHint = useMemo(() => {
    if (!allowedDomains?.length) return "";
    return allowedDomains.map((domain) => `@${domain}`).join(" o ");
  }, [allowedDomains]);

  const label = selectedUniversity?.label ?? "";
  const urlParams = new URLSearchParams(location.search);
  const errorParam = urlParams.get("error");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (!activeSlug || !allowedDomains) {
      setError("Selecciona una universidad para continuar.");
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();
    if (!trimmedEmail || !trimmedPassword) {
      setError("Completa tu correo y contrasena.");
      return;
    }

    const domain = getEmailDomain(trimmedEmail);
    if (!isAdminEmail(trimmedEmail) && (!domain || !isAllowedDomain(domain, allowedDomains))) {
      setError(`Solo se permiten correos ${domainHint}.`);
      return;
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
      navigate(`/${activeSlug}`, { replace: true });
    } catch (err) {
      setError("No fue posible conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async (credential?: string | null) => {
    setError("");
    if (!credential) {
      setError("No fue posible iniciar sesion con Google.");
      return;
    }
    if (!activeSlug) {
      setError("Selecciona una universidad para continuar.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential, slug: activeSlug }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        email?: string;
        error?: string;
      };
      if (!response.ok) {
        setError(data?.error ?? "No fue posible autenticar con Google.");
        return;
      }
      if (!data?.email) {
        setError("No fue posible validar el correo con Google.");
        return;
      }
      setStoredSession({ email: data.email, slug: activeSlug });
      navigate(`/${activeSlug}`, { replace: true });
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
          {!selectedUniversity ? (
            <div className="space-y-2 rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-4 text-sm text-slate-300">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
                Selecciona universidad
              </p>
              <select
                value={activeSlug}
                onChange={(event) =>
                  setActiveSlug(event.target.value as keyof typeof UNIVERSITY_LABELS)
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-slate-50 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-400/70 focus:ring-offset-2 focus:ring-offset-slate-950"
              >
                <option value="" disabled>
                  Elige una opcion
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
              onClick={() => setMode("signin")}
              className={`rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-wide transition border ${
                mode === "signin"
                  ? "bg-emerald-500/20 border-emerald-400 text-emerald-200"
                  : "border-slate-700 text-slate-300 hover:border-slate-500"
              }`}
            >
              Iniciar sesion
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

          {error ? (
            <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          ) : null}
          {errorParam === "domain" && !error ? (
            <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              Solo se permiten correos {domainHint || "institucionales"}.
            </div>
          ) : null}

          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-5 text-sm text-slate-200">
            <div className="grid gap-4">
              <div className="text-xs uppercase tracking-[0.25em] text-slate-400 text-center">
                {mode === "signup" ? "Crear cuenta" : "Iniciar sesion"}
              </div>
              {hasGoogleAuth && canAuth ? (
                <div className="flex justify-center">
                  <GoogleLogin
                    onSuccess={(credentialResponse) =>
                      handleGoogleLogin(credentialResponse.credential)
                    }
                    onError={() => handleGoogleLogin(null)}
                    useOneTap={false}
                  />
                </div>
              ) : (
                <div className="text-center text-xs text-amber-200">
                  {hasGoogleAuth
                    ? "Selecciona una universidad para continuar."
                    : "Google no esta configurado en este entorno."}
                </div>
              )}
              <div className="text-center text-xs text-slate-400">
                o continua con correo y contrasena
              </div>
              <form onSubmit={handleSubmit} className="grid gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-300 uppercase tracking-wide">
                    Correo institucional
                  </label>
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
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
                    Contrasena
                  </label>
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    type="password"
                    placeholder="Minimo 6 caracteres"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-slate-50 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-400/70 focus:ring-offset-2 focus:ring-offset-slate-950"
                  />
                </div>
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
                    : mode === "signup"
                      ? "Crear cuenta"
                      : "Iniciar sesion"}
                </button>
              </form>
            </div>
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
