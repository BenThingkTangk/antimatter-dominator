/** Stub for Akamai built-in cookies module */
export class Cookies {
  private store: Map<string, string>;

  constructor(cookieHeader: string) {
    this.store = new Map();
    if (cookieHeader) {
      for (const pair of cookieHeader.split(";")) {
        const [key, ...rest] = pair.trim().split("=");
        if (key) this.store.set(key.trim(), rest.join("=").trim());
      }
    }
  }

  get(name: string): string | undefined {
    return this.store.get(name);
  }

  getAll(name: string): string[] {
    const val = this.store.get(name);
    return val !== undefined ? [val] : [];
  }
}
