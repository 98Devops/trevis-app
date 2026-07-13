/// <reference types="vite/client" />
/**
 * Brand + vertical configuration — one codebase, two deployments.
 *
 *   - PropNest (demo / portfolio / future SaaS foundation): the defaults below.
 *   - Trevis (the client's production instance): its own Netlify deploy sets
 *       VITE_BRAND_NAME=Trevis
 *       VITE_VERTICAL=student
 *     plus VITE_SUPABASE_URL/KEY for his database.
 *
 * This only relabels the UI. It never touches the coverage engine, so both
 * brands run the identical, proven billing logic.
 */

export const BRAND_NAME: string =
  (import.meta.env.VITE_BRAND_NAME as string | undefined)?.trim() || "PropNest";

export type Vertical = "student" | "tenant";

/** "student" relabels occupant → Student/Students; anything else stays Tenant. */
export const VERTICAL: Vertical =
  (import.meta.env.VITE_VERTICAL as string | undefined)?.trim().toLowerCase() === "student"
    ? "student"
    : "tenant";
