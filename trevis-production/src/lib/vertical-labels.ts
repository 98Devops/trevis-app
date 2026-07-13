/**
 * Vertical-neutral label config (UI brief §7).
 *
 * The active label set is chosen by VERTICAL (from brand.ts, driven by the
 * VITE_VERTICAL build env). Trevis's deploy sets VITE_VERTICAL=student to get
 * Student/Students; the PropNest demo defaults to the generic Tenant set. Every
 * label-aware component reads useLabels(), so the swap is a config change, not a
 * rewrite — and it never touches the engine.
 */

import { VERTICAL } from "./brand";

export type RatePeriod = "month" | "night";

export type VerticalLabels = {
  /** Singular noun for the person being billed. */
  occupant: string;
  /** Plural noun. */
  occupantPlural: string;
  /** Verb form of "add a new one" — used on CTAs. */
  addOccupant: string;
  /** Unit being occupied: room / unit / listing. */
  unit: string;
  unitPlural: string;
  /** Building-level container. */
  property: string;
  /** Billing cadence. Drives "$120/mo" vs "$45/night" affordances. */
  ratePeriod: RatePeriod;
  /** Currency glyph from settings. */
  currencySymbol: string;
};

export const TENANT_LABELS: VerticalLabels = {
  occupant:       "Tenant",
  occupantPlural: "Tenants",
  addOccupant:    "Add tenant",
  unit:           "Room",
  unitPlural:     "Rooms",
  property:       "Property",
  ratePeriod:     "month",
  currencySymbol: "$",
};

export const STUDENT_LABELS: VerticalLabels = {
  occupant:       "Student",
  occupantPlural: "Students",
  addOccupant:    "Add student",
  unit:           "Room",
  unitPlural:     "Rooms",
  property:       "Property",
  ratePeriod:     "month",
  currencySymbol: "$",
};

/** The label set for this build, chosen by the VITE_VERTICAL env (brand.ts). */
export const ACTIVE_LABELS: VerticalLabels =
  VERTICAL === "student" ? STUDENT_LABELS : TENANT_LABELS;

// Components import the hook (not a constant) so the active set can switch via
// env without touching any call site.
export function useLabels(): VerticalLabels {
  return ACTIVE_LABELS;
}
