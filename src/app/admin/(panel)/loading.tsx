export default function Loading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <div className="h-3 w-24 rounded bg-slate-200" />
        <div className="h-7 w-56 rounded-md bg-slate-200" />
      </div>
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-12">
        <div className="h-60 rounded-md bg-slate-200 sm:col-span-2 xl:col-span-6" />
        <div className="h-60 rounded-md bg-slate-200 xl:col-span-3" />
        <div className="h-60 rounded-md bg-slate-200 xl:col-span-3" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-80 rounded-md bg-slate-200" />
        <div className="h-80 rounded-md bg-slate-200" />
      </div>
    </div>
  );
}
