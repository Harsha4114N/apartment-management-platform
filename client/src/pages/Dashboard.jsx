import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Plumbing');
  const [description, setDescription] = useState('');
  
  const navigate = useNavigate();

  // Dummy state for tickets - replace with your actual MongoDB fetch logic later
  const [tickets, setTickets] = useState([
    { id: 1, title: 'working', status: 'Open', description: 'cannot work due to network problems' }
  ]);

  // --- LOGOUT FUNCTION ---
  const handleLogout = () => {
    localStorage.removeItem('token'); // Clears the ID card
    toast.success('Logged out successfully');
    navigate('/'); // Sends you back to the login page
  };

  // --- SUBMIT TICKET FUNCTION ---
  const handleSubmitTicket = async (e) => {
    e.preventDefault();
    const toastId = toast.loading('Submitting ticket...');

    try {
      const token = localStorage.getItem('token'); 

      await axios.post('https://apartment-management-platform.onrender.com/api/tickets', 
        {
          sendTo: 'Admin', 
          notificationTitle: `New Issue: ${title}`,
          message: `Category: ${category}\nDetails: ${description}`
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      
      toast.success('Ticket submitted and Admin notified!', { id: toastId });
      
      // Clear form
      setTitle('');
      setDescription('');
    } catch (error) {
      console.error(error);
      toast.error('Failed to submit ticket.', { id: toastId });
    }
  };

  // --- RESOLVE TICKET FUNCTION ---
  const handleResolveTicket = async (ticketId) => {
    try {
      const token = localStorage.getItem('token');
      
      await axios.put(`https://apartment-management-platform.onrender.com/api/tickets/${ticketId}`, 
        { status: 'Resolved' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setTickets(tickets.map(ticket => 
        ticket.id === ticketId ? { ...ticket, status: 'Resolved' } : ticket
      ));
      
      toast.success('Ticket marked as resolved!');
    } catch (error) {
      console.error(error);
      toast.error('Failed to resolve ticket.');
    }
  };

  // --- DELETE TICKET FUNCTION ---
  const handleDeleteTicket = async (ticketId) => {
    try {
      const token = localStorage.getItem('token');
      
      await axios.delete(`https://apartment-management-platform.onrender.com/api/tickets/${ticketId}`, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setTickets(tickets.filter(ticket => ticket.id !== ticketId));
      
      toast.success('Ticket deleted!');
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete ticket.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12 font-sans">
      
      {/* Top Header */}
      <div className="max-w-3xl mx-auto flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Resident Dashboard</h1>
        {/* The Logout button is now properly wired up! */}
        <button 
          onClick={handleLogout}
          className="bg-rose-500 hover:bg-rose-600 text-white px-5 py-2 rounded-xl font-medium transition-colors shadow-md shadow-rose-200"
        >
          Logout
        </button>
      </div>

      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* Report Issue Card */}
        <div className="bg-white p-8 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
          <h2 className="text-xl font-bold text-slate-800 mb-6 text-center">Report an Issue</h2>
          
          <form onSubmit={handleSubmitTicket} className="space-y-5">
            <div>
              <input
                type="text"
                placeholder="Issue Title (e.g., Leaking Faucet)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                required
              />
            </div>

            <div>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all cursor-pointer"
              >
                <option value="Plumbing">Plumbing</option>
                <option value="Electrical">Electrical</option>
                <option value="Network">Network</option>
                <option value="General">General</option>
              </select>
            </div>

            <div>
              <textarea
                rows="4"
                placeholder="Describe the issue in detail..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all resize-y"
                required
              ></textarea>
            </div>

            <button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-bold tracking-wide shadow-lg shadow-blue-200 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
            >
              Submit Ticket
            </button>
          </form>
        </div>

        {/* Tickets List Card */}
        <div className="bg-white p-8 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 border-l-4 border-l-blue-600">
          {tickets.map(ticket => (
            <div key={ticket.id} className="space-y-3">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-bold text-slate-800">{ticket.title}</h3>
                <span className="px-2.5 py-1 bg-slate-100 text-slate-500 text-xs font-semibold rounded-md uppercase tracking-wider">
                  ({ticket.status})
                </span>
              </div>
              <p className="text-slate-600 leading-relaxed">{ticket.description}</p>
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => handleResolveTicket(ticket.id)}
                  className="px-4 py-2 text-sm font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                >
                  Mark as Resolved
                </button>
                <button 
                  onClick={() => handleDeleteTicket(ticket.id)}
                  className="px-4 py-2 text-sm font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors"
                >
                  Delete Ticket
                </button>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}