# Aria — Live Job Radar (free version)

This is the "make it live" version of Aria's Jobs tab. It's a real, working system —
not a demo — but it runs entirely on free infrastructure, which comes with one
honest trade-off: **jobs update roughly every 30 minutes**, not within 1 minute.
Getting closer to instant alerts later means paying for a small always-on server
(see "Going faster later" at the bottom).

## What this actually does

- `scripts/fetch-jobs.js` — a small script that calls **four public, free,
  no-API-key** job APIs (RemoteOK, Remotive, Jobicy, Arbeitnow), filters the
  results down to **IT/tech roles specifically** (by keyword-matching titles
  and tags against a built-in list of IT terms), and saves everything as
  `docs/jobs.json`.
- `.github/workflows/fetch-jobs.yml` — tells GitHub to run that script automatically,
  roughly every 30 minutes, forever, for free.
- `docs/index.html` — the dashboard you already tested, adapted to load real jobs
  from `jobs.json` instead of sample data. GitHub Pages will serve this for free.

Both pieces live in the same GitHub repo — no separate backend server to manage.

**A note on Jobicy and Arbeitnow specifically:** their exact field names were
mapped from documentation, not tested live (this environment's sandbox blocks
outbound requests to job-board domains). RemoteOK and Remotive were verified
against real prior usage and are more likely to work exactly as written. If
Jobicy or Arbeitnow return 0 jobs after your first run, check the Actions log
— it'll show the exact error, and the fix is usually just adjusting one field
name in that source's function in `fetch-jobs.js`.

## Setup (about 10 minutes, no credit card needed)

1. **Create a GitHub account** if you don't have one already — [github.com](https://github.com).
2. **Create a new repository.** Name it anything (e.g. `aria-live`). Keep it Public
   (Public repos get unlimited free GitHub Actions minutes; Private repos get a
   smaller free monthly allowance, which is usually still plenty for this).
3. **Upload all the files from this project**, keeping the folder structure exactly
   as given (`.github/workflows/fetch-jobs.yml`, `scripts/fetch-jobs.js`,
   `docs/index.html`, `docs/jobs.json`, `package.json`, this `README.md`). The
   easiest way: on your new repo's page, use "Add file → Upload files" and drag
   the whole folder in, or use GitHub Desktop if you have it.
4. **Turn on GitHub Pages:**
   - Go to your repo's **Settings → Pages**.
   - Under "Build and deployment," set **Source** to "Deploy from a branch."
   - Set **Branch** to `main` (or `master`) and the folder to **`/docs`**.
   - Save. GitHub will give you a URL like `https://yourusername.github.io/aria-live/`
     — that's your live site. It can take a minute or two to go live the first time.
5. **Run the job-fetcher for the first time:**
   - Go to your repo's **Actions** tab.
   - You should see a workflow called "Fetch live jobs." Click it.
   - Click **"Run workflow"** (the manual trigger button) → **Run workflow** again to confirm.
   - Wait about 30–60 seconds, then refresh — it should show a green checkmark.
   - This updates `docs/jobs.json` with real jobs and commits it automatically.
6. **Open your live site** (the URL from step 4) and go to the Jobs tab — you should
   see real postings now instead of sample data.

After this, the workflow keeps running on its own every ~30 minutes. You don't need
to do anything else.

## Things worth knowing

- **Scheduled runs can be delayed.** GitHub doesn't guarantee exact timing for
  scheduled Actions, especially during busy periods. Treat "every 30 minutes" as
  "roughly every 30 minutes."
- **Scheduled Actions auto-pause after 60 days of repo inactivity.** If you don't
  touch the repo for 2 months, GitHub turns off the schedule to save resources.
  If that happens, just go to the Actions tab and click "Run workflow" once — it
  turns the schedule back on.
- **These are remote-only, global listings for now.** RemoteOK and Remotive don't
  publish onsite/hybrid Metro Manila jobs or Facebook group postings — those
  sources need either a paid data partnership or manual link-checking (see the
  earlier conversation about why Facebook/LinkedIn/JobStreet are harder to
  automate). This version covers what's realistically free and automatable today.
- **Matching is offline/keyword-based now, not AI-powered.** The claude.ai version
  used Claude to score matches. A real standalone website can't call that for free
  — it would need your own paid Anthropic API key wired through a small serverless
  function. The keyword-matching here is the same fallback logic the prototype
  already had, so it still works, just less nuanced.
- **CSV export and everything else** (themes, saved job statuses, resume storage)
  works the same as before, no changes needed there.

## Adding more job sources later

`scripts/fetch-jobs.js` is written so each source is a separate function
(`fetchRemoteOK`, `fetchRemotive`, `fetchJobicy`, `fetchArbeitnow`) that returns
a normalized array, run through the shared `isITJob()` filter. To add a new
source:

1. Write a new `fetchXyz()` function that calls that source's API and maps its
   fields to the same shape: `{ id, title, company, source, url, setup, location,
   salaryMin, salaryMax, postedAt }`.
2. Add it to the `Promise.all([...])` list and the final `all = [...]` array in `main()`.

Good next candidates, in rough order of ease:

- **Jooble API** — free, needs a quick sign-up for an API key at jooble.org/api/about.
- **Adzuna API** — free tier, needs sign-up at developer.adzuna.com. Double-check
  their country coverage includes the Philippines before relying on it.
- **Hacker News "Who is Hiring"** — free, public, via the Algolia HN API
  (hn.algolia.com/api), but needs a bit more logic since job listings are comments
  inside a monthly thread rather than a clean job-listing endpoint.

## Going faster later (optional, not free)

If 30-minute updates aren't fast enough later, the fix is a small always-on server
(~$5–7/month on something like Render, Railway, or a basic VPS) running the same
fetch logic every 1–2 minutes instead of via a GitHub Actions schedule, plus
something like a Telegram bot to push instant alerts. That's a bigger step — worth
coming back to once you've confirmed the free version is useful day-to-day.
