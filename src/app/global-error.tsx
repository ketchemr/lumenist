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
    console.error("Global Error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-md">
          <h2 className="text-2xl font-light">Application Error</h2>
          <p className="text-sm text-gray-400">A critical error occurred in the application.</p>
          <button
            onClick={() => reset()}
            className="px-4 py-2 bg-white text-black text-xs uppercase tracking-wider rounded font-medium cursor-pointer"
          >
            Reload Application
          </button>
        </div>
      </body>
    </html>
  );
}
