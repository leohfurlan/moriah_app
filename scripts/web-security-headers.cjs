const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const root = path.resolve(__dirname, "../mobile/dist");
const hashes = new Set();
function scan(dir) {
  for (const file of fs.readdirSync(dir, { withFileTypes: true })) {
    const target = path.join(dir, file.name);
    if (file.isDirectory()) scan(target);
    else if (file.name.endsWith(".html")) {
      for (const match of fs.readFileSync(target, "utf8").matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
        if (!/\bsrc\s*=/i.test(match[1]) && match[2].trim()) {
          hashes.add(`'sha256-${crypto.createHash("sha256").update(match[2]).digest("base64")}'`);
        }
      }
    }
  }
}
scan(root);
const policy = `default-src 'self'; script-src 'self' ${[...hashes].join(" ")}; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`;
const header = process.env.CSP_ENFORCE === "true" ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only";
fs.writeFileSync(path.join(root, "security-headers.conf"), `include /etc/nginx/security-common.conf;\nadd_header ${header} "${policy}" always;\n`);
console.log(`Generated ${header} with ${hashes.size} inline script hashes.`);
