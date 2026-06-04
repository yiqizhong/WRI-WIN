# Changelog

All notable changes to Writer desktop are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.7.0] - 2026-06-04
- Update check now runs every 60 minutes and on window focus — upgrade pill appears without restarting the app
- Update modal no longer shows a misleading download size before the download starts
- Update modal no longer opens automatically — pill appears silently, user opens it when ready

## [0.6.9] - 2026-06-04
- Home screen now says "Good night!" after 10pm

## [0.6.8] - 2026-06-04
- Fix update pill not appearing — update-available event was silently lost if it fired before the app window finished loading

## [0.6.7] - 2026-06-04
- Fix window minimize/maximize/close buttons not working on some Windows configurations

## [0.6.6] - 2026-06-04
- Update modal now shows the actual differential download size (e.g. 38 MB) instead of the full installer size

## [0.6.5] - 2026-06-04
- Update modal now shows installer size with a note that existing installs only download changed files

## [0.6.4] - 2026-06-04
- Remove misleading download size from update modal — differential updates are much smaller than the full installer

## [0.6.3] - 2026-06-04
- Welcome screen now shown once per installed version — updating to a new version replays it
- App version shown at the bottom of the welcome screen
- Update modal release-notes block uses sharp corners matching app style
- Removed arrow icon from "Upgrade" pill in title bar
- Devin reasoning "off" label only shows "(free)" when SWE 1.6 model is selected

## [0.6.2] - 2026-06-04
- Fix app icon not appearing in taskbar and Start Menu

## [0.6.1] - 2026-06-04
- Show download size before upgrading (e.g. "553 MB download")

## [0.6.0] - 2026-06-04
- Gradient progress bar and byte counter on update download
- "Download in background" replaces confusing "Later" button
- Update modal shows instantly on Upgrade click (no freeze)
- Local model verifying state shows informative alert
- Removed redundant "Failed" badge next to Retry button
- Figma MCP connection updates immediately on browser return (no polling delay)
- Local model download progress persists across page navigation
- New app icon

## [0.5.0] - 2026-06-03
- Fixed "Not Responding" freeze during update install
- Retry logic for slow corporate DNS (3 attempts, 10 s apart)
- New update pill in title bar — click to check upgrade status
- Download progress visible in modal; dismiss and reopen anytime

## [0.4.0] - 2026-06-02
- Initial auto-update support via Cloudflare R2
- NSIS installer preserves all user data and models on update
