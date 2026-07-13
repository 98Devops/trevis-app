/**
 * Payment-method vocabulary — SINGLE SOURCE OF TRUTH for every payment form.
 *
 * Must match the methods used in the production ledger (the legacy system's
 * list: p3_modals.jsx). The first template version invented its own generic
 * list (Mobile Money/Card), which made real methods like EcoCash impossible
 * to record even though they exist throughout the payment history.
 */
export const PAYMENT_METHODS = [
  "Cash",
  "EcoCash",
  "Bank Transfer",
  "Zipit",
  "Swipe",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
