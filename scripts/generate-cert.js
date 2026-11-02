/**
 * scripts/generate-cert.js
 * 
 * Generates a self-signed SSL/TLS certificate with Subject Alternative Names (SAN)
 * for localhost, 127.0.0.1, and local LAN IP addresses.
 * Required for mobile camera permissions over local HTTPS.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const CERTS_DIR = path.resolve(__dirname, '..', '.certs');
const KEY_PATH = path.join(CERTS_DIR, 'server.key');
const CERT_PATH = path.join(CERTS_DIR, 'server.crt');
const CONFIG_PATH = path.join(CERTS_DIR, 'openssl.cnf');

function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = ['127.0.0.1'];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  return addresses;
}

function generateCertificates() {
  if (!fs.existsSync(CERTS_DIR)) {
    fs.mkdirSync(CERTS_DIR, { recursive: true });
  }

  // If already exist and valid, return
  if (fs.existsSync(KEY_PATH) && fs.existsSync(CERT_PATH)) {
    console.log('🔒 Existing SSL certificate found at .certs/server.crt');
    return { keyPath: KEY_PATH, certPath: CERT_PATH };
  }

  console.log('🔐 Generating self-signed SSL certificate with SANs for mobile WebAR...');
  const ips = getLocalIpAddresses();
  console.log('   Bound IP Addresses:', ips.join(', '));

  let sanList = 'DNS.1 = localhost\n';
  ips.forEach((ip, idx) => {
    sanList += `IP.${idx + 1} = ${ip}\n`;
  });

  const opensslConfig = `
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
x509_extensions = v3_req

[dn]
C = US
ST = California
L = San Francisco
O = Tazheeb AR Studio
OU = Instructional Technology
CN = localhost

[v3_req]
subjectAltName = @alt_names
basicConstraints = CA:FALSE
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth

[alt_names]
${sanList}
`;

  fs.writeFileSync(CONFIG_PATH, opensslConfig.trim(), 'utf8');

  try {
    execSync(`openssl req -x509 -newkey rsa:2048 -nodes -keyout "${KEY_PATH}" -out "${CERT_PATH}" -days 365 -config "${CONFIG_PATH}"`, { stdio: 'pipe' });
    console.log('   ✓ SSL Key generated:', KEY_PATH);
    console.log('   ✓ SSL Certificate generated:', CERT_PATH);
  } catch (err) {
    console.error('Failed to generate SSL certificate via openssl:', err.message);
    throw err;
  }

  return { keyPath: KEY_PATH, certPath: CERT_PATH };
}

if (require.main === module) {
  generateCertificates();
}

module.exports = { generateCertificates, getLocalIpAddresses };

