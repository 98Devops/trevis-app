import { describe, it, expect, afterEach, vi } from "vitest";
import { TENANT_LABELS, STUDENT_LABELS } from "./vertical-labels";

describe("vertical label sets", () => {
  it("tenant set reads Tenant / Tenants (PropNest demo default)", () => {
    expect(TENANT_LABELS.occupant).toBe("Tenant");
    expect(TENANT_LABELS.occupantPlural).toBe("Tenants");
    expect(TENANT_LABELS.addOccupant).toBe("Add tenant");
  });

  it("student set reads Student / Students (Trevis production)", () => {
    expect(STUDENT_LABELS.occupant).toBe("Student");
    expect(STUDENT_LABELS.occupantPlural).toBe("Students");
    expect(STUDENT_LABELS.addOccupant).toBe("Add student");
  });
});

describe("ACTIVE_LABELS env switch", () => {
  // Stub the build env and re-import so the choice is deterministic regardless of
  // the developer's ambient .env (which may be pointed at a Trevis preview).
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("selects the student set when VITE_VERTICAL=student", async () => {
    vi.stubEnv("VITE_VERTICAL", "student");
    vi.resetModules();
    const mod = await import("./vertical-labels");
    expect(mod.ACTIVE_LABELS.occupantPlural).toBe("Students");
  });

  it("falls back to the tenant set when VITE_VERTICAL is not 'student'", async () => {
    vi.stubEnv("VITE_VERTICAL", "");
    vi.resetModules();
    const mod = await import("./vertical-labels");
    expect(mod.ACTIVE_LABELS.occupantPlural).toBe("Tenants");
  });
});
