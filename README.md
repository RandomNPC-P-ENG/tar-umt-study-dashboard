# TAR UMT Study Dashboard

Existing buildless static PWA for the TAR UMT 202609 semester, with the seven-day schedule, personal tasks, local completion records and calendar downloads.

## Calisthenics integration

The existing three fitness reservations are reused, rather than adding workouts to the preferred Monday/Wednesday/Saturday:

| Day | Existing reservation | Training |
| --- | --- | --- |
| Tuesday | 15:30–16:30 | A: Muscle-up / Explosive Pull |
| Friday | 15:00–16:00 | B: Planche / Push Stability |
| Sunday | 15:30–16:30 | C: Front Lever / Core Stability |

Each defaults to 60 minutes including 8 minutes warmup, rests and 5 minutes cooldown. The user has excluded the red Thursday 13:00–15:00 Integrative English entry (M204). Monday English remains. Thursday Statistics 12:30–14:00 is a normal class; the former overlap warning is removed. All other event IDs and times, commuting, meals, study and seven sleep blocks (at least eight hours each) are retained. The newly empty 14:00–15:00 gap has not been filled or used to move other activities.

Fitness reservations are clickable cards within the interactive timetable. Click or use Enter/Space to expand or collapse the full A/B/C workout inline: exercise checkboxes, individual/session pause, notes and editable prescriptions. The timetable is shown immediately after compact day controls; the separate weekly training overview has been removed. Workout cards stay compact until expanded. Checklist updates retain the expanded card and focused controls. Estimated duration can be edited within the existing 60-minute reservation; this does not move the timetable or shorten its reserved event. Easier progressions are conditional suggestions, not clinical clearance. Generic precautions remain visible, and affected loaded/explosive movements start paused. No personal medical history is embedded in the public source.

The six progress measures start blank. Users can add/update dated records. Checklist completion never invents skill scores. Training logs are keyed by actual date and workout; the training-record date defaults to that weekday in the current Malaysian week and can be changed.

## Storage and migration

The existing localStorage key remains `tarumt-dashboard-v1`. Migration adds a versioned `cal` object while preserving original `done`, `added`, `hidden`, and unknown settings. Old fitness completion marks are retained as legacy records, without marking new exercises complete. Editing a prescription does not rewrite the performed prescription snapshot in existing logs. Unreadable legacy JSON is retained without overwriting and included in the JSON backup.

Exercise notes and private training notes save as typed. Personal notes, progress and user-entered settings stay in the current browser. Devices do not synchronize. Export JSON for a backup; there is no cloud account connection or automatic restore.

## Reminders and calendars

- Calendar range: 2 November–20 December 2026, Asia/Kuala_Lumpur.
- Default ICS and current-plan export contain 31 unique events, excluding the red Thursday English course. Remaining UIDs, starts, ends and recurrences are retained. The Statistics conflict metadata is cleared; the three fitness descriptions are updated; the other 27 original event blocks remain byte-identical. Existing external calendar imports do not automatically lose the excluded course: remove its old Thursday event or replace the dedicated calendar before reimporting.
- All existing five-minute alarms are retained. Current-plan export includes edited prescriptions and optional training location, but excludes health notes, exercise notes and progress records.
- Stable UIDs avoid generating new identities during export. Calendar applications may still duplicate events on repeated manual imports. Replace the old version in a dedicated calendar when updating; external synchronization has not been implemented or verified.
- Optional browser notifications are requested only by an explicit button. The open/running page checks the five-minute window in Malaysian time and persists deduplication keys. Paused sessions are skipped. Browser/OS suspension can prevent reminders, and closed-page delivery and Apple Watch vibration are not guaranteed or verified. ICS reminders are handled by the user's calendar application.
- Notification delivery requires a supported browser and permission. Denied/unsupported permissions retain the page reminder and ICS route.

## PWA and hosting

Android: open the HTTPS site in Chrome and use **Install app / Add to Home screen**. iPad: Safari **Share → Add to Home Screen**.

Open online once to prepare the complete offline cache, including training data, modules and ICS. The UI reports readiness. Relative URLs preserve GitHub Pages project-subpath compatibility. The service worker versions caches, refreshes installation assets and cleans up only this app's old caches. After an update, reopen or refresh the app to load the new version.

GitHub Pages is deployed by `.github/workflows/pages.yml`, using an explicit static-file allowlist. No bundler, package installation, build script or lint configuration is required.

## Validation

Run with Node 22+:

```sh
node --test tests/training.test.cjs
node --check app.js
node --check calisthenics.js
node --check training-core.js
node --check sw.js
```

Regression tests cover commitments, sleep and the authorized Thursday course exclusion; exact exercise prescriptions; additive migration and date-scoped completion; ICS identities, unrelated-event preservation, UTF-8 folding and note exclusion; edit bounds; Malaysian reminder timing/deduplication/pause; and service worker cache/fallback behavior.

Browser checks cover training/pause controls, checklist and note persistence after reload, editing duration and exercises without changing history, blank progress and dated record updates, actual current-plan ICS download, 390px mobile and 768px tablet layout, and continued operation after the local server is stopped. These tests use an isolated localhost origin, separate from production user records. Actual iPad/Xiaomi installation, background OS notification delivery and Apple Watch haptics still require device verification.
