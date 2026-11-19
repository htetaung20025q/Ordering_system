import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { MobileHeader } from '@/components/navigation/MobileHeader';
import { BottomNav } from '@/components/navigation/BottomNav';
import { CartSummaryBar } from '@/components/cart/CartSummaryBar';
import { PageTransition } from '@/components/common/PageTransition';

export const CustomerLayout: React.FC = () => {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-[#f8f9fb] text-slate-900 flex flex-col justify-between selection:bg-black selection:text-white">
      {/* Centered Mobile App Shell (Clean White & Black Glassmorphic Experience) */}
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col relative pb-32">
        <MobileHeader />
        <main className="flex-1 px-4 py-3">
          <AnimatePresence mode="wait">
            <PageTransition key={location.pathname}>
              <Outlet />
            </PageTransition>
          </AnimatePresence>
        </main>
        <CartSummaryBar />
        <BottomNav />
      </div>
    </div>
  );
};
