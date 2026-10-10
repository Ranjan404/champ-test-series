import { NextResponse, type NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";

// Every page except /login needs a session. API routes check the session themselves and answer 401.
export async function proxy(req: NextRequest) {
  const res = NextResponse.next();
  const session = await getIronSession<SessionData>(req, res, sessionOptions());
  const loggedIn = !!session.userId;
  const { pathname } = req.nextUrl;

  if (pathname === "/login") {
    return loggedIn ? NextResponse.redirect(new URL("/dashboard", req.url)) : res;
  }
  if (!loggedIn) {
    const url = new URL("/login", req.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)"],
};
