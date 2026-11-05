import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("player_profiles")
          .select("user_id")
          .eq("user_id", user.id)
          .maybeSingle();

        return NextResponse.redirect(`${origin}${profile ? "/welcome-back" : "/profile"}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/?error=auth`);
}
