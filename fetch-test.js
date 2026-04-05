const http = require('http');

const options = {
  hostname: '127.0.0.1',
  port: 3000,
  path: '/api/generate/',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    require('fs').writeFileSync('response.txt', 'Status: ' + res.statusCode + '\\n' + data);
    console.log('Saved to response.txt');
  });
});

req.on('error', console.error);
req.write(JSON.stringify({
  resume: "R",
  skills: "S",
  jobOffer: "J"
}));
req.end();
