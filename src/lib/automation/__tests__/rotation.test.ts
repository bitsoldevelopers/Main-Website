import { describe, expect, it } from "vitest";
import type { MailboxCredentials } from "../email/mailbox";
import { describeWindow, pickMailbox, spacingMs, windowState, type MailboxUsage } from "../email/rotation";

const HOUR = 3_600_000;
/** An instant given in Pakistan time (UTC+5). */
const pkt = (day: number, hour: number, minute = 0) => new Date(Date.UTC(2026, 10, day, hour - 5, minute));

const WINDOW = { start: 10, end: 22 };

describe("windowState: sending hours in Pakistan time", () => {
  it("is open from 10:00 up to (not including) 22:00", () => {
    expect(windowState(pkt(15, 10), WINDOW).open).toBe(true);
    expect(windowState(pkt(15, 21, 59), WINDOW).open).toBe(true);
    expect(windowState(pkt(15, 22), WINDOW).open).toBe(false);
    expect(windowState(pkt(15, 9, 59), WINDOW).open).toBe(false);
  });

  it("before the window, opens at 10:00 the same day", () => {
    expect(windowState(pkt(15, 7, 30), WINDOW).opensAt.toISOString()).toBe(pkt(15, 10).toISOString());
  });

  it("after the window, opens at 10:00 the next day, across midnight too", () => {
    expect(windowState(pkt(15, 23), WINDOW).opensAt.toISOString()).toBe(pkt(16, 10).toISOString());
    // 01:00 Pakistan time is still the previous UTC day.
    expect(windowState(pkt(16, 1), WINDOW).opensAt.toISOString()).toBe(pkt(16, 10).toISOString());
  });

  it("is twelve hours long, and 0–24 means any time", () => {
    expect(windowState(pkt(15, 12), WINDOW).minutes).toBe(720);
    expect(windowState(pkt(15, 3), { start: 0, end: 24 })).toMatchObject({ open: true, minutes: 1440 });
    expect(describeWindow(WINDOW)).toBe("10:00–22:00");
  });
});

describe("spacingMs", () => {
  it("spreads 100 emails over 12 hours: one every 7.2 minutes", () => {
    expect(spacingMs(720, 100, true)).toBe(432_000);
  });
  it("is 0 when spreading is off", () => {
    expect(spacingMs(720, 100, false)).toBe(0);
  });
});

function mailbox(user: string, dailyLimit = 100): MailboxCredentials {
  return {
    id: user,
    user,
    hasPassword: true,
    password: "x",
    smtpHost: "smtp.hostinger.com",
    smtpPort: 465,
    imapHost: "imap.hostinger.com",
    imapPort: 993,
    watchInbox: true,
    dailyLimit,
    enabled: true,
    fromName: "",
  };
}

describe("pickMailbox: which mailbox sends", () => {
  const now = pkt(15, 12);
  const at = (minutesAgo: number) => now.getTime() - minutesAgo * 60_000;
  const A = mailbox("a@bitsol.test");
  const B = mailbox("b@bitsol.test");
  const C = mailbox("c@bitsol.test");
  const D = mailbox("d@bitsol.test");
  const usage = (entries: [string, MailboxUsage][]) => new Map(entries);
  const gap = () => spacingMs(720, 100, true);

  it("gives a new lead to the least-used mailbox", () => {
    const choice = pickMailbox({
      mailboxes: [A, B, C, D],
      usage: usage([
        [A.user, { sent: 30, lastSentAt: at(60), oldestSentAt: at(600) }],
        [B.user, { sent: 12, lastSentAt: at(60), oldestSentAt: at(600) }],
        [C.user, { sent: 40, lastSentAt: at(60), oldestSentAt: at(600) }],
        [D.user, { sent: 25, lastSentAt: at(60), oldestSentAt: at(600) }],
      ]),
      sticky: null,
      now,
      gapFor: gap,
    });
    expect(choice).toMatchObject({ kind: "send", mailbox: { user: B.user } });
  });

  it("keeps a lead on the mailbox that emailed it, even when another is emptier", () => {
    const choice = pickMailbox({
      mailboxes: [A, B],
      usage: usage([
        [A.user, { sent: 50, lastSentAt: at(10), oldestSentAt: at(600) }],
        [B.user, { sent: 0, lastSentAt: null, oldestSentAt: null }],
      ]),
      sticky: A.user,
      now,
      gapFor: gap,
    });
    expect(choice).toMatchObject({ kind: "send", mailbox: { user: A.user } });
  });

  it("makes a lead wait for its own mailbox's spacing instead of switching", () => {
    const choice = pickMailbox({
      mailboxes: [A, B],
      usage: usage([[A.user, { sent: 5, lastSentAt: at(2), oldestSentAt: at(300) }]]),
      sticky: A.user,
      now,
      gapFor: gap,
    });
    expect(choice).toMatchObject({ kind: "wait", scope: "lead" });
    if (choice.kind === "wait") expect(choice.until.getTime()).toBe(at(2) + 432_000);
  });

  it("moves a lead to another mailbox when its own was turned off or removed", () => {
    const choice = pickMailbox({ mailboxes: [B], usage: usage([]), sticky: A.user, now, gapFor: gap });
    expect(choice).toMatchObject({ kind: "send", mailbox: { user: B.user } });
  });

  it("skips a mailbox at its daily limit, and waits until its oldest send ages out when all are full", () => {
    const full = { sent: 100, lastSentAt: at(10), oldestSentAt: at(1200) };
    expect(
      pickMailbox({ mailboxes: [A, B], usage: usage([[A.user, full]]), sticky: null, now, gapFor: gap })
    ).toMatchObject({ kind: "send", mailbox: { user: B.user } });

    const waiting = pickMailbox({ mailboxes: [A], usage: usage([[A.user, full]]), sticky: null, now, gapFor: gap });
    expect(waiting).toMatchObject({ kind: "wait", scope: "all" });
    if (waiting.kind === "wait") expect(waiting.until.getTime()).toBe(at(1200) + 24 * HOUR);
  });

  it("respects each mailbox's own limit (a new mailbox ramping up at 20 a day)", () => {
    const ramping = mailbox("new@bitsol.test", 20);
    const choice = pickMailbox({
      mailboxes: [ramping],
      usage: usage([[ramping.user, { sent: 20, lastSentAt: at(30), oldestSentAt: at(700) }]]),
      sticky: null,
      now,
      gapFor: (m) => spacingMs(720, m.dailyLimit, true),
    });
    expect(choice).toMatchObject({ kind: "wait", scope: "all" });
  });

  it("waits an hour when no mailbox can send at all", () => {
    expect(pickMailbox({ mailboxes: [], usage: usage([]), sticky: null, now, gapFor: gap })).toMatchObject({ kind: "wait", scope: "all" });
  });
});
