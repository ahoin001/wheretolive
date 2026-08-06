import clsx, { type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function detectSource(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    if (host.includes('zillow')) return 'Zillow'
    if (host.includes('realtor')) return 'Realtor.com'
    if (host.includes('apartments')) return 'Apartments.com'
    if (host.includes('facebook') || host.includes('fb.')) return 'Facebook Marketplace'
    if (host.includes('redfin')) return 'Redfin'
    return host
  } catch {
    return 'Link'
  }
}
