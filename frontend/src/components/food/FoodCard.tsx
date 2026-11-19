import React from 'react';
import { motion } from 'framer-motion';
import { Plus, Minus } from 'lucide-react';
import { Product } from '@/types';
import { formatCurrency } from '@/utils/formatters';
import { getFoodImage } from '@/utils/foodImages';
import { useCart } from '@/contexts/CartContext';

interface FoodCardProps {
  product: Product;
  categoryName?: string;
  onOpenDetail: (product: Product) => void;
}

export const FoodCard: React.FC<FoodCardProps> = ({
  product,
  categoryName,
  onOpenDetail,
}) => {
  const { getItemQuantity, updateQuantity, addToCart } = useCart();
  const quantity = getItemQuantity(product.id);
  const imageUrl = getFoodImage(product.name, categoryName, product.image_url);

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    addToCart(product, 1);
  };

  const handleMinus = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateQuantity(product.id, -1);
  };

  const handlePlus = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateQuantity(product.id, 1);
  };

  return (
    <motion.div
      layout
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onOpenDetail(product)}
      className="bg-white rounded-3xl p-3 flex flex-col justify-between cursor-pointer select-none group border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-200"
    >
      <div>
        {/* Food Plate Hero Image (Aspect 4:3, rounded-2xl) */}
        <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-slate-50 mb-2.5 shadow-2xs">
          <img
            src={imageUrl}
            alt={product.name}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          {!product.is_available && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex items-center justify-center">
              <span className="text-[10px] font-black uppercase tracking-wider text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                Sold Out
              </span>
            </div>
          )}
        </div>

        {/* Title & Description */}
        <h4 className="font-extrabold text-sm text-slate-900 line-clamp-1 group-hover:text-black transition">
          {product.name}
        </h4>
        {product.description && (
          <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-snug">
            {product.description}
          </p>
        )}
      </div>

      {/* Price & Action */}
      <div className="flex items-center justify-between pt-3 mt-1 border-t border-slate-100">
        <span className="font-black text-sm text-slate-900">
          {formatCurrency(product.price)}
        </span>

        {product.is_available && (
          <div>
            {quantity > 0 ? (
              <div
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 bg-slate-100 rounded-full px-2 py-0.5 border border-slate-200/60 shadow-2xs"
              >
                <motion.button
                  whileTap={{ scale: 0.85 }}
                  onClick={handleMinus}
                  className="w-5 h-5 rounded-full bg-white hover:bg-slate-200 text-slate-700 flex items-center justify-center transition shadow-2xs"
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-3 h-3" />
                </motion.button>
                <span className="font-mono text-xs font-black text-slate-900 min-w-[12px] text-center">
                  {quantity}
                </span>
                <motion.button
                  whileTap={{ scale: 0.85 }}
                  onClick={handlePlus}
                  className="w-5 h-5 rounded-full bg-black text-white hover:bg-slate-800 flex items-center justify-center transition shadow-2xs"
                  aria-label="Increase quantity"
                >
                  <Plus className="w-3 h-3 text-white" />
                </motion.button>
              </div>
            ) : (
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleAdd}
                className="w-7 h-7 rounded-full bg-black text-white hover:bg-slate-800 flex items-center justify-center transition shadow-md shadow-black/10 group/btn"
                aria-label={`Add ${product.name} to cart`}
              >
                <Plus className="w-3.5 h-3.5 group-hover/btn:scale-110 transition-transform" />
              </motion.button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};
