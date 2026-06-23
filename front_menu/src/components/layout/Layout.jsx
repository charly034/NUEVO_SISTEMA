import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import BottomNav from './BottomNav.jsx';
import MobileHeader from './MobileHeader.jsx';

export default function Layout({ admin, onLogout }) {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar admin={admin} onLogout={onLogout} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <MobileHeader admin={admin} onLogout={onLogout} />
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
