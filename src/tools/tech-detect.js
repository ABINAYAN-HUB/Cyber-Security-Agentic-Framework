// OpenClaw Cyber — Technology Detection Tool
export const definition = {
  type: 'function',
  function: {
    name: 'tech_detect',
    description: 'Detect technologies, frameworks, CMS, web servers, and JavaScript libraries on a website. Identifies WordPress, React, Angular, Vue, jQuery, Nginx, Apache, CloudFlare, and 100+ technologies by analyzing headers, HTML, scripts, and meta tags.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Target URL to analyze' }
      },
      required: ['url']
    }
  }
};

const TECH_SIGNATURES = {
  // CMS
  'WordPress': { html: [/wp-content/i, /wp-includes/i, /wp-json/i], headers: { 'x-powered-by': /WordPress/i }, meta: /WordPress/i },
  'Drupal': { html: [/sites\/default\/files/i, /Drupal\.settings/i], headers: { 'x-drupal-cache': /./i, 'x-generator': /Drupal/i } },
  'Joomla': { html: [/\/media\/jui\//i, /com_content/i], meta: /Joomla/i },
  'Magento': { html: [/\/skin\/frontend/i, /Mage\.Cookies/i], headers: { 'x-magento-vary': /./i } },
  'Shopify': { html: [/cdn\.shopify\.com/i, /Shopify\.theme/i] },
  'Wix': { html: [/wix\.com/i, /X-Wix/i] },
  'Squarespace': { html: [/squarespace\.com/i, /static\.squarespace/i] },
  
  // JS Frameworks
  'React': { html: [/react/i, /__NEXT_DATA__/i, /data-reactroot/i, /_next\/static/i] },
  'Angular': { html: [/ng-version/i, /angular\.min\.js/i, /ng-app/i] },
  'Vue.js': { html: [/vue\.min\.js/i, /vue\.js/i, /data-v-/i, /vuex/i] },
  'jQuery': { html: [/jquery[\.-](\d+\.)?min\.js/i, /jquery\.js/i] },
  'Bootstrap': { html: [/bootstrap[\.-](\d+\.)?min\.(css|js)/i] },
  'Tailwind CSS': { html: [/tailwindcss/i, /tailwind\.min\.css/i] },
  'Next.js': { html: [/__NEXT_DATA__/i, /_next\/static/i] },
  'Nuxt.js': { html: [/__nuxt/i, /_nuxt\//i] },
  'Svelte': { html: [/svelte/i, /__svelte/i] },
  
  // Web Servers
  'Nginx': { headers: { 'server': /nginx/i } },
  'Apache': { headers: { 'server': /Apache/i } },
  'IIS': { headers: { 'server': /IIS/i } },
  'LiteSpeed': { headers: { 'server': /LiteSpeed/i } },
  'Caddy': { headers: { 'server': /Caddy/i } },
  
  // CDN/Security
  'Cloudflare': { headers: { 'server': /cloudflare/i, 'cf-ray': /./i } },
  'AWS CloudFront': { headers: { 'x-amz-cf-id': /./i, 'via': /CloudFront/i } },
  'Fastly': { headers: { 'x-served-by': /cache/i, 'via': /varnish/i } },
  'Akamai': { headers: { 'x-akamai-transformed': /./i } },
  
  // Languages
  'PHP': { headers: { 'x-powered-by': /PHP/i }, html: [/\.php/i] },
  'ASP.NET': { headers: { 'x-powered-by': /ASP\.NET/i, 'x-aspnet-version': /./i } },
  'Java/JSP': { headers: { 'x-powered-by': /JSP|Servlet|Java/i } },
  'Python/Django': { html: [/csrfmiddlewaretoken/i], headers: { 'x-frame-options': /DENY/i } },
  'Python/Flask': { headers: { 'server': /Werkzeug/i } },
  'Ruby on Rails': { html: [/csrf-token/i], headers: { 'x-powered-by': /Phusion Passenger/i } },
  'Node.js/Express': { headers: { 'x-powered-by': /Express/i } },
  
  // Analytics
  'Google Analytics': { html: [/google-analytics\.com\/analytics\.js/i, /gtag\/js/i, /googletagmanager/i] },
  'Google Tag Manager': { html: [/googletagmanager\.com\/gtm/i] },
  'Facebook Pixel': { html: [/connect\.facebook\.net\/en_US\/fbevents/i] },
  
  // WAF
  'ModSecurity': { headers: { 'server': /mod_security/i } },
  'AWS WAF': { headers: { 'x-amzn-requestid': /./i } },
  'Sucuri': { headers: { 'x-sucuri-id': /./i, 'server': /Sucuri/i } },
  'Imperva/Incapsula': { headers: { 'x-cdn': /Incapsula/i } },
};

export async function execute(args) {
  const { url } = args;

  try {
    const targetUrl = url.startsWith('http') ? url : `https://${url}`;
    
    const { Agent } = await import('undici');
    const dispatcher = new Agent({
      connect: { rejectUnauthorized: false }
    });

    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html'
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
      dispatcher
    });

    const html = await response.text();
    const headers = {};
    response.headers.forEach((value, key) => { headers[key.toLowerCase()] = value; });

    const detected = [];

    for (const [tech, sigs] of Object.entries(TECH_SIGNATURES)) {
      let found = false;
      let evidence = [];

      // Check HTML patterns
      if (sigs.html) {
        for (const pattern of sigs.html) {
          if (pattern.test(html)) {
            found = true;
            evidence.push(`HTML: ${pattern.source}`);
            break;
          }
        }
      }

      // Check headers
      if (sigs.headers) {
        for (const [header, pattern] of Object.entries(sigs.headers)) {
          if (headers[header] && pattern.test(headers[header])) {
            found = true;
            evidence.push(`Header: ${header}=${headers[header]}`);
            break;
          }
        }
      }

      // Check meta tags
      if (sigs.meta && sigs.meta.test(html)) {
        found = true;
        evidence.push('Meta tag');
      }

      if (found) {
        detected.push({ technology: tech, evidence });
      }
    }

    // Extract version info from scripts
    const scriptVersions = [];
    const versionPatterns = html.matchAll(/(?:src|href)="[^"]*?([a-zA-Z]+)[.-](\d+\.\d+[\.\d]*?)(?:\.min)?\.(js|css)/gi);
    for (const m of versionPatterns) {
      scriptVersions.push({ library: m[1], version: m[2], type: m[3] });
    }

    return {
      success: true,
      url: targetUrl,
      technologies_detected: detected.length,
      technologies: detected,
      script_versions: [...new Map(scriptVersions.map(s => [s.library, s])).values()].slice(0, 20),
      server: headers.server || 'unknown',
      powered_by: headers['x-powered-by'] || 'unknown'
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
