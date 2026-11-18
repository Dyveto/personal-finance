import { describe, it, expect, vi } from "vitest";
import {
  applyThemeToDOM,
  saveThemePreference,
  getThemePreference,
  dispatchThemeEvent,
  THEME_STORAGE_KEY,
  THEME_EVENT_NAME,
  type ThemeChangeDetail,
} from "@/lib/theme";

describe("Theme Management & Synchronization (Frontend)", () => {
  function createMockClassList() {
    const classes = new Set<string>();
    return {
      add: (cls: string) => classes.add(cls),
      remove: (cls: string) => classes.delete(cls),
      contains: (cls: string) => classes.has(cls),
      get size() {
        return classes.size;
      },
    };
  }

  function createMockDocument(initialDark = true) {
    const docElementClasses = createMockClassList();
    const bodyClasses = createMockClassList();

    if (initialDark) {
      docElementClasses.add("dark");
      bodyClasses.add("dark");
    } else {
      docElementClasses.add("light");
      bodyClasses.add("light");
    }

    return {
      documentElement: {
        classList: docElementClasses,
      },
      body: {
        classList: bodyClasses,
      },
    } as unknown as Document;
  }

  function createMockStorage() {
    const store: Record<string, string> = {};
    return {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        for (const k of Object.keys(store)) delete store[k];
      },
    } as unknown as Storage;
  }

  describe("applyThemeToDOM", () => {
    it("should apply dark classes and remove light classes from documentElement and body", () => {
      const doc = createMockDocument(false);
      expect(doc.documentElement.classList.contains("light")).toBe(true);

      applyThemeToDOM(true, doc);

      expect(doc.documentElement.classList.contains("dark")).toBe(true);
      expect(doc.documentElement.classList.contains("light")).toBe(false);
      expect(doc.body.classList.contains("dark")).toBe(true);
      expect(doc.body.classList.contains("light")).toBe(false);
    });

    it("should apply light classes and remove dark classes from documentElement and body", () => {
      const doc = createMockDocument(true);
      expect(doc.documentElement.classList.contains("dark")).toBe(true);

      applyThemeToDOM(false, doc);

      expect(doc.documentElement.classList.contains("light")).toBe(true);
      expect(doc.documentElement.classList.contains("dark")).toBe(false);
      expect(doc.body.classList.contains("light")).toBe(true);
      expect(doc.body.classList.contains("dark")).toBe(false);
    });

    it("should handle null document without throwing", () => {
      expect(() => applyThemeToDOM(true, undefined)).not.toThrow();
    });
  });

  describe("saveThemePreference & getThemePreference", () => {
    it("should save and retrieve dark theme preference", () => {
      const storage = createMockStorage();
      saveThemePreference(true, storage);

      expect(storage.getItem(THEME_STORAGE_KEY)).toBe("dark");
      expect(getThemePreference(storage)).toBe(true);
    });

    it("should save and retrieve light theme preference", () => {
      const storage = createMockStorage();
      saveThemePreference(false, storage);

      expect(storage.getItem(THEME_STORAGE_KEY)).toBe("light");
      expect(getThemePreference(storage)).toBe(false);
    });

    it("should fallback to documentElement class if storage is empty", () => {
      const storage = createMockStorage();
      const docLight = createMockDocument(false);

      expect(getThemePreference(storage, docLight)).toBe(false);

      const docDark = createMockDocument(true);
      expect(getThemePreference(storage, docDark)).toBe(true);
    });

    it("should fallback to default true (dark) if storage and doc have no preference", () => {
      const storage = createMockStorage();
      const emptyDoc = {
        documentElement: {
          classList: createMockClassList(),
        },
      } as unknown as Document;

      expect(getThemePreference(storage, emptyDoc)).toBe(false);
      expect(getThemePreference(storage, undefined)).toBe(true);
    });
  });

  describe("dispatchThemeEvent", () => {
    it("should dispatch custom event with theme details", () => {
      let dispatchedEvent: unknown = null;
      const mockWindow = {
        dispatchEvent: vi.fn((e: Event) => {
          dispatchedEvent = e;
          return true;
        }),
      } as unknown as Window;

      dispatchThemeEvent(false, mockWindow);

      expect(mockWindow.dispatchEvent).toHaveBeenCalledOnce();
      const customEvent = dispatchedEvent as CustomEvent<ThemeChangeDetail>;
      expect(customEvent.type).toBe(THEME_EVENT_NAME);
      expect(customEvent.detail).toEqual({
        isDark: false,
        theme: "light",
      });
    });
  });
});
