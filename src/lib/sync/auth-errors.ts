/** Turn Supabase auth errors into sentences Mat, Jason, and Bill can act on. */
export function plainAuthError(message: string): string {
  const text = message.toLowerCase();
  if (text.includes("invalid login") || text.includes("invalid credentials") || text.includes("wrong password")) {
    return "That email or password is wrong.";
  }
  if (text.includes("already registered") || text.includes("already been registered") || text.includes("user already exists")) {
    return "That email already has a login. Sign in instead.";
  }
  if (text.includes("password") && (text.includes("weak") || text.includes("at least") || text.includes("short") || text.includes("should be"))) {
    return "Use a password of at least 8 characters.";
  }
  if (text.includes("fetch") || text.includes("network") || text.includes("failed to fetch")) {
    return "Can't reach the shared database right now. Your jobs on this phone are still here.";
  }
  return "That did not work. Check the email and password, or ask Mat.";
}
