const fs = require('fs');
const https = require('https');

const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/VITE_SUPABASE_SERVICE_ROLE_KEY=(.*)/);

const url = urlMatch[1].trim() + '/rest/v1/personal_records?select=*';
const key = keyMatch[1].trim();

https.get(url, { headers: { 'apikey': key, 'Authorization': 'Bearer ' + key } }, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => { console.log(data); });
});
