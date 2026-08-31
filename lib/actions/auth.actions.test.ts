import { signIn, signOut } from "@/auth";
import { loginWithGoogle, logout } from "@/lib/actions/auth.actions";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

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

// `redirect` throws in the real implementation, which would abort the action
// before the assertions run.
jest.mock("next/navigation", () => ({ redirect: jest.fn() }));

const setCookieMock = jest.fn();
const deleteCookieMock = jest.fn();

const redirectMock = redirect as jest.MockedFunction<typeof redirect>;
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

  const formWith = (callbackUrl: string) => {
    const formData = new FormData();
    formData.set("callbackUrl", callbackUrl);
    return formData;
  };

  it("uses the Google provider and lands on the dashboard by default", async () => {
    await loginWithGoogle();

    expect(signInMock).toHaveBeenCalledWith("google", { redirectTo: "/" });
    expect(setCookieMock).not.toHaveBeenCalled();
  });

  it("returns the visitor to the page they were heading for", async () => {
    await loginWithGoogle(formWith("/trip/clx0000000000000000000000?day=2"));

    expect(signInMock).toHaveBeenCalledWith("google", {
      redirectTo: "/trip/clx0000000000000000000000?day=2",
    });
  });

  // `callbackUrl` arrives in a query string, so it is attacker-controlled: an
  // absolute or protocol-relative value would make sign-in an open redirect.
  it.each([
    ["an absolute URL", "https://evil.example/steal"],
    ["a protocol-relative URL", "//evil.example/steal"],
    ["a bare host", "evil.example"],
  ])("refuses to send the visitor to %s", async (_label, callbackUrl) => {
    await loginWithGoogle(formWith(callbackUrl));

    expect(signInMock).toHaveBeenCalledWith("google", { redirectTo: "/" });
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
    expect(redirectMock).toHaveBeenCalledWith("/");
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
