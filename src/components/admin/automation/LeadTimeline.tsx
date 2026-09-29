import {
  Ban,
  CheckSquare,
  CircleDot,
  Clock,
  FileSpreadsheet,
  Mail,
  MailOpen,
  MailX,
  MousePointerClick,
  Pause,
  Pencil,
  Play,
  Reply,
  Search,
  Send,
  Square,
  StickyNote,
  Tags,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { formatDate, timeAgo } from "@/lib/admin/format";
import { cn } from "@/lib/utils";

export interface TimelineItem {
  id: string;
  type: string;
  title: string;
  detail: string | null;
  actor: string;
  createdAt: Date;
}

const STYLE: Record<string, { icon: LucideIcon; className: string }> = {
  IMPORTED: { icon: FileSpreadsheet, className: "bg-emerald-100 text-emerald-700" },
  LEAD_CREATED: { icon: CircleDot, className: "bg-cyan-100 text-cyan-700" },
  LEAD_UPDATED: { icon: Pencil, className: "bg-slate-100 text-slate-600" },
  DUPLICATE_CHECKED: { icon: Search, className: "bg-slate-100 text-slate-600" },
  OUTREACH_EMAIL_SELECTED: { icon: Mail, className: "bg-cyan-100 text-cyan-700" },
  ASSIGNED: { icon: UserPlus, className: "bg-violet-100 text-violet-700" },
  TAGGED: { icon: Tags, className: "bg-slate-100 text-slate-600" },
  STATUS_CHANGED: { icon: CircleDot, className: "bg-amber-100 text-amber-700" },
  AUTOMATION_STARTED: { icon: Play, className: "bg-cyan-100 text-cyan-700" },
  AUTOMATION_PAUSED: { icon: Pause, className: "bg-amber-100 text-amber-700" },
  AUTOMATION_RESUMED: { icon: Play, className: "bg-cyan-100 text-cyan-700" },
  AUTOMATION_STOPPED: { icon: Square, className: "bg-slate-200 text-slate-700" },
  AUTOMATION_COMPLETED: { icon: CheckSquare, className: "bg-emerald-100 text-emerald-700" },
  EMAIL_SENT: { icon: Send, className: "bg-violet-100 text-violet-700" },
  EMAIL_DELIVERED: { icon: Mail, className: "bg-violet-100 text-violet-700" },
  EMAIL_OPENED: { icon: MailOpen, className: "bg-violet-100 text-violet-700" },
  EMAIL_CLICKED: { icon: MousePointerClick, className: "bg-violet-100 text-violet-700" },
  EMAIL_BOUNCED: { icon: MailX, className: "bg-red-100 text-red-600" },
  EMAIL_FAILED: { icon: MailX, className: "bg-red-100 text-red-600" },
  FOLLOW_UP_SCHEDULED: { icon: Clock, className: "bg-amber-100 text-amber-700" },
  FOLLOW_UP_SENT: { icon: Send, className: "bg-violet-100 text-violet-700" },
  REPLIED: { icon: Reply, className: "bg-emerald-100 text-emerald-700" },
  UNSUBSCRIBED: { icon: Ban, className: "bg-red-100 text-red-600" },
  TASK_CREATED: { icon: CheckSquare, className: "bg-violet-100 text-violet-700" },
  TASK_COMPLETED: { icon: CheckSquare, className: "bg-emerald-100 text-emerald-700" },
  NOTE: { icon: StickyNote, className: "bg-slate-100 text-slate-600" },
};

/** A lead's history, newest first, as a line of events. */
export function LeadTimeline({ items, total }: { items: TimelineItem[]; total?: number }) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500">Nothing has happened to this lead yet.</p>;
  }
  return (
    <>
      <ol className="relative">
        {items.map((item, i) => {
          const style = STYLE[item.type] ?? { icon: CircleDot, className: "bg-slate-100 text-slate-600" };
          const Icon = style.icon;
          return (
            <li key={item.id} className="relative flex gap-3 pb-5 last:pb-0">
              {i < items.length - 1 && <span aria-hidden className="absolute left-[15px] top-8 h-[calc(100%-2rem)] w-px bg-slate-200" />}
              <span className={cn("relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full", style.className)}>
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="break-words text-sm font-semibold text-slate-900">{item.title}</p>
                {item.detail && <p className="mt-0.5 whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-500">{item.detail}</p>}
                <p className="mt-1 text-[11px] text-slate-400" title={formatDate(item.createdAt, { time: true })}>
                  {timeAgo(item.createdAt)} · {item.actor}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
      {typeof total === "number" && total > items.length && (
        <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">Showing the latest {items.length} of {total} events.</p>
      )}
    </>
  );
}
