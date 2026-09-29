/** Shared by the lead table (client) and the bulk action (server). */

export const BULK_LIMIT = 500;

export type BulkAction =
  | "START_AUTOMATION"
  | "PAUSE_AUTOMATION"
  | "RESUME_AUTOMATION"
  | "STOP_AUTOMATION"
  | "ASSIGN"
  | "STATUS"
  | "ADD_TAG"
  | "REMOVE_TAG"
  | "DELETE";
