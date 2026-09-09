"use client";

import { useMemo, useState } from "react";
import type { Branch, DashboardData, DashboardSnapshot, MetricPair } from "@/lib/dashboard-data";

const formatInr = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);

const formatCount = (value: number) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value || 0);

const formatPct = (value: number | null) => (value === null ? "—" : `${value.toFixed(1)}%`);

const formatDate = (value: string | null) => {
  if (!value) return "No DSR activity";
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

function MetricCard({
  title,
  pair,
  accent,
  note,
}: {
  title: string;
  pair: MetricPair;
  accent?: boolean;
  note?: string;
}) {
  return (
    <article className={`metric-card ${accent ? "metric-card-accent" : ""}`}>
      <p className="metric-label">{title}</p>
      <p className="metric-value">{formatInr(pair.sales)}</p>
      <p className="metric-caption">Sales</p>
      <div className="metric-divider" />
      <p className="metric-count">{formatCount(pair.count)}</p>
      <p className="metric-caption">Transactions</p>
      {note ? <p className="metric-note">{note}</p> : null}
    </article>
  );
}

function AchievementCard({
  title,
  salesPct,
  countPct,
}: {
  title: string;
  salesPct: number | null;
  countPct: number | null;
}) {
  const progress = Math.max(0, Math.min(salesPct ?? 0, 100));
  return (
    <article className="achievement-card">
      <div className="achievement-topline">
        <p className="metric-label">{title}</p>
        <strong>{formatPct(salesPct)}</strong>
      </div>
      <div className="progress-track" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>
      <div className="achievement-stats">
        <span>Sales target</span>
        <strong>{formatPct(salesPct)}</strong>
        <span>Count target</span>
        <strong>{formatPct(countPct)}</strong>
      </div>
    </article>
  );
}

function snapshotKey(branch: Branch, month: string) {
  return `${branch}-${month}`;
}

export default function DashboardClient({ data }: { data: DashboardData }) {
  const [branch, setBranch] = useState<Branch>(data.defaultBranch);
  const [month, setMonth] = useState(data.defaultMonth);

  const snapshot: DashboardSnapshot = useMemo(
    () => data.snapshots[snapshotKey(branch, month)],
    [branch, month, data.snapshots],
  );

  return (
    <main className="page-shell">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">SMPL · Sales & DSR</p>
          <h1>Performance Dashboard</h1>
          <p className="hero-copy">
            EUC and SML sales, transaction counts, targets and DSR-driven current-period performance in INR.
          </p>
        </div>
        <div className="status-pill">
          <span className="status-dot" />
          Workbook refresh: 5 min
        </div>
      </section>

      <section className="filter-bar" aria-label="Dashboard filters">
        <label>
          <span>Branch</span>
          <select value={branch} onChange={(event) => setBranch(event.target.value as Branch)}>
            {data.branches.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Month</span>
          <select value={month} onChange={(event) => setMonth(event.target.value)}>
            {data.months.map((item) => (
              <option key={item} value={item}>
                {item} {snapshot?.year ?? 2026}
              </option>
            ))}
          </select>
        </label>
        <div className="data-note">
          <span>Selected actual basis</span>
          <strong>{snapshot.actualBasis}</strong>
        </div>
        <div className="data-note">
          <span>Latest DSR activity</span>
          <strong>{formatDate(snapshot.dataThrough)}</strong>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Year to date</p>
            <h2>YTD Performance</h2>
          </div>
          <p>2025 and target figures include the full selected month because daily breakup is not available.</p>
        </div>
        <div className="metrics-grid metrics-grid-four">
          <MetricCard title={`${snapshot.year} Actual YTD`} pair={snapshot.ytd.current} accent />
          <MetricCard title={`${snapshot.year - 1} YTD`} pair={snapshot.ytd.previous} />
          <MetricCard title={`${snapshot.year} Target YTD`} pair={snapshot.ytd.target} />
          <AchievementCard
            title="YTD Achievement"
            salesPct={snapshot.achievement.ytdSalesPct}
            countPct={snapshot.achievement.ytdCountPct}
          />
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Selected month</p>
            <h2>{snapshot.month} {snapshot.year}</h2>
          </div>
          <p>For DSR-linked months, actuals reflect all entered daily records up to the latest active DSR date.</p>
        </div>
        <div className="metrics-grid metrics-grid-four">
          <MetricCard
            title={snapshot.dataThrough ? `${snapshot.month} Actual / MTD` : `${snapshot.month} Actual`}
            pair={snapshot.monthMetrics.current}
            accent
            note={snapshot.dataThrough ? `Through ${formatDate(snapshot.dataThrough)}` : undefined}
          />
          <MetricCard title={`${snapshot.month} ${snapshot.year - 1}`} pair={snapshot.monthMetrics.previous} />
          <MetricCard title={`${snapshot.month} ${snapshot.year} Target`} pair={snapshot.monthMetrics.target} />
          <AchievementCard
            title="Month Achievement"
            salesPct={snapshot.achievement.monthSalesPct}
            countPct={snapshot.achievement.monthCountPct}
          />
        </div>
      </section>

      <section className="section-block split-section">
        <div className="latest-card">
          <p className="eyebrow">Latest sales</p>
          <h2>{formatDate(snapshot.latestSale.date)}</h2>
          <div className="latest-values">
            <div>
              <span>Sales</span>
              <strong>{formatInr(snapshot.latestSale.sales)}</strong>
            </div>
            <div>
              <span>Transactions</span>
              <strong>{formatCount(snapshot.latestSale.count)}</strong>
            </div>
          </div>
          <p className="latest-footnote">
            Uses the latest DSR date with non-zero Sales or Count activity, rather than simply using yesterday.
          </p>
        </div>

        <div className="summary-card">
          <p className="eyebrow">Data logic</p>
          <h2>How this view is calculated</h2>
          <ul>
            <li>2025 Sales and Count are fixed monthly historical values.</li>
            <li>2026 Sales and Count targets are fixed monthly target values.</li>
            <li>Jan–Aug 2026 actuals use the monthly aggregate stored in the branch sheet.</li>
            <li>Sep 2026 onward uses daily records from the respective branch DSR whenever activity exists.</li>
          </ul>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Service mix</p>
            <h2>{snapshot.month} Performance by Service</h2>
          </div>
          <p>All values are shown in INR.</p>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Service</th>
                <th>Actual Sales</th>
                <th>Actual Count</th>
                <th>{snapshot.year - 1} Sales</th>
                <th>{snapshot.year - 1} Count</th>
                <th>Target Sales</th>
                <th>Target Count</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.services.map((service) => (
                <tr key={service.service}>
                  <td className="service-name">{service.service}</td>
                  <td>{formatInr(service.actualSales)}</td>
                  <td>{formatCount(service.actualCount)}</td>
                  <td>{formatInr(service.previousSales)}</td>
                  <td>{formatCount(service.previousCount)}</td>
                  <td>{formatInr(service.targetSales)}</td>
                  <td>{formatCount(service.targetCount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
