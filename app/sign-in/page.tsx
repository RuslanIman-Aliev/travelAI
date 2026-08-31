import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { loginWithGoogle } from "@/lib/actions/auth.actions";
import { LogIn, MapPin, Route, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Sign in" };

/** Only in-app paths are accepted back; anything else lands on the dashboard. */
const toSafeCallback = (value: string | string[] | undefined): string => {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
};

const highlights = [
  {
    icon: Sparkles,
    title: "Itineraries, not lists",
    body: "Tell us where and when. You get a day-by-day plan with real places, times and costs.",
  },
  {
    icon: MapPin,
    title: "Everything on one map",
    body: "Each day's stops are plotted and ordered, so you can see the route before you walk it.",
  },
  {
    icon: Route,
    title: "Live Guide",
    body: "Already somewhere? Build a walking route from what's actually around you.",
  },
];

/**
 * The sign-in screen. `/new-trip`, `/live-guide` and `/trip/*` used to answer an
 * anonymous visitor with a bare line of text and no way to sign in - middleware
 * now sends them here instead, carrying where they were going.
 */
const SignInPage = async (props: {
  searchParams: Promise<{ callbackUrl?: string | string[] }>;
}) => {
  const searchParams = await props.searchParams;
  const callbackUrl = toSafeCallback(searchParams.callbackUrl);

  // Signing in is the one thing an already-signed-in visitor cannot need.
  const session = await auth();
  if (session?.user) {
    redirect(callbackUrl);
  }

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-5xl flex-col justify-center gap-10 p-6 lg:flex-row lg:items-center lg:gap-16 lg:p-10">
      <div className="flex flex-col gap-6 lg:flex-1">
        <div className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Sign in to Travel AI
          </h1>
          <p className="max-w-md text-muted-foreground">
            Your trips are saved to your account, so you can come back to them
            from any device.
          </p>
        </div>

        <form action={loginWithGoogle} className="max-w-sm">
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <Button type="submit" className="h-11 w-full gap-2 lg:h-10">
            <LogIn className="size-4" />
            Continue with Google
          </Button>
        </form>

        <p className="max-w-md text-xs text-muted-foreground">
          We only read your name, email address and profile picture — enough to
          keep your trips attached to you.
        </p>
      </div>

      <ul className="flex flex-col gap-5 lg:flex-1">
        {highlights.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex gap-4">
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
              <Icon className="size-4 text-cyan-600 dark:text-cyan-400" />
            </span>
            <span className="space-y-1">
              <span className="block font-semibold">{title}</span>
              <span className="block text-sm text-muted-foreground">
                {body}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SignInPage;
