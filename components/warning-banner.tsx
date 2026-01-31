import { RouteWarning } from "@/lib/domain/types";

interface WarningBannerProps {
  warnings: RouteWarning[];
}

const SEVERITY_STYLES: Record<RouteWarning["severity"], string> = {
  info: "border-blue-500/30 bg-blue-500/5 text-blue-300",
  warn: "border-hl-warn/30 bg-hl-warn/5 text-hl-warn",
  error: "border-hl-error/30 bg-hl-error/5 text-hl-error",
};

const SEVERITY_LABELS: Record<RouteWarning["severity"], string> = {
  info: "INFO",
  warn: "WARN",
  error: "ERR",
};

export function WarningBanner({ warnings }: WarningBannerProps) {
  if (warnings.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      {warnings.map((w, i) => (
        <div
          key={i}
          className={`flex items-start gap-2 px-3 py-2 text-xs border ${SEVERITY_STYLES[w.severity]}`}
        >
          <span className="shrink-0 font-mono text-[10px] mt-px opacity-70">
            [{SEVERITY_LABELS[w.severity]}]
          </span>
          <span>{w.message}</span>
        </div>
      ))}
    </div>
  );
}
