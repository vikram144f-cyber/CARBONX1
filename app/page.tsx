import { Suspense } from "react";
import { WorldExperience } from "@/features/carbon-world/world-experience";

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--cx-bg)] flex items-center justify-center">
          <span className="cx-mono text-xs uppercase tracking-[0.2em] text-[var(--cx-accent)]">
            Loading CARBONX...
          </span>
        </div>
      }
    >
      <WorldExperience />
    </Suspense>
  );
}
