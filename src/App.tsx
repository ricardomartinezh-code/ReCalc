import React, { Suspense } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { StackHandler, useStackApp, useUser } from "@stackframe/react";
import { UNIVERSITY_DOMAINS } from "./data/authConfig";
import { getEmailDomain, isAllowedDomain } from "./utils/auth";
import { setSelectedSlug } from "./utils/selection";

const LandingPage = React.lazy(() => import("./components/LandingPage"));
const BlockedUniversity = React.lazy(
  () => import("./components/BlockedUniversity")
);
const ScholarshipCalculator = React.lazy(
  () => import("./components/ScholarshipCalculator")
);
const AuthPage = React.lazy(() => import("./components/AuthPage"));
const AccountPage = React.lazy(() => import("./components/AccountPage"));

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
  const user = useUser({ or: "return-null" });
  const stackApp = useStackApp();

  React.useEffect(() => {
    if (!user) {
      setSelectedSlug(slug);
    }
  }, [slug, user]);

  React.useEffect(() => {
    if (!user) return;
    const email = user.primaryEmail ?? "";
    const domain = getEmailDomain(email);
    const allowedDomains = UNIVERSITY_DOMAINS[slug as keyof typeof UNIVERSITY_DOMAINS];
    if (!allowedDomains || !isAllowedDomain(domain, allowedDomains)) {
      setSelectedSlug(slug);
      void stackApp.signOut({
        redirectUrl: `/auth/sign-in?error=domain`,
      });
    }
  }, [slug, stackApp, user]);

  if (user) {
    const domain = getEmailDomain(user.primaryEmail ?? "");
    const allowedDomains = UNIVERSITY_DOMAINS[slug as keyof typeof UNIVERSITY_DOMAINS];
    if (!allowedDomains || !isAllowedDomain(domain, allowedDomains)) {
      return <Navigate to="/auth/sign-in?error=domain" replace />;
    }
  }

  if (!user) {
    return <Navigate to="/auth/sign-in" replace />;
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
        <Route path="/auth" element={<Navigate to="/auth/sign-in" replace />} />
        <Route path="/auth/:mode" element={<AuthPage />} />
        <Route path="/account/*" element={<AccountPage />} />
        <Route path="/handler/*" element={<StackHandler fullPage />} />
        <Route path="/unidep" element={<UnidepRoute />} />
        <Route path="/unidep/:program" element={<UnidepRoute />} />
        <Route path="/utc" element={<BlockedUniversity label="UTC" />} />
        <Route path="/ula" element={<BlockedUniversity label="ULA" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
