import { auth } from "@/auth";
import LiveGuideForm from "./live-guide-form";

const LiveGuidePage = async () => {
  const session = await auth();
  if (!session?.user) {
    return <div>Please log in to access the Live Guide feature.</div>; //remake later
  }
  return (
    <div className="w-full p-4 sm:p-6 lg:p-0">
      <LiveGuideForm />
    </div>
  );
};

export default LiveGuidePage;
