"use client";

export function GuidedIntro({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-[#020b08]/80 px-5 backdrop-blur-md">
      <div className="w-full max-w-2xl rounded-3xl border border-emerald-200/15 bg-[#071610]/95 p-6 shadow-2xl shadow-black/50 sm:p-10">
        <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-300/75">
          <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,0.9)]" />
          CARBONX · operations world
        </div>
        <h1 className="mt-6 max-w-xl text-3xl font-semibold tracking-tight text-white sm:text-5xl">Enter the intelligence layer.</h1>
        <p className="mt-5 max-w-xl text-sm leading-7 text-slate-400">
          Navigate the live portfolio workspace in first person. Each station opens a real CARBONX route; counts and incident state come from the backend.
        </p>
        <div className="mt-8 grid gap-3 text-xs text-slate-400 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3"><span className="font-mono text-emerald-300">WASD</span><p className="mt-2">Move</p></div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3"><span className="font-mono text-emerald-300">MOUSE</span><p className="mt-2">Look around</p></div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3"><span className="font-mono text-emerald-300">E / CLICK</span><p className="mt-2">Open a station</p></div>
        </div>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button type="button" onClick={onEnter} className="rounded-xl bg-emerald-300 px-5 py-3 text-xs font-bold uppercase tracking-[0.16em] text-[#062117] transition hover:bg-emerald-200">Enter operations</button>
          <button type="button" onClick={onEnter} className="rounded-xl border border-white/15 px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-300 transition hover:bg-white/[0.06]">Skip intro</button>
        </div>
      </div>
    </div>
  );
}
