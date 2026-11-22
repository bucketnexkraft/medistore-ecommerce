import React from "react";

const BackendNotInstalled = () => {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-slate-200 via-slate-200 to-indigo-300 px-4 py-12">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-indigo-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-blue-500/25 blur-3xl" />

      <div className="relative w-full max-w-2xl rounded-3xl border border-slate-300/70 bg-white/80 p-8 shadow-2xl backdrop-blur-xl md:p-12">
        <div className="mb-8 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 ring-1 ring-indigo-200">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            className="h-7 w-7 text-indigo-600"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16h.01M8.257 3.099c.765-1.36 2.721-1.36 3.486 0l7.04 12.52c.75 1.334-.213 2.981-1.742 2.981H3.96c-1.53 0-2.492-1.647-1.742-2.98l7.04-12.521z" />
          </svg>
        </div>

        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-indigo-600/90">
          Setup Required
        </p>
        <h1 className="text-3xl font-semibold leading-tight text-slate-900 md:text-4xl">
          Backend is not installed yet
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-7 text-slate-700 md:text-base">
          This application is waiting for initial backend installation. Complete the installer on the server, then refresh this page to continue.
        </p>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-700">
            Status: <span className="font-medium text-indigo-600">Not Installed</span>
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Complete installation on the server and refresh this page.
          </p>
        </div>
      </div>
    </div>
  );
};

export default BackendNotInstalled;
