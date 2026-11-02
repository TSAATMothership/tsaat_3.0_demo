/** Shared handlers execute locally using browser request/response objects. */
export class NextRequest extends Request { get nextUrl() { return new URL(this.url); } }
export class NextResponse extends Response {
  static json(value: unknown, init?: ResponseInit) {
    return new NextResponse(JSON.stringify(value), { ...init, headers: { "Content-Type": "application/json", ...Object.fromEntries(new Headers(init?.headers)) } });
  }
}
