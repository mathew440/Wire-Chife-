/** Seeded device profile. The foreman is a different field and starts blank. */
export const SEEDED_MAT_ID = "person-mat-hiner";
export const SEEDED_PROFILE_NAME = "Mat Hiner";
export const SEEDED_PROFILE_ROLE = "Project Manager";
/** Role written by the first seed. Migration upgrades only this exact value. */
export const SEEDED_OLD_ROLE = "Foreman";
export const NEEDS_VERIFICATION = "Needs verification";

export function preparedByLabel(name: string, role: string): string {
  const cleanName = name.trim() || SEEDED_PROFILE_NAME;
  const cleanRole = role.trim();
  return cleanRole ? `${cleanName}, ${cleanRole}` : cleanName;
}

export function foremanDisplay(name: string): string {
  return name.trim() || NEEDS_VERIFICATION;
}
