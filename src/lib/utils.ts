import clsx, { type ClassValue } from "clsx";
export const cn = (...v: ClassValue[]) => clsx(v);
export const fmtDate = (d: string | Date | null | undefined) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "-");
export const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
