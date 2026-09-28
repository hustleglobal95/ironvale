// Serves the game at http://localhost:8080 so you can play it in a browser.
// The file is a fragment by design (the Artifact host supplies the page
// skeleton), so this wraps it on the way out.
const http = require('http');
const { document } = require('./document');

const port = Number(process.env.PORT) || 8080;

http.createServer((req, res) => {
  const route = new URL(req.url, 'http://localhost').pathname;
  if (route !== '/' && route !== '/index.html') {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    return res.end('Not found');
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { allow: 'GET, HEAD' });
    return res.end();
  }
  const body = document();
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store' });
  res.end(req.method === 'HEAD' ? undefined : body);
}).listen(port, () => console.log('Ironvale on http://localhost:' + port));
