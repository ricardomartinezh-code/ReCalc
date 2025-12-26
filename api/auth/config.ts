export const UNIVERSITY_DOMAINS = {
  unidep: ["unidep.mx", "unidep.edu.mx", "*.unidep.edu.mx"],
} as const;

type AllowedDomains = readonly string[];

function normalizeDomainEntry(entry: string): string {
  const trimmed = entry.trim().toLowerCase();
  if (!trimmed) return "";
  return trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
}

export function getEmailDomain(email: string): string {
  const parts = email.trim().toLowerCase().split("@");
  if (parts.length !== 2) return "";
  const domain = parts[1];
  return domain ? domain : "";
}

export function isAllowedDomain(domain: string, allowedDomains: AllowedDomains) {
  const normalized = domain.trim().toLowerCase();
  if (!normalized) return false;
  return allowedDomains.some((entry) => {
    const allowed = normalizeDomainEntry(entry);
    if (!allowed) return false;
    if (allowed.startsWith("*.")) {
      const base = allowed.slice(2);
      if (!base) return false;
      return normalized === base || normalized.endsWith(`.${base}`);
    }
    return normalized === allowed;
  });
}
