import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, Trash2 } from 'lucide-react';
import { CartItem } from '@/types';
import { formatCurrency } from '@/utils/formatters';
import { getFoodImage } from '@/utils/foodImages';

interface CartItemListProps {
  items: CartItem[];
  onUpdateQuantity: (productId: number, delta: number) => void;
  onRemoveItem: (productId: number) => void;
}

export const CartItemList: React.FC<CartItemListProps> = ({
  items,
  onUpdateQuantity,
  onRemoveItem,
}) => {
  return (
    <div className="space-y-3">
      <AnimatePresence mode="popLayout">
        {items.map((item) => {
          const imageUrl = getFoodImage(item.product.name, undefined, item.product.image_url);
          const itemPrice = typeof item.product.price === 'string' ? parseFloat(item.product.price) : item.product.price;
          const lineTotal = (itemPrice || 0) * item.quantity;

          return (
            <motion.div
              key={item.product.id}
              layout
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.18 } }}
              transition={{ type: 'spring', stiffness: 450, damping: 32 }}
              className="bg-white rounded-3xl p-3.5 flex items-center gap-3.5 border border-slate-100 shadow-sm"
            >
              {/* Thumbnail */}
              <div className="w-16 h-16 rounded-2xl overflow-hidden bg-slate-50 shrink-0 border border-slate-100 shadow-2xs">
                <img
                  src={imageUrl}
                  alt={item.product.name}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Title & Price */}
              <div className="flex-1 min-w-0">
                <h4 className="font-extrabold text-sm text-slate-900 truncate">
                  {item.product.name}
                </h4>
                <p className="text-xs font-black text-slate-900 mt-0.5">
                  {formatCurrency(lineTotal)}
                </p>
                {item.special_instructions && (
                  <span className="inline-block text-[10px] text-slate-500 italic bg-slate-50 px-2 py-0.5 rounded-md mt-1 truncate max-w-full border border-slate-100">
                    {item.special_instructions}
                  </span>
                )}
              </div>

              {/* Quantity Stepper & Remove Action */}
              <div className="flex items-center gap-2.5 shrink-0">
                <div className="flex items-center gap-1.5 bg-slate-100 rounded-full px-2 py-1 border border-slate-200/60 shadow-2xs">
                  <motion.button
                    whileTap={{ scale: 0.88 }}
                    onClick={() => onUpdateQuantity(item.product.id, -1)}
                    className="w-6 h-6 rounded-full bg-white hover:bg-slate-200 text-slate-700 flex items-center justify-center transition shadow-2xs"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="w-3 h-3" />
                  </motion.button>
                  <span className="text-xs font-black text-slate-900 min-w-[16px] text-center">
                    {item.quantity}
                  </span>
                  <motion.button
                    whileTap={{ scale: 0.88 }}
                    onClick={() => onUpdateQuantity(item.product.id, 1)}
                    className="w-6 h-6 rounded-full bg-black hover:bg-slate-800 text-white flex items-center justify-center transition shadow-2xs"
                    aria-label="Increase quantity"
                  >
                    <Plus className="w-3 h-3" />
                  </motion.button>
                </div>

                <motion.button
                  whileTap={{ scale: 0.88 }}
                  onClick={() => onRemoveItem(item.product.id)}
                  className="w-8 h-8 rounded-full bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition border border-red-100"
                  aria-label="Remove item"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </motion.button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
