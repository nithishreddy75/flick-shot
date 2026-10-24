# FLICK SHOT — refinement notes

## Changes applied in this package

1. Added the supplied FLICK SHOT logo at `frontend/public/flick-shot-logo.jpeg`.
2. Updated the browser title to `FLICK SHOT — Cricket Scoring`.
3. Updated the signed-in app shell branding while deliberately preserving existing local-storage authentication keys so existing sessions are not silently invalidated.
4. Updated live scoring player-team matching to support `teamId`, `team_id`, `teamIds`, and multi-team `teams` response shapes. This reflects the application's many-to-many player/team model.
5. Added automatic live-scoring delivery refresh every 3 seconds, so users no longer need to press refresh to see newly saved deliveries. The refresh interval is cleaned up when the screen is left.

## Important limitations — do not treat this package as production-ready yet

The ZIP supplied by the user does not currently provide a verified, complete backend workflow for persisting opening striker/non-striker/bowler selections, automatically switching innings, completing matches, and deriving every result. Those features require coordinated backend service/entity/API changes and tests, not only frontend changes.

DLS: this package does not implement or claim an official Duckworth–Lewis–Stern calculator. DLS requires the appropriate current resource tables/calculation rules and the match's interruption/resource history. A made-up percentage or run-rate formula would produce incorrect official results. For informal box cricket, a clearly labelled manual organizer result may be offered; for official DLS decisions, use the authorized DLS calculator or an approved implementation.

Public share links: automatic polling in the scorer screen is included, but a safe public viewer link is not enabled by these changes. A viewer feature needs a public read-only endpoint or tokenized access policy, a viewer route that does not expose private player mobile numbers, and deployment on a reachable host. `localhost` links will not work for remote viewers.

## Before real-world use

- Configure secrets through environment variables; do not commit database passwords or JWT secrets.
- Replace broad `permitAll` API security with explicit authorization before public deployment.
- Back up the existing MySQL database before schema changes.
- Test scoring edge cases: wides, no-balls, byes, leg-byes, run-outs, retired-out, over changes, all-out, target reached, ties, shortened matches and undo.
- Run frontend build and backend tests in the target environment. The source package was not certified by a full end-to-end test during this refinement pass.

## Local run commands (Windows PowerShell)

Frontend:
```powershell
cd frontend
npm install
npm run dev
```

Backend:
```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

Set the required database and JWT environment variables before starting the backend.
