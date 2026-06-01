# Tasks: Separate Text and Figma Audit Workflows

Maps to Linear epic **WRI-121** and child issues **WRI-122** through **WRI-125**.

## 1. Shared contracts and persisted history

- [x] 1.1 [WRI-122] Extend paste-text contracts with optional Product context selection and add contract tests that accept omitted or selected `productId` without changing existing attachment/message behavior (`npm run test --workspace=@writer/contracts`).
- [x] 1.2 [WRI-122] Add a batch-level Figma Audit Log response contract containing stable Batch/session identity, Product, target summary, Label, status, and timestamps, with parser tests (`npm run test --workspace=@writer/contracts`).
- [x] 1.3 [WRI-122] Extend session persistence/list projection for backward-compatible Figma Audit Log metadata and tests proving prior sessions still load and one Figma session maps to one Batch entry (`npm run test --workspace=@writer/storage`).

## 2. Daemon workflow behavior

- [x] 2.1 [WRI-123] Update Text conversation creation/message orchestration to accept optional Product selection and assemble mandatory company-based plus software-writing context, augmented by Product context only when selected (`npm run test --workspace=@writer/daemon -- paste-text`).
- [x] 2.2 [WRI-123] Add Text failure tests for missing mandatory global rule context and invalid selected Product context, preserving current attachment rewrite behavior and excluding Text conversations from Audit Log results (`npm run test --workspace=@writer/daemon -- paste-text`).
- [x] 2.3 [WRI-123] Add a read-only daemon Audit Log listing endpoint/projection for Figma runs and tests for completed, running, and created-but-failed Batch states (`npm run test --workspace=@writer/daemon -- review`).
- [x] 2.4 [WRI-123] Ensure Batch identity continues to retrieve existing queue, changelog, export, and permission-gated writeback operations without introducing new MCP/write tool behavior (`npm run test --workspace=@writer/daemon -- review figma-writeback`).

## 3. Desktop dedicated workflows

- [x] 3.1 [WRI-124] Add typed desktop client methods/state for Audit Log listing and optional Text Product selection, including user-readable loading and failure states (`npm run typecheck`).
- [x] 3.2 [WRI-124] Introduce a standalone Text workflow page with Back navigation, optional Product selector, and the existing paste/CSV/XLSX chatbot interactions (`npm run typecheck`).
- [x] 3.3 [WRI-124] Introduce a Figma Audit Log page for Product plus URL submission and one-row-per-Batch table rendering with Product, target, Batch, Label, status, and timestamps (`npm run typecheck`).
- [x] 3.4 [WRI-124] Introduce an Audit Detail route keyed by Batch/session identity and compose existing queue, changelog, export, approval, and approved-writeback surfaces there (`npm run typecheck`).
- [x] 3.5 [WRI-124] Route home cards directly to Text and Figma Audit pages and reduce Settings to Guidelines and Agents, updating stale desktop links and empty-state copy (`npm run typecheck`).

## 4. Documentation and verification

- [x] 4.1 [WRI-125] Update user-facing product/readme references that still direct workflow work through `Sources` or `Review`, while preserving the global-guidelines and permission-gate explanation.
- [x] 4.2 [WRI-125] Add or adjust focused desktop/daemon tests for dedicated navigation, optional Product Text context, Audit Log projection, and Detail loading; run `npm run typecheck && npm run test`.
- [x] 4.3 [WRI-125] Manually verify Text rewrite without Product, Text rewrite with Product and attachment input, Figma Batch creation/log/detail navigation, and approved-only writeback behavior; record evidence for `/opsx:verify`.
