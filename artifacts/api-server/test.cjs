const http = require('http');

const data = JSON.stringify({
  email: "test@example.com",
  password: "password123"
});

const req = http.request('http://localhost:3000/auth/usher/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log('LOGIN:', res.statusCode, body));
});
req.write(data);
req.end();

const regData = JSON.stringify({
  fullName: "Test User",
  phone: "12345678",
  email: "test2@example.com",
  nationalIdNumber: "12345678901234",
  password: "password123"
});

const req2 = http.request('http://localhost:3000/auth/usher/register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': regData.length
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('REGISTER:', res.statusCode, body);
    
    // Register again to trigger 23505
    const req3 = http.request('http://localhost:3000/auth/usher/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': regData.length
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => console.log('REGISTER DUP:', res.statusCode, body));
    });
    req3.write(regData);
    req3.end();
  });
});
req2.write(regData);
req2.end();
