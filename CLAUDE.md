# Life Planner — notes for Claude

Static app in `docs/` (plain HTML/CSS/JS, no build). Served by GitHub Pages from `main` + `/docs`.

## Data safety rules (critical — Maxi can't lose anything)
- User data lives ONLY in the phone's localStorage key `lifeplanner.data` (plus a daily snapshot in `lifeplanner.data.daily`).
- Never rename these keys, never remove/rename existing fields. `migrate()` may only ADD missing fields with defaults.
- Bump `?v=` on `style.css`/`app.js` in index.html, `CACHE` in sw.js and `VERSION` in app.js when releasing.

## Sending content into the app (goals, steps, plans)
Add an entry to `docs/updates.json`. The app shows it on Today as "updates from Claude"; Maxi taps Add.
Each update needs a unique `id` (never reuse). Merge rules: goals merge by id (step status/notes kept),
other lists add items whose id is new, vision text fields only fill if empty, quotes are appended.
NOTE: the repo is public — keep personal/sensitive details out of updates.json; use the in-app
"Paste from Claude" box (same JSON format) for anything private.

```json
{ "updates": [ { "id": "2026-11-25-cheshire", "title": "…", "description": "…", "data": {
  "goals": [ { "id": "g-sub45", "title": "Sub-45 10K", "horizon": "short|mid|long",
    "pillars": ["physical"], "deadline": "2026-12-31", "feeds": ["g-other"],
    "why": "…", "research": "…", "sources": "…",
    "phases": [ { "id": "ph-a", "name": "Phase A — …", "steps": [
      { "id": "st-1", "title": "…", "why": "…", "source": "…" } ] } ] } ],
  "tasks": [ { "id": "t-1", "title": "…", "date": "2026-11-25", "tag": "T|S|B|P", "slot": "am|pm|eve|any",
    "time": "14:00", "length": 30, "priority": true, "goalId": "g-sub45", "stepId": "st-1", "note": "", "app": "PT app" } ],
  "recurring": [ { "id": "r-1", "title": "Spanish", "tag": "S", "slot": "am", "length": 10, "days": [0,1,2,3,4,5,6] } ],
  "habits": [], "wins": [], "people": [], "reading": [], "admin": [], "timeline": [], "travel": [],
  "pillars": [], "shifts": { "2026-11-25": { "start": "14:00", "end": "22:30" } },
  "vision": { "identity": "", "philosophy": "", "idealDay": "", "quotes": [] } } } ] }
```
To link existing goals without touching their steps, use `"goalLinks": [ { "id": "g-x", "feeds": ["g-bigger"], "horizon": "mid", "start": "2027-01-01" } ]` in `data` (feeds are added, never removed). Goals form a ladder: steps → short → mid → long; `rollPct()` rolls feeder progress up. Goals may have an optional `start` date.
To move goals between pillars use `"goalPillars": [ { "id": "g-x", "pillars": ["travel", "life"] } ]` (sets pillars exactly; remembered in `S.goalPillarFix` so it also applies to goals imported later). Goals tab: picking a pillar shows that pillar's path, short → mid → long, each level by date (deadline, else start).
Today screen (v2.6): hero → quote picked for the day (`dayQuote`: matches the main task type T/S/B or work/day off, sometimes his own quotes) → updates-from-Claude line only if pending → "Today at a glance" bar (`glanceBar`: before shift / shift / after with task counts, main plan; taps to Calendar day) → "Why today matters" (`whyLines`: top 2–3 goal-linked tasks, step why or goal ladder) → smoke-free line (counts down to 1 Jan 2027 or `S.smoke.quit`, then days free) → Habits tile (tick circles, 7-day dots, 🔥 streak, "–" when broken) → journal prompt. Maxi removed: do-this-next card, chips (fuel, taper, to-sort), morning/evening button. Keep it simple (no tag colours on the bar).
Auto updates (v2.7): an update with `"auto": true` is applied on open with no tap (state copied first to localStorage `lifeplanner.data.preupdate`). Maxi wants changes pushed so he only has to refresh.
Extra ops: `"goalAddSteps": [ { "id" | "match": "title regex", "phase": { "id", "name", "steps": [] } } ]` adds a phase once; `"goalArchive": [ { "id" | "match", "onlyIf": "regex of replacement goal", "note" } ]` archives (restorable); goal `"ifNoMatch": "regex"` skips adding a new goal if one with a matching title exists. Step `mins` = rough time. Also: `goalPhaseSteps` [{id|match, phaseMatch, before: step-title regex, steps}] inserts steps inside an existing phase; `goalRemovePhase` [{id|match, phase}] removes a Claude-added phase only if untouched; `goalRenote` [{match, note}] rewrites an archived goal's note; `goalLinks` also accepts `match`.
Milestone steps start with 🏁, never ✓ (a tick in a title reads as done). Level 2 is NOT finished: filming the session assignment is the next big step (Nov 2026).
Link picker (v2.8): lists every active goal at that level or bigger, grouped Linked now / Same pillar / Other goals.
v2.9: Habits tile on Today folds (UI-only key `lifeplanner.ui.habitsClosed`). Calendar: year month cards open that month; month view lists goal deadlines/timeline/wins/trips (`monthItems`) under the grid. Goals → Path (all) is time-ordered: Short → Mid → Long, each by date, with '↓ builds:' lines (Maxi: short at top, build down).
Default pillar ids: physical, ptbiz, money, travel, life, spanish.
Goal step research must be accurate and sourced (Maxi's rule: no generic or inaccurate info).
