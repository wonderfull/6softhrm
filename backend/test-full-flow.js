// Test the full login + create employee flow
async function testFlow() {
  try {
    // Step 1: Login
    console.log('1. Logging in...');
    const loginRes = await fetch('http://localhost:4000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@example.com',
        password: 'password123'
      })
    });
    
    const loginData = await loginRes.json();
    console.log('Login response:', loginData);
    
    if (!loginData.token) {
      console.error('❌ Login failed - no token received');
      return;
    }
    
    console.log('✓ Login successful, token received');
    const token = loginData.token;
    
    // Step 2: Create employee
    console.log('\n2. Creating employee...');
    const employeeData = {
      firstName: "Jane",
      lastName: "Smith",
      email: "jane.smith" + Date.now() + "@example.com",
      phoneNumber: "07700 900123",
      jobTitle: "Manager",
      employeeType: "EMPLOYEE",
      department: "Sales",
      niNumber: "CD789012E",
      startDate: "2025-11-15"
    };
    
    console.log('Sending data:', JSON.stringify(employeeData, null, 2));
    
    const createRes = await fetch('http://localhost:4000/api/employees', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(employeeData)
    });
    
    console.log('Response status:', createRes.status);
    const createData = await createRes.json();
    console.log('Response data:', JSON.stringify(createData, null, 2));
    
    if (createRes.ok) {
      console.log('\n✓ Employee created successfully!');
      console.log('Employee ID:', createData.id);
    } else {
      console.error('\n❌ Failed to create employee');
      console.error('Error:', createData.error || createData);
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

testFlow();
