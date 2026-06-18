import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { I18nProvider, useI18n } from "./I18nProvider.tsx";
import type { Tool } from "../../components/Toolbar/Toolbar.tsx";

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

  it("switches locale and re-resolves keys + tool labels", () => {
    const { result } = setup();
    act(() => result.current.setLocale("de"));
    expect(result.current.locale).toBe("de");
    expect(result.current.t("cell.preview")).toBe("Vorschau");
    expect(result.current.tl("Bold")).toBe("Fett");
  });

  it("ignores an unknown locale", () => {
    const { result } = setup();
    act(() => result.current.setLocale("xx"));
    expect(result.current.locale).toBe("en");
  });

  it("localizeTools translates labels (and leaves separators alone)", () => {
    const { result } = setup();
    act(() => result.current.setLocale("de"));
    const tools: Tool[] = [
      { kind: "action", id: "bold", label: "Bold", onUse: () => {} },
      { kind: "sep" },
    ];
    const out = result.current.localizeTools(tools);
    expect(out[0]).toMatchObject({ kind: "action", label: "Fett" });
    expect(out[1]).toEqual({ kind: "sep" });
  });
});
