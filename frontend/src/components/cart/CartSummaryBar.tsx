import React from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, ChevronRight } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { formatCurrency } from '@/utils/formatters';

export const CartSummaryBar: React.FC = () => {
  const { totalItemCount, subtotal } = useCart();

  return (
    <AnimatePresence>
      {totalItemCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-30 w-[88%] max-w-sm"
        >
          <Link
            to="/cart"
            className="glass-panel rounded-full px-4 py-2.5 flex items-center justify-between shadow-float border border-white/80 transition active:scale-[0.99] group text-slate-900"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center shrink-0 shadow-sm">
                <ShoppingBag className="w-4 h-4 text-white" />
              </div>
              <div>
                <span className="text-xs font-black block leading-tight text-slate-900">
                  {totalItemCount} {totalItemCount === 1 ? 'Dish' : 'Dishes'} in Basket
                </span>
                <span className="text-[11px] text-slate-500 font-bold leading-none">
                  {formatCurrency(subtotal)}
                </span>
              </div>
            </div>

            <motion.div
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-1 text-xs font-extrabold uppercase tracking-wide bg-black text-white px-3.5 py-1.5 rounded-full shadow-xs"
            >
              <span>View Basket</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </motion.div>
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
