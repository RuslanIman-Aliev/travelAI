import { signIn, signOut } from "@/auth";
import { loginWithGoogle, logout } from "@/lib/actions/auth.actions";
import { cookies } from "next/headers";

const authState = { isTestAuthEnabled: false };

jest.mock("@/auth", () => ({
  signIn: jest.fn(),
  signOut: jest.fn(),
  E2E_COOKIE_NAME: "e2e-auth",
  get isTestAuthEnabled() {
    return authState.isTestAuthEnabled;
  },
}));

jest.mock("next/headers", () => ({ cookies: jest.fn() }));

const setCookieMock = jest.fn();
const deleteCookieMock = jest.fn();

const signInMock = signIn as jest.MockedFunction<typeof signIn>;
const signOutMock = signOut as jest.MockedFunction<typeof signOut>;
const cookiesMock = cookies as jest.MockedFunction<typeof cookies>;

describe("auth.actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authState.isTestAuthEnabled = false;
    cookiesMock.mockResolvedValue({
      set: setCookieMock,
      delete: deleteCookieMock,
    } as never);
  });

  it("uses the Google provider by default", async () => {
    await loginWithGoogle();

    expect(signInMock).toHaveBeenCalledWith("google");
    expect(setCookieMock).not.toHaveBeenCalled();
  });

  it("sets the test auth cookie in e2e auth mode", async () => {
    authState.isTestAuthEnabled = true;

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

  it("clears the test auth cookie in e2e logout mode", async () => {
    authState.isTestAuthEnabled = true;

    await logout();

    expect(deleteCookieMock).toHaveBeenCalledWith("e2e-auth");
    expect(signOutMock).not.toHaveBeenCalled();
  });
});
