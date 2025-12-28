import React, { Suspense } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { UNIVERSITY_DOMAINS } from "./data/authConfig";
import {
  clearStoredSession,
  getEmailDomain,
  getStoredSession,
  isAllowedDomain,
} from "./utils/auth";

const LandingPage = React.lazy(() => import("./components/LandingPage"));
const BlockedUniversity = React.lazy(
  () => import("./components/BlockedUniversity")
);
const ScholarshipCalculator = React.lazy(
  () => import("./components/ScholarshipCalculator")
);
const AuthPage = React.lazy(() => import("./components/AuthPage"));

type Programa = "nuevo" | "regreso" | "academia";

const resolveProgram = (segment?: string): Programa | undefined => {
  if (!segment) return undefined;
  const normalized = segment.toLowerCase();
  if (normalized === "regresos") return "regreso";
  if (normalized === "academia") return "academia";
  if (normalized === "ni" || normalized === "nuevo") return "nuevo";
  return undefined;
};

const RequireAuth: React.FC<{ slug: string; children: React.ReactNode }> = ({
  slug,
  children,
}) => {
  const session = getStoredSession();
  const emailDomain = session ? getEmailDomain(session.email) : "";
  const allowedDomains = UNIVERSITY_DOMAINS[slug as keyof typeof UNIVERSITY_DOMAINS];
  const hasAccess =
    Boolean(session) && Boolean(allowedDomains) && isAllowedDomain(emailDomain, allowedDomains);

  if (!hasAccess) {
    clearStoredSession();
    return <Navigate to={`/auth/${slug}?error=domain`} replace />;
  }
  return <>{children}</>;
};

const UnidepRoute: React.FC = () => {
  const { program } = useParams();
  const initialProgram = resolveProgram(program);
  return (
    <RequireAuth slug="unidep">
      <ScholarshipCalculator university="unidep" initialProgram={initialProgram} />
    </RequireAuth>
  );
};

const PageLoader = () => (
  <div className="min-h-screen min-h-[100dvh] bg-slate-950 text-slate-50 flex items-center justify-center p-6">
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-6 py-5 text-sm text-slate-300 shadow-xl">
      Cargando...
    </div>
  </div>
);

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth/:slug" element={<AuthPage />} />
        <Route path="/unidep" element={<UnidepRoute />} />
        <Route path="/unidep/:program" element={<UnidepRoute />} />
        <Route path="/utc" element={<BlockedUniversity label="UTC" />} />
        <Route path="/ula" element={<BlockedUniversity label="ULA" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
