# Local LLM Provider Adapters — Implementation Plan

> **For agentic workers:** Use `superpowers:subagent-driven-development` to implement `tasks.md` task-by-task with TDD where applicable.

**Goal:** Let Writer users detect, test, and run UX copy review prompts through locally linked Cursor Agent, Codex, Claude Code, and Devin interfaces.

**Architecture:** Keep all CLI/SDK spawning in `packages/agent-adapters`; daemon registry unchanged in shape but gains detect/smoke routes. Desktop Agents panel becomes the "connection" surface—no renderer subprocesses. Normalize all provider output to existing `AgentRunEvent` stream.

**Tech Stack:** TypeScript ESM, Node `child_process`, Zod contracts, Vitest fixtures, optional `@cursor/sdk` behind feature flag.

---

## Task 1: Shared CLI runner

- [ ] **Step 1:** Add `packages/agent-adapters/src/cli-runner.ts` with spawn, async line iterator, cancel, timeout
- [ ] **Step 2:** Extend `AgentAdapter` contract fields (`runtimeKind`, `authState`, `executablePath`)
- [ ] **Step 3:** Tests for runner cancel and timeout

## Task 2: Claude Code adapter

- [ ] **Step 1:** `detect()` via `claude --version`
- [ ] **Step 2:** `run()` print-mode; map stdout lines → `text` events
- [ ] **Step 3:** Fixture-based parser test

## Task 3: Codex adapter

- [ ] **Step 1:** `detect()` via `codex --version`
- [ ] **Step 2:** `run()` non-interactive command per Codex CLI docs
- [ ] **Step 3:** Fixture-based parser test

## Task 4: Cursor Agent adapter

- [ ] **Step 1:** `detect()` for cursor agent CLI
- [ ] **Step 2:** `run()` with stream parser; env flag stub for future SDK path
- [ ] **Step 3:** Manual note in README for maintainer validation

## Task 5: Devin adapter

- [ ] **Step 1:** `detect()` + auth failure messaging
- [ ] **Step 2:** `run()` via `devin -p`; hybrid `runtimeKind` in metadata
- [ ] **Step 3:** Smoke-friendly short prompt path

## Task 6: Daemon routes

- [ ] **Step 1:** `POST /agents/detect`, `POST /agents/smoke`
- [ ] **Step 2:** Wire registry refresh; bounded smoke timeout
- [ ] **Step 3:** Integration test in `apps/daemon`

## Task 7: Desktop UX

- [ ] **Step 1:** Agents panel badges + Refresh + Test connection
- [ ] **Step 2:** `daemon-client` methods for detect/smoke
- [ ] **Step 3:** Disable audit/run actions when adapter unavailable (if wired)

## Task 8: Verification & docs

- [ ] **Step 1:** Fill `verify.md` manual matrix
- [ ] **Step 2:** README section "Local LLM providers"
- [ ] **Step 3:** `npm run typecheck` + `npm run test`
