import { auth } from "@/auth";
import { ModeToggle } from "./utils/mode-toggle";
import { Button } from "./ui/button";
import { loginWithGoogle, logout } from "@/lib/actions/auth.actions";

const Header = async () => {
  let fragment;
  const session = await auth();
  if (!session?.user) {
    fragment = (
      <form action={loginWithGoogle}>
        <Button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          Sign in with Google
        </Button>
      </form>
    );
  } else {
    fragment = (
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-medium">Welcome, {session.user?.name}!</h2>
        <form action={logout}>
          <Button type="submit" variant="destructive">
            Sign Out
          </Button>
        </form>
      </div>
    );
  }
  console.log("Session in Header:", session);
  return (
    <div className="flex justify-end w-full  gap-4">
      <div className="flex  gap-4">{fragment}</div>
      <div className="flex space-x-5">
        <ModeToggle />
      </div>
    </div>
  );
};

export default Header;
