export const TIMEZONES: string[] =
  typeof Intl !== 'undefined' && 'supportedValuesOf' in Intl
    ? (Intl as unknown as { supportedValuesOf: (key: string) => string[] }).supportedValuesOf('timeZone')
    : [
        // Fallback list of common timezones if Intl.supportedValuesOf not available
        'Pacific/Auckland', 'Australia/Sydney', 'Australia/Melbourne', 'Asia/Tokyo',
        'Asia/Seoul', 'Asia/Shanghai', 'Asia/Singapore', 'Asia/Bangkok', 'Asia/Dhaka',
        'Asia/Karachi', 'Asia/Kolkata', 'Asia/Dubai', 'Asia/Tehran', 'Asia/Baghdad',
        'Europe/Istanbul', 'Africa/Cairo', 'Europe/Athens', 'Europe/Paris', 'Europe/London',
        'UTC', 'America/Sao_Paulo', 'America/New_York', 'America/Chicago',
        'America/Denver', 'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu',
      ];
