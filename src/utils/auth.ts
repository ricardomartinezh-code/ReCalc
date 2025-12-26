export type AuthSession = {
  email: string;
  slug: string;
};

const STORAGE_KEY = "recalc_auth_session";

export function getEmailDomain(email: string): string {
  const parts = email.trim().toLowerCase().split("@");
  if (parts.length !== 2) return "";
  const domain = parts[1];
  return domain ? domain : "";
}

export function isAllowedDomain(domain: string, allowedDomains: readonly string[]) {
  const normalized = domain.trim().toLowerCase();
  if (!normalized) return false;
  return allowedDomains.some((entry) => {
    const allowed = entry.trim().toLowerCase();
    if (!allowed) return false;
    const normalizedAllowed = allowed.startsWith("@") ? allowed.slice(1) : allowed;
    if (!normalizedAllowed) return false;
    if (normalizedAllowed.startsWith("*.")) {
      const base = normalizedAllowed.slice(2);
      if (!base) return false;
      return normalized === base || normalized.endsWith(`.${base}`);
    }
    return normalized === normalizedAllowed;
  });
}

export function getStoredSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed?.email || !parsed?.slug) return null;
    return parsed;
  } catch (err) {
    return null;
  }
}

export function setStoredSession(session: AuthSession) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
