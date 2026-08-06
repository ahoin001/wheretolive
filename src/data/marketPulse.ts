export interface MarketPulseNote {
  id: string
  title: string
  body: string
  confidence: 'high' | 'medium' | 'low'
  asOf: string
  sourceLabel: string
  sourceUrl: string
}

export interface MarketPulseBundle {
  addressLabel: string
  outlook: 'mixed' | 'cooling' | 'steady' | 'rising'
  summary: string
  estimateNote: string
  notes: MarketPulseNote[]
  links: { label: string; url: string }[]
}

/** Static, labeled planning context — not a live appraisal feed. */
export function getMarketPulse(zip: string, city: string): MarketPulseBundle {
  const isMiramarExample = zip === '33029' || city.toLowerCase().includes('miramar')

  if (!isMiramarExample) {
    return {
      addressLabel: [city, zip].filter(Boolean).join(' ') || 'Your area',
      outlook: 'mixed',
      summary:
        'Local markets move in neighborhoods, not just citywide averages. Add a few recent sold comps or talk with a local agent before trusting any single estimate.',
      estimateNote:
        'Enter your own low / mid / high sale estimates. Website estimates can disagree a lot.',
      notes: [
        {
          id: 'generic-1',
          title: 'Use a range, not one number',
          body: 'Treat online estimates as a starting conversation, not a promise of what a buyer will pay.',
          confidence: 'medium',
          asOf: '2026-08',
          sourceLabel: 'Planning guidance',
          sourceUrl: 'https://www.consumerfinance.gov/owning-a-home/',
        },
      ],
      links: [
        {
          label: 'Consumer Financial Protection Bureau — owning a home',
          url: 'https://www.consumerfinance.gov/owning-a-home/',
        },
      ],
    }
  }

  return {
    addressLabel: '19506 SW 49th Ct, Miramar, FL 33029',
    outlook: 'mixed',
    summary:
      'Miramar looks broadly balanced to mildly cooling in citywide averages, while ZIP 33029 and larger single-family homes can behave differently. Signals are mixed — not a clear “sure to rise” or “sure to fall” story.',
    estimateNote:
      'Public estimates for this property have varied widely across sites. Keep a low / mid / high range and verify with Broward records plus local comps.',
    notes: [
      {
        id: 'miramar-city',
        title: 'Citywide values have cooled',
        body: 'Recent Miramar medians have shown year-over-year softness in several public trackers, with a more balanced market pace than peak boom years.',
        confidence: 'medium',
        asOf: '2026',
        sourceLabel: 'Realtor.com Miramar market',
        sourceUrl: 'https://www.realtor.com/local/market/florida/broward-county/miramar',
      },
      {
        id: 'zip-33029',
        title: '33029 is its own pocket',
        body: 'Higher-priced ZIP pockets can diverge from citywide medians. Use nearby sold homes of similar size, not only city averages.',
        confidence: 'medium',
        asOf: '2026',
        sourceLabel: 'MIAMI Realtors market reports',
        sourceUrl: 'https://www.miamirealtors.com/',
      },
      {
        id: 'insurance',
        title: 'Florida insurance still shapes the monthly bill',
        body: 'Broward homeowners insurance remains comparatively high even as statewide reforms show some stabilization and selected rate relief. Ownership cost is more than the mortgage rate.',
        confidence: 'high',
        asOf: '2026-01',
        sourceLabel: 'Florida OIR stability reporting',
        sourceUrl:
          'https://floir.gov/docs-sf/default-source/property-and-casualty/stability-unit-reports/january-2026-isu-report-final.pdf',
      },
    ],
    links: [
      {
        label: 'Broward County Property Appraiser search',
        url: 'https://web.bcpa.net/bcpaclient/search.aspx',
      },
      {
        label: 'Realtor.com — Miramar market',
        url: 'https://www.realtor.com/local/market/florida/broward-county/miramar',
      },
      {
        label: 'Florida OIR insurance information',
        url: 'https://floir.gov/',
      },
    ],
  }
}
