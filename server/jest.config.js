/**
 * Jest config for server-side tests.
 * Tests PNR parser, smart utilities, and core logic.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  collectCoverageFrom: [
    'src/pnr-parser.ts',
    'src/smart-utilities.ts',
  ],
};
