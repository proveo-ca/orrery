// apps/chess-coach/ui/src/store/createPersistedStore.ts
import { createEffect, createRoot } from 'solid-js';
import { createStore, type SetStoreFunction } from 'solid-js/store';

export function createPersistedStore<T extends object>(
  key: string,
  initialValue: T
): [T, SetStoreFunction<T>] {
  // 1. Load from localStorage
  let state = initialValue;
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge parsed data with initialValue to ensure no missing keys
      state = { ...initialValue, ...parsed };
    }
  } catch (e) {
    console.error(`Failed to load state for key: ${key}`, e);
  }

  // 2. Create the SolidJS store
  const [store, setStore] = createStore<T>(state);

  // 3. Automatically sync changes back to localStorage
  createRoot(() => {
    createEffect(() => {
      try {
        localStorage.setItem(key, JSON.stringify(store));
      } catch (e) {
        console.error(`Failed to save state for key: ${key}`, e);
      }
    });
  });

  return [store, setStore];
}
