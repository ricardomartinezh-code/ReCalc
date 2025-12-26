import React from "react";
import { AccountSettings } from "@stackframe/react";
import { useNavigate } from "react-router-dom";

export default function AccountPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen min-h-[100dvh] bg-slate-950 text-slate-50 flex items-start justify-center p-3 sm:p-4 md:p-6">
      <div className="w-full max-w-4xl rounded-2xl border border-slate-800 bg-slate-900/60 shadow-2xl px-6 py-7 md:px-10 md:py-9 backdrop-blur-sm recalc-fade-up">
        <header className="flex flex-col items-center gap-3 text-center">
          <img
            src="/branding/logo-recalc.png"
            alt="ReCalc Scholarship"
            className="h-[96px] sm:h-[110px] w-auto max-w-[420px] object-contain drop-shadow-[0_10px_24px_rgba(0,0,0,0.45)]"
            loading="lazy"
          />
          <p className="text-sm md:text-base text-slate-300 max-w-xl">
            Administra tu perfil y configuraciones de acceso.
          </p>
        </header>

        <div className="mt-6 rounded-2xl border border-slate-800/80 bg-slate-950/70 px-4 py-5 text-sm text-slate-200">
          <AccountSettings fullPage={false} />
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
