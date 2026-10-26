"use client";

import { useEffect } from "react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl px-6 py-24 text-center">
      <h2 className="text-2xl font-bold text-white">Something went wrong</h2>
      <p className="mt-3 text-sm text-slate-300">
        {error?.message || "An unexpected error occurred."}
      </p>
      <button
        onClick={reset}
        className="mt-6 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#05070d]"
      >
        Try again
      </button>
    </div>
  );
}