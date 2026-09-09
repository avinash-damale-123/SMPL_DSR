import SalesAnalysisClient from "@/components/SalesAnalysisClient";
import { getDashboardData } from "@/lib/dashboard-data";

export default async function SalesAnalysisPage() {
  try {
    const data = await getDashboardData();
    return <SalesAnalysisClient data={data} />;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return (
      <main className="error-shell">
        <div className="error-card">
          <p className="eyebrow">SMPL · Sales & DSR</p>
          <h1>Sales analysis data could not be loaded</h1>
          <p>{message}</p>
        </div>
      </main>
    );
  }
}
