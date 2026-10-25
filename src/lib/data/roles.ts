/** Seeded device profile. The foreman is a different field and starts blank. */
export const SEEDED_MAT_ID = "person-mat-hiner";
export const SEEDED_PROFILE_NAME = "Mat Hiner";
export const SEEDED_PROFILE_ROLE = "Project Manager";
export const SEEDED_COMPANY_NAME = "AKA Electric Inc";
export const SEEDED_PROFILE_EMAIL = "Mathew@akaelectricinc.com";
/** Company written before the Inc. suffix. Upgrade replaces only this exact value. */
export const PREVIOUS_COMPANY_NAME = "AKA Electric";
/** Role written by the first seed. Migration upgrades only this exact value. */
export const SEEDED_OLD_ROLE = "Foreman";
export const NEEDS_VERIFICATION = "Needs verification";

export function preparedByLabel(name: string, role: string): string {
  const cleanName = name.trim() || SEEDED_PROFILE_NAME;
  const cleanRole = role.trim();
  return cleanRole ? `${cleanName}, ${cleanRole}` : cleanName;
}

/** Name, title, company, and email, skipping anything still blank. */
export function preparedByLine(name: string, role: string, company: string, email: string): string {
  return [preparedByLabel(name, role), company.trim(), email.trim()].filter(Boolean).join(", ");
}

export function foremanDisplay(name: string): string {
  return name.trim() || NEEDS_VERIFICATION;
}
