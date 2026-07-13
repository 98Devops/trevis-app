import { describe, it, expect } from "vitest";
import { formatDate, money } from "./fmt";

describe("formatDate", () => {
  it("includes the year so multi-year payment history is unambiguous", () => {
    // The exact bug from the Gate-2 review: two "01 Jul" rows from different years.
    expect(formatDate("2026-07-01")).toBe("01 Jul 2026");
    expect(formatDate("2025-07-01")).toBe("01 Jul 2025");
  });

  it("does not drift a day (parses the calendar day locally, not UTC)", () => {
    expect(formatDate("2026-01-01")).toBe("01 Jan 2026");
    expect(formatDate("2026-12-31")).toBe("31 Dec 2026");
  });
});

describe("money", () => {
  it("rounds and groups", () => {
    expect(money(1234.6)).toBe("$1,235");
    expect(money(0)).toBe("$0");
  });
});
