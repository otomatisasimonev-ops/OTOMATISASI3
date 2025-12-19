import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import SmtpModal from './SmtpModal';

const Layout = () => {
  const [showSmtpModal, setShowSmtpModal] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col ml-64">
        <Navbar onOpenSmtp={() => setShowSmtpModal(true)} />
        <main className="flex-1 px-8 py-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      <SmtpModal open={showSmtpModal} onClose={() => setShowSmtpModal(false)} />
    </div>
  );
};

export default Layout;
