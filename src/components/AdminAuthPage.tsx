import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { isAdminEmail } from "../data/adminAccess";
import { setStoredSession } from "../utils/auth";

const ADMIN_PASSWORD = "xoSro2-zuggap-forwof";

export default function AdminAuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      setError("Completa tu correo y contrasena.");
      return;
    }

    if (!isAdminEmail(trimmedEmail) || trimmedPassword !== ADMIN_PASSWORD) {
      setError("Credenciales invalidas.");
      return;
    }

    setLoading(true);
    try {
      setStoredSession({ email: trimmedEmail, slug: "unidep" });
      navigate("/admin", { replace: true });
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
            <span className="text-xs uppercase tracking-[0.4em] text-slate-400">
              Acceso admin
            </span>
          </div>
          <p className="text-sm md:text-base text-slate-300 max-w-xl mx-auto">
            Ingresa con tus credenciales para administrar configuraciones.
          </p>
        </header>

        <div className="mt-8 grid gap-6">
          {error ? (
            <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-300 uppercase tracking-wide">
                Correo
              </label>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                placeholder="correo@relead.com.mx"
                className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-slate-50 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-400/70 focus:ring-offset-2 focus:ring-offset-slate-950"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-300 uppercase tracking-wide">
                Contrasena
              </label>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                placeholder="Tu contrasena"
                className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-slate-50 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-400/70 focus:ring-offset-2 focus:ring-offset-slate-950"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className={`w-full rounded-xl px-5 py-3 text-sm font-semibold uppercase tracking-wide text-slate-950 shadow-md transition ${
                loading
                  ? "bg-slate-700 text-slate-300 cursor-not-allowed"
                  : "bg-emerald-500 shadow-emerald-500/30 hover:bg-emerald-400"
              }`}
            >
              {loading ? "Validando..." : "Iniciar sesion"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
