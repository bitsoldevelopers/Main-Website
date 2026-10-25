/**
 * The Setup page tests the callback URL the way Meta calls it, and marks its
 * requests with this header so the webhook leaves them out of the activity
 * log: a test is not Meta's verification, and a refused test delivery is not
 * a refused Meta delivery. Meta never sends the header.
 *
 * The header changes what is logged, never what is accepted: a marked request
 * still needs the right verify token or signature to get anything but 403 or
 * 401. Its presence is enough on purpose. The Setup page of one installation
 * (a laptop) tests the callback URL of another (the live site), which holds
 * different secrets, and those tests must not read as failures on the live
 * site's own Setup page.
 */

export const SELF_TEST_HEADER = "x-bitsol-webhook-self-test";
export const SELF_TEST_VALUE = "setup-page";

export function isSelfTest(value: string | null): boolean {
  return Boolean(value?.trim());
}
