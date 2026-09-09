"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  snapshotKey,
  type Branch,
  type DashboardData,
  type DashboardSnapshot,
  type MetricPair,
  type ServiceSummary,
} from "@/lib/dashboard-data";

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
  const date = new Date(`${value}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
};

function addPairs(...pairs: MetricPair[]): MetricPair {
  return pairs.reduce(
    (acc, pair) => ({ sales: acc.sales + pair.sales, count: acc.count + pair.count }),
    { sales: 0, count: 0 },
  );
}

function ratio(actual: number, target: number): number | null {
  return target > 0 ? (actual / target) * 100 : null;
}

function combineServices(rows: ServiceSummary[][]): ServiceSummary[] {
  const map = new Map<string, ServiceSummary>();
  for (const list of rows) {
    for (const item of list) {
      const current = map.get(item.service) ?? {
        service: item.service,
        actualSales: 0,
        actualCount: 0,
        previousSales: 0,
        previousCount: 0,
        targetSales: 0,
        targetCount: 0,
      };
      current.actualSales += item.actualSales;
      current.actualCount += item.actualCount;
      current.previousSales += item.previousSales;
      current.previousCount += item.previousCount;
      current.targetSales += item.targetSales;
      current.targetCount += item.targetCount;
      map.set(item.service, current);
    }
  }
  return [...map.values()];
}

function MultiSelect<T extends string | number>({
  label,
  values,
  options,
  onChange,
  renderOption,
}: {
  label: string;
  values: T[];
  options: T[];
  onChange: (values: T[]) => void;
  renderOption?: (value: T) => string;
}) {
  return (
    <label className="filter-control">
      <span>{label}</span>
      <select
        multiple
        value={values.map(String)}
        onChange={(event) => {
          const selected = Array.from(event.currentTarget.selectedOptions).map((option) => option.value);
          const typed = options.filter((option) => selected.includes(String(option)));
          onChange(typed.length ? typed : options);
        }}
      >
        {options.map((option) => (
          <option key={String(option)} value={String(option)}>
            {renderOption ? renderOption(option) : String(option)}
          </option>
        ))}
      </select>
      <small>{values.length === options.length ? "All selected" : `${values.length} selected`}</small>
    </label>
  );
}

function KpiTile({ title, sales, count, note }: { title: string; sales: number; count: number; note?: string }) {
  return (
    <article className="compact-kpi">
      <p>{title}</p>
      <strong>{formatInr(sales)}</strong>
      <span>{formatCount(count)} transactions</span>
      {note ? <small>{note}</small> : null}
    </article>
  );
}

export default function DashboardClient({ data }: { data: DashboardData }) {
  const [branches, setBranches] = useState<Branch[]>([...data.branches]);
  const [years, setYears] = useState<number[]>([data.defaultYear]);
  const [months, setMonths] = useState<string[]>([data.defaultMonth]);

  const operational = useMemo(() => {
    const snapshots = data.branches
      .map((branch) => data.snapshots[snapshotKey(branch, data.operationalYear, data.operationalMonth)])
      .filter(Boolean);

    const ytdCurrent = addPairs(...snapshots.map((item) => item.ytd.current));
    const ytdPrevious = addPairs(...snapshots.map((item) => item.ytd.previous));
    const ytdTarget = addPairs(...snapshots.map((item) => item.ytd.target));
    const mtdCurrent = addPairs(...snapshots.map((item) => item.monthMetrics.current));
    const mtdPrevious = addPairs(...snapshots.map((item) => item.monthMetrics.previous));
    const mtdTarget = addPairs(...snapshots.map((item) => item.monthMetrics.target));

    const latest = data.dailyActivity
      .filter((row) => row.year === data.operationalYear)
      .sort((a, b) => b.date.localeCompare(a.date))[0];

    return {
      ytdCurrent,
      ytdPrevious,
      ytdTarget,
      mtdCurrent,
      mtdPrevious,
      mtdTarget,
      latest,
    };
  }, [data]);

  const selectedSnapshots = useMemo(() => {
    const result: DashboardSnapshot[] = [];
    for (const branch of branches) {
      for (const year of years) {
        for (const month of months) {
          const snapshot = data.snapshots[snapshotKey(branch, year, month)];
          if (snapshot) result.push(snapshot);
        }
      }
    }
    return result;
  }, [branches, years, months, data.snapshots]);

  const selected = useMemo(() => {
    const actual = addPairs(...selectedSnapshots.map((item) => item.monthMetrics.current));
    const previous = addPairs(...selectedSnapshots.map((item) => item.monthMetrics.previous));
    const target = addPairs(...selectedSnapshots.map((item) => item.monthMetrics.target));
    const services = combineServices(selectedSnapshots.map((item) => item.services));

    return {
      actual,
      previous,
      target,
      services,
      salesAchievement: ratio(actual.sales, target.sales),
      countAchievement: ratio(actual.count, target.count),
    };
  }, [selectedSnapshots]);

  return (
    <main className="page-shell compact-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">SMPL · Sales & DSR</p>
          <h1>Performance Dashboard</h1>
        </div>
        <nav className="page-nav">
          <Link className="nav-link active" href="/">Dashboard</Link>
          <Link className="nav-link" href="/sales-analysis">Sales Analysis</Link>
        </nav>
      </header>

      <section className="operational-strip">
        <div className="strip-heading">
          <div>
            <span>Fixed operational view</span>
            <strong>{data.operationalMonth} {data.operationalYear} · EUC + SML</strong>
          </div>
          <small>These cards do not change when filters are applied.</small>
        </div>
        <div className="compact-kpi-grid">
          <KpiTile title="YTD Actual" sales={operational.ytdCurrent.sales} count={operational.ytdCurrent.count} />
          <KpiTile title="YTD Previous Year" sales={operational.ytdPrevious.sales} count={operational.ytdPrevious.count} />
          <KpiTile title="YTD Target" sales={operational.ytdTarget.sales} count={operational.ytdTarget.count} />
          <KpiTile title="MTD Actual" sales={operational.mtdCurrent.sales} count={operational.mtdCurrent.count} />
          <KpiTile title="MTD Previous Year" sales={operational.mtdPrevious.sales} count={operational.mtdPrevious.count} />
          <KpiTile title="MTD Target" sales={operational.mtdTarget.sales} count={operational.mtdTarget.count} />
          <KpiTile
            title="Latest Sales"
            sales={operational.latest?.totalSales ?? 0}
            count={operational.latest?.totalCount ?? 0}
            note={formatDate(operational.latest?.date ?? null)}
          />
        </div>
      </section>

      <section className="filter-panel">
        <div className="filter-panel-title">
          <div>
            <p className="eyebrow">Analysis filters</p>
            <h2>Choose one or multiple values</h2>
          </div>
          <button
            type="button"
            className="clear-button"
            onClick={() => {
              setBranches([...data.branches]);
              setYears([...data.years]);
              setMonths([...data.months]);
            }}
          >
            Select all
          </button>
        </div>
        <div className="filter-grid-three">
          <MultiSelect label="Branch" values={branches} options={data.branches} onChange={setBranches} />
          <MultiSelect label="Year" values={years} options={data.years} onChange={setYears} />
          <MultiSelect label="Month" values={months} options={data.months} onChange={setMonths} />
        </div>
      </section>

      <section className="analysis-summary-grid">
        <article className="analysis-card accent-card">
          <span>Selected Actual</span>
          <strong>{formatInr(selected.actual.sales)}</strong>
          <small>{formatCount(selected.actual.count)} transactions</small>
        </article>
        <article className="analysis-card">
          <span>Previous Year</span>
          <strong>{formatInr(selected.previous.sales)}</strong>
          <small>{formatCount(selected.previous.count)} transactions</small>
        </article>
        <article className="analysis-card">
          <span>Target</span>
          <strong>{formatInr(selected.target.sales)}</strong>
          <small>{formatCount(selected.target.count)} target transactions</small>
        </article>
        <article className="analysis-card">
          <span>Sales Achievement</span>
          <strong>{formatPct(selected.salesAchievement)}</strong>
          <small>Count achievement {formatPct(selected.countAchievement)}</small>
        </article>
      </section>

      <section className="section-block compact-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Filtered service view</p>
            <h2>Service Performance</h2>
          </div>
          <p>{branches.join(", ")} · {years.join(", ")} · {months.join(", ")}</p>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Service</th>
                <th>Actual Sales</th>
                <th>Actual Count</th>
                <th>Previous Sales</th>
                <th>Previous Count</th>
                <th>Target Sales</th>
                <th>Target Count</th>
              </tr>
            </thead>
            <tbody>
              {selected.services.map((service) => (
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
