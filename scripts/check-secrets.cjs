const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const files = execFileSync('git',['ls-files','--cached','--others','--exclude-standard'],{encoding:'utf8'}).trim().split('\n');
const failures=[];
for (const file of files) {
  if (!fs.existsSync(file)) continue;
  if (/(^|\/)\.env($|\.)/.test(file) && !file.endsWith('.example')) failures.push(file);
  if (/\.(db|jks|keystore|p12|pem|key)$/.test(file)) failures.push(file);
  if (fs.statSync(file).size>1000000 || /package-lock\.json$/.test(file)) continue;
  const content=fs.readFileSync(file,'utf8');
  // Redact findings: output filenames only, never matched secret material.
  if (/-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(content) || /gh[pousr]_[A-Za-z0-9]{30,}/.test(content) || /postgres(?:ql)?:\/\/[^\s:@]+:[^\s@]+@(?!localhost|127\.0\.0\.1)[^\s/]+/.test(content)) failures.push(file);
}
if(failures.length){console.error('Potential credentials or private artifacts:',[...new Set(failures)]);process.exit(1);}
console.log('Current-tree secret/artifact checks passed. Historical exposure still requires rotation.');
