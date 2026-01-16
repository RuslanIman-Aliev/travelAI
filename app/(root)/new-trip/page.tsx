import CreateNewTripForm from "@/app/(root)/new-trip/create-new-trip-form";
import { auth } from "@/auth";

const CreateNewTrip = async () => {
  const session = await auth();
  if(!session?.user){
    return <div>Please log in to create a new trip.</div> //remake later
  }
  return (
    <div className="m-10">
      <CreateNewTripForm />
    </div>
  );
};

export default CreateNewTrip;
