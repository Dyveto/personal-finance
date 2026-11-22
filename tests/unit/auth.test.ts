import { describe, it, expect, vi, afterEach } from "vitest";
import { SignInSchema, SignUpSchema } from "@/lib/validations/auth";
import { getBaseUrl } from "@/features/auth/actions/auth-actions";
import { getSafeRedirectPath } from "@/lib/utils/redirect";

// Mock next/headers
vi.mock("next/headers", () => ({
  headers: vi.fn(() => ({
    get: (name: string) => {
      if (name === "origin") return "https://interactive-finance-dashboard.netlify.app";
      return null;
    },
  })),
  cookies: vi.fn(() => ({
    getAll: () => [],
    set: vi.fn(),
  })),
}));

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("Authentication Validation Schemas: auth.ts", () => {
  describe("SignInSchema", () => {
    it("should accept valid email and password >= 6 characters", () => {
      const valid = {
        email: "usuario@ejemplo.com",
        password: "secretpassword123",
      };
      const result = SignInSchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("usuario@ejemplo.com");
      }
    });

    it("should reject invalid email formats", () => {
      const invalid = {
        email: "correo-invalido",
        password: "password123",
      };
      const result = SignInSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.email).toBeDefined();
      }
    });

    it("should reject passwords shorter than 6 characters", () => {
      const invalid = {
        email: "usuario@ejemplo.com",
        password: "123",
      };
      const result = SignInSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.password).toBeDefined();
      }
    });
  });

  describe("SignUpSchema", () => {
    it("should accept valid matching strong passwords (min 8 chars, uppercase, lowercase, number)", () => {
      const valid = {
        email: "nuevo@ejemplo.com",
        password: "SecurePassword123",
        confirmPassword: "SecurePassword123",
      };
      const result = SignUpSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("should reject when password and confirmPassword do not match", () => {
      const mismatched = {
        email: "nuevo@ejemplo.com",
        password: "SecurePassword123",
        confirmPassword: "DifferentPassword123",
      };
      const result = SignUpSchema.safeParse(mismatched);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.confirmPassword).toContain(
          "Las contraseñas no coinciden"
        );
      }
    });

    it("should reject passwords shorter than 8 characters", () => {
      const short = {
        email: "nuevo@ejemplo.com",
        password: "Pass1",
        confirmPassword: "Pass1",
      };
      const result = SignUpSchema.safeParse(short);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.password).toContain(
          "La contraseña debe tener al menos 8 caracteres"
        );
      }
    });

    it("should reject passwords lacking an uppercase letter", () => {
      const noUpper = {
        email: "nuevo@ejemplo.com",
        password: "securepassword123",
        confirmPassword: "securepassword123",
      };
      const result = SignUpSchema.safeParse(noUpper);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.password).toContain(
          "La contraseña debe contener al menos una letra mayúscula"
        );
      }
    });

    it("should reject passwords lacking a lowercase letter", () => {
      const noLower = {
        email: "nuevo@ejemplo.com",
        password: "SECUREPASSWORD123",
        confirmPassword: "SECUREPASSWORD123",
      };
      const result = SignUpSchema.safeParse(noLower);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.password).toContain(
          "La contraseña debe contener al menos una letra minúscula"
        );
      }
    });

    it("should reject passwords lacking a number", () => {
      const noNumber = {
        email: "nuevo@ejemplo.com",
        password: "SecurePassword",
        confirmPassword: "SecurePassword",
      };
      const result = SignUpSchema.safeParse(noNumber);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.password).toContain(
          "La contraseña debe contener al menos un número"
        );
      }
    });
  });

  describe("Open Redirect Protection: getSafeRedirectPath() (SEC-002)", () => {
    it("should allow safe relative internal paths", () => {
      expect(getSafeRedirectPath("/")).toBe("/");
      expect(getSafeRedirectPath("/accounts")).toBe("/accounts");
      expect(getSafeRedirectPath("/transactions?view=monthly")).toBe("/transactions?view=monthly");
      expect(getSafeRedirectPath("/credit-cards")).toBe("/credit-cards");
    });

    it("should neutralize protocol-relative URLs", () => {
      expect(getSafeRedirectPath("//evil.com")).toBe("/");
      expect(getSafeRedirectPath("//malicious.site/phish")).toBe("/");
    });

    it("should neutralize backslash bypasses", () => {
      expect(getSafeRedirectPath("/\\evil.com")).toBe("/");
    });

    it("should neutralize absolute external URLs", () => {
      expect(getSafeRedirectPath("https://evil.com")).toBe("/");
      expect(getSafeRedirectPath("http://evil.com/login")).toBe("/");
      expect(getSafeRedirectPath("javascript:alert(1)")).toBe("/");
    });

    it("should fallback to '/' on null, empty, or whitespace parameter", () => {
      expect(getSafeRedirectPath(null)).toBe("/");
      expect(getSafeRedirectPath("")).toBe("/");
      expect(getSafeRedirectPath("   ")).toBe("/");
    });
  });

  describe("Dynamic Base URL: getBaseUrl()", () => {
    const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

    afterEach(() => {
      process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
    });

    it("should return NEXT_PUBLIC_SITE_URL without trailing slash when configured", async () => {
      process.env.NEXT_PUBLIC_SITE_URL = "https://interactive-finance-dashboard.netlify.app/";
      expect(await getBaseUrl()).toBe("https://interactive-finance-dashboard.netlify.app");
    });

    it("should fallback to headers origin when NEXT_PUBLIC_SITE_URL is not set", async () => {
      delete process.env.NEXT_PUBLIC_SITE_URL;
      expect(await getBaseUrl()).toBe("https://interactive-finance-dashboard.netlify.app");
    });
  });
});
