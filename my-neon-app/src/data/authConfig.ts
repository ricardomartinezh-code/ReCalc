export const UNIVERSITY_DOMAINS = {
  unidep: ["unidep.mx", "unidep.edu.mx", "*.unidep.edu.mx"],
} as const;

export const UNIVERSITY_LABELS: Record<keyof typeof UNIVERSITY_DOMAINS, string> = {
  unidep: "UNIDEP",
};
