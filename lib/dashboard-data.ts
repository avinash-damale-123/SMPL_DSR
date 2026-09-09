import * as XLSX from "xlsx";

const DEFAULT_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSGoXmsHe0Ad9PgtTO0m_8vszvPxIjAgSpO4tkR4xgS_Fc6Y0XTLDGSN6-3N8M10iXXvaOkINaB_554/pub?output=xlsx";

export const SERVICES = [
  "Air",
  "Car",
  "Hotel",
  "Visa",
  "Package",
  "Insurance",
  "Handling",
  "Other",
] as const;

export const MONTHS = [
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

export type DailyActivity = {
  branch: Branch;
  date: string;
  year: number;
  month: string;
  monthNumber: number;
  services: Record<string, MetricPair>;
  totalSales: number;
  totalCount: number;
};

export type MonthlyPerformance = {
  branch: Branch;
  year: number;
  month: string;
  monthNumber: number;
  actual: MetricPair;
  previous: MetricPair;
  target: MetricPair;
  salesAchievementPct: number | null;
  countAchievementPct: number | null;
  dataThrough: string | null;
  actualBasis: string;
};

export type DashboardData = {
  generatedAt: string;
  source: string;
  branches: Branch[];
  years: number[];
  months: string[];
  defaultBranch: Branch;
  defaultYear: number;
  defaultMonth: string;
  operationalYear: number;
  operationalMonth: string;
  snapshots: Record<string, DashboardSnapshot>;
  dailyActivity: DailyActivity[];
  monthlyPerformance: MonthlyPerformance[];
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

function normalizeDate(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day));
}

function parseDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return normalizeDate(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
  }
  if (typeof value === "number") {
    const decoded = XLSX.SSF.parse_date_code(value);
    if (!decoded) return null;
    return normalizeDate(decoded.y, decoded.m - 1, decoded.d);
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return normalizeDate(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
    }
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
    .filter(
      (row) =>
        row.year > 0 &&
        MONTHS.includes(row.month as (typeof MONTHS)[number]) &&
        SERVICES.includes(row.service as (typeof SERVICES)[number]),
    );
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

    const calculatedTotal = sumPairs(Object.values(values));
    const enteredSales = num(row[18]);
    const enteredCount = num(row[19]);

    return [
      {
        branch,
        date,
        values,
        totalSales: enteredSales || calculatedTotal.sales,
        totalCount: enteredCount || calculatedTotal.count,
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

function isOnOrBeforeToday(date: Date): boolean {
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return date.getTime() <= today;
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
      .filter((row) => row.date.getUTCFullYear() === year && row.date.getUTCMonth() === monthNumber)
      .map((row) => ({ sales: row.totalSales, count: row.totalCount })),
  );
}

function hasDsrActivity(rows: DsrRow[], year: number, monthNumber: number): boolean {
  return rows.some(
    (row) =>
      row.date.getUTCFullYear() === year &&
      row.date.getUTCMonth() === monthNumber &&
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
            .filter(
              (row) => row.date.getUTCFullYear() === year && row.date.getUTCMonth() === index,
            )
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
    monthsToDate.map((item) => currentMetricForMonth(monthlyRows, dsrRows, year, item)),
  );
  const previousYtd = sumPairs(
    monthsToDate.map((item) => monthlyMetric(monthlyRows, year, item, "previous")),
  );
  const targetYtd = sumPairs(
    monthsToDate.map((item) => monthlyMetric(monthlyRows, year, item, "target")),
  );

  const currentMonth = currentMetricForMonth(monthlyRows, dsrRows, year, month);
  const previousMonth = monthlyMetric(monthlyRows, year, month, "previous");
  const targetMonth = monthlyMetric(monthlyRows, year, month, "target");

  const monthActiveRows = dsrRows
    .filter(
      (row) =>
        row.date.getUTCFullYear() === year &&
        row.date.getUTCMonth() === selectedMonthIndex &&
        (row.totalSales !== 0 || row.totalCount !== 0),
    )
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  const latestEligibleRows = dsrRows
    .filter(
      (row) =>
        row.date.getUTCFullYear() === year &&
        row.date.getUTCMonth() <= selectedMonthIndex &&
        (row.totalSales !== 0 || row.totalCount !== 0),
    )
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  const dataThroughRow = monthActiveRows[0] ?? null;
  const latest = latestEligibleRows[0] ?? null;
  const useDsr = selectedMonthIndex >= 0 && hasDsrActivity(dsrRows, year, selectedMonthIndex);

  return {
    branch,
    year,
    month,
    monthNumber: selectedMonthIndex + 1,
    dataThrough: dataThroughRow ? formatIsoDate(dataThroughRow.date) : null,
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

export function snapshotKey(branch: Branch, year: number, month: string): string {
  return `${branch}-${year}-${month}`;
}

export async function getDashboardData(): Promise<DashboardData> {
  const source = process.env.SMPL_SHEET_XLSX_URL || DEFAULT_SHEET_URL;
  const response = await fetch(source, { next: { revalidate: 300 } });
  if (!response.ok) throw new Error(`Unable to load SMPL workbook (${response.status}).`);

  const buffer = await response.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const snapshots: Record<string, DashboardSnapshot> = {};
  const branches: Branch[] = ["EUC", "SML"];
  const monthlyByBranch = new Map<Branch, MonthlyRow[]>();
  const dsrByBranch = new Map<Branch, DsrRow[]>();
  const allMonthlyRows: MonthlyRow[] = [];
  const allDsrRows: DsrRow[] = [];

  for (const branch of branches) {
    const monthlyRows = readMonthlySheet(workbook, branch);
    const dsrRows = readDsrSheet(workbook, branch).filter((row) => isOnOrBeforeToday(row.date));
    monthlyByBranch.set(branch, monthlyRows);
    dsrByBranch.set(branch, dsrRows);
    allMonthlyRows.push(...monthlyRows);
    allDsrRows.push(...dsrRows);
  }

  const years = [...new Set(allMonthlyRows.map((row) => row.year).filter(Boolean))].sort(
    (a, b) => a - b,
  );
  if (!years.length) years.push(new Date().getUTCFullYear());

  for (const branch of branches) {
    const monthlyRows = monthlyByBranch.get(branch) ?? [];
    const dsrRows = dsrByBranch.get(branch) ?? [];
    for (const year of years) {
      for (const month of MONTHS) {
        snapshots[snapshotKey(branch, year, month)] = buildSnapshot(
          branch,
          monthlyRows,
          dsrRows,
          year,
          month,
        );
      }
    }
  }

  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const operationalYear = years.includes(currentYear)
    ? currentYear
    : [...years].reverse().find((year) => year <= currentYear) ?? years[years.length - 1];
  const operationalMonth =
    operationalYear === currentYear ? MONTHS[now.getUTCMonth()] : MONTHS[MONTHS.length - 1];

  const dailyActivity: DailyActivity[] = allDsrRows
    .filter((row) => row.totalSales !== 0 || row.totalCount !== 0)
    .map((row) => ({
      branch: row.branch,
      date: formatIsoDate(row.date),
      year: row.date.getUTCFullYear(),
      month: MONTHS[row.date.getUTCMonth()],
      monthNumber: row.date.getUTCMonth() + 1,
      services: row.values,
      totalSales: row.totalSales,
      totalCount: row.totalCount,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const monthlyPerformance: MonthlyPerformance[] = [];
  for (const branch of branches) {
    for (const year of years) {
      for (const month of MONTHS) {
        const snapshot = snapshots[snapshotKey(branch, year, month)];
        monthlyPerformance.push({
          branch,
          year,
          month,
          monthNumber: snapshot.monthNumber,
          actual: snapshot.monthMetrics.current,
          previous: snapshot.monthMetrics.previous,
          target: snapshot.monthMetrics.target,
          salesAchievementPct: snapshot.achievement.monthSalesPct,
          countAchievementPct: snapshot.achievement.monthCountPct,
          dataThrough: snapshot.dataThrough,
          actualBasis: snapshot.actualBasis,
        });
      }
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    source,
    branches,
    years,
    months: [...MONTHS],
    defaultBranch: "EUC",
    defaultYear: operationalYear,
    defaultMonth: operationalMonth,
    operationalYear,
    operationalMonth,
    snapshots,
    dailyActivity,
    monthlyPerformance,
  };
}
