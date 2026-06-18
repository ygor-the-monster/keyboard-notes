// Unit-project (jsdom) setup. jsdom ships no IndexedDB, which the StoreProvider persists to;
// fake-indexeddb/auto installs an in-memory implementation so the store hydrates and saves
// cleanly (no swallowed errors, no jsdom alert() noise) during tests.
import "fake-indexeddb/auto";
