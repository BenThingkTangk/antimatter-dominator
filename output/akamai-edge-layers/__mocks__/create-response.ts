/** Stub for Akamai built-in create-response module */
export function createResponse(
  status: number,
  headers: Record<string, string | string[]>,
  body: string | ReadableStream
): { status: number; headers: Record<string, string | string[]>; body: string | ReadableStream } {
  return { status, headers, body };
}
