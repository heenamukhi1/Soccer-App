"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AnalysisDetail from "./AnalysisDetail";

type AnalysisRecord = {
  id: string;
  created_at: string;
  analysis: {
    rating: number;
    strengths: { name: string; detail: string }[];
    weaknesses: { name: string; detail: string }[];
    drills: string[];
  };
} | null;

export default function AnalysisRouteClient({ id }: { id: string }) {
  const router = useRouter();
  const [record, setRecord] = useState<AnalysisRecord>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadRecord() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.replace("/");
          return;
        }

        const { data } = await supabase
          .from("player_analyses")
          .select("id, created_at, analysis")
          .eq("id", id)
          .eq("user_id", user.id)
          .maybeSingle();

        if (!cancelled) setRecord(data as AnalysisRecord);
      } catch (error) {
        console.error("[analysis-detail] Could not load analysis", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadRecord();
    return () => {
      cancelled = true;
    };
  }, [id, router]);

  if (loading) {
    return <main className="workspace auth-loading" role="status">Loading analysis...</main>;
  }

  return <AnalysisDetail id={id} record={record} />;
}
