// Parses the game's script block without running it. Fast enough to use as a
// pre-commit gate: a stray brace in a 5,000-line file is otherwise only found
// by loading the page and watching nothing happen.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const file = path.join(__dirname, '..', 'ironvale.html');
const html = fs.readFileSync(file, 'utf8');

const open = html.indexOf('<script>');
const close = html.lastIndexOf('</script>');
if (open < 0 || close < 0) {
  console.error('check: no <script> block found in ironvale.html');
  process.exit(1);
}
const js = html.slice(open + 8, close);

try {
  new vm.Script('(function(){' + js + '\n})', { filename: 'ironvale.html' });
  const lines = js.split('\n').length;
  console.log('check: ok — ' + lines.toLocaleString() + ' lines of script parse cleanly');
} catch (e) {
  console.error('check: ' + e.message);
  process.exit(1);
}
