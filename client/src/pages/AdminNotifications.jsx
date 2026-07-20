import { useState } from 'react';
import toast from 'react-hot-toast';

export default function AdminNotifications() {
  const [sendTo, setSendTo] = useState('all');
  const [selectedResident, setSelectedResident] = useState('');
  const [notificationTitle, setNotificationTitle] = useState('');
  const [message, setMessage] = useState('');

  // Dummy data simulating MongoDB fetch
  const recentNotifications = [
    {
      id: 1,
      title: 'Water Supply Maintenance',
      target: 'All Residents',
      date: '20/07/2026',
      message: 'Water supply will be interrupted between 2 PM and 4 PM.',
    }
  ];

  const handleSendNotification = (e) => {
    e.preventDefault();
    
    // Simulating the Axios post to our future Twilio/Express backend
    console.log({ sendTo, selectedResident, notificationTitle, message });
    
    // Interactive success feedback using react-hot-toast
    toast.success('WhatsApp Notification queued for delivery!');
    
    // Clear form
    setNotificationTitle('');
    setMessage('');
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12 flex flex-wrap gap-8 font-sans justify-center">
      
      {/* LEFT COLUMN: Compose Notification */}
      <div className="flex-1 min-w-[320px] max-w-[600px] bg-white p-8 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
        <h2 className="text-2xl font-bold text-slate-800 mb-6 tracking-tight">Create Notification</h2>
        
        <form onSubmit={handleSendNotification} className="space-y-6">
          
          {/* Send To Toggle */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-3">Send To</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setSendTo('all')}
                className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  sendTo === 'all' 
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Residents
              </button>
              <button
                type="button"
                onClick={() => setSendTo('specific')}
                className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  sendTo === 'specific' 
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Specific Resident
              </button>
            </div>
          </div>

          {/* Conditional Dropdown */}
          {sendTo === 'specific' && (
            <div className="animate-fade-in-down">
              <label className="block text-sm font-medium text-slate-600 mb-2">Select Resident</label>
              <select 
                value={selectedResident}
                onChange={(e) => setSelectedResident(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all cursor-pointer"
                required
              >
                <option value="">Choose a resident...</option>
                <option value="flat_101">Flat 101 - John Doe</option>
                <option value="flat_102">Flat 102 - Jane Smith</option>
              </select>
            </div>
          )}

          {/* Title Input */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">Notification Title</label>
            <input
              type="text"
              placeholder="e.g., Emergency Maintenance"
              value={notificationTitle}
              onChange={(e) => setNotificationTitle(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
              required
            />
          </div>

          {/* Message Textarea */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">Message</label>
            <textarea
              rows="4"
              placeholder="Type the detailed alert here..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all resize-y"
              required
            ></textarea>
          </div>

          {/* Submit Button */}
          <button 
            type="submit" 
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-xl font-bold tracking-wide shadow-lg shadow-indigo-200 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
          >
            Send via WhatsApp
          </button>
        </form>
      </div>

      {/* RIGHT COLUMN: Recent Notifications */}
      <div className="flex-1 min-w-[320px] max-w-[500px] bg-white p-8 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 h-fit">
        <h2 className="text-xl font-bold text-slate-800 mb-1 tracking-tight">Recent Dispatches</h2>
        <p className="text-sm text-slate-500 mb-6">Log of previously sent alerts.</p>
        
        <div className="space-y-4">
          {recentNotifications.map((note) => (
            <div 
              key={note.id} 
              className="group p-5 border border-slate-100 bg-slate-50/50 rounded-2xl hover:bg-white hover:border-indigo-100 hover:shadow-lg hover:shadow-indigo-500/5 transition-all duration-300"
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-semibold text-slate-800 text-base">{note.title}</h3>
                <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded-md">{note.date}</span>
              </div>
              <div className="inline-block mb-3 px-2.5 py-1 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-md uppercase tracking-wider">
                {note.target}
              </div>
              <p className="text-sm text-slate-600 leading-relaxed mb-4">{note.message}</p>
              
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <button className="px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors">Edit</button>
                <button className="px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors">Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}