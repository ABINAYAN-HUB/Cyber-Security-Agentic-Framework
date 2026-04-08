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

  let targetIp = ip;
  
  try {
    // Optional: resolve hostname to IP to prevent API fetch failures
    if (!/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(ip) && !ip.includes(':')) {
      const { promisify } = await import('util');
      const { resolve4, resolve6 } = await import('dns');
      try {
        const ips = await promisify(resolve4)(ip);
        if (ips.length > 0) targetIp = ips[0];
      } catch {
        try {
          const ips = await promisify(resolve6)(ip);
          if (ips.length > 0) targetIp = ips[0];
        } catch {
           return { success: false, error: `Failed to resolve hostname: ${ip}` };
        }
      }
    }

    // Primary: ipinfo.io (HTTPS, reliable from Node fetch)
    let data = null;
    try {
      const response = await fetch(`https://ipinfo.io/${targetIp}/json`, {
        signal: AbortSignal.timeout(10000)
      });
      if (response.ok) {
        const info = await response.json();
        if (info.bogon) {
          return { success: true, ip: targetIp, is_private: true, message: 'Bogon/Private IP address' };
        }
        const [lat, lon] = (info.loc || '0,0').split(',').map(Number);
        data = {
          query: targetIp,
          country: info.country,
          region: info.region,
          city: info.city,
          zip: info.postal,
          lat, lon,
          timezone: info.timezone,
          isp: info.org,
          org: info.org,
          hostname: info.hostname,
          anycast: info.anycast,
        };
      }
    } catch {}

    // Fallback: ip-api.com (HTTP, may fail on some networks)
    if (!data) {
      try {
        const response = await fetch(`http://ip-api.com/json/${targetIp}?fields=status,message,continent,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,asname,reverse,mobile,proxy,hosting,query`, {
          signal: AbortSignal.timeout(8000)
        });
        if (response.ok) {
          const apiData = await response.json();
          if (apiData.status === 'fail') {
            if (apiData.message === 'private range') {
              return { success: true, ip: targetIp, is_private: true, message: 'Internal/Private network address space (RFC 1918)' };
            }
            return { success: false, error: apiData.message || 'Lookup failed' };
          }
          data = {
            query: apiData.query,
            continent: apiData.continent,
            country: apiData.country,
            countryCode: apiData.countryCode,
            region: apiData.regionName,
            city: apiData.city,
            zip: apiData.zip,
            lat: apiData.lat,
            lon: apiData.lon,
            timezone: apiData.timezone,
            isp: apiData.isp,
            org: apiData.org,
            asn: apiData.as,
            as_name: apiData.asname,
            reverse: apiData.reverse,
            mobile: apiData.mobile,
            proxy: apiData.proxy,
            hosting: apiData.hosting,
          };
        }
      } catch {}
    }

    if (!data) {
      return { success: false, error: `All geolocation APIs failed for ${targetIp}. Network may be restricted.` };
    }

    return {
      success: true,
      query: ip,
      ip: data.query || targetIp,
      location: {
        continent: data.continent || null,
        country: data.country,
        country_code: data.countryCode || null,
        region: data.region,
        city: data.city,
        zip: data.zip,
        coordinates: { lat: data.lat, lon: data.lon },
        timezone: data.timezone
      },
      network: {
        isp: data.isp,
        organization: data.org,
        asn: data.asn || null,
        as_name: data.as_name || null,
        reverse_dns: data.reverse || data.hostname || null
      },
      flags: {
        is_mobile: data.mobile || false,
        is_proxy: data.proxy || false,
        is_hosting: data.hosting || false,
        is_anycast: data.anycast || false
      }
    };
  } catch (err) {
    return { success: false, error: `Geolocation lookup failed: ${err.message}` };
  }
}
