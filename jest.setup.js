/* eslint-env jest */

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map();
  const api = {
    getItem: async key => (store.has(key) ? store.get(key) : null),
    setItem: async (key, value) => {
      store.set(key, value);
    },
    removeItem: async key => {
      store.delete(key);
    },
    clear: async () => {
      store.clear();
    },
  };
  return {
    __esModule: true,
    default: api,
    createAsyncStorage: () => api,
  };
});
