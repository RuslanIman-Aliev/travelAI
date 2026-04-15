import { signIn, signOut } from "@/auth";
import { loginWithGoogle, logout } from "@/lib/actions/auth.actions";
import { cookies } from "next/headers";

jest.mock("@/auth", () => ({
  signIn: jest.fn(),
  signOut: jest.fn(),
}));

const setCookieMock = jest.fn();
const deleteCookieMock = jest.fn();

jest.mock("next/headers", () => ({
  cookies: jest.fn(),
}));

const signInMock = signIn as jest.MockedFunction<typeof signIn>;
const signOutMock = signOut as jest.MockedFunction<typeof signOut>;
const cookiesMock = cookies as jest.MockedFunction<typeof cookies>;

describe("auth.actions", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    cookiesMock.mockResolvedValue({
      set: setCookieMock,
      delete: deleteCookieMock,
    } as never);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("uses Google provider by default", async () => {
    delete process.env.ENABLE_TEST_AUTH;

    await loginWithGoogle();

    expect(signInMock).toHaveBeenCalledWith("google");
    expect(setCookieMock).not.toHaveBeenCalled();
  });

  it("sets test auth cookie in e2e auth mode", async () => {
    process.env.ENABLE_TEST_AUTH = "true";
    process.env.E2E_TEST_EMAIL = "tester@travel-ai.local";
    process.env.E2E_TEST_NAME = "E2E Tester";

    await loginWithGoogle();

    expect(setCookieMock).toHaveBeenCalledWith(
      "e2e-auth",
      "1",
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      }),
    );
    expect(signInMock).not.toHaveBeenCalled();
  });

  it("calls signOut in normal logout mode", async () => {
    await logout();

    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(deleteCookieMock).not.toHaveBeenCalled();
  });

  it("clears test auth cookie in e2e logout mode", async () => {
    process.env.ENABLE_TEST_AUTH = "true";

    await logout();

    expect(deleteCookieMock).toHaveBeenCalledWith("e2e-auth");
    expect(signOutMock).not.toHaveBeenCalled();
  });
});
