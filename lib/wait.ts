/**
 * lib/wait.ts — fake-delivery wait duration (D-03). Pure, zero dependencies.
 *
 * The wait is server-authoritative: the start route records waitDeadline =
 * now + WAIT_MS, and the arrive route judges endured by comparing the server
 * clock to that deadline (the client only counts down to it for display). This
 * module is the single source of the duration so the start route, any deadline
 * helper, and the SC shell all agree.
 *
 * 20 minutes sits in the 15~30분 target band (CONTEXT A4): long enough that
 * "참기" feels real, short enough to complete in one sitting.
 */

export const WAIT_MINUTES = 20;
export const WAIT_MS = WAIT_MINUTES * 60_000;

/**
 * The authoritative wait deadline for a wait that starts at `from`
 * (default: now). Callers persist this onto orders.waitDeadline.
 */
export function waitDeadline(from: Date = new Date()): Date {
  return new Date(from.getTime() + WAIT_MS);
}
