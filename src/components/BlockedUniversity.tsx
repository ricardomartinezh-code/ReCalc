import React from "react";

interface BlockedUniversityProps {
  label: string;
}

export default function BlockedUniversity({ label }: BlockedUniversityProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900/50 shadow-2xl px-6 py-7 md:px-10 md:py-9 recalc-fade-up">
        <header className="text-center space-y-3">
          <div className="flex flex-col items-center gap-2">
            <img
              src="/branding/logo-recalc.png"
              alt="ReCalc Scholarship"
              className="h-[168px] sm:h-[192px] md:h-[216px] w-auto max-w-[520px] md:max-w-[640px] object-contain drop-shadow-[0_10px_24px_rgba(0,0,0,0.45)]"
              loading="lazy"
            />
            <p className="text-[11px] text-slate-400">
              Powered by ReLead © {new Date().getFullYear()}
            </p>
          </div>
        </header>

        <section className="mt-6 rounded-2xl border border-slate-800/70 bg-slate-950/40 p-5 text-center">
          <p className="text-sm text-slate-200">
            La ruta para <span className="font-semibold">{label}</span> está
            bloqueada por el momento.
          </p>
          <p className="mt-2 text-xs text-slate-400">
            Selecciona otra universidad para continuar.
          </p>

          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => window.location.assign("/")}
              className="rounded-xl border border-slate-600 px-4 py-2 text-xs font-medium uppercase tracking-wide text-slate-200 hover:border-slate-400 hover:bg-slate-800/60 transition"
            >
              Regresar
            </button>
          </div>
        </section>

        <footer className="mt-8 pt-5 border-t border-slate-800/60 flex flex-col items-center justify-center gap-2 text-center">
          <img
            src="/branding/logo-relead.png"
            alt="ReLead"
            className="h-[72px] w-auto opacity-90"
            loading="lazy"
          />
          <p className="text-[11px] text-slate-400">
            Powered by ReLead © {new Date().getFullYear()}
          </p>
        </footer>
      </div>
    </div>
  );
}
