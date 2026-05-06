
const url = 'https://tevtluhuznkovezjgohh.supabase.co/rest/v1/profiles?role=eq.admin&select=*';
const apikey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRldnRsdWh1em5rb3Zlempnb2hoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM3NTA3NCwiZXhwIjoyMDg5OTUxMDc0fQ.OuPJ3aZWln82AP2QlShUsNPmwzm9h7o2ji6B3iEFgXk';

fetch(url, {
  headers: {
    'apikey': apikey,
    'Authorization': `Bearer ${apikey}`
  }
})
.then(res => {
  console.log('Status:', res.status);
  return res.json();
})
.then(data => {
  console.log('Data:', JSON.stringify(data, null, 2));
})
.catch(err => {
  console.error('Error:', err);
});
