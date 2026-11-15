import { Suspense } from "react";
import AnalysisRouteClient from "./AnalysisRouteClient";

export default async function AnalysisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<main className="workspace auth-loading">Loading analysis...</main>}>
      <AnalysisPageParams params={params} />
    </Suspense>
  );
}

async function AnalysisPageParams({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AnalysisRouteClient id={id} />;
}
