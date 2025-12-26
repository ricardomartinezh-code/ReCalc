const STORAGE_KEY = "recalc_selected_slug";

export const getSelectedSlug = () => {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(STORAGE_KEY) ?? "";
};

export const setSelectedSlug = (slug: string) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, slug);
};

export const clearSelectedSlug = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
};
