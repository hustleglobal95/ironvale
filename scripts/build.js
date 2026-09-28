const fs = require('fs');
const path = require('path');
const { document } = require('./document');

const out = path.join(__dirname, '..', 'dist');
fs.mkdirSync(out, { recursive: true });
const target = path.join(out, 'index.html');
fs.writeFileSync(target, document());
console.log('Standalone game ready: dist/index.html');
