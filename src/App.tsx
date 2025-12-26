import React from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { StackHandler, useUser } from "@stackframe/react";
import LandingPage from "./components/LandingPage";
import AuthPage from "./components/AuthPage";
import AccountPage from "./components/AccountPage";
import BlockedUniversity from "./components/BlockedUniversity";
import ScholarshipCalculator from "./components/ScholarshipCalculator";
import { setSelectedSlug } from "./utils/selection";

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

  React.useEffect(() => {
    if (!user) {
      setSelectedSlug(slug);
    }
  }, [slug, user]);

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

export default function App() {
  return (
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
  );
}
