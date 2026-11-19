import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChefHat, Clock, Maximize, Minimize, LogOut, CheckCircle2, History, Volume2, VolumeX } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { PageTransition } from '@/components/common/PageTransition';
import clsx from 'clsx';

export const KitchenLayout: React.FC = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [time, setTime] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/kitchen/login');
  };

  const navItems = [
    { to: '/kitchen', end: true, label: 'Active Orders', icon: CheckCircle2 },
    { to: '/kitchen/history', end: false, label: 'Completed Orders', icon: History },
  ];

  return (
    <div className="min-h-screen bg-[#f8f9fb] text-slate-900 flex flex-col font-sans selection:bg-black selection:text-white pb-28">
      {/* Top Glass Header (Identical Customer UI Aesthetic) */}
      <header className="sticky top-0 z-40 w-full glass-header px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-black text-white flex items-center justify-center shadow-md shadow-black/10">
            <ChefHat className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm tracking-tight text-slate-900">FLOW-SYS</span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 bg-black text-white rounded-md uppercase tracking-wider">
                Kitchen
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-medium leading-none">Chief KDS Display</p>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2">
          {/* Live Shift Clock */}
          <div className="px-3 py-1 rounded-full bg-white border border-slate-200/80 shadow-xs flex items-center gap-1.5 text-xs font-mono font-bold text-slate-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{time}</span>
          </div>

          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-full bg-white hover:bg-slate-100 border border-slate-200/80 text-slate-600 hover:text-black transition shadow-xs"
            title={soundEnabled ? 'Mute Audio Alerts' : 'Unmute Audio Alerts'}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-full bg-white hover:bg-slate-100 border border-slate-200/80 text-slate-600 hover:text-black transition shadow-xs"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>

          {/* User & Sign Out */}
          <button
            onClick={handleLogout}
            className="p-2 rounded-full bg-white hover:bg-red-50 border border-slate-200/80 text-slate-600 hover:text-red-600 transition shadow-xs"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main KDS Workspace with Page Transitions */}
      <main className="flex-1 p-4 lg:p-6 max-w-7xl mx-auto w-full">
        <AnimatePresence mode="wait">
          <PageTransition key={location.pathname}>
            <Outlet />
          </PageTransition>
        </AnimatePresence>
      </main>

      {/* Floating Bottom Navigation Dock with Sliding Glider */}
      <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[88%] max-w-sm glass-nav rounded-full px-3 py-2 flex items-center justify-around shadow-float border border-white/80">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className="relative flex items-center justify-center py-2 px-5 rounded-full select-none group"
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.div
                      layoutId="kitchenActiveDockPill"
                      transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                      className="absolute inset-0 bg-black rounded-full shadow-sm"
                    />
                  )}
                  <motion.div
                    whileTap={{ scale: 0.94 }}
                    className={clsx(
                      'relative z-10 flex items-center gap-2 transition-colors duration-150',
                      isActive ? 'text-white' : 'text-slate-500 hover:text-black font-semibold'
                    )}
                  >
                    <Icon className={clsx('w-4 h-4 transition-transform', isActive && 'scale-105')} />
                    <span className="text-xs font-bold tracking-tight">{item.label}</span>
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
