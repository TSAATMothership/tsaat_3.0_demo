export class NextRequest extends Request {
  readonly nextUrl: URL;

  constructor(input: RequestInfo | URL, init?: RequestInit) {
    const rawUrl = input instanceof Request ? input.url : input.toString();
    const absoluteUrl = new URL(rawUrl, "https://tsaat-demo-lite.local").toString();
    super(absoluteUrl, init);
    this.nextUrl = new URL(absoluteUrl);
  }
}

export class NextResponse<T = unknown> extends Response {
  static json<T>(body: T, init: ResponseInit = {}): NextResponse<T> {
    const headers = new Headers(init.headers);
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json; charset=utf-8");
    }
    return new NextResponse<T>(JSON.stringify(body), { ...init, headers });
  }

  static redirect(url: string | URL, status = 307): NextResponse<never> {
    return new NextResponse<never>(null, {
      status,
      headers: { Location: String(url) }
    });
  }

  readonly cookies = {
    set: () => undefined,
    delete: () => undefined,
    get: () => undefined
  };
}
