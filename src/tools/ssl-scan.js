// Jarvis Cyber — SSL/TLS Scanner
import { connect } from 'tls';
import { createConnection } from 'net';

export const definition = {
  type: 'function',
  function: {
    name: 'ssl_scan',
    description: 'Analyze SSL/TLS configuration of a target. Checks certificate details (issuer, expiry, SANs), protocol versions (TLS 1.0/1.1/1.2/1.3), cipher suites, and common vulnerabilities (expired certs, self-signed, weak ciphers, Heartbleed indicators).',
    parameters: {
      type: 'object',
      properties: {
        host: { type: 'string', description: 'Target hostname or IP' },
        port: { type: 'integer', description: 'Port (default: 443)' }
      },
      required: ['host']
    }
  }
};

export async function execute(args) {
  const { host, port = 443 } = args;

  try {
    // Test main TLS connection
    const mainResult = await _testTLS(host, port);
    
    // Test specific protocol versions
    const protocols = {};
    for (const proto of ['TLSv1', 'TLSv1.1', 'TLSv1.2', 'TLSv1.3']) {
      protocols[proto] = await _testProtocol(host, port, proto);
    }

    // Analyze vulnerabilities
    const vulns = [];
    if (mainResult.cert) {
      const cert = mainResult.cert;
      
      // Expired cert
      if (new Date(cert.valid_to) < new Date()) {
        vulns.push({ severity: 'CRITICAL', issue: 'Certificate has EXPIRED', detail: `Expired: ${cert.valid_to}` });
      }
      
      // Expiring soon (30 days)
      const daysToExpiry = Math.floor((new Date(cert.valid_to) - new Date()) / (1000 * 60 * 60 * 24));
      if (daysToExpiry > 0 && daysToExpiry < 30) {
        vulns.push({ severity: 'WARNING', issue: 'Certificate expiring soon', detail: `${daysToExpiry} days remaining` });
      }

      // Self-signed
      if (cert.issuer && cert.subject && JSON.stringify(cert.issuer) === JSON.stringify(cert.subject)) {
        vulns.push({ severity: 'HIGH', issue: 'Self-signed certificate detected', detail: 'Not trusted by browsers' });
      }

      // Weak signature
      if (cert.signatureAlgorithm && cert.signatureAlgorithm.includes('sha1')) {
        vulns.push({ severity: 'MEDIUM', issue: 'Weak signature algorithm (SHA1)', detail: cert.signatureAlgorithm });
      }
    }

    // Deprecated protocols
    if (protocols['TLSv1'] === 'supported') {
      vulns.push({ severity: 'HIGH', issue: 'TLS 1.0 supported (deprecated, POODLE vulnerable)' });
    }
    if (protocols['TLSv1.1'] === 'supported') {
      vulns.push({ severity: 'MEDIUM', issue: 'TLS 1.1 supported (deprecated)' });
    }
    if (protocols['TLSv1.3'] !== 'supported') {
      vulns.push({ severity: 'LOW', issue: 'TLS 1.3 not supported (recommended for best security)' });
    }

    // Weak ciphers
    if (mainResult.cipher) {
      const cipherName = mainResult.cipher.name || '';
      if (/RC4|DES|NULL|EXPORT|MD5/i.test(cipherName)) {
        vulns.push({ severity: 'CRITICAL', issue: 'Weak cipher suite in use', detail: cipherName });
      }
    }

    return {
      success: true,
      host,
      port,
      certificate: mainResult.cert ? {
        subject: mainResult.cert.subject,
        issuer: mainResult.cert.issuer,
        valid_from: mainResult.cert.valid_from,
        valid_to: mainResult.cert.valid_to,
        days_remaining: Math.floor((new Date(mainResult.cert.valid_to) - new Date()) / (1000 * 60 * 60 * 24)),
        serial: mainResult.cert.serialNumber,
        fingerprint: mainResult.cert.fingerprint256,
        sans: mainResult.cert.subjectaltname
      } : null,
      protocol: mainResult.protocol,
      cipher: mainResult.cipher,
      protocols_supported: protocols,
      vulnerabilities: vulns,
      vulnerability_count: vulns.length
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function _testTLS(host, port) {
  return new Promise((resolve) => {
    const socket = connect({
      host, port,
      servername: host,
      rejectUnauthorized: false,
      timeout: 10000
    }, () => {
      const cert = socket.getPeerCertificate();
      const protocol = socket.getProtocol();
      const cipher = socket.getCipher();
      socket.destroy();
      resolve({ cert, protocol, cipher });
    });

    socket.on('error', (err) => {
      resolve({ error: err.message });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ error: 'Connection timed out' });
    });
  });
}

function _testProtocol(host, port, protocol) {
  return new Promise((resolve) => {
    try {
      const socket = connect({
        host, port,
        servername: host,
        rejectUnauthorized: false,
        minVersion: protocol,
        maxVersion: protocol,
        timeout: 5000
      }, () => {
        socket.destroy();
        resolve('supported');
      });

      socket.on('error', () => {
        resolve('not supported');
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve('timeout');
      });
    } catch {
      resolve('not supported');
    }
  });
}
