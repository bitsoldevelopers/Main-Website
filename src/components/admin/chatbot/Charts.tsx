import { Panel } from "@/components/admin/ui";
import { humanise } from "@/lib/utils";

/**
 * Small, dependency-free charts for the chatbot analytics: a ranked bar list
 * and a daily column chart. One series each, in the brand accent, with the
 * value always written next to the mark so nothing is read from colour alone.
 */

export interface BarRow {
  label: string;
  count: number;
}

export function Breakdown({
  title,
  rows,
  format = (value) => String(value),
  empty = "No data yet.",
  labels = humanise,
}: {
  title: string;
  rows: BarRow[];
  format?: (value: number) => string;
  empty?: string;
  labels?: (label: string) => string;
}) {
  const total = rows.reduce((sum, row) => sum + row.count, 0) || 1;
  const peak = Math.max(1, ...rows.map((row) => row.count));

  return (
    <Panel title={title}>
      {rows.length ? (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.label} title={`${labels(row.label)}: ${format(row.count)}`}>
              <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
                <span className="truncate text-slate-700">{labels(row.label)}</span>
                <span className="shrink-0 tabular-nums text-slate-500">
                  {format(row.count)} · {Math.round((row.count / total) * 100)}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-brand-cyan" style={{ width: `${(row.count / peak) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-slate-500">{empty}</p>
      )}
    </Panel>
  );
}

export function DailyColumns({ title, rows }: { title: string; rows: BarRow[] }) {
  const peak = Math.max(1, ...rows.map((row) => row.count));
  const total = rows.reduce((sum, row) => sum + row.count, 0);

  return (
    <Panel title={title} actions={<span className="text-xs tabular-nums text-slate-500">{total} total</span>}>
      <div className="flex h-36 items-end gap-[2px]" role="img" aria-label={`${title}: ${total} in total`}>
        {rows.map((row) => (
          <div
            key={row.label}
            title={`${row.label}: ${row.count}`}
            className="flex-1 rounded-t bg-brand-cyan opacity-75 transition-opacity hover:opacity-100"
            style={{ height: `${Math.max(2, (row.count / peak) * 100)}%` }}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-slate-500">
        <span>{rows[0]?.label}</span>
        <span>{rows[rows.length - 1]?.label}</span>
      </div>
    </Panel>
  );
}
