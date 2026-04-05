// const fetch = require('node-fetch'); // If it exists, or global fetch
async function run() {
  try {
    const res = await globalThis.fetch('http://localhost:3000/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resume: 'software engineer details',
        skills: 'React, Node',
        jobOffer: 'senior software engineer',
        experiences: [], stages: [], education: []
      })
    });
    const text = await res.text();
    console.log('---- STATUS ----\\n', res.status);
    console.log('---- BODY ----\\n', text);
  } catch(e) {
    console.log('---- ERROR ----\\n', e);
  }
}
run();
