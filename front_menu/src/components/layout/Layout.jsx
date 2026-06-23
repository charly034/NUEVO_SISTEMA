import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import BottomNav from './BottomNav.jsx';

export default function Layout({ admin, onLogout }) {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar admin={admin} onLogout={onLogout} />
      <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
        <div className="md:hidden flex justify-end px-4 pt-3">
          <button onClick={onLogout} className="text-xs text-gray-500">Cerrar sesión</button>
        </div>
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
