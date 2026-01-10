/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
export const ActivityCard = ({ activity }: { activity: any }) => {
  return (
    <>
      <Card key={activity.id} className="mb-4 p-4 w-full bg-hero border-hero-border shadow-xl">
        <CardHeader>
          <CardTitle>{activity.time}</CardTitle>
          <CardDescription>{activity.title}</CardDescription>
        </CardHeader>
        <CardContent>
          <CardDescription>{activity.description}</CardDescription>
        </CardContent>
        <CardFooter>
          <CardDescription>
            Estimated Cost: {activity.estimatedCost}
          </CardDescription>
        </CardFooter>
      </Card>
    </>
  );
};