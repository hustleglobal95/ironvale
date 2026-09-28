// The game source is a host-friendly HTML fragment. Keep the standalone
// document generated from exactly that source, with no second game copy.
const fs = require('fs');
const path = require('path');

const source = path.join(__dirname, '..', 'ironvale.html');

function document() {
  const fragment = fs.readFileSync(source, 'utf8');
  const end = fragment.indexOf('</style>');
  if (end < 0 || fragment.indexOf('<script>') < end) {
    throw new Error('ironvale.html must contain its stylesheet before its game script');
  }
  const split = end + '</style>'.length;
  return '<!doctype html>\n<html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    fragment.slice(0, split) + '</head><body>' +
    fragment.slice(split) + '</body></html>\n';
}

module.exports = { document };
