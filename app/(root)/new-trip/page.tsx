import CreateNewTripForm from "@/app/(root)/new-trip/create-new-trip-form";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

const CreateNewTrip = async () => {
  // Middleware already redirected an anonymous visitor to `/sign-in`; this is the
  // check that actually authorises, since middleware only sees a cookie.
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in?callbackUrl=%2Fnew-trip");
  }
  return (
    <div className="m-4 sm:m-6 lg:m-10">
      <CreateNewTripForm />
    </div>
  );
};

export default CreateNewTrip;
