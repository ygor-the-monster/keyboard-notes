import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { I18nProvider, useI18n } from "./I18nProvider.tsx";

// The provider persists the chosen locale to localStorage; clear it so each test starts from the
// detected default (English) rather than a locale a previous test left behind.
beforeEach(() => localStorage.clear());

const wrapper = ({ children }: { children: ReactNode }) => <I18nProvider>{children}</I18nProvider>;
const setup = () => renderHook(() => useI18n(), { wrapper });

describe("useI18n", () => {
  it("resolves a dotted key in the active (default English) locale", () => {
    const { result } = setup();
    expect(result.current.t("cell.preview")).toBe("Preview");
  });

  it("falls back to the raw key for a missing translation (never throws)", () => {
    const { result } = setup();
    expect(result.current.t("nope.not.a.key")).toBe("nope.not.a.key");
  });

  it("interpolates {placeholders}", () => {
    const { result } = setup();
    expect(result.current.t("storage.usage", { used: "12", quota: "500" })).toBe(
      "Using 12 MB of about 500 MB available.",
    );
  });

  it("switches locale and re-resolves keys (including tool-label keys)", () => {
    const { result } = setup();
    act(() => result.current.setLocale("de"));
    expect(result.current.locale).toBe("de");
    expect(result.current.t("cell.preview")).toBe("Vorschau");
    expect(result.current.t("note.bold")).toBe("Fett");
  });

  it("ignores an unknown locale", () => {
    const { result } = setup();
    act(() => result.current.setLocale("xx"));
    expect(result.current.locale).toBe("en");
  });
});
