const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const OUTPUT_FILE = path.join(__dirname, 'output.json');

const server = http.createServer((req, res) => {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(parsed, null, 2));
        console.log(`\n[SUCCESS] Snapshot received and written to ${OUTPUT_FILE}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'success' }));
      } catch (err) {
        console.error('[ERROR] Failed to parse or write JSON:', err.message);
        res.writeHead(400);
        res.end(JSON.stringify({ status: 'error', message: err.message }));
      }
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(PORT, () => {
  console.log(`Listening for snapshot on port ${PORT}...`);
  console.log(`Make sure your app is running and triggers the POST request to http://localhost:${PORT}`);
});
