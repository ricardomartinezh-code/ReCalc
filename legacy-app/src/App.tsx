import { useEffect } from "react";
import LandingPage from "./components/LandingPage";
import BlockedUniversity from "./components/BlockedUniversity";
import ScholarshipCalculator from "./components/ScholarshipCalculator";
import AuthPage from "./components/AuthPage";
import { UNIVERSITY_DOMAINS } from "./data/authConfig";
import { getEmailDomain, getStoredSession, isAllowedDomain } from "./utils/auth";

function getSegments(pathname: string): string[] {
  const cleaned = pathname.replace(/\/+$/, "");
  return cleaned.replace(/^\/+/, "").split("/").filter(Boolean);
}

function RedirectToAuth({ slug }: { slug: string }) {
  useEffect(() => {
    window.location.replace(`/auth/${slug}`);
  }, [slug]);

  return (
    <div className="min-h-screen min-h-[100dvh] bg-slate-950 text-slate-50 flex items-center justify-center p-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-6 py-5 text-sm text-slate-300 shadow-xl">
        Redirigiendo al inicio de sesión...
      </div>
    </div>
  );
}

function App() {
  const [topSegment, subSegment] = getSegments(window.location.pathname).map((s) =>
    s.toLowerCase()
  );
  if (topSegment === "auth") {
    return <AuthPage slug={subSegment} />;
  }
  if (topSegment === "unidep") {
    const session = getStoredSession();
    const emailDomain = session ? getEmailDomain(session.email) : "";
    const hasUnidepAccess =
      Boolean(session) &&
      session.slug === "unidep" &&
      isAllowedDomain(emailDomain, UNIVERSITY_DOMAINS.unidep);
    if (!hasUnidepAccess) {
      return <RedirectToAuth slug="unidep" />;
    }
    const initialProgram =
      subSegment === "regresos"
        ? "regreso"
        : subSegment === "academia"
          ? "academia"
          : subSegment === "ni" || subSegment === "nuevo"
            ? "nuevo"
            : undefined;
    return (
      <ScholarshipCalculator
        university="unidep"
        initialProgram={initialProgram}
      />
    );
  }
  if (topSegment === "utc") return <BlockedUniversity label="UTC" />;
  if (topSegment === "ula") return <BlockedUniversity label="ULA" />;
  return <LandingPage />;
}

export default App;
