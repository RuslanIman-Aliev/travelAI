/**
 * Regression guard for the e2e sign-in shortcut.
 *
 * `isTestAuthEnabled` hands out a real session to anyone presenting a cookie, so
 * an environment variable alone must never be enough to switch it on.
 */
jest.mock("next-auth", () => ({
  __esModule: true,
  default: () => ({
    auth: jest.fn(),
    handlers: {},
    signIn: jest.fn(),
    signOut: jest.fn(),
  }),
}));
jest.mock("next-auth/providers/credentials", () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock("next-auth/providers/google", () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock("@auth/prisma-adapter", () => ({ PrismaAdapter: jest.fn() }));
jest.mock("@/prisma", () => ({ prisma: {} }));

const loadIsTestAuthEnabled = async (
  nodeEnv: string | undefined,
  enableTestAuth: string | undefined,
) => {
  jest.resetModules();

  const previousNodeEnv = process.env.NODE_ENV;
  const previousFlag = process.env.ENABLE_TEST_AUTH;

  // NODE_ENV is readonly in the Next type augmentation, hence the cast.
  (process.env as Record<string, string | undefined>).NODE_ENV = nodeEnv;
  (process.env as Record<string, string | undefined>).ENABLE_TEST_AUTH =
    enableTestAuth;

  try {
    const mod = await import("@/auth");
    return mod.isTestAuthEnabled;
  } finally {
    (process.env as Record<string, string | undefined>).NODE_ENV =
      previousNodeEnv;
    (process.env as Record<string, string | undefined>).ENABLE_TEST_AUTH =
      previousFlag;
  }
};

describe("isTestAuthEnabled", () => {
  it("stays off in production even when the env flag is set", async () => {
    await expect(loadIsTestAuthEnabled("production", "true")).resolves.toBe(
      false,
    );
  });

  it("is on in development when the env flag is set", async () => {
    await expect(loadIsTestAuthEnabled("development", "true")).resolves.toBe(
      true,
    );
  });

  it("is off in development without the env flag", async () => {
    await expect(loadIsTestAuthEnabled("development", undefined)).resolves.toBe(
      false,
    );
  });
});
