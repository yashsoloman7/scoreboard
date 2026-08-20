const fs = require('fs');
const path = require('path');

function findFiles(dir, exts) {
  let results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.next') {
      results = results.concat(findFiles(full, exts));
    } else if (exts.some(e => entry.name.endsWith(e))) {
      results.push(full);
    }
  }
  return results;
}

const files = findFiles(path.join(__dirname, '..', 'src'), ['.ts', '.tsx']);
const pkgs = new Set();

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const re = /from\s+['"]([a-z][^'"]*)['"]/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const pkg = m[1].startsWith('@') ? m[1] : m[1].split('/')[0];
    pkgs.add(pkg);
  }
}

console.log([...pkgs].sort().join('\n'));
