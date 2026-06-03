import type { DaemonState } from "./state";

const WHITELIST = [
  "Jair", "Brenda", "Christopher", "Mallory", "Michelle",
  "Jorge", "Scott", "Alexis", "Aylin", "Vicky",
  "Greg", "Danielle", "Lucy", "Kathryn", "Martin",
  "Jaegon", "Elliot", "Amy", "Yiqi"
];

/**
 * Validates a name against the whitelist (case-insensitive, trimmed).
 * Returns the canonical (correctly-cased) name on match, null otherwise.
 */
export function validateWhitelistName(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  return WHITELIST.find((n) => n.toLowerCase() === lower) ?? null;
}

export async function setupUserProfile(
  state: DaemonState,
  input: unknown
): Promise<{ name: string }> {
  const body = input as { name?: unknown };
  const raw = typeof body?.name === "string" ? body.name : "";
  const canonical = validateWhitelistName(raw);

  if (!canonical) {
    throw new Error("Name not recognized.");
  }

  state.store.setUserProfile({ name: canonical });
  await state.store.save();
  return { name: canonical };
}
