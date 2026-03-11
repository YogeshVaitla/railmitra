/**
 * Jest config for client-side service tests.
 * Tests the swap engine, swap store, and mesh bridge logic
 * in a plain Node environment (no React Native runtime needed).
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        target: 'ES2020',
        module: 'commonjs',
        lib: ['ES2020'],
        strict: false,
        esModuleInterop: true,
        skipLibCheck: true,
        noImplicitAny: false,
        resolveJsonModule: true,
        jsx: 'react',
      },
    }],
  },
  moduleNameMapper: {
    // Mock AsyncStorage since we're running in Node, not React Native
    '^@react-native-async-storage/async-storage$':
      '<rootDir>/__mocks__/@react-native-async-storage/async-storage.ts',
  },
  testPathIgnorePatterns: ['/node_modules/', '/server/'],
  collectCoverageFrom: [
    'services/swapEngine.ts',
    'services/swapStore.ts',
  ],
};
