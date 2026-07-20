import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  // 1. Navigation Hook securely inside the component
  const navigate = useNavigate();
  
  // 2. State Management
  const [tickets, setTickets] = useState([]);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'Plumbing' // Default category included
  });

  const { title, description, category } = formData;
  const token = localStorage.getItem('token');

  // 3. Logout Handler
  const onLogout = () => {
    localStorage.removeItem('token'); 
    navigate('/login');               
  };

  // 4. Read (Fetch) Lifecycle
  useEffect(() => {
    const fetchTickets = async () => {
      if (!token) return;
      try {
        const response = await axios.get('https://apartment-management-platform.onrender.com/api/tickets', {
          headers: { 'x-auth-token': token }
        });
        setTickets(response.data);
      } catch (err) {
        console.error("Error fetching tickets:", err);
        setError('Failed to load tickets.');
      }
    };
    fetchTickets();
  }, [token]);

  // 5. Input Handler
  const onChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // 6. Create Lifecycle
  const onSubmit = async (e) => {
    e.preventDefault();
    try {
      const config = {
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        }
      };
      
      const response = await axios.post('https://apartment-management-platform.onrender.com/api/tickets', formData, config);
      
      // Optimistic UI update
      setTickets([response.data, ...tickets]);
      
      // Reset form state properly
      setFormData({ title: '', description: '', category: 'Plumbing' });
    } catch (err) {
      console.error("Error creating ticket:", err);
      setError('Failed to create ticket.');
    }
  };

  // 7. Delete Lifecycle
  const onDelete = async (id) => {
    try {
      await axios.delete(`https://apartment-management-platform.onrender.com/api/tickets/${id}`, {
        headers: { 'x-auth-token': token }
      });
      
      // Optimistic UI filter
      setTickets(tickets.filter(ticket => ticket._id !== id));
    } catch (err) {
      console.error("Error deleting ticket:", err);
      setError('Failed to delete ticket.');
    }
  };
  // Update Lifecycle (Resolve Ticket)
  const onResolve = async (id) => {
    try {
      const response = await axios.put(`https://apartment-management-platform.onrender.com/api/tickets/${id}`, {}, {
        headers: { 'x-auth-token': token }
      });
      
      // Optimistic UI: Map through the state array. 
      // If the ID matches, replace it with the updated ticket from the server.
      setTickets(tickets.map(ticket => ticket._id === id ? response.data : ticket));
    } catch (err) {
      console.error("Error updating ticket:", err);
      setError('Failed to update ticket status.');
    }
  };

  // 8. View Engine (JSX Rendering)
  return (
    <div style={{ padding: '2rem', color: '#fff', maxWidth: '800px', margin: '0 auto' }}>
      
      {/* Header Panel */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Resident Dashboard</h2>
        <button 
          onClick={onLogout} 
          style={{ padding: '0.5rem 1rem', background: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          Logout
        </button>
      </div>
      
      {error && <p style={{ color: '#dc3545', textAlign: 'center' }}>{error}</p>}

      {/* Ticket Creation Form */}
      <div style={{ background: '#2a2a2a', padding: '2rem', borderRadius: '8px', marginTop: '2rem' }}>
        <h3 style={{ textAlign: 'center', marginBottom: '1rem' }}>Report an Issue</h3>
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          <input 
            type="text" 
            name="title" 
            value={title} 
            onChange={onChange} 
            placeholder="Issue Title (e.g., Leaking Faucet)" 
            required 
            style={{ padding: '0.75rem', borderRadius: '4px', border: '1px solid #444', background: '#1e1e1e', color: '#fff' }} 
          />
          
          <select 
            name="category" 
            value={category} 
            onChange={onChange}
            style={{ padding: '0.75rem', borderRadius: '4px', border: '1px solid #444', background: '#1e1e1e', color: '#fff' }}
          >
            <option value="Plumbing">Plumbing</option>
            <option value="Electrical">Electrical</option>
            <option value="Carpentry">Carpentry</option>
            <option value="General">General Maintenance</option>
          </select>

          <textarea 
            name="description" 
            value={description} 
            onChange={onChange} 
            placeholder="Describe the issue in detail..." 
            required 
            rows="4" 
            style={{ padding: '0.75rem', borderRadius: '4px', border: '1px solid #444', background: '#1e1e1e', color: '#fff', resize: 'vertical' }} 
          />
          
          <button type="submit" style={{ padding: '0.75rem', background: '#0d6efd', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            Submit Ticket
          </button>
        </form>
      </div>

      {/* Ticket List Panel */}
      <div style={{ marginTop: '3rem' }}>
        <h3 style={{ borderBottom: '1px solid #444', paddingBottom: '1rem', marginBottom: '1rem', textAlign: 'center' }}>My Service Tickets</h3>
        
        {tickets.length === 0 ? (
          <p style={{ textAlign: 'center' }}>No tickets found. You are all caught up!</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {tickets.map(ticket => (
              <li key={ticket._id} style={{ background: '#1e1e1e', margin: '1rem 0', padding: '1rem', borderRadius: '4px', borderLeft: '4px solid #0d6efd' }}>
                <h4 style={{ margin: '0 0 0.5rem 0' }}>
                  {ticket.title} 
                  <span style={{ fontSize: '0.8rem', color: '#aaa', marginLeft: '1rem' }}>({ticket.status})</span>
                </h4>
                <p style={{ margin: '0', color: '#ccc' }}>{ticket.description}</p>
                
                {/* Action Buttons */}
                <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
                  
                  {/* Only show 'Resolve' if the ticket is not already resolved */}
                  {ticket.status !== 'Resolved' && (
                    <button 
                      onClick={() => onResolve(ticket._id)}
                      style={{ padding: '0.4rem 0.8rem', background: '#198754', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                    >
                      Mark as Resolved
                    </button>
                  )}

                  <button 
                    onClick={() => onDelete(ticket._id)}
                    style={{ padding: '0.4rem 0.8rem', background: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                  >
                    Delete Ticket
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}