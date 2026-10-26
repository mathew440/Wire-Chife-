import { plainAuthError } from "@/lib/sync/auth-errors";
import { describe, expect, it } from "vitest";

describe("sign-in error wording", () => {
  it("uses plain sentences for a wrong password, an existing login, and a weak password", () => {
    expect(plainAuthError("Invalid login credentials")).toBe("That email or password is wrong.");
    expect(plainAuthError("User already registered")).toBe("That email already has a login. Sign in instead.");
    expect(plainAuthError("Password should be at least 6 characters")).toBe("Use a password of at least 8 characters.");
    expect(plainAuthError("Failed to fetch")).toBe("Can't reach the shared database right now. Your jobs on this phone are still here.");
  });
});
