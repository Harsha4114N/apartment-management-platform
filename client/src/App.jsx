import { BrowserRouter, Routes, Route } from 'react-router-dom';
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';

function App() {
  return (
    <BrowserRouter>
      {/* Add the Toaster here, outside of your Routes */}
      <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<Dashboard />} />
        {/* Redirect empty path to login */}
        <Route path="/" element={<Login />} />
      </Routes>
    </Router>
    </BrowserRouter>
  );
}

export default App;