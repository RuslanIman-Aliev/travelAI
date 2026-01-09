import Header from "@/components/header";
import { StatsCard } from "@/components/home/statsCard";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import Link from "next/link";

export default function Home() {
  return (
    <div className="m-10">
      <Card className="w-auto mt-10 bg-hero border-hero-border shadow-xl ">
        <CardContent className="pt-6">
          <h2 className="text-3xl font-bold mb-2">
            Plan your next adventure with AI
          </h2>
          <p className="text-slate-400">
            Plan your next adventure with AI in the TravelAI.
          </p>
        </CardContent>
        <CardFooter className="flex gap-3">
          <Button className="bg-cyan-400 text-black hover:bg-cyan-500 font-semibold">
            <Link href={""}>Start Planning</Link>
          </Button>

          <Button
            variant="outline"
            className="border-slate-600 text-foreground hover:bg-slate-800 hover:text-white bg-transparent"
          >
            <Link href={""}>View Tutorial</Link>
          </Button>
        </CardFooter>
      </Card>

      <div className="flex w-full gap-6 mt-10">
        <StatsCard title="Trips Planned" value={24} />
        <StatsCard title="Countries" value={12} />
        <StatsCard title="Destinations" value={8} />
      </div>
    </div>
  );
}
