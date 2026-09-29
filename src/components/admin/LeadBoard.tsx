"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { moveLead } from "@/app/admin/actions-crm";
import {
  LEAD_PRIORITY_META,
  LEAD_STATUS_META,
  isLeadPriority,
  leadTopic,
  type LeadStatus,
} from "@/lib/admin/leads";
import type { BoardColumn } from "@/lib/admin/queries-crm";
import { timeAgo } from "@/lib/admin/format";
import { Pill } from "./ui";

/**
 * Kanban pipeline over plain HTML5 drag & drop. Moves are optimistic: the
 * card jumps immediately, the server action confirms in the background and
 * the board reverts (with a message) if the write fails.
 */
export function LeadBoard({ initial }: { initial: BoardColumn[] }) {
  const [columns, setColumns] = useState(initial);
  const [dragged, setDragged] = useState<string | null>(null);
  const [over, setOver] = useState<LeadStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function drop(target: LeadStatus) {
    setOver(null);
    const id = dragged;
    setDragged(null);
    if (!id) return;

    const source = columns.find((c) => c.cards.some((card) => card.id === id));
    if (!source || source.status === target) return;
    const card = source.cards.find((c) => c.id === id);
    if (!card) return;

    const before = columns;
    setColumns((cols) =>
      cols.map((col) => {
        if (col.status === source.status) {
          return { ...col, total: col.total - 1, cards: col.cards.filter((c) => c.id !== id) };
        }
        if (col.status === target) {
          return { ...col, total: col.total + 1, cards: [{ ...card, status: target }, ...col.cards] };
        }
        return col;
      })
    );
    setError(null);
    startTransition(async () => {
      const result = await moveLead(id, target);
      if (!result.ok) {
        setColumns(before);
        setError(result.error ?? "Could not move the lead.");
      }
    });
  }

  return (
    <>
      {error && (
        <p className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600" role="alert">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex min-w-max gap-4">
          {columns.map((column) => {
            const meta = LEAD_STATUS_META[column.status];
            return (
              <section
                key={column.status}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOver(column.status);
                }}
                onDragLeave={() => setOver((v) => (v === column.status ? null : v))}
                onDrop={(e) => {
                  e.preventDefault();
                  drop(column.status);
                }}
                className={cn(
                  "flex w-72 shrink-0 flex-col rounded-2xl border bg-slate-50 transition-colors",
                  over === column.status ? "border-cyan-400 bg-cyan-50" : "border-slate-200"
                )}
              >
                <header className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
                  <Pill tone={meta.tone}>{meta.label}</Pill>
                  <span className="text-xs font-bold tabular-nums text-slate-500">{column.total}</span>
                </header>

                <div className="flex max-h-[65vh] flex-col gap-2 overflow-y-auto p-2">
                  {column.cards.length === 0 && (
                    <p className="px-2 py-6 text-center text-xs text-slate-400">Drop a lead here</p>
                  )}
                  {column.cards.map((card) => {
                    const priority = isLeadPriority(card.priority) ? card.priority : "NORMAL";
                    const overdue = card.followUpAt && new Date(card.followUpAt).getTime() < Date.now();
                    return (
                      <article
                        key={card.id}
                        draggable
                        onDragStart={() => setDragged(card.id)}
                        onDragEnd={() => setDragged(null)}
                        className={cn(
                          "cursor-grab rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300 active:cursor-grabbing",
                          dragged === card.id && "opacity-40"
                        )}
                      >
                        <div className="mb-1 flex items-start justify-between gap-2">
                          <Link
                            href={`/admin/leads/${card.id}`}
                            className="min-w-0 truncate text-sm font-semibold text-slate-900 hover:text-cyan-700"
                          >
                            {card.name}
                          </Link>
                          {priority !== "NORMAL" && (
                            <span
                              title={`${LEAD_PRIORITY_META[priority].label} priority`}
                              className={cn(
                                "mt-1 h-2 w-2 shrink-0 rounded-full",
                                priority === "URGENT" ? "bg-red-400" : priority === "HIGH" ? "bg-amber-400" : "bg-slate-300"
                              )}
                            />
                          )}
                        </div>
                        <p className="truncate text-xs text-slate-500">
                          {leadTopic(card.subject)}
                          {card.company ? ` · ${card.company}` : ""}
                        </p>
                        <p className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                          <span>{timeAgo(card.createdAt)}</span>
                          {card.assignedTo && <span className="truncate">{card.assignedTo.name || card.assignedTo.email}</span>}
                          {overdue && <span className="font-semibold text-amber-700">follow-up due</span>}
                        </p>
                      </article>
                    );
                  })}
                  {column.total > column.cards.length && (
                    <Link
                      href={`/admin/leads?status=${column.status}`}
                      className="rounded-lg px-2 py-2 text-center text-xs text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                    >
                      View all {column.total} in the list →
                    </Link>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}
