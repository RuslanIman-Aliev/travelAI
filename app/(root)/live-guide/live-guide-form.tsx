import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@radix-ui/react-label";

const LiveGuideForm = () => {
  return (
    <div className="w-full h-full flex justify-center items-center">
      <Card className="w-125 md:w-175">
        <CardContent>
          <div className="flex flex-row">
            <div className="flex flex-col">
              <Label htmlFor="location" className="mb-2 font-medium">
                Location
              </Label>
              <Input
                placeholder="Enter your location"
                id="location"
                disabled={true}
                className="mb-4"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LiveGuideForm;
