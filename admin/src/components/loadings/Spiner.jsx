import React from "react";

export default function Spiner({ label = "" }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="flex flex-col items-center gap-3">
        <div className="h-9 w-9 rounded-full border-2 border-slate-200 border-t-slate-900 animate-spin" />
        {label ? <p className="text-sm text-slate-500">{label}</p> : null}
      </div>
    </div>
  );
}
