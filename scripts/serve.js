// Serves the game at http://localhost:8080 so you can play it in a browser.
// The file is a fragment by design (the Artifact host supplies the page
// skeleton), so this wraps it on the way out.
const http = require('http');
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'ironvale.html');
const port = Number(process.env.PORT) || 8080;

http.createServer((req, res) => {
  const body = '<!doctype html><html><head><meta charset="utf-8">' +
    '<title>Ironvale</title></head><body>' +
    fs.readFileSync(file, 'utf8') + '</body></html>';
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(body);
}).listen(port, () => console.log('Ironvale on http://localhost:' + port));
