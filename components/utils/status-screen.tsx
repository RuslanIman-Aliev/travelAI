import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * The shared shell for every "this page cannot show what you asked for" state:
 * route errors, 404s, and a trip that failed to load.
 *
 * They were all one-off markup before, which is why three of the four did not
 * exist at all - each one was a page of layout to write from scratch. Centring
 * it here makes adding the next state a five-line file.
 */
const StatusScreen = ({
  icon: Icon,
  tone = "neutral",
  title,
  description,
  children,
  className,
}: {
  icon: LucideIcon;
  tone?: "neutral" | "danger";
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      "flex min-h-[60vh] flex-col items-center justify-center gap-6 p-6 text-center",
      className,
    )}
  >
    <div
      className={cn(
        "rounded-full p-4",
        tone === "danger" ? "bg-destructive/10" : "bg-muted",
      )}
    >
      <Icon
        className={cn(
          "h-10 w-10",
          tone === "danger" ? "text-destructive" : "text-muted-foreground",
        )}
        aria-hidden
      />
    </div>

    <div className="space-y-2">
      <h1 className="text-xl font-bold sm:text-2xl">{title}</h1>
      {description && (
        <p className="max-w-md text-muted-foreground">{description}</p>
      )}
    </div>

    {children && (
      <div className="flex flex-wrap justify-center gap-3">{children}</div>
    )}
  </div>
);

export default StatusScreen;
