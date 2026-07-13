import { describe, it, expect } from "vitest";
import { localTodayISO, isFutureDate } from "./dateGuards";

describe("localTodayISO", () => {
  it("formats a local date as YYYY-MM-DD (month is 0-based input)", () => {
    expect(localTodayISO(new Date(2026, 5, 27))).toBe("2026-06-27"); // June 27
  });

  it("zero-pads single-digit month and day", () => {
    expect(localTodayISO(new Date(2026, 0, 3))).toBe("2026-01-03");
  });

  it("uses local calendar fields, not UTC", () => {
    // 1 Jan 2026 00:30 local — toISOString() would roll back to 2025-12-31 in any
    // positive-offset zone; localTodayISO must stay on the local day.
    const d = new Date(2026, 0, 1, 0, 30);
    expect(localTodayISO(d)).toBe("2026-01-01");
  });
});

describe("isFutureDate", () => {
  const today = "2026-06-27";

  it("flags a date after today", () => {
    expect(isFutureDate("2026-07-01", today)).toBe(true);
  });

  it("does not flag today itself", () => {
    expect(isFutureDate("2026-06-27", today)).toBe(false);
  });

  it("does not flag a past date", () => {
    expect(isFutureDate("2026-06-01", today)).toBe(false);
  });

  it("treats null/empty as not-future", () => {
    expect(isFutureDate(null, today)).toBe(false);
    expect(isFutureDate(undefined, today)).toBe(false);
    expect(isFutureDate("", today)).toBe(false);
  });

  it("ignores a time suffix on the value", () => {
    expect(isFutureDate("2026-07-01T12:00:00Z", today)).toBe(true);
  });
});
