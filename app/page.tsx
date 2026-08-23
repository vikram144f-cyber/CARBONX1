import dynamic from "next/dynamic";

const WorldExperience = dynamic(
  () => import("@/features/carbon-world/world-experience").then((module) => module.WorldExperience),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-screen items-center justify-center bg-[var(--cx-bg)]">
        <span className="cx-mono text-xs uppercase tracking-[0.2em] text-[var(--cx-accent)]">
          Loading CARBONX…
        </span>
      </div>
    ),
  },
);

export default function HomePage() {
  return <WorldExperience />;
}
