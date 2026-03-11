/**
 * Manual mock for @react-native-async-storage/async-storage.
 *
 * In-memory key-value store so we can test swapStore.ts
 * without a React Native runtime. Resets between tests
 * via the exported __reset() helper.
 */

const store: Record<string, string> = {};

const AsyncStorage = {
  getItem: jest.fn(async (key: string): Promise<string | null> => {
    return store[key] ?? null;
  }),

  setItem: jest.fn(async (key: string, value: string): Promise<void> => {
    store[key] = value;
  }),

  removeItem: jest.fn(async (key: string): Promise<void> => {
    delete store[key];
  }),

  multiRemove: jest.fn(async (keys: string[]): Promise<void> => {
    for (const key of keys) {
      delete store[key];
    }
  }),

  clear: jest.fn(async (): Promise<void> => {
    for (const key of Object.keys(store)) {
      delete store[key];
    }
  }),

  getAllKeys: jest.fn(async (): Promise<string[]> => {
    return Object.keys(store);
  }),
};

/**
 * Reset the in-memory store. Call in beforeEach() to isolate tests.
 */
export function __reset(): void {
  for (const key of Object.keys(store)) {
    delete store[key];
  }
  jest.clearAllMocks();
}

export default AsyncStorage;
