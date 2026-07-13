export const money = (n: number) =>
  "$" + Math.round(n).toLocaleString();

export const moneyCompact = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1) + "M";
  if (Math.abs(n) >= 1_000) return "$" + (n / 1_000).toFixed(1) + "k";
  return "$" + Math.round(n).toLocaleString();
};

export const formatDate = (iso: string) => {
  try {
    // Parse the calendar day from its parts so a date-only string never drifts a
    // day across timezones (matches the engine's parseLocalDate). Include the year
    // so multi-year payment histories are unambiguous (e.g. "01 Jul 2025" vs "01 Jul 2026").
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
};
