import { describe, expect, it } from "vitest";
import { confirmError, emailError, nameError, passwordChecks, passwordOk } from "./validation";

describe("sign-up checks", () => {
  it("needs 8 characters, a letter and a number", () => {
    expect(passwordOk("short1")).toBe(false);
    expect(passwordOk("longenough")).toBe(false);
    expect(passwordOk("12345678")).toBe(false);
    expect(passwordOk("bakery2026")).toBe(true);
    expect(passwordChecks("abc").filter((c) => c.ok).map((c) => c.label)).toEqual(["At least one letter"]);
  });

  it("explains email problems in plain words", () => {
    expect(emailError("")).toMatch(/Enter your email/);
    expect(emailError("maria@gmail")).toMatch(/doesn't look like/);
    expect(emailError("maria @gmail.com")).toMatch(/doesn't look like/);
    expect(emailError(" maria@gmail.com ")).toBeNull();
  });

  it("checks the name and the repeated password", () => {
    expect(nameError("  ")).toMatch(/Enter your name/);
    expect(nameError("Maria's Bakery")).toBeNull();
    expect(confirmError("bakery2026", "bakery2025")).toMatch(/don't match/);
    expect(confirmError("bakery2026", "bakery2026")).toBeNull();
  });
});
