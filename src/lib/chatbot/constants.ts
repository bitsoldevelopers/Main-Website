/**
 * Vocabulary shared by the chatbot's admin screens, forms and Server Actions.
 * Kept out of the "use server" module, which may only export functions.
 */

export const KNOWLEDGE_KINDS = ["FAQ", "ARTICLE", "SERVICE", "POLICY", "DOCUMENT"] as const;
export const KNOWLEDGE_STATES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

export const TICKET_STATUSES = ["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED", "CLOSED"] as const;
export const MEETING_STATUSES = ["REQUESTED", "CONFIRMED", "RESCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"] as const;
