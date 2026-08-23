const fs = require('fs');
const path = require('path');

const apiTsPath = path.join(__dirname, 'lib/api-zod/src/generated/api.ts');
let content = fs.readFileSync(apiTsPath, 'utf8');

// Replace zod.int() -> zod.number().int()
content = content.replace(/zod\.int\(\)/g, 'zod.number().int()');
// Replace zod.email() -> zod.string().email()
content = content.replace(/zod\.email\(\)/g, 'zod.string().email()');
// Replace from 'zod' -> from 'zod/v4' if needed (but zod works for v3 which this likely uses)
// Wait, the project package.json has zod "catalog:" but maybe it's fine.

fs.writeFileSync(apiTsPath, content);

const typesDir = path.join(__dirname, 'lib/api-zod/src/generated/types');
const removed = [];
fs.readdirSync(typesDir).filter(f => f !== 'index.ts').forEach(f => {
  const name = f.replace('.ts', '');
  const pascal = name.charAt(0).toUpperCase() + name.slice(1).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  if (content.includes('export const ' + pascal)) {
    fs.unlinkSync(path.join(typesDir, f));
    removed.push(name);
    console.log('Removed conflicting type file:', f);
  }
});

if (removed.length) {
  const idx = path.join(typesDir, 'index.ts');
  let idxContent = fs.readFileSync(idx, 'utf8');
  removed.forEach(n => {
    idxContent = idxContent.split('\n').filter(l => !l.includes("./" + n)).join('\n');
  });
  fs.writeFileSync(idx, idxContent);
}

// Also fix index.ts conflicts
const rootIndexTsPath = path.join(__dirname, 'lib/api-zod/src/index.ts');
if (fs.existsSync(rootIndexTsPath)) {
  let idx = fs.readFileSync(rootIndexTsPath, 'utf8');
  // It says already exported. We can just export from api.ts.
  fs.writeFileSync(rootIndexTsPath, "export * from './generated/api';\nexport * from './generated/types/index';\n");
}
