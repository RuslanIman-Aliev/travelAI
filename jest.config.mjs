import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  dir: "./",
});

const customJestConfig = {
  // Node is the default because most of the suite exercises server code, and
  // importing `next/cache` (or anything else that pulls in Next's server
  // internals) under jsdom fails on missing globals like TextEncoder.
  // Component tests opt back in with a `@jest-environment jsdom` docblock.
  testEnvironment: "node",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  testPathIgnorePatterns: [
    "<rootDir>/.next/",
    "<rootDir>/node_modules/",
    "<rootDir>/tests/e2e/",
  ],
  collectCoverageFrom: [
    "lib/**/*.{ts,tsx}",
    "app/api/**/*.ts",
    "components/**/*.{ts,tsx}",
    "!**/*.d.ts",
    "!components/ui/**/*",
  ],
};

export default createJestConfig(customJestConfig);
