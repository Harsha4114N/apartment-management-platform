import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export default function Register() {
  // 1. Initialize the state to hold our form data
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    flatNumber: ''
  });

  const navigate = useNavigate();

  // 2. Update the state dynamically as the user types
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // 3. Handle the form submission
  const handleSubmit = async (e) => {
    e.preventDefault(); // Prevents the page from refreshing
    try {
      // Send the POST request to your verified backend route
      const response = await axios.post('https://apartment-management-platform.onrender.com/api/auth/register', formData);
      
      console.log("Server Response:", response.data);
      alert('Registration successful! Rerouting to login...');
      
      // If successful, automatically push the user to the login page
      navigate('/login');
    } catch (error) {
      console.error("Registration Error:", error.response?.data || error.message);
      alert('Registration failed. Check the console for details.');
    }
  };

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif' }}>
      <h2>Resident Registration</h2>
      <p>Enter your details to create an account on the platform.</p>
      
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', width: '300px', gap: '15px', marginTop: '20px' }}>
        <input 
          type="text" 
          name="fullName" 
          placeholder="Full Name" 
          onChange={handleChange} 
          required 
          style={{ padding: '8px' }}
        />
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
          placeholder="Secure Password" 
          onChange={handleChange} 
          required 
          style={{ padding: '8px' }}
        />
        <input 
          type="text" 
          name="flatNumber" 
          placeholder="Flat Number (e.g., B-404)" 
          onChange={handleChange} 
          required 
          style={{ padding: '8px' }}
        />
        <button type="submit" style={{ padding: '10px', cursor: 'pointer', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px' }}>
          Register Account
        </button>
      </form>
    </div>
  );
}