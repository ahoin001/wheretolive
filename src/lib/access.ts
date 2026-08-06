/** Signed-in emails allowed to use the keep/downsize Guide. */
export const GUIDE_ALLOWED_EMAILS = ['ahoin001@gmail.com'] as const

export function canAccessGuide(email: string | null | undefined): boolean {
  if (!email) return false
  const normalized = email.trim().toLowerCase()
  return (GUIDE_ALLOWED_EMAILS as readonly string[]).includes(normalized)
}
