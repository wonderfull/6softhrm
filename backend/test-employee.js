const jwt = require('jsonwebtoken');

// Generate a test token (using the secret from .env)
const token = jwt.sign(
  { userId: 1, role: 'ADMIN' }, 
  'change_me_to_a_strong_secret_in_production'
);

const testData = {
  firstName: "John",
  lastName: "Doe",
  email: "john.doe" + Date.now() + "@example.com",
  phoneNumber: "07700 900000",
  jobTitle: "Software Engineer",
  employeeType: "EMPLOYEE",
  department: "Engineering",
  niNumber: "AB123456C",
  startDate: "2025-11-01"
};

console.log('Testing employee creation...');
console.log('Data:', JSON.stringify(testData, null, 2));

fetch('http://localhost:4000/api/employees', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify(testData)
})
.then(res => {
  console.log('Status:', res.status);
  return res.json();
})
.then(data => {
  console.log('Response:', JSON.stringify(data, null, 2));
})
.catch(err => {
  console.error('Error:', err.message);
});
