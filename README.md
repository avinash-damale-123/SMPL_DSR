# SMPL DSR Dashboard

Small Next.js dashboard for SMPL sales and DSR monitoring. The application is designed for GitHub + Vercel deployment.

## Fixed project repository

All SMPL portal development should continue in this repository only:

`avinash-damale-123/SMPL_DSR`

## Data scope

The current dashboard uses only these four workbook sheets:

- `EUC`
- `SML`
- `EUC_DSR`
- `SML_DSR`

These sheets are intentionally ignored by the application:

- `Sales Dashboard`
- `SHML`
- `Combine_DSR`

## Business logic

### EUC_DSR / SML_DSR

Daily DSR entry sheets. Each row represents one Branch + Date combination.

Eight services are tracked:

1. Air
2. Car
3. Hotel
4. Visa
5. Package
6. Insurance
7. Handling
8. Other

Each service has:

- Sales
- Count

The final two columns contain Grand Total Sales and Grand Total Count.

### EUC / SML

Monthly service-level summary sheets.

Each row represents:

`Branch + Year + Month + Service`

The dashboard uses:

- Previous-year Sales
- Current-year Sales
- Current-year Sales Target
- Previous-year Count
- Current-year Count
- Current-year Count Target

YOY % and ATP are not required for the first dashboard calculation layer.

### Actual-data logic

- 2025 Sales and Count are fixed monthly historical figures.
- 2026 Sales and Count targets are fixed monthly target figures.
- Jan-Aug 2026 actual Sales and Count use the fixed monthly aggregate in the `EUC` or `SML` sheet.
- Sep 2026 onward, where DSR activity exists, current actual Sales and Count are calculated directly from `EUC_DSR` or `SML_DSR`.

## Page 1 - Dashboard

Current version includes:

- Branch filter: EUC / SML
- Month filter
- INR only
- YTD current-year Sales and Count
- YTD previous-year Sales and Count
- YTD current-year target Sales and Count
- YTD target achievement
- Selected-month / MTD actual Sales and Count
- Previous-year same-month Sales and Count
- Current-year selected-month target Sales and Count
- Month target achievement
- Latest DSR activity date
- Latest-sales amount
- Latest transaction count
- Service-wise monthly breakdown

The latest-sales card uses the latest DSR row with non-zero Sales or Count activity instead of simply using yesterday.

## Data source

By default, the application reads the published XLSX export supplied for the SMPL workbook.

You can override it in Vercel with:

```bash
SMPL_SHEET_XLSX_URL=<your-xlsx-export-url>
```

This keeps the deployment simple. A private Google Sheets API integration can replace the published export later if required.

## Run locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Deploy to Vercel

1. Import `avinash-damale-123/SMPL_DSR` into Vercel.
2. Keep the framework preset as Next.js.
3. Add `SMPL_SHEET_XLSX_URL` only if you want to override the default workbook export.
4. Deploy.
