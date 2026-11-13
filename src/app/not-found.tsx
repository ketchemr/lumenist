import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="max-w-screen-2xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center space-y-4">
      <h2 className="text-3xl font-light text-foreground tracking-tight">404 - Photograph Not Found</h2>
      <p className="text-sm text-muted">The photograph or gallery you are looking for does not exist.</p>
      <div className="pt-4">
        <Link
          href="/"
          className="inline-flex items-center space-x-2 text-sm text-accent hover:text-accent-light"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Exhibition</span>
        </Link>
      </div>
    </div>
  );
}
