import React from "react";
import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 px-4 py-10 flex items-center justify-center">
      <div className="w-full max-w-2xl">
        <div className="rounded-3xl border border-slate-200 bg-white/90 backdrop-blur shadow-xl p-8 md:p-12 text-center">
          <p className="inline-flex items-center rounded-full bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1">
            Error 404
          </p>

          <h1 className="mt-4 text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900">
            Page Not Found
          </h1>

          <p className="mt-4 text-base md:text-lg text-slate-600 leading-relaxed">
            The page you are looking for may have been moved, deleted, or the URL might be incorrect.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/dashboard" className="btn btn-primary px-6">
              Go to Dashboard
            </Link>
            <Link to="/pos" className="btn btn-outline px-6">
              Go to POS
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
