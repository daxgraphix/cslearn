import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Refreshes the session cookie and redirects anonymous users away from portals.
 *  This is a UX convenience only: every server action and query re-checks identity and permission. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  try {
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list: { name: string; value: string; options: CookieOptions }[]) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
    const { data: { user } } = await supabase.auth.getUser();
    const path = request.nextUrl.pathname;
    const protectedPrefix = ["/learner", "/instructor", "/reviewer", "/admin", "/organization", "/support"];
    if (!user && protectedPrefix.some((p) => path.startsWith(p))) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", path);
      return NextResponse.redirect(url);
    }
  } catch {
    return response;
  }
  return response;
}
