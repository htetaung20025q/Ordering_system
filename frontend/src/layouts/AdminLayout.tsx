import React from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  TrendingUp,
  ShoppingBag,
  QrCode,
  UtensilsCrossed,
  Shield,
  LogOut,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { PageTransition } from '@/components/common/PageTransition';
import clsx from 'clsx';

export const AdminLayout: React.FC = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  const navLinks = [
    {
      to: '/admin',
      end: true,
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      to: '/admin/analytics',
      end: false,
      label: 'Analytics',
      icon: TrendingUp,
    },
    {
      to: '/admin/orders',
      end: false,
      label: 'Orders',
      icon: ShoppingBag,
    },
    {
      to: '/admin/tables',
      end: false,
      label: 'Tables & QR',
      icon: QrCode,
    },
    {
      to: '/admin/menu',
      end: false,
      label: 'Menu Catalog',
      icon: UtensilsCrossed,
    },
  ];

  return (
    <div className="min-h-screen bg-[#f8f9fb] text-slate-900 flex flex-col font-sans selection:bg-black selection:text-white pb-28">
      {/* Top Glass Header (Identical Customer UI Aesthetic) */}
      <header className="sticky top-0 z-40 w-full glass-header px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-black text-white flex items-center justify-center shadow-md shadow-black/10">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm tracking-tight text-slate-900">FLOW-SYS</span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 bg-black text-white rounded-md uppercase tracking-wider">
                Admin
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-medium leading-none">Executive Operations Console</p>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2">
          {/* Live Status Pill */}
          <div className="px-3 py-1 rounded-full bg-white border border-slate-200/80 shadow-xs flex items-center gap-1.5 text-xs font-bold text-slate-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="hidden sm:inline text-slate-500 font-normal">System:</span>
            <span>Online</span>
          </div>

          {/* User & Sign Out */}
          <button
            onClick={handleLogout}
            className="p-2 rounded-full bg-white hover:bg-red-50 border border-slate-200/80 text-slate-600 hover:text-red-600 transition shadow-xs flex items-center gap-1"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Admin Workspace with Page Transitions */}
      <main className="flex-1 p-4 lg:p-6 max-w-7xl mx-auto w-full">
        <AnimatePresence mode="wait">
          <PageTransition key={location.pathname}>
            <Outlet />
          </PageTransition>
        </AnimatePresence>
      </main>

      {/* Floating Bottom Navigation Dock with Sliding Glider */}
      <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-lg glass-nav rounded-full px-3 py-2 flex items-center justify-around shadow-float border border-white/80">
        {navLinks.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className="relative flex items-center justify-center py-2 px-3 sm:px-4 rounded-full select-none group"
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.div
                      layoutId="adminActiveDockPill"
                      transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                      className="absolute inset-0 bg-black rounded-full shadow-sm"
                    />
                  )}
                  <motion.div
                    whileTap={{ scale: 0.94 }}
                    className={clsx(
                      'relative z-10 flex items-center gap-1.5 transition-colors duration-150',
                      isActive ? 'text-white' : 'text-slate-500 hover:text-black font-semibold'
                    )}
                  >
                    <Icon className={clsx('w-4 h-4 transition-transform', isActive && 'scale-105')} />
                    <span className="text-xs font-bold tracking-tight hidden sm:inline">{item.label}</span>
                  </motion.div>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};
