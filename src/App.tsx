import LandingPage from "./components/LandingPage";
import BlockedUniversity from "./components/BlockedUniversity";
import ScholarshipCalculator from "./components/ScholarshipCalculator";

function getSegments(pathname: string): string[] {
  const cleaned = pathname.replace(/\/+$/, "");
  return cleaned.replace(/^\/+/, "").split("/").filter(Boolean);
}

function App() {
  const [topSegment, subSegment] = getSegments(window.location.pathname).map((s) =>
    s.toLowerCase()
  );
  if (topSegment === "unidep") {
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
