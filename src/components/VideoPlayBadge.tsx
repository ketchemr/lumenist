import { Play } from "lucide-react";

interface VideoPlayBadgeProps {
  size?: "sm" | "md";
}

export function VideoPlayBadge({ size = "sm" }: VideoPlayBadgeProps) {
  const circleClasses =
    size === "md" ? "w-11 h-11" : "w-8 h-8";
  const iconClasses =
    size === "md" ? "w-5 h-5 ml-0.5" : "w-3.5 h-3.5 ml-0.5";

  return (
    <div
      className="absolute top-2.5 right-2.5 z-20 pointer-events-none flex items-center justify-center rounded-full bg-black/60 backdrop-blur-sm border border-white/25 text-white shadow-lg transition-transform duration-200 group-hover:scale-110"
      aria-label="Video"
    >
      <div className={`${circleClasses} flex items-center justify-center`}>
        <Play className={`${iconClasses} fill-white`} />
      </div>
    </div>
  );
}
