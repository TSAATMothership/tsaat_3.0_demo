// The retained route handlers run in this window; these are Web API objects.
export class NextRequest extends Request { get nextUrl() { return new URL(this.url); } }
export const NextResponse = Response;
