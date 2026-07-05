import { Outlet, useLocation } from 'react-router-dom';
import { useState } from 'react';
import Sidebar from './Sidebar.jsx';
import BottomNav from './BottomNav.jsx';
import MobileHeader from './MobileHeader.jsx';
import SectionErrorBoundary from './SectionErrorBoundary.jsx';

export default function Layout({ admin, onLogout }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar
        admin={admin}
        onLogout={onLogout}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />
      <div className="min-w-0 flex-1 flex flex-col overflow-hidden">
        <MobileHeader admin={admin} onLogout={onLogout} onOpenMenu={() => setMobileMenuOpen(true)} />
        <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden pb-16 lg:pb-0">
          <SectionErrorBoundary resetKey={`${location.pathname}${location.search}`}>
            <Outlet />
          </SectionErrorBoundary>
        </main>
      </div>
      <BottomNav admin={admin} />
    </div>
  );
}
