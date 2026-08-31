import { auth } from "@/auth";
import { redirect } from "next/navigation";
import LiveGuideForm from "./live-guide-form";

const LiveGuidePage = async () => {
  // Middleware already redirected an anonymous visitor to `/sign-in`; this is the
  // check that actually authorises, since middleware only sees a cookie.
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in?callbackUrl=%2Flive-guide");
  }
  return (
    <div className="w-full p-4 sm:p-6 lg:p-0">
      <LiveGuideForm />
    </div>
  );
};

export default LiveGuidePage;
