/**
 * Minimal Akamai EdgeWorkers type declarations.
 * Generated from Akamai EdgeWorkers TypeScript typings reference.
 * In a real project, install: @types/akamai-edgeworkers
 */

declare namespace EW {
  interface Headers {
    [key: string]: string[];
  }

  interface ReadsHeaders {
    getHeader(name: string): string[] | null;
    getHeaderNames(): string[];
  }

  interface MutatesHeaders {
    addHeader(name: string, value: string): void;
    setHeader(name: string, value: string | string[]): void;
    removeHeader(name: string): void;
  }

  interface ReadsVariables {
    getVariable(name: string): string | undefined;
  }

  interface MutatesVariables {
    setVariable(name: string, value: string): void;
  }

  interface HasBody {
    readonly body: ReadableStream | null;
  }

  interface RouteDestination {
    origin?: string;
    path?: string;
    query?: string;
  }

  interface IngressClientRequest
    extends ReadsHeaders,
      MutatesHeaders,
      ReadsVariables,
      MutatesVariables {
    readonly host: string;
    readonly path: string;
    readonly url: string;
    readonly query: string;
    readonly method: string;
    readonly scheme: string;
    route(destination: RouteDestination): void;
    respondWith(
      status: number,
      headers: Record<string, string>,
      body: string | ReadableStream
    ): void;
  }

  interface EgressClientResponse extends MutatesHeaders {
    readonly status: number;
    setHeader(name: string, value: string): void;
    addHeader(name: string, value: string): void;
    removeHeader(name: string): void;
  }

  interface ResponseProviderRequest
    extends ReadsHeaders,
      ReadsVariables,
      MutatesVariables,
      HasBody {
    readonly host: string;
    readonly path: string;
    readonly url: string;
    readonly query: string;
    readonly method: string;
    readonly scheme: string;
  }

  interface CreateResponse {
    readonly status: number;
    readonly headers: Record<string, string | string[]>;
    readonly body: string | ReadableStream;
  }
}

// Module declarations for Akamai EdgeWorker built-in modules
declare module "http-request" {
  interface HttpResponse {
    readonly status: number;
    readonly ok: boolean;
    readonly body: ReadableStream;
    getHeader(name: string): string[] | null;
    json(): Promise<unknown>;
    text(): Promise<string>;
  }

  interface HttpRequestOptions {
    method?: string;
    headers?: Record<string, string>;
    body?: string | ReadableStream | null;
    timeout?: number;
  }

  export function httpRequest(url: string, options?: HttpRequestOptions): Promise<HttpResponse>;
}

declare module "create-response" {
  export function createResponse(
    status: number,
    headers: Record<string, string | string[]>,
    body: string | ReadableStream
  ): EW.CreateResponse;
}

declare module "streams" {
  export class ReadableStream {
    constructor(underlyingSource?: Record<string, unknown>);
  }
}

declare module "log" {
  export function log(message: string, ...args: unknown[]): void;
}

declare module "cookies" {
  export class Cookies {
    constructor(cookieHeader: string);
    get(name: string): string | undefined;
    getAll(name: string): string[];
  }
}
