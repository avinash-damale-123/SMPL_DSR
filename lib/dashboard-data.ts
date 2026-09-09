import * as XLSX from "xlsx";

const DEFAULT_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSGoXmsHe0Ad9PgtTO0m_8vszvPxIjAgSpO4tkR4xgS_Fc6Y0XTLDGSN6-3N8M10iXXvaOkINaB_554/pub?output=xlsx";

const SERVICES = [
  "Air",
  "Car",
  "Hotel",
  "Visa",
  "Package",
  "Insurance",
  "Handling",
  "Other",
] as const;

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export type Branch = "EUC" | "SML";

export type MetricPair = {
  sales: number;
  count: number;
};

export type ServiceSummary = {
  service: string;
  actualSales: number;
  actualCount: number;
  previousSales: number;
  previousCount: number;
  targetSales: number;
  targetCount: number;
};

export type DashboardSnapshot = {
  branch: Branch;
  year: number;
  month: string;
  monthNumber: number;
  dataThrough: string | null;
  actualBasis: string;
  ytd: {
    current: MetricPair;
    previous: MetricPair;
    target: MetricPair;
  };
  monthMetrics: {
    current: MetricPair;
    previous: MetricPair;
    target: MetricPair;
  };
  achievement: {
    ytdSalesPct: number | null;
    ytdCountPct: number | null;
    monthSalesPct: number | null;
    monthCountPct: number | null;
  };
  latestSale: {
    date: string | null;
    sales: number;
    count: number;
  };
  services: ServiceSummary[];
};

export type DashboardData = {
  generatedAt: string;
  source: string;
  branches: Branch[];
  months: string[];
  defaultBranch: Branch;
  defaultMonth: string;
  snapshots: Record<string, DashboardSnapshot>;
};

type MonthlyRow = {
  branch: Branch;
  year: number;
  month: string;
  service: string;
  salesPrev: number;
  salesCurrent: number;
  targetSales: number;
  countPrev: number;
  countCurrent: number;
  targetCount: number;
};

type DsrRow = {
  branch: Branch;
  date: Date;
  values: Record<string, MetricPair>;
  totalSales: number;
  totalCount: number;
};

function num(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return 0;
  const cleaned = value.replace(/[₹$,%\s,]/g, "").replace(/^-+$/, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number") {
    const decoded = XLSX.SSF.parse_date_code(value);
    if (!decoded) return null;
    return new Date(Date.UTC(decoded.y, decoded.m - 1, decoded.d));
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function readMonthlySheet(workbook: XLSX.WorkBook, branch: Branch): MonthlyRow[] {
  const sheet = workbook.Sheets[branch];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    range: 2,
    raw: true,
    defval: null,
  });

  return rows
    .filter((row) => String(row[0] ?? "").trim() === branch)
    .map((row) => ({
      branch,
      year: num(row[1]),
      month: String(row[2] ?? "").trim(),
      service: String(row[3] ?? "").trim(),
      salesPrev: num(row[4]),
      salesCurrent: num(row[5]),
      targetSales: num(row[6]),
      countPrev: num(row[8]),
      countCurrent: num(row[9]),
      targetCount: num(row[10]),
    }))
    .filter((row) => row.year > 0 && MONTHS.includes(row.month as (typeof MONTHS)[number]));
}

function readDsrSheet(workbook: XLSX.WorkBook, branch: Branch): DsrRow[] {
  const sheet = workbook.Sheets[`${branch}_DSR`];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    range: 3,
    raw: true,
    defval: null,
  });

  return rows.flatMap((row) => {
    const rowBranch = String(row[0] ?? "").trim();
    const date = parseDate(row[1]);
    if (rowBranch !== branch || !date) return [];

    const values: Record<string, MetricPair> = {};
    SERVICES.forEach((service, index) => {
      const salesIndex = 2 + index * 2;
      values[service] = {
        sales: num(row[salesIndex]),
        count: num(row[salesIndex + 1]),
      };
    });

    return [
      {
        branch,
        date,
        values,
        totalSales: num(row[18]),
        totalCount: num(row[19]),
      },
    ];
  });
}

function sumPairs(pairs: MetricPair[]): MetricPair {
  return pairs.reduce(
    (acc, item) => ({ sales: acc.sales + item.sales, count: acc.count + item.count }),
    { sales: 0, count: 0 },
  );
}

function pct(actual: number, target: number): number | null {
  return target > 0 ? (actual / target) * 100 : null;
}

function monthIndex(month: string): number {
  return MONTHS.indexOf(month as (typeof MONTHS)[number]);
}

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function monthlyMetric(
  rows: MonthlyRow[],
  year: number,
  month: string,
  kind: "current" | "previous" | "target",
): MetricPair {
  const matching = rows.filter((row) => row.year === year && row.month === month);
  return sumPairs(
    matching.map((row) => {
      if (kind === "previous") return { sales: row.salesPrev, count: row.countPrev };
      if (kind === "target") return { sales: row.targetSales, count: row.targetCount };
      return { sales: row.salesCurrent, count: row.countCurrent };
    }),
  );
}

function dsrMetric(rows: DsrRow[], year: number, monthNumber: number): MetricPair {
  return sumPairs(
    rows
      .filter((row) => row.date.getFullYear() === year && row.date.getMonth() === monthNumber)
      .map((row) => ({ sales: row.totalSales, count: row.totalCount })),
  );
}

function hasDsrActivity(rows: DsrRow[], year: number, monthNumber: number): boolean {
  return rows.some(
    (row) =>
      row.date.getFullYear() === year &&
      row.date.getMonth() === monthNumber &&
      (row.totalSales !== 0 || row.totalCount !== 0),
  );
}

function currentMetricForMonth(
  monthlyRows: MonthlyRow[],
  dsrRows: DsrRow[],
  year: number,
  month: string,
): MetricPair {
  const index = monthIndex(month);
  if (index >= 0 && hasDsrActivity(dsrRows, year, index)) return dsrMetric(dsrRows, year, index);
  return monthlyMetric(monthlyRows, year, month, "current");
}

function serviceSummaryForMonth(
  monthlyRows: MonthlyRow[],
  dsrRows: DsrRow[],
  year: number,
  month: string,
): ServiceSummary[] {
  const index = monthIndex(month);
  const useDsr = index >= 0 && hasDsrActivity(dsrRows, year, index);

  return SERVICES.map((service) => {
    const monthly = monthlyRows.find(
      (row) => row.year === year && row.month === month && row.service === service,
    );
    const dsr = useDsr
      ? sumPairs(
          dsrRows
            .filter((row) => row.date.getFullYear() === year && row.date.getMonth() === index)
            .map((row) => row.values[service] ?? { sales: 0, count: 0 }),
        )
      : null;

    return {
      service,
      actualSales: dsr?.sales ?? monthly?.salesCurrent ?? 0,
      actualCount: dsr?.count ?? monthly?.countCurrent ?? 0,
      previousSales: monthly?.salesPrev ?? 0,
      previousCount: monthly?.countPrev ?? 0,
      targetSales: monthly?.targetSales ?? 0,
      targetCount: monthly?.targetCount ?? 0,
    };
  });
}

function buildSnapshot(
  branch: Branch,
  monthlyRows: MonthlyRow[],
  dsrRows: DsrRow[],
  year: number,
  month: string,
): DashboardSnapshot {
  const selectedMonthIndex = monthIndex(month);
  const monthsToDate = MONTHS.slice(0, selectedMonthIndex + 1);

  const currentYtd = sumPairs(
    monthsToDate.map((m) => currentMetricForMonth(monthlyRows, dsrRows, year, m)),
  );
  const previousYtd = sumPairs(
    monthsToDate.map((m) => monthlyMetric(monthlyRows, year, m, "previous")),
  );
  const targetYtd = sumPairs(
    monthsToDate.map((m) => monthlyMetric(monthlyRows, year, m, "target")),
  );

  const currentMonth = currentMetricForMonth(monthlyRows, dsrRows, year, month);
  const previousMonth = monthlyMetric(monthlyRows, year, month, "previous");
  const targetMonth = monthlyMetric(monthlyRows, year, month, "target");

  const activeRows = dsrRows
    .filter(
      (row) =>
        row.date.getFullYear() === year &&
        row.date.getMonth() === selectedMonthIndex &&
        (row.totalSales !== 0 || row.totalCount !== 0),
    )
    .sort((a, b) => b.date.getTime() - a.date.getTime());
  const latest = activeRows[0] ?? null;
  const useDsr = selectedMonthIndex >= 0 && hasDsrActivity(dsrRows, year, selectedMonthIndex);

  return {
    branch,
    year,
    month,
    monthNumber: selectedMonthIndex + 1,
    dataThrough: latest ? formatIsoDate(latest.date) : null,
    actualBasis: useDsr
      ? `${month} ${year} actuals are calculated from daily ${branch}_DSR entries.`
      : `${month} ${year} actuals use the fixed monthly aggregate in ${branch}.`,
    ytd: {
      current: currentYtd,
      previous: previousYtd,
      target: targetYtd,
    },
    monthMetrics: {
      current: currentMonth,
      previous: previousMonth,
      target: targetMonth,
    },
    achievement: {
      ytdSalesPct: pct(currentYtd.sales, targetYtd.sales),
      ytdCountPct: pct(currentYtd.count, targetYtd.count),
      monthSalesPct: pct(currentMonth.sales, targetMonth.sales),
      monthCountPct: pct(currentMonth.count, targetMonth.count),
    },
    latestSale: {
      date: latest ? formatIsoDate(latest.date) : null,
      sales: latest?.totalSales ?? 0,
      count: latest?.totalCount ?? 0,
    },
    services: serviceSummaryForMonth(monthlyRows, dsrRows, year, month),
  };
}

export async function getDashboardData(): Promise<DashboardData> {
  const source = process.env.SMPL_SHEET_XLSX_URL || DEFAULT_SHEET_URL;
  const response = await fetch(source, { next: { revalidate: 300 } });
  if (!response.ok) throw new Error(`Unable to load SMPL workbook (${response.status}).`);

  const buffer = await response.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const snapshots: Record<string, DashboardSnapshot> = {};
  const branches: Branch[] = ["EUC", "SML"];

  for (const branch of branches) {
    const monthlyRows = readMonthlySheet(workbook, branch);
    const dsrRows = readDsrSheet(workbook, branch);
    const years = monthlyRows.map((row) => row.year).filter(Boolean);
    const year = years.length ? Math.max(...years) : 2026;

    for (const month of MONTHS) {
      snapshots[`${branch}-${month}`] = buildSnapshot(
        branch,
        monthlyRows,
        dsrRows,
        year,
        month,
      );
    }
  }

  const defaultMonth = "Sep";

  return {
    generatedAt: new Date().toISOString(),
    source,
    branches,
    months: [...MONTHS],
    defaultBranch: "EUC",
    defaultMonth,
    snapshots,
  };
}
