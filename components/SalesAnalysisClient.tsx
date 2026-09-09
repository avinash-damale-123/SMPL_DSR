"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Branch, DashboardData, MetricPair } from "@/lib/dashboard-data";

const formatInr = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);

const formatCount = (value: number) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value || 0);

const formatPct = (value: number | null) => (value === null ? "—" : `${value.toFixed(1)}%`);

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    weekday: "short",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));

function MultiSelect<T extends string | number>({
  label,
  values,
  options,
  onChange,
}: {
  label: string;
  values: T[];
  options: T[];
  onChange: (values: T[]) => void;
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
            {String(option)}
          </option>
        ))}
      </select>
      <small>{values.length === options.length ? "All selected" : `${values.length} selected`}</small>
    </label>
  );
}

function sumPairs(pairs: MetricPair[]): MetricPair {
  return pairs.reduce(
    (acc, pair) => ({ sales: acc.sales + pair.sales, count: acc.count + pair.count }),
    { sales: 0, count: 0 },
  );
}

export default function SalesAnalysisClient({ data }: { data: DashboardData }) {
  const [branches, setBranches] = useState<Branch[]>([...data.branches]);
  const [years, setYears] = useState<number[]>([data.defaultYear]);
  const [months, setMonths] = useState<string[]>([data.defaultMonth]);

  const filteredDaily = useMemo(
    () =>
      data.dailyActivity.filter(
        (row) => branches.includes(row.branch) && years.includes(row.year) && months.includes(row.month),
      ),
    [branches, years, months, data.dailyActivity],
  );

  const lastSevenDates = useMemo(() => {
    const dates = [...new Set(filteredDaily.map((row) => row.date))]
      .sort((a, b) => b.localeCompare(a))
      .slice(0, 7);

    return dates.map((date) => {
      const rows = filteredDaily.filter((row) => row.date === date);
      const total = sumPairs(rows.map((row) => ({ sales: row.totalSales, count: row.totalCount })));
      const services = data.months.length
        ? ["Air", "Car", "Hotel", "Visa", "Package", "Insurance", "Handling", "Other"].map((service) => {
            const metric = sumPairs(
              rows.map((row) => row.services[service] ?? { sales: 0, count: 0 }),
            );
            return { service, ...metric };
          })
        : [];
      return { date, total, services };
    });
  }, [filteredDaily, data.months.length]);

  const monthlyRows = useMemo(
    () =>
      data.monthlyPerformance
        .filter(
          (row) => branches.includes(row.branch) && years.includes(row.year) && months.includes(row.month),
        )
        .sort((a, b) => a.year - b.year || a.monthNumber - b.monthNumber || a.branch.localeCompare(b.branch)),
    [branches, years, months, data.monthlyPerformance],
  );

  const combinedMonthly = useMemo(() => {
    const map = new Map<string, {
      year: number;
      month: string;
      monthNumber: number;
      actual: MetricPair;
      target: MetricPair;
    }>();

    for (const row of monthlyRows) {
      const key = `${row.year}-${row.month}`;
      const current = map.get(key) ?? {
        year: row.year,
        month: row.month,
        monthNumber: row.monthNumber,
        actual: { sales: 0, count: 0 },
        target: { sales: 0, count: 0 },
      };
      current.actual.sales += row.actual.sales;
      current.actual.count += row.actual.count;
      current.target.sales += row.target.sales;
      current.target.count += row.target.count;
      map.set(key, current);
    }

    return [...map.values()].sort((a, b) => a.year - b.year || a.monthNumber - b.monthNumber);
  }, [monthlyRows]);

  const lastSevenTotal = useMemo(
    () => sumPairs(lastSevenDates.map((row) => row.total)),
    [lastSevenDates],
  );

  return (
    <main className="page-shell compact-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">SMPL · Sales & DSR</p>
          <h1>Sales Analysis</h1>
        </div>
        <nav className="page-nav">
          <Link className="nav-link" href="/">Dashboard</Link>
          <Link className="nav-link active" href="/sales-analysis">Sales Analysis</Link>
        </nav>
      </header>

      <section className="filter-panel">
        <div className="filter-panel-title">
          <div>
            <p className="eyebrow">Analysis filters</p>
            <h2>Branch, year and month</h2>
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

      <section className="analysis-summary-grid three-up">
        <article className="analysis-card accent-card">
          <span>Last 7 Available Dates Sales</span>
          <strong>{formatInr(lastSevenTotal.sales)}</strong>
          <small>{formatCount(lastSevenTotal.count)} transactions</small>
        </article>
        <article className="analysis-card">
          <span>Latest Available Date</span>
          <strong className="date-value">{lastSevenDates[0] ? formatDate(lastSevenDates[0].date) : "—"}</strong>
          <small>Latest filtered DSR date with activity</small>
        </article>
        <article className="analysis-card">
          <span>Dates Included</span>
          <strong>{lastSevenDates.length}</strong>
          <small>Up to the latest 7 available dates</small>
        </article>
      </section>

      <section className="section-block compact-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Transaction & sales</p>
            <h2>Last 7 Available DSR Dates</h2>
          </div>
          <p>Shows service-wise Sales and Count in INR for the latest available activity dates.</p>
        </div>
        <div className="table-wrap">
          <table className="last-seven-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Total Sales</th>
                <th>Total Count</th>
                <th>Air</th>
                <th>Car</th>
                <th>Hotel</th>
                <th>Visa</th>
                <th>Package</th>
                <th>Insurance</th>
                <th>Handling</th>
                <th>Other</th>
              </tr>
            </thead>
            <tbody>
              {lastSevenDates.map((row) => (
                <tr key={row.date}>
                  <td className="service-name">{formatDate(row.date)}</td>
                  <td>{formatInr(row.total.sales)}</td>
                  <td>{formatCount(row.total.count)}</td>
                  {row.services.map((service) => (
                    <td key={service.service}>
                      <span className="cell-main">{formatInr(service.sales)}</span>
                      <span className="cell-sub">{formatCount(service.count)} txn</span>
                    </td>
                  ))}
                </tr>
              ))}
              {!lastSevenDates.length ? (
                <tr>
                  <td colSpan={11} className="empty-cell">No DSR activity for the selected filters.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section-block compact-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Target vs achievement</p>
            <h2>Month-wise Performance</h2>
          </div>
          <p>Combined view for the selected branch or branches.</p>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Sales Target</th>
                <th>Sales Actual</th>
                <th>Sales Ach %</th>
                <th>Count Target</th>
                <th>Count Actual</th>
                <th>Count Ach %</th>
              </tr>
            </thead>
            <tbody>
              {combinedMonthly.map((row) => (
                <tr key={`${row.year}-${row.month}`}>
                  <td className="service-name">{row.month}-{String(row.year).slice(-2)}</td>
                  <td>{formatInr(row.target.sales)}</td>
                  <td>{formatInr(row.actual.sales)}</td>
                  <td>{formatPct(row.target.sales ? (row.actual.sales / row.target.sales) * 100 : null)}</td>
                  <td>{formatCount(row.target.count)}</td>
                  <td>{formatCount(row.actual.count)}</td>
                  <td>{formatPct(row.target.count ? (row.actual.count / row.target.count) * 100 : null)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
