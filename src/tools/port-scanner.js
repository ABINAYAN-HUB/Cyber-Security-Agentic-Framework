// OpenClaw Cyber — Native Port Scanner
import net from 'net';

export const definition = {
  type: 'function',
  function: {
    name: 'port_scanner',
    description: 'Fast TCP port scanner built in pure Node.js. No nmap required. Scan single ports, ranges, or common service ports. Returns open ports with service identification via banner grabbing.',
    parameters: {
      type: 'object',
      properties: {
        host: { type: 'string', description: 'Target IP or hostname' },
        ports: { type: 'string', description: 'Port specification: single port "80", range "1-1000", common "top100", "top1000", or comma-separated "22,80,443,8080"' },
        timeout_ms: { type: 'integer', description: 'Connection timeout per port in ms (default: 2000)' },
        grab_banner: { type: 'boolean', description: 'Attempt banner grabbing on open ports (default: true)' },
        concurrency: { type: 'integer', description: 'Number of concurrent connections (default: 100)' }
      },
      required: ['host']
    }
  }
};

const TOP_100 = [21,22,23,25,53,80,110,111,135,139,143,443,445,993,995,1723,3306,3389,5900,8080,
  20,26,49,69,79,88,113,119,123,137,138,161,162,179,199,389,427,444,465,513,514,515,
  543,544,548,554,587,631,646,873,990,1080,1433,1434,1521,1720,2000,2001,2049,2121,
  2717,3000,3128,3268,3269,3986,4899,5000,5009,5051,5060,5101,5190,5357,5432,5631,
  5666,5800,5901,6000,6001,6646,7002,7070,8000,8008,8009,8443,8888,9100,9999,10000,
  32768,49152,49153,49154,49155,49156,49157];

const TOP_1000_EXTRA = [1,7,9,11,13,15,17,18,19,37,42,49,50,51,52,53,65,67,68,70,79,81,82,83,84,85,86,87,88,89,90,
  99,100,106,109,110,111,113,119,125,135,139,143,144,146,161,163,164,174,177,178,179,191,199,211,212,222,254,255,256,
  259,264,280,301,306,311,340,366,389,406,407,416,417,425,427,443,444,445,458,464,465,481,497,500,512,513,514,515,
  524,541,543,544,545,548,554,555,563,587,593,616,617,625,631,636,646,648,666,667,668,683,687,691,700,705,711,714,
  720,722,726,749,765,777,783,787,800,801,808,843,873,880,888,898,900,901,902,903,911,912,981,987,990,992,993,995,
  999,1000,1001,1002,1007,1009,1010,1011,1021,1022,1023,1024,1025,1026,1027,1028,1029,1030,1031,1032,1033,1034,
  1035,1036,1037,1038,1039,1040,1041,1042,1043,1044,1045,1046,1047,1048,1049,1050,1051,1052,1053,1054,1055,1056,
  1057,1058,1059,1060,1061,1062,1063,1064,1065,1066,1067,1068,1069,1070,1071,1072,1073,1074,1075,1080,1081,1082,
  1083,1084,1085,1086,1088,1090,1098,1099,1100,1101,1102,1104,1105,1106,1107,1108,1110,1111,1112,1113,1117,1119,
  1121,1122,1123,1124,1126,1130,1131,1132,1137,1138,1141,1145,1147,1148,1149,1151,1152,1154,1163,1164,1165,1166,
  1169,1174,1175,1183,1185,1186,1187,1192];

const SERVICE_MAP = {
  21:'FTP', 22:'SSH', 23:'Telnet', 25:'SMTP', 53:'DNS', 80:'HTTP', 110:'POP3', 111:'RPCBind',
  135:'MSRPC', 139:'NetBIOS', 143:'IMAP', 443:'HTTPS', 445:'SMB', 993:'IMAPS', 995:'POP3S',
  1433:'MSSQL', 1521:'Oracle', 1723:'PPTP', 3306:'MySQL', 3389:'RDP', 5432:'PostgreSQL',
  5900:'VNC', 6379:'Redis', 8080:'HTTP-Proxy', 8443:'HTTPS-Alt', 27017:'MongoDB',
  9200:'Elasticsearch', 5601:'Kibana', 8888:'HTTP-Alt', 2049:'NFS', 11211:'Memcached',
  6667:'IRC', 25565:'Minecraft', 5060:'SIP'
};

export async function execute(args) {
  const { host, ports = 'top100', timeout_ms = 2000, grab_banner = true, concurrency = 100 } = args;
  
  // Parse port specification
  const portList = _parsePorts(ports);
  const startTime = Date.now();
  
  // Scan with concurrency limit
  const openPorts = [];
  const chunks = [];
  for (let i = 0; i < portList.length; i += concurrency) {
    chunks.push(portList.slice(i, i + concurrency));
  }

  for (const chunk of chunks) {
    const results = await Promise.all(chunk.map(port => _scanPort(host, port, timeout_ms, grab_banner)));
    for (const r of results) {
      if (r.open) openPorts.push(r);
    }
  }

  const elapsed = Date.now() - startTime;

  return {
    success: true,
    host,
    ports_scanned: portList.length,
    open_ports: openPorts.length,
    scan_time_ms: elapsed,
    results: openPorts.sort((a, b) => a.port - b.port)
  };
}

function _parsePorts(spec) {
  if (spec === 'top100') return [...TOP_100];
  if (spec === 'top1000') return [...new Set([...TOP_100, ...TOP_1000_EXTRA])].sort((a,b) => a-b);
  
  const ports = new Set();
  for (const part of spec.split(',')) {
    const trimmed = part.trim();
    if (trimmed.includes('-')) {
      const [start, end] = trimmed.split('-').map(Number);
      for (let p = start; p <= Math.min(end, 65535); p++) ports.add(p);
    } else {
      const p = Number(trimmed);
      if (p > 0 && p <= 65535) ports.add(p);
    }
  }
  return [...ports].sort((a, b) => a - b);
}

async function _scanPort(host, port, timeout, grabBanner) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let banner = '';
    
    socket.setTimeout(timeout);
    
    socket.on('connect', () => {
      const result = { port, open: true, service: SERVICE_MAP[port] || 'unknown' };
      
      if (grabBanner) {
        socket.on('data', (data) => {
          banner += data.toString().slice(0, 200);
        });
        
        // Send probe for HTTP
        if ([80, 8080, 8000, 8443, 443, 8888].includes(port)) {
          socket.write('HEAD / HTTP/1.0\r\nHost: target\r\n\r\n');
        }
        
        setTimeout(() => {
          result.banner = banner.trim() || null;
          socket.destroy();
          resolve(result);
        }, Math.min(timeout, 2000));
      } else {
        socket.destroy();
        resolve(result);
      }
    });

    socket.on('timeout', () => { socket.destroy(); resolve({ port, open: false }); });
    socket.on('error', () => { socket.destroy(); resolve({ port, open: false }); });

    socket.connect(port, host);
  });
}
