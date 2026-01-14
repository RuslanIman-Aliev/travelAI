import { Card, CardContent } from "@/components/ui/card";

interface StatsCardProps {
  title: string;
  value: string | number;
}

export const StatsCard = ({ title, value }: StatsCardProps) => {
  return (
    <Card className="w-full card-modern">
      <CardContent className="pt-3"> 
        <p className="text-slate-400 text-[20px]">
          {title}
        </p>
        <h2 className="text-3xl font-bold mb-2 pt-5">
          {value}
        </h2>
      </CardContent>
    </Card>
  );
};