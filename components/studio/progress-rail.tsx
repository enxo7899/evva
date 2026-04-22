import { cn } from "./primitives";

export type StudioStep = "upload" | "direct" | "generate" | "mix" | "export";

const STEPS: { id: StudioStep; number: string; label: string }[] = [
  { id: "upload", number: "01", label: "Source" },
  { id: "direct", number: "02", label: "Direction" },
  { id: "generate", number: "03", label: "Compose" },
  { id: "mix", number: "04", label: "Mix" },
  { id: "export", number: "05", label: "Export" }
];

const order: Record<StudioStep, number> = {
  upload: 0,
  direct: 1,
  generate: 2,
  mix: 3,
  export: 4
};

export function ProgressRail({ current }: { current: StudioStep }) {
  const currentIdx = order[current];

  return (
    <div className="flex items-center gap-5 overflow-x-auto">
      {STEPS.map((step, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={step.id} className="flex items-center gap-5">
            <div className="flex items-center gap-2 whitespace-nowrap">
              <span
                className={cn(
                  "font-mono text-[11px] transition",
                  done ? "text-ink-3" : active ? "text-accent-ink" : "text-ink-4"
                )}
              >
                {step.number}
              </span>
              <span
                className={cn(
                  "text-[12px] font-medium tracking-tight transition",
                  done ? "text-ink-2" : active ? "text-ink" : "text-ink-4"
                )}
              >
                {step.label}
              </span>
              {active ? (
                <span className="evva-live-dot ml-1 inline-block h-1.5 w-1.5 rounded-full bg-accent" />
              ) : null}
            </div>
            {i < STEPS.length - 1 ? (
              <div
                className={cn(
                  "h-px w-8 transition",
                  done ? "bg-ink-3" : "bg-line"
                )}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
