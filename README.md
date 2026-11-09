# hasanscgcalculator — NU Result & CGPA Calculator

Cloned from nu-cgpa-calculator-ten.vercel.app, with all problems fixed.

## What's fixed
1. **College option removed** — the College dropdown is gone; the tab is now
   "Batch Result" and loads by Subject + Year across all colleges in the DB.
2. **Dark mode fixed** — Bootstrap `data-bs-theme` on `<html>` (synced by the
   theme toggle), so nav, dropdowns, tables and buttons all follow the theme;
   selects use `form-select`.
3. **Placeholder registration numbers removed** — no example reg number in the
   Reg No box or the paste box.
4. **Short description + How to use** — one-line description under the header
   and a collapsible "How to use" (CGPA + Batch steps).

## Files
- `index.html` — the whole app (single file).
- `api/result.js` — Vercel serverless function. Scrapes the official NU results
  site (results.nu.ac.bd): GETs the form, solves its text math CAPTCHA,
  POSTs exam/year/reg, parses the result into JSON. Verified against the
  original API (same name/roll/college/subject/status/courses).
- `data/students.json.gz` — NU roll-sheet database (13,264 students) for the
  Batch tab auto-load.

## Deploy (Vercel)
Push this folder to a GitHub repo named `hasanscgcalculator`, then import it
in Vercel (Add New → Project → Import Git Repository). No build step, no env
vars. Production URL: https://hasanscgcalculator.vercel.app/
