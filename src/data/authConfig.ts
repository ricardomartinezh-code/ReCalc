export const UNIVERSITY_DOMAINS = {
  unidep: ["unidep.edu.mx"],
} as const;

export const UNIVERSITY_LABELS: Record<keyof typeof UNIVERSITY_DOMAINS, string> = {
  unidep: "UNIDEP",
};
