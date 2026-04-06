import { requireAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { fetchIgMetrics, fetchIgMetricsPair } from "@/lib/queries/ig-metrics";
import IgMetricsClient from "./IgMetricsClient";

export default async function IgMetricsPage() {
  const auth = await requireAdmin();
  if ("error" in auth) redirect("/login");

  const [metrics, pair] = await Promise.all([
    fetchIgMetrics(),
    fetchIgMetricsPair(),
  ]);

  return (
    <IgMetricsClient
      metrics={metrics}
      current={pair.current}
      previous={pair.previous}
    />
  );
}
