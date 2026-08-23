"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body className="bg-[#121025] text-[#FFF4ED] font-sans antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center p-5 text-center">
          <div className="rounded-2xl border border-[rgba(232,188,203,0.15)] bg-[#1E1B38] p-8 max-w-md w-full shadow-2xl space-y-5">
            <h2 className="text-xl font-bold tracking-tight text-white">
              Critical System Error
            </h2>
            <p className="text-xs text-[#cfc0cc] leading-relaxed">
              {error.message || "A fatal application error occurred."}
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => reset()}
                className="rounded-lg bg-[#ED8E59] px-5 py-2 text-xs font-bold uppercase tracking-wider text-[#121025] hover:bg-[#f5ad7a] transition shadow-lg"
              >
                Reload Application
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
