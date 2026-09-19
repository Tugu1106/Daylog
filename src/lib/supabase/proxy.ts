import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";
import { missingEnv, missingEnvMessage } from "@/lib/env";

const PUBLIC_PATHS = ["/login"];

/** A Supabase session cookie is present, even if it could not be verified right now. */
function hasAuthCookie(request: NextRequest) {
  return request.cookies.getAll().some((c) => c.name.includes("auth-token") && c.value !== "");
}

export async function updateSession(request: NextRequest) {
  // Say what is wrong instead of failing with a blank 500.
  const missing = missingEnv();
  if (missing.length > 0) {
    return new NextResponse(missingEnvMessage(missing), {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
        },
      },
    },
  );

  // Do not put code between createServerClient and getClaims — it refreshes the session.
  // Refresh tokens are single-use, so parallel requests with an expired token can
  // lose the race. Treat that as "still signed in" rather than erroring or logging out;
  // the request that won the race has already written fresh cookies.
  let signedIn: boolean;
  try {
    const { data } = await supabase.auth.getClaims();
    signedIn = !!data?.claims;
  } catch {
    signedIn = hasAuthCookie(request);
  }
  if (!signedIn && hasAuthCookie(request)) signedIn = true;
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!signedIn && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (signedIn && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}
