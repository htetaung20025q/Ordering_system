import React from 'react';
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Utensils, Receipt, ShoppingBag } from 'lucide-react';
import clsx from 'clsx';
import { useCart } from '@/contexts/CartContext';
import { useOrder } from '@/contexts/OrderContext';

export const BottomNav: React.FC = () => {
  const { totalItemCount } = useCart();
  const { activeOrder } = useOrder();

  const navItems = [
    {
      to: '/',
      label: 'Menu',
      icon: Utensils,
      badge: null,
      indicator: false,
    },
    {
      to: '/orders',
      label: 'Orders',
      icon: Receipt,
      badge: null,
      indicator: !!activeOrder && !['completed', 'picked_up', 'cancelled'].includes(activeOrder.status),
    },
    {
      to: '/cart',
      label: 'Basket',
      icon: ShoppingBag,
      badge: totalItemCount > 0 ? totalItemCount : null,
      indicator: false,
    },
  ];

  return (
    <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[88%] max-w-sm glass-nav rounded-full px-3 py-2 flex items-center justify-around shadow-float border border-white/80">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className="relative flex items-center justify-center py-2 px-4 rounded-full select-none group"
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.div
                    layoutId="customerActiveDockPill"
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
                  <div className="relative">
                    <Icon className={clsx('w-4 h-4 transition-transform', isActive && 'scale-105')} />
                    {item.indicator && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    )}
                    {item.badge !== null && (
                      <span
                        className={clsx(
                          'absolute -top-2 -right-3 min-w-[17px] h-[17px] px-1 rounded-full text-[9px] font-black flex items-center justify-center border shadow-xs',
                          isActive ? 'bg-white text-black border-black' : 'bg-black text-white border-white'
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-bold tracking-tight">{item.label}</span>
                </motion.div>
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
};
