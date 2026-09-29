import { prisma } from "@/lib/prisma";
import { MANDATORY_STOP_CONDITIONS } from "./conditions";

/**
 * The starter content: four templates, the "BITSOL Lead Outreach" sequence
 * and the "BITSOL Cold Outreach" automation that runs it. Created once, the
 * first time the automation area is opened, and ordinary rows from then on:
 * edit or delete them like any other.
 *
 * The automation is created as a DRAFT. Nothing is sent until someone has
 * read the emails and activated it.
 */

export const DEFAULT_SEQUENCE_NAME = "BITSOL Lead Outreach";
export const DEFAULT_AUTOMATION_NAME = "BITSOL Cold Outreach";

interface StarterEmail {
  step: string;
  delayDays: number;
  name: string;
  subject: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
}

const STARTER_EMAILS: StarterEmail[] = [
  {
    step: "Email 1 — Introduction",
    delayDays: 0,
    name: "Outreach 1 — Introduction",
    subject: "A growth idea for {{company_name|your team}}",
    body: `Hi {{first_name|there}},

I came across {{company_name|your company}}{{#title}} and noticed that you are working as {{title}}{{/title}}.

{{#personalization}}{{personalization}}

{{/personalization}}Based on the company's profile, I thought BITSOL Marketing could potentially help with your digital growth and lead generation. We work on SEO, paid campaigns and AI automation.

Would you be open to a short call to see whether there is a fit?

Best regards,
{{sender_name}}`,
  },
  {
    step: "Email 2 — Follow-up",
    delayDays: 2,
    name: "Outreach 2 — Follow-up",
    subject: "Following up, {{first_name|quick question}}",
    body: `Hi {{first_name|there}},

I wanted to follow up on my earlier note about {{company_name|your company}}.

If growing your pipeline is a priority this quarter, I would be glad to share a few ideas specific to your market. If the timing is wrong, just say so and I will not follow up again.

Best regards,
{{sender_name}}`,
  },
  {
    step: "Email 3 — What we do",
    delayDays: 4,
    name: "Outreach 3 — Services",
    subject: "How we could help {{company_name|your team}} generate leads",
    body: `Hi {{first_name|there}},

To be concrete about what BITSOL Marketing does:

- SEO and content that brings in search traffic
- Paid campaigns on Google, Meta and LinkedIn
- AI automation for lead capture and follow-up

If any of these is on your list{{#company_name}} at {{company_name}}{{/company_name}}, I can put together a short plan at no cost.

Best regards,
{{sender_name}}`,
    ctaLabel: "See our services",
    ctaUrl: "https://bitsolmarketing.com/services",
  },
  {
    step: "Email 4 — Final follow-up",
    delayDays: 7,
    name: "Outreach 4 — Final follow-up",
    subject: "Should I close the loop?",
    body: `Hi {{first_name|there}},

I have reached out a few times and do not want to crowd your inbox, so this is my last note.

If digital growth becomes a priority later, you are welcome to reply to this email at any time.

Wishing you and the team{{#company_name}} at {{company_name}}{{/company_name}} all the best.

Best regards,
{{sender_name}}`,
  },
];

let ensured: Promise<void> | null = null;

/** Creates the starter content when the tables are empty. Safe to call often. */
export function ensureDefaults(): Promise<void> {
  ensured ??= seed().catch((err) => {
    ensured = null; // try again on the next call
    throw err;
  });
  return ensured;
}

async function seed(): Promise<void> {
  const [templates, sequences, automations] = await Promise.all([
    prisma.emailTemplate.count(),
    prisma.emailSequence.count(),
    prisma.automation.count(),
  ]);
  if (templates > 0 || sequences > 0 || automations > 0) return;

  await prisma.$transaction(async (tx) => {
    const sequence = await tx.emailSequence.create({
      data: {
        name: DEFAULT_SEQUENCE_NAME,
        description: "Four emails over about two weeks: an introduction, a follow-up, what we do, and a last note.",
        isDefault: true,
      },
    });

    const sequenceSteps: { id: string; name: string; delayDays: number; order: number }[] = [];
    for (const [index, email] of STARTER_EMAILS.entries()) {
      const template = await tx.emailTemplate.create({
        data: {
          name: email.name,
          subject: email.subject,
          body: email.body,
          ctaLabel: email.ctaLabel ?? null,
          ctaUrl: email.ctaUrl ?? null,
          isDefault: true,
        },
      });
      const step = await tx.emailSequenceStep.create({
        data: { sequenceId: sequence.id, order: index + 1, name: email.step, delayDays: email.delayDays, templateId: template.id },
      });
      sequenceSteps.push({ id: step.id, name: step.name, delayDays: step.delayDays, order: step.order });
    }

    const automation = await tx.automation.create({
      data: {
        name: DEFAULT_AUTOMATION_NAME,
        description:
          "Sends the BITSOL Lead Outreach sequence, stops the moment a lead replies, and hands anyone who stays silent to a person.",
        status: "DRAFT",
        trigger: "IMPORT",
        sequenceId: sequence.id,
        createTask: true,
        taskTitle: "Follow up personally with {{first_name|this lead}}{{#company_name}} ({{company_name}}){{/company_name}}",
        taskNote:
          "The outreach sequence finished without a reply. Try a call or a LinkedIn message.{{#linkedin_url}}\nLinkedIn: {{linkedin_url}}{{/linkedin_url}}",
        taskDueDays: 1,
        isDefault: true,
        createdBy: "System",
      },
    });

    await tx.automationStep.createMany({ data: buildSteps(automation.id, sequenceSteps, true) });
    await tx.automationCondition.createMany({
      data: MANDATORY_STOP_CONDITIONS.map((rule) => ({
        automationId: automation.id,
        kind: "STOP",
        field: rule.field,
        operator: rule.operator,
        value: rule.value,
        locked: true,
      })),
    });
  });
}

/**
 * Turns a sequence into the workflow an automation executes: a WAIT before
 * every email that has a delay, then the email, and the hand-over task last.
 */
export function buildSteps(
  automationId: string,
  sequenceSteps: { id: string; name: string; delayDays: number; order: number }[],
  createTask: boolean
): { automationId: string; order: number; type: string; label: string; sequenceStepId: string | null; waitDays: number | null }[] {
  const steps: ReturnType<typeof buildSteps> = [];
  let order = 1;
  const ordered = [...sequenceSteps].sort((a, b) => a.order - b.order);
  for (const step of ordered) {
    if (step.delayDays > 0) {
      steps.push({
        automationId,
        order: order++,
        type: "WAIT",
        label: `Wait ${step.delayDays} day${step.delayDays === 1 ? "" : "s"}`,
        sequenceStepId: null,
        waitDays: step.delayDays,
      });
    }
    steps.push({ automationId, order: order++, type: "SEND_EMAIL", label: step.name, sequenceStepId: step.id, waitDays: null });
  }
  if (createTask) {
    steps.push({ automationId, order: order++, type: "CREATE_TASK", label: "Create a human follow-up task", sequenceStepId: null, waitDays: null });
  }
  return steps;
}

/**
 * Rebuilds an automation's steps from its sequence. Runs in progress keep
 * their position by counting the emails they have already sent, so editing
 * a delay or adding a fifth email never resends anything.
 */
export async function syncAutomationSteps(automationId: string): Promise<void> {
  const automation = await prisma.automation.findUnique({
    where: { id: automationId },
    include: { sequence: { include: { steps: { orderBy: { order: "asc" } } } } },
  });
  if (!automation) return;
  const steps = buildSteps(automation.id, automation.sequence.steps, automation.createTask);

  await prisma.$transaction(async (tx) => {
    await tx.automationStep.deleteMany({ where: { automationId } });
    if (steps.length > 0) await tx.automationStep.createMany({ data: steps });

    const openRuns = await tx.automationRun.findMany({
      where: { automationId, status: { in: ["ACTIVE", "PAUSED"] } },
      select: { id: true, emailsSent: true },
    });
    for (const run of openRuns) {
      await tx.automationRun.update({ where: { id: run.id }, data: { stepIndex: positionAfter(steps, run.emailsSent) } });
    }
  });
}

/**
 * Where a run that has sent `emailsSent` emails stands in a list of steps:
 * just after its last email, and past the wait that follows it, because that
 * wait is the job the run already has scheduled.
 */
export function positionAfter(steps: { type: string }[], emailsSent: number): number {
  if (emailsSent <= 0) return 0;
  let seen = 0;
  for (const [i, step] of steps.entries()) {
    if (step.type === "SEND_EMAIL" && ++seen === emailsSent) {
      return steps[i + 1]?.type === "WAIT" ? i + 2 : i + 1;
    }
  }
  // The sequence now has fewer emails than were sent: only the hand-over is left.
  const task = steps.findIndex((step) => step.type === "CREATE_TASK");
  return task === -1 ? steps.length : task;
}

/** Re-syncs every automation that uses a sequence, after the sequence changed. */
export async function syncAutomationsOfSequence(sequenceId: string): Promise<void> {
  const automations = await prisma.automation.findMany({ where: { sequenceId }, select: { id: true } });
  for (const automation of automations) await syncAutomationSteps(automation.id);
}
