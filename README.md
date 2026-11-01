# TAR UMT Study Dashboard

Installable static PWA for the TAR UMT 202609 semester, with a seven-day schedule and a Google Calendar download.

- Calendar range: 2 November–20 December 2026, Asia/Kuala_Lumpur (UTC+8).
- Keep both Thursday classes at their supplied times; the 13:00–14:00 overlap remains flagged.
- Completion state and custom tasks stay in the current browser's local storage. Devices do not synchronize automatically.
- Calendar imports are separate from dashboard edits. Import the ICS once into a dedicated calendar.
- Open the HTTPS site online once before using it offline.

## Install

Android: open the site in Chrome and use **Install app / Add to Home screen**.

iPad: open the site in Safari and use **Share → Add to Home Screen**.

## Hosting

The repository root is a buildless static site. Publish `main` from `/` with GitHub Pages. All asset paths are relative, so project-site subpaths work.

The supplied schedule and ICS are preserved; deployment adds the download link, offline calendar caching, installation metadata, and accessible task labels.
