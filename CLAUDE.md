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
Default pillar ids: physical, ptbiz, money, travel, life, spanish.
Goal step research must be accurate and sourced (Maxi's rule: no generic or inaccurate info).
