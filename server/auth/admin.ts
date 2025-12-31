export const ADMIN_EMAILS = ["ricardo.martinezh@relead.com.mx"];

export const isAdminEmail = (email: string) => {
  const normalized = String(email ?? "").trim().toLowerCase();
  if (!normalized) return false;
  return ADMIN_EMAILS.some((entry) => entry.toLowerCase() === normalized);
};
