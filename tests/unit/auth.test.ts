import { describe, it, expect, vi, afterEach } from "vitest";
import { SignInSchema, SignUpSchema } from "@/lib/validations/auth";
import { getBaseUrl } from "@/features/auth/actions/auth-actions";

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
    it("should accept matching password and confirmPassword", () => {
      const valid = {
        email: "nuevo@ejemplo.com",
        password: "securepassword",
        confirmPassword: "securepassword",
      };
      const result = SignUpSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("should reject when password and confirmPassword do not match", () => {
      const mismatched = {
        email: "nuevo@ejemplo.com",
        password: "password123",
        confirmPassword: "differentpassword",
      };
      const result = SignUpSchema.safeParse(mismatched);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.confirmPassword).toContain(
          "Las contraseñas no coinciden"
        );
      }
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
