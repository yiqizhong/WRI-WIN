import type { ChangeStatus } from "@writer/contracts";

const ALLOWED_TRANSITIONS: Record<ChangeStatus, ChangeStatus[]> = {
  detected: ["proposed", "skipped"],
  proposed: ["approved", "edited", "rejected", "skipped"],
  approved: ["queued_for_writeback", "edited", "rejected"],
  edited: ["queued_for_writeback", "rejected"],
  rejected: ["proposed"],
  queued_for_writeback: ["applied", "failed", "skipped"],
  applied: [],
  failed: ["queued_for_writeback", "skipped"],
  skipped: ["proposed"]
};

export class InvalidChangeTransitionError extends Error {
  constructor(from: ChangeStatus, to: ChangeStatus) {
    super(`Cannot transition change from ${from} to ${to}.`);
    this.name = "InvalidChangeTransitionError";
  }
}

export function canTransitionChange(from: ChangeStatus, to: ChangeStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertChangeTransition(from: ChangeStatus, to: ChangeStatus): void {
  if (!canTransitionChange(from, to)) {
    throw new InvalidChangeTransitionError(from, to);
  }
}

export function isWritebackEligible(status: ChangeStatus): boolean {
  return status === "approved" || status === "edited";
}
