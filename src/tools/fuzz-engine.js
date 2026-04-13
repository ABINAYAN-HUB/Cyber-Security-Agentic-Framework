// Jarvis Cyber — Fuzzing Engine
export const definition = {
  type: 'function',
  function: {
    name: 'fuzz_engine',
    description: 'Web fuzzer for directory/file discovery, parameter fuzzing, and virtual host enumeration. Uses built-in wordlists and supports custom patterns. Fast concurrent HTTP requests with response analysis.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Target URL with FUZZ placeholder (e.g., "https://example.com/FUZZ" or "https://example.com/page?id=FUZZ")' },
        mode: { type: 'string', enum: ['dir', 'file', 'param', 'vhost', 'custom'], description: 'Fuzzing mode (default: dir)' },
        wordlist: { type: 'string', enum: ['common', 'medium', 'api', 'backup', 'custom'], description: 'Built-in wordlist to use (default: common)' },
        custom_words: { type: 'string', description: 'Comma-separated custom words for fuzzing' },
        extensions: { type: 'string', description: 'File extensions to append (e.g., "php,html,txt,bak")' },
        filter_status: { type: 'string', description: 'Status codes to show (e.g., "200,301,302,403") or hide with - prefix (e.g., "-404")' },
        concurrency: { type: 'integer', description: 'Concurrent requests (default: 20)' },
        method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD'], description: 'HTTP method (default: GET)' }
      },
      required: ['url']
    }
  }
};

const WORDLISTS = {
  common: ['admin','login','dashboard','api','config','backup','test','dev','staging','upload','uploads',
    'images','img','css','js','static','assets','media','files','docs','doc','documentation',
    'wp-admin','wp-login','wp-content','wp-includes','administrator','phpmyadmin','cpanel',
    'webmail','mail','email','console','panel','manager','portal','server-status','server-info',
    '.env','.git','.htaccess','.htpasswd','robots.txt','sitemap.xml','crossdomain.xml',
    'web.config','.well-known','security.txt','humans.txt','readme','README.md','CHANGELOG',
    'LICENSE','package.json','composer.json','Gemfile','requirements.txt','Dockerfile',
    '.DS_Store','thumbs.db','.svn','.hg','CVS','.gitignore','.dockerignore',
    'info.php','phpinfo.php','test.php','info','health','healthcheck','status','ping',
    'graphql','graphiql','swagger','api-docs','openapi','v1','v2','v3',
    'register','signup','forgot','reset','password','account','profile','settings',
    'search','debug','trace','elmah','error','errors','log','logs',
    'tmp','temp','cache','old','new','bak','backup','archive','dump',
    'database','db','sql','data','export','import','download','internal','private','secret'],
  
  medium: ['index','home','about','contact','faq','help','support','terms','privacy','blog',
    'news','press','careers','jobs','team','staff','members','users','customers','clients',
    'products','services','pricing','plans','features','solutions','resources','tools',
    'downloads','gallery','portfolio','projects','case-studies','testimonials','reviews',
    'newsletter','subscribe','unsubscribe','feed','rss','atom','xml','json','csv',
    'cgi-bin','bin','scripts','includes','modules','plugins','themes','templates','layouts',
    'vendor','node_modules','bower_components','build','dist','public','private','src','lib',
    'checkout','cart','order','payment','invoice','receipt','shipping','tracking',
    'socket','websocket','ws','wss','xmlrpc','soap','rest','grpc','webhook','callback'],

  api: ['api','v1','v2','v3','graphql','rest','oauth','token','auth','authenticate',
    'authorize','login','logout','register','signup','verify','confirm','reset','refresh',
    'users','user','me','profile','account','accounts','admin','admins','roles','permissions',
    'posts','comments','likes','follows','notifications','messages','chat','conversations',
    'products','items','orders','payments','subscriptions','invoices','transactions',
    'files','upload','download','images','media','documents','attachments',
    'search','filter','sort','page','limit','offset','cursor','fields','include','expand',
    'config','settings','preferences','options','metadata','stats','analytics','metrics',
    'health','status','ping','info','version','docs','swagger','openapi','schema'],

  backup: ['.env','.env.bak','.env.old','.env.production','.env.staging','.env.dev','.env.local',
    'backup.sql','dump.sql','database.sql','db.sql','data.sql','backup.tar.gz','backup.zip',
    'site.tar.gz','www.tar.gz','html.tar.gz','public.tar.gz','web.tar.gz',
    'id_rsa','id_rsa.pub','authorized_keys','.ssh','shadow','passwd',
    'wp-config.php.bak','wp-config.php.old','config.php.bak','settings.py.bak',
    '.git/config','.git/HEAD','.svn/entries','.hg/hgrc',
    'debug.log','error.log','access.log','application.log','app.log',
    '.bash_history','.mysql_history','.psql_history','.rediscli_history',
    'docker-compose.yml','Vagrantfile','terraform.tfstate','ansible.cfg']
};

export async function execute(args) {
  const { url, mode = 'dir', wordlist = 'common', custom_words, extensions, filter_status, concurrency = 20, method = 'GET' } = args;

  if (!url.includes('FUZZ')) {
    return { success: false, error: 'URL must contain FUZZ placeholder (e.g., "https://example.com/FUZZ")' };
  }

  // Build word list
  let words = custom_words ? custom_words.split(',').map(w => w.trim()) : (WORDLISTS[wordlist] || WORDLISTS.common);
  
  // Apply extensions
  if (extensions) {
    const exts = extensions.split(',').map(e => e.trim());
    const extended = [];
    for (const word of words) {
      extended.push(word);
      for (const ext of exts) {
        extended.push(`${word}.${ext}`);
      }
    }
    words = extended;
  }

  // Parse status filter
  let showStatuses = null;
  let hideStatuses = null;
  if (filter_status) {
    if (filter_status.startsWith('-')) {
      hideStatuses = new Set(filter_status.slice(1).split(',').map(Number));
    } else {
      showStatuses = new Set(filter_status.split(',').map(Number));
    }
  }

  const startTime = Date.now();
  const results = [];

  // Fuzz with concurrency
  const chunks = [];
  for (let i = 0; i < words.length; i += concurrency) {
    chunks.push(words.slice(i, i + concurrency));
  }

  for (const chunk of chunks) {
    const promises = chunk.map(word => _fuzzRequest(url.replace('FUZZ', word), method, word));
    const chunkResults = await Promise.all(promises);
    
    for (const r of chunkResults) {
      if (!r) continue;
      if (showStatuses && !showStatuses.has(r.status)) continue;
      if (hideStatuses && hideStatuses.has(r.status)) continue;
      if (!showStatuses && !hideStatuses && r.status === 404) continue; // Default: hide 404s
      results.push(r);
    }
  }

  const elapsed = Date.now() - startTime;

  return {
    success: true,
    url,
    mode,
    words_tested: words.length,
    results_found: results.length,
    scan_time_ms: elapsed,
    results: results.sort((a, b) => a.status - b.status)
  };
}

const FUZZ_USER_AGENTS = [
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
  'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
];

async function _fuzzRequest(url, method, word) {
  try {
    const ua = FUZZ_USER_AGENTS[Math.floor(Math.random() * FUZZ_USER_AGENTS.length)];
    const response = await fetch(url, {
      method,
      headers: {
        'User-Agent': ua,
        'Accept': '*/*'
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(5000)
    });

    const contentLength = response.headers.get('content-length') || '0';
    const contentType = response.headers.get('content-type') || '';
    const location = response.headers.get('location') || '';

    return {
      word,
      url,
      status: response.status,
      size: parseInt(contentLength),
      content_type: contentType.split(';')[0],
      redirect: location || undefined
    };
  } catch {
    return null;
  }
}
