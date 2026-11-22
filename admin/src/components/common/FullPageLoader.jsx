export default function FullPageLoader({ label = "" }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/90 px-4 backdrop-blur-[1px]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 rounded-full border-2 border-slate-200 border-t-slate-900 animate-spin" />
        {label ? <p className="text-sm text-slate-500">{label}</p> : null}
      </div>
    </div>
  );
}
