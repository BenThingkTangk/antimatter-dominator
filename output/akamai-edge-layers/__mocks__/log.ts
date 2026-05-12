/** Stub for Akamai built-in log module */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function log(message: string, ...args: unknown[]): void {
  console.log("[EW-LOG]", message, ...args);
}
