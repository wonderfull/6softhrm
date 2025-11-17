const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');

const token = jwt.sign({ userId: 1, role: 'ADMIN' }, 'change_me_to_a_strong_secret_in_production');
const date = '2025-11-17';
const p1 = 1; const p2 = 2;

(async ()=>{
  try {
    console.log('Creating ts 4h project p1');
    let r = await fetch('http://localhost:4000/api/timesheets', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify({ employeeId: 1, projectId: p1, date, hours: 4, notes: 'Project p1' }) });
    console.log('Status', r.status, await r.json());

    console.log('Creating ts 4h project p2');
    r = await fetch('http://localhost:4000/api/timesheets', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify({ employeeId: 1, projectId: p2, date, hours: 4, notes: 'Project p2' }) });
    console.log('Status', r.status, await r.json());

    let rr = await fetch('http://localhost:4000/api/timesheets', { headers: { 'Authorization': 'Bearer ' + token } });
    let arr = await rr.json();
    const count = arr.filter(t => t.employeeId === 1 && t.date.includes(date)).length;
    console.log('Timesheets count:', count);
    console.log('Timesheets entries for date:', arr.filter(t => t.employeeId === 1 && t.date.includes(date)).map(t=>({id:t.id, projectId:t.projectId, hours:t.hours})));
  } catch (err) {
    console.error(err);
  }
})();