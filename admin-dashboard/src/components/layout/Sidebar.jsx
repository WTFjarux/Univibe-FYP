import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FileText, MessageSquare, Users,
  Calendar, Flag, ScrollText, Settings, LogOut, Shield, ChevronLeft,
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import api from '../../api/axios';

const menuItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/posts', icon: FileText, label: 'Posts' },
  { path: '/comments', icon: MessageSquare, label: 'Comments' },
  { path: '/users', icon: Users, label: 'Users' },
  { path: '/events', icon: Calendar, label: 'Events' },
  { path: '/reports', icon: Flag, label: 'Reports' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

function Sidebar({ isOpen, onToggle }) {
  const navigate = useNavigate();
  const admin = useAuthStore((state) => state.admin);   
  const logout = useAuthStore((state) => state.logout); 

  const handleLogout = async () => {
    try {
      await api.post('/api/admin/auth/logout');
    } catch (err) {
      // ignore
    }
    logout();
    navigate('/login');
  };

  return (
    <div className="flex flex-col border-r transition-all duration-300"
      style={{ width: isOpen ? '260px' : '72px', backgroundColor: '#ffffff', borderColor: '#e5e7eb' }}>
      
      {/* Logo */}
      <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: '#f3f4f6' }}>
        {isOpen && (
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6" style={{ color: '#8b5cf6' }} />
            <span className="text-lg tracking-wide" style={{ fontFamily: 'Sofia, serif', color: '#111827' }}>UNIVIBE</span>
          </div>
        )}
        <button onClick={onToggle} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <ChevronLeft className={`w-5 h-5 transition-transform ${!isOpen ? 'rotate-180' : ''}`} style={{ color: '#6b7280' }} />
        </button>
      </div>

      {/* User Info */}
      {isOpen && (
        <div className="px-5 py-4 border-b" style={{ borderColor: '#f3f4f6' }}>
          <p className="text-xs" style={{ color: '#9ca3af', fontFamily: 'Sofia Sans', fontWeight: 500 }}>LOGGED IN AS</p>
          <p className="text-sm mt-1" style={{ color: '#111827', fontFamily: 'Sofia Sans', fontWeight: 600 }}>
            {admin?.name || 'Admin'}
          </p>
          <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs"
            style={{ backgroundColor: '#f3e8ff', color: '#8b5cf6', fontFamily: 'Sofia Sans', fontWeight: 600 }}>
            {admin?.role || 'admin'}
          </span>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3">
        {menuItems.map((item) => (
          <NavLink key={item.path} to={item.path}
            className={({ isActive }) => `flex items-center gap-3 px-3 py-3 rounded-xl mb-1 transition-all duration-200 ${isActive ? '' : 'hover:bg-gray-50'}`}
            style={({ isActive }) => ({
              backgroundColor: isActive ? '#f3e8ff' : 'transparent',
              color: isActive ? '#8b5cf6' : '#4b5563',
              fontFamily: 'Sofia Sans', fontWeight: isActive ? 600 : 400,
            })}>
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {isOpen && <span className="text-sm">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t" style={{ borderColor: '#f3f4f6' }}>
        <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-3 rounded-xl w-full hover:bg-red-50 transition-colors">
          <LogOut className="w-5 h-5 flex-shrink-0" style={{ color: '#ef4444' }} />
          {isOpen && <span className="text-sm" style={{ color: '#ef4444', fontFamily: 'Sofia Sans', fontWeight: 500 }}>Logout</span>}
        </button>
      </div>
    </div>
  );
}

export default Sidebar;