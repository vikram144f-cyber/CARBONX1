"use client";

import type { WorldDestination } from "./navigation-state";

export function InteractionPrompt({
  destination,
  onInteract,
}: {
  destination: WorldDestination;
  onInteract: () => void;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-6 z-20 flex justify-center sm:bottom-8">
      <div className="cx-surface-elevated pointer-events-auto w-full max-w-xl rounded-2xl p-4 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: destination.accent }}>
              {destination.eyebrow}
            </p>
            <p className="mt-1 text-lg font-medium text-white">{destination.label}</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">{destination.description}</p>
          </div>
          <button
            type="button"
            onClick={onInteract}
            className="shrink-0 rounded-xl border border-white/15 bg-white/[0.08] px-4 py-3 text-left transition hover:border-white/30 hover:bg-white/[0.14]"
          >
            <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Interact</span>
            <span className="mt-1 block text-sm font-semibold text-white">Press E or click</span>
          </button>
        </div>
      </div>
    </div>
  );
}
