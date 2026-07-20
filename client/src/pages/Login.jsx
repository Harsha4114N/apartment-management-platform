import toast from 'react-hot-toast';
import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [credentials, setCredentials] = useState({
    email: '',
    password: ''
  });

  const navigate = useNavigate();

  const handleChange = (e) => {
    setCredentials({ ...credentials, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // 1. Send credentials to the backend
      const response = await axios.post('https://apartment-management-platform.onrender.com/api/auth/login', credentials);
      
      // 2. Catch the JWT token sent back by the server
      const token = response.data.token;
      
      // 3. Store the token in the browser's local storage
      localStorage.setItem('token', token);
      
      toast.success("Authentication Successful!");
      
      // 4. Route the authenticated user to the secure dashboard
      navigate('/dashboard');
    } catch (error) {
      console.error("Login Error:", error.response?.data || error.message);
      toast.error("Invalid credentials. Please try again.");
    }
  };

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif' }}>
      <h2>Resident Login</h2>
      <p>Access your apartment dashboard.</p>
      
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', width: '300px', gap: '15px', marginTop: '20px' }}>
        <input 
          type="email" 
          name="email" 
          placeholder="Email Address" 
          onChange={handleChange} 
          required 
          style={{ padding: '8px' }}
        />
        <input 
          type="password" 
          name="password" 
          placeholder="Password" 
          onChange={handleChange} 
          required 
          style={{ padding: '8px' }}
        />
        <button type="submit" style={{ padding: '10px', cursor: 'pointer', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px' }}>
          Secure Login
        </button>
      </form>

      <p style={{ marginTop: '20px', fontSize: '14px' }}>
        Don't have an account? <a href="/register" style={{ color: '#007bff' }}>Register here</a>.
      </p>
    </div>
  );
}