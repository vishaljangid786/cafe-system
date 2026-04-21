const axios = require('axios');

const test = async () => {
  try {
    const res = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'superadmin_seed@gmail.com',
      password: 'password123'
    });
    console.log('Login Success:', res.data.success);
  } catch (err) {
    console.log('Login Failed:', err.response?.data?.message || err.message);
    if (err.response) {
      console.log('Status:', err.response.status);
    }
  }
};

test();
