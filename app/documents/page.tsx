import Link from "next/link";

export const dynamic = "force-dynamic";

export default function DocumentsPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl items-center px-5 py-12 sm:px-8">
      <div className="w-full rounded-3xl border border-white/10 bg-white/[0.03] p-7 sm:p-10">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-200/75">Evidence & documents</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-5xl">Document station is not yet available.</h1>
        <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-400">Evidence labels, source metadata, and deterministic assessment context are available on incident records. Document upload and management are not implemented yet, so this station does not present placeholder records.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/?mode=command" className="rounded-xl bg-emerald-300 px-4 py-3 text-xs font-bold uppercase tracking-[0.15em] text-[#062117]">Open Command Mode</Link>
          <Link href="/" className="rounded-xl border border-white/15 px-4 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-slate-300 hover:bg-white/[0.06]">Return to World</Link>
        </div>
      </div>
    </div>
  );
}
