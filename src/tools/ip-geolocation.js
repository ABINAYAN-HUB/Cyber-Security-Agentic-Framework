// OpenClaw Cyber — IP Geolocation Tool
export const definition = {
  type: 'function',
  function: {
    name: 'ip_geolocation',
    description: 'Look up geographic location, ISP, ASN, and threat intelligence for an IP address. Useful for target profiling and attribution during reconnaissance.',
    parameters: {
      type: 'object',
      properties: {
        ip: { type: 'string', description: 'IP address to look up' }
      },
      required: ['ip']
    }
  }
};

export async function execute(args) {
  const { ip } = args;

  try {
    // Primary: ip-api.com (free, no key needed)
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,continent,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,asname,reverse,mobile,proxy,hosting,query`, {
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);
    
    const data = await response.json();
    if (data.status === 'fail') {
      if (data.message === 'private range') {
        return {
          success: true,
          ip: ip,
          is_private: true,
          message: 'Internal/Private network address space (RFC 1918)'
        };
      }
      return { success: false, error: data.message || 'Lookup failed' };
    }

    // Additional threat intel from ipinfo.io
    let threatInfo = null;
    try {
      const r2 = await fetch(`https://ipinfo.io/${ip}/json`, { signal: AbortSignal.timeout(8000) });
      if (r2.ok) threatInfo = await r2.json();
    } catch {}

    return {
      success: true,
      ip: data.query,
      location: {
        continent: data.continent,
        country: data.country,
        country_code: data.countryCode,
        region: data.regionName,
        city: data.city,
        zip: data.zip,
        coordinates: { lat: data.lat, lon: data.lon },
        timezone: data.timezone
      },
      network: {
        isp: data.isp,
        organization: data.org,
        asn: data.as,
        as_name: data.asname,
        reverse_dns: data.reverse
      },
      flags: {
        is_mobile: data.mobile,
        is_proxy: data.proxy,
        is_hosting: data.hosting
      },
      additional: threatInfo ? {
        hostname: threatInfo.hostname,
        bogon: threatInfo.bogon,
        anycast: threatInfo.anycast,
        company: threatInfo.company,
        privacy: threatInfo.privacy
      } : null
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
