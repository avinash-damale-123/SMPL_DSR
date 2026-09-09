import DashboardClient from "@/components/DashboardClient";
import { getDashboardData } from "@/lib/dashboard-data";

export default async function HomePage() {
  try {
    const data = await getDashboardData();
    return <DashboardClient data={data} />;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return (
      <main className="error-shell">
        <div className="error-card">
          <p className="eyebrow">SMPL · Sales & DSR</p>
          <h1>Dashboard data could not be loaded</h1>
          <p>{message}</p>
          <p>
            Check the published Google Sheet export URL or set the
            <code> SMPL_SHEET_XLSX_URL </code>
            environment variable in Vercel.
          </p>
        </div>
      </main>
    );
  }
}
