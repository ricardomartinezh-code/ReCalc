import ScholarshipCalculator from "./components/ScholarshipCalculator";

type UniversityKey = "demo" | "unidep";

function getUniversityFromPath(pathname: string): UniversityKey {
  const cleaned = pathname.replace(/\/+$/, "");
  const segment = cleaned.replace(/^\/+/, "").split("/")[0] ?? "";
  return segment.toLowerCase() === "unidep" ? "unidep" : "demo";
}

function App() {
  const university = getUniversityFromPath(window.location.pathname);

  const onUniversityChange = (next: UniversityKey) => {
    const target = next === "unidep" ? "/unidep" : "/";
    const current = window.location.pathname.replace(/\/+$/, "") || "/";
    if (current !== target) window.location.assign(target);
  };

  return (
    <ScholarshipCalculator
      university={university}
      onUniversityChange={onUniversityChange}
    />
  );
}

export default App;
