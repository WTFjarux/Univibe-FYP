import { Menu, Bell, Search } from 'lucide-react';
import useAuthStore from '../../store/authStore';

function Header({ onMenuClick }) {
  const admin = useAuthStore((state) => state.admin); 

  return (
    <header
      className="flex items-center justify-between px-6 py-4 border-b"
      style={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb' }}
    >
      <div className="flex items-center gap-4">
        <button onClick={onMenuClick} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <Menu className="w-5 h-5" style={{ color: '#374151' }} />
        </button>
        <div>
          <h1 className="text-xl" style={{ fontFamily: 'Sofia Sans', fontWeight: 700, color: '#111827' }}>
            Admin Panel
          </h1>
          <p className="text-xs" style={{ fontFamily: 'Sofia Sans', color: '#6b7280' }}>
            Manage your platform
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full border" style={{ borderColor: '#e5e7eb', backgroundColor: '#f9fafb' }}>
          <Search className="w-4 h-4" style={{ color: '#9ca3af' }} />
          <input type="text" placeholder="Search..." className="bg-transparent outline-none text-sm w-40" style={{ fontFamily: 'Sofia Sans', color: '#111827' }} />
        </div>
        <button className="relative p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <Bell className="w-5 h-5" style={{ color: '#374151' }} />
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full" style={{ backgroundColor: '#ef4444' }} />
        </button>
        <div className="flex items-center gap-3 pl-3 border-l" style={{ borderColor: '#e5e7eb' }}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: '#8b5cf6' }}>
            <span className="text-white text-sm" style={{ fontFamily: 'Sofia Sans', fontWeight: 700 }}>
              {admin?.name?.charAt(0) || 'A'}
            </span>
          </div>
          <div className="hidden sm:block">
            <p className="text-sm" style={{ fontFamily: 'Sofia Sans', fontWeight: 600, color: '#111827' }}>
              {admin?.name || 'Admin'}
            </p>
            <p className="text-xs" style={{ fontFamily: 'Sofia Sans', color: '#6b7280' }}>
              {admin?.role || 'admin'}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;