import React from "react";

const CORNER_LOGO_SRC = "/branding/recalc-logo.gif";

export default function CornerLogo() {
  return (
    <button
      type="button"
      aria-label="ReCalc Scholarship"
      className="fixed bottom-4 right-4 z-50 hidden rounded-full bg-slate-950/60 p-2 ring-1 ring-white/10 shadow-lg backdrop-blur transition hover:bg-slate-950/80 sm:block"
    >
      <img
        src={CORNER_LOGO_SRC}
        alt="ReCalc Scholarship logo"
        width={44}
        height={44}
        className="h-11 w-11 rounded-full object-contain"
        loading="lazy"
      />
    </button>
  );
}
