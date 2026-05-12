/** Stub for Akamai built-in http-request module used in tests */
export async function httpRequest(
  _url: string,
  _options?: Record<string, unknown>
): Promise<{
  status: number;
  ok: boolean;
  body: ReadableStream;
  getHeader(name: string): string[] | null;
  json(): Promise<unknown>;
  text(): Promise<string>;
}> {
  return {
    status: 200,
    ok: true,
    body: new ReadableStream(),
    getHeader: () => null,
    json: async () => ({}),
    text: async () => "",
  };
}
