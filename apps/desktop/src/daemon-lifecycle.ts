export type DaemonHealthSnapshot = {
  version: string;
  apiRevision: string;
};

export type DaemonExpectation = {
  version: string;
  apiRevision: string;
};

export function isDaemonHealthCompatible(
  health: DaemonHealthSnapshot | null,
  expected: DaemonExpectation
): health is DaemonHealthSnapshot {
  if (!health) {
    return false;
  }

  return health.version === expected.version && health.apiRevision === expected.apiRevision;
}

export function shouldRestartDaemon(
  health: DaemonHealthSnapshot | null,
  expected: DaemonExpectation
): boolean {
  return health !== null && !isDaemonHealthCompatible(health, expected);
}
