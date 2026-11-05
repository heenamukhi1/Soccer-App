import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return response;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  const protectedRoutes = ["/session-builder", "/training-schedule", "/profile", "/welcome-back"];
  if (!user && protectedRoutes.some((route) => request.nextUrl.pathname.startsWith(route))) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (user && request.nextUrl.pathname === "/") {
    const { data: profile } = await supabase
      .from("player_profiles")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    return NextResponse.redirect(
      new URL(profile ? "/welcome-back" : "/profile", request.url),
    );
  }

  return response;
}

export const config = {
  matcher: ["/session-builder/:path*", "/training-schedule/:path*", "/profile/:path*", "/welcome-back/:path*", "/api/analyze"],
};
