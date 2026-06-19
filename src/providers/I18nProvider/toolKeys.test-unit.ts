import { describe, it, expect } from "vitest";
import { LOCALES, MESSAGES } from "./locales/index.ts";
import { buildNoteTools } from "../../components/NoteCell/NoteCell.tools.ts";
import { buildScoreTools } from "../../components/ScoreCell/ScoreCell.tools.ts";

// Guard: every i18n key the Note/Score tool builders emit must resolve in EVERY locale. Because the
// builders call t() with dotted keys (and t() falls back to English then the raw key), a typo'd or
// un-migrated key would silently show English — this test catches that across all locales.

const messages = MESSAGES as Record<string, unknown>;
const resolve = (dict: unknown, key: string): unknown =>
  key
    .split(".")
    .reduce<unknown>((o, k) => (o == null ? undefined : (o as Record<string, unknown>)[k]), dict);

// A probe `t` that records each key it's asked for and returns the key verbatim.
function collectKeys(): Set<string> {
  const keys = new Set<string>();
  const t = (key: string) => {
    keys.add(key);
    return key;
  };
  const noop = () => {};
  buildNoteTools({ t, format: noop });
  buildScoreTools({
    t,
    ins: noop,
    smart: noop,
    wrapSel: noop,
    insLine: noop,
    applyScore: noop,
    headerNow: () => "",
    bodyNow: () => "",
    playing: false,
    play: noop,
    stop: noop,
    tempoNow: () => 120,
    setTempo: noop,
  });
  return keys;
}

describe("tool-label i18n keys", () => {
  const keys = [...collectKeys()];

  it("emits the expected number of distinct keys", () => {
    expect(keys.length).toBeGreaterThan(80); // ~21 note + ~74 score
  });

  for (const loc of LOCALES) {
    it(`every key resolves to a string in "${loc}"`, () => {
      const missing = keys.filter((k) => typeof resolve(messages[loc], k) !== "string");
      expect(missing, `missing keys in ${loc}`).toEqual([]);
    });
  }
});
