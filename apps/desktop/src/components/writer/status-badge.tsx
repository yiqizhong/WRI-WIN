import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function StatusBadge({
  status
}: {
  status: "ok" | "error" | "incomplete" | "warning";
}) {
  const label =
    status === "ok" ? "OK" : status === "error" ? "Error" : status === "warning" ? "Warning" : "Empty";
  return (
    <Badge
      variant={status === "ok" ? "default" : status === "error" ? "destructive" : "secondary"}
      className={cn(status === "incomplete" && "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100")}
    >
      {label}
    </Badge>
  );
}
