import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

const PHASES = [
  { key: "DESIGN", label: "설계", color: "bg-blue-500" },
  { key: "PERMIT", label: "인허가", color: "bg-purple-500" },
  { key: "CONSTRUCTION", label: "시공", color: "bg-orange-500" },
  { key: "COMPLETION", label: "준공", color: "bg-green-500" },
  { key: "PORTFOLIO", label: "포트폴리오", color: "bg-pink-500" },
] as const;

export function PhaseProgress({ currentPhase, compact }: { currentPhase: string; compact?: boolean }) {
  const currentIdx = PHASES.findIndex((p) => p.key === currentPhase);

  return (
    <div className="w-full" data-testid="phase-progress">
      <div className={cn("flex items-center", compact ? "gap-1" : "gap-0")}>
        {PHASES.map((phase, idx) => {
          const isCompleted = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const isUpcoming = idx > currentIdx;

          return (
            <div key={phase.key} className={cn("flex items-center", idx < PHASES.length - 1 ? "flex-1" : "")}>
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "rounded-full flex items-center justify-center border-2 transition-all",
                    compact ? "w-7 h-7" : "w-9 h-9",
                    isCompleted && `${phase.color} border-transparent text-white`,
                    isCurrent && "border-primary bg-primary text-primary-foreground",
                    isUpcoming && "border-muted-foreground/30 bg-muted text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <Check className={compact ? "w-3.5 h-3.5" : "w-4 h-4"} />
                  ) : (
                    <span className={cn("font-semibold", compact ? "text-xs" : "text-sm")}>{idx + 1}</span>
                  )}
                </div>
                {!compact && (
                  <span
                    className={cn(
                      "text-xs mt-1.5 whitespace-nowrap font-medium",
                      isCurrent ? "text-primary" : isCompleted ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {phase.label}
                  </span>
                )}
              </div>
              {idx < PHASES.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-1",
                    idx < currentIdx ? "bg-primary" : "bg-muted-foreground/20"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function getPhaseLabel(phase: string) {
  return PHASES.find((p) => p.key === phase)?.label ?? phase;
}

export function getPhaseColor(phase: string) {
  const map: Record<string, string> = {
    DESIGN: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    PERMIT: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
    CONSTRUCTION: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    COMPLETION: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    PORTFOLIO: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
  };
  return map[phase] ?? "bg-muted text-muted-foreground";
}

export { PHASES };
