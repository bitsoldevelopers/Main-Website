import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { getAdminSession, requireAdminPage } from "@/lib/admin/auth";
import { hasPermission } from "@/lib/admin/rbac";
import { conversationSide, getConversation } from "@/lib/chatbot/queries";
import { readCapture } from "@/lib/capture";
import { DETAIL_LABELS, MEETING_MODE_LABEL, type CustomerDetails } from "@/lib/ai/customer";
import { findService } from "@/data/marketing/services";
import { readBotState } from "@/lib/bot/types";
import { formatDate } from "@/lib/admin/format";
import { cn, humanise, isUrduScript } from "@/lib/utils";
import { deleteConversation, resolveHandoff } from "@/app/admin/actions-chatbot";
import { ConversationControls } from "@/components/admin/chatbot/ConversationControls";
import { ConfirmButton, SubmitButton } from "@/components/admin/SubmitButton";
import { DbUnavailable, KeyValue, PageHeader, Panel, Pill } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Conversation" };

const INTENT_LABEL: Record<string, string> = {
  PROJECT: "Start a project",
  CONSULTATION: "Book a consultation",
  SUPPORT: "Get support",
  BROWSING: "Just browsing",
};

function displayDetail(key: keyof CustomerDetails, value: string): string {
  if (key === "service") return findService(value)?.name ?? value;
  if (key === "meetingMode") return MEETING_MODE_LABEL[value as keyof typeof MEETING_MODE_LABEL] ?? value;
  if (key === "intent") return INTENT_LABEL[value] ?? value;
  if (key === "topic") return humanise(value);
  if (key === "supportCategory") return value.charAt(0) + value.slice(1).toLowerCase();
  return value;
}

export default async function ConversationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage("chatbot.view");
  const session = await getAdminSession();
  const canWrite = session ? hasPermission(session.role, "chatbot.write") : false;
  const canManage = session ? hasPermission(session.role, "chatbot.manage") : false;

  const { id } = await params;
  const result = await getConversation(id);
  if (!result.ok) {
    return (
      <>
        <PageHeader eyebrow="Chatbot" title="Conversation" />
        <DbUnavailable error={result.error} />
      </>
    );
  }
  const conversation = result.data;
  if (!conversation) notFound();

  const capture = readCapture(conversation.capture);
  const { details } = capture;
  const bot = readBotState(capture.bot);
  const authorIds = Array.from(new Set(conversation.messages.map((m) => m.authorId).filter((v): v is string => Boolean(v))));
  const side = await conversationSide(authorIds, conversation.contactPhone);
  const authors = side.ok ? side.data.authors : new Map<string, string>();
  const contact = side.ok ? side.data.contact : null;
  // Server Component: rendered per request, so "now" is the request time.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const windowOpen = Boolean(contact?.lastInboundAt && now - contact.lastInboundAt.getTime() < 24 * 60 * 60 * 1000);

  const learned = DETAIL_LABELS.filter(([key]) => key !== "requirements" && details[key]).map(
    ([key, label]) => ({ label, value: displayDetail(key, details[key] as string) })
  );
  const isWhatsApp = conversation.channel === "WHATSAPP";

  return (
    <>
      <Link href="/admin/chatbot/conversations" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> All conversations
      </Link>

      <PageHeader
        eyebrow={isWhatsApp ? "WhatsApp" : "Website chat"}
        title={conversation.reference}
        description={`${conversation.messages.length} messages · started ${formatDate(conversation.createdAt, { time: true })} · language ${humanise(conversation.language)}`}
        actions={
          <>
            {conversation.handedOff && <Pill tone="amber">Handed off{conversation.handoverTeam ? ` · ${humanise(conversation.handoverTeam)}` : ""}</Pill>}
            {conversation.botPaused && <Pill tone="slate">Assistant paused</Pill>}
            {conversation.lead && <Pill tone="green">Lead captured</Pill>}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Transcript" className="lg:col-span-2" bodyClassName="max-h-[70dvh] space-y-4 overflow-y-auto">
          {conversation.messages.length === 0 && <p className="text-sm text-slate-500">No messages stored for this conversation.</p>}
          {conversation.messages.map((message) => {
            const isUser = message.role === "USER";
            return (
              <div key={message.id} className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                    isUser ? "rounded-br-md bg-brand-cyan text-white" : "rounded-bl-md bg-slate-100 text-slate-900"
                  )}
                >
                  <p className={cn("whitespace-pre-wrap", isUrduScript(message.content) && "urdu")}>{message.content}</p>
                  <p className={cn("mt-1 text-[10px]", isUser ? "text-white/70" : "text-slate-500")}>
                    {message.authorId ? `${authors.get(message.authorId) ?? "Team member"} · ` : isUser ? "" : "Assistant · "}
                    {formatDate(message.createdAt, { time: true })}
                    {message.latencyMs ? ` · ${(message.latencyMs / 1000).toFixed(1)}s` : ""}
                  </p>
                </div>
              </div>
            );
          })}
        </Panel>

        <div className="space-y-6">
          <Panel title="Customer details" description="What the assistant learned in conversation.">
            {learned.length || details.requirements ? (
              <>
                <KeyValue items={learned} />
                {details.requirements && (
                  <div className={cn(learned.length > 0 && "mt-3 border-t border-slate-100 pt-3")}>
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-500">What they need</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-900">{details.requirements}</p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-500">Nothing shared yet.</p>
            )}
          </Panel>

          {isWhatsApp && conversation.contactPhone && (
            <Panel title="WhatsApp contact">
              <KeyValue
                items={[
                  { label: "Name", value: conversation.contactName ?? "Not shared" },
                  { label: "Number", value: conversation.contactPhone },
                  ...(contact?.optedOut ? [{ label: "Marketing", value: <span className="font-semibold text-red-600">Opted out</span> }] : []),
                ]}
              />
              <div className="mt-4 border-t border-slate-100 pt-4">
                <ConversationControls
                  conversationId={conversation.id}
                  botPaused={conversation.botPaused}
                  handedOff={conversation.handedOff}
                  windowOpen={windowOpen}
                  canReply={canWrite}
                />
              </div>
            </Panel>
          )}

          <Panel title="Assistant">
            <KeyValue
              items={[
                { label: "Source", value: conversation.trafficSource ? humanise(conversation.trafficSource) : "—" },
                ...(conversation.campaign ? [{ label: isWhatsApp ? "Campaign" : "Page", value: <span className="break-all">{conversation.campaign}</span> }] : []),
                ...(conversation.adId ? [{ label: "Ad ID", value: conversation.adId }] : []),
                { label: "Intent", value: bot.intent ? humanise(bot.intent) : details.topic ? humanise(details.topic) : "—" },
                {
                  label: "Lead score",
                  value: bot.score
                    ? `${bot.score.value}/100 · ${humanise(bot.score.temperature)}`
                    : conversation.lead?.chatProfile
                      ? `${conversation.lead.chatProfile.score}/100 · ${humanise(conversation.lead.chatProfile.temperature)}`
                      : "—",
                },
                ...(bot.flow ? [{ label: "In progress", value: `${humanise(bot.flow.id)}${bot.flow.pending ? ` → ${humanise(bot.flow.pending)}` : ""}` }] : []),
                ...(bot.signals.enterprise ? [{ label: "Enterprise", value: "Yes" }] : []),
                ...(bot.handover?.reference ? [{ label: "Handover ref", value: bot.handover.reference }] : []),
                { label: "Rating", value: conversation.rating ? `${conversation.rating} / 5` : "Not rated" },
              ]}
            />
            {bot.trail.length > 0 && <p className="mt-3 border-t border-slate-100 pt-3 text-[11px] leading-relaxed text-slate-500">{bot.trail.join(" → ")}</p>}
          </Panel>

          <Panel title="Records created">
            <ul className="space-y-2 text-sm">
              {conversation.lead && (
                <li>
                  <Link href={`/admin/leads/${conversation.lead.id}`} className="font-semibold text-cyan-700 hover:underline">
                    {conversation.lead.chatProfile?.reference ?? conversation.lead.name}
                  </Link>{" "}
                  <span className="text-slate-500">lead · {conversation.lead.name} · {humanise(conversation.lead.status)}</span>
                </li>
              )}
              {conversation.requests.map((request) => (
                <li key={request.id}>
                  <Link href={`/admin/chatbot/requests?kind=${request.kind}`} className="font-mono text-xs font-semibold text-cyan-700 hover:underline">
                    {request.reference}
                  </Link>{" "}
                  <span className="text-slate-500">
                    {request.kind === "TICKET" ? "ticket" : "consultation"} · {humanise(request.status)}
                  </span>
                </li>
              ))}
              {!conversation.lead && conversation.requests.length === 0 && <li className="text-slate-500">Nothing captured from this chat.</li>}
            </ul>
          </Panel>

          {canWrite && conversation.handedOff && (
            <Panel title="Handover">
              <p className="mb-3 text-sm text-slate-500">
                Mark this as dealt with once a person has replied. The assistant answers the thread again afterwards.
              </p>
              <form action={resolveHandoff}>
                <input type="hidden" name="id" value={conversation.id} />
                <SubmitButton variant="secondary" pendingText="Saving…">
                  <CheckCircle2 className="h-4 w-4" /> Mark as handled
                </SubmitButton>
              </form>
            </Panel>
          )}

          {canManage && (
            <Panel title="Danger zone">
              <form action={deleteConversation}>
                <input type="hidden" name="id" value={conversation.id} />
                <ConfirmButton message="Delete this conversation and its transcript? Leads and tickets it created are kept.">Delete conversation</ConfirmButton>
              </form>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
