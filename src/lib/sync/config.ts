/**
 * Browser-safe Supabase settings. The publishable key is meant to ship in the
 * app. Row access is enforced by the database, not by hiding this key.
 * Override with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://wqmnhrycgkbiwrrxnyjj.supabase.co";

export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_RpeyFAaD1a1UGE3rr8U1rQ_l8fu5uv-";

export const FILES_BUCKET = "wire-chief-files";

/**
 * Emails that may use the shared book. An empty cloud still lets these
 * addresses in. Anyone else who signs in and sees no rows is turned away.
 */
export const KNOWN_EMAILS = [
  "mathew@akaelectricinc.com",
  "jason@akaelectricinc.com",
  "william@akaelectricinc.com",
] as const;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isKnownEmail(email: string): boolean {
  return (KNOWN_EMAILS as readonly string[]).includes(normalizeEmail(email));
}
