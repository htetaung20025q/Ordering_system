import React, { useState } from 'react';
import { Plus, Minus, ShoppingBag, Sparkles, Star, Clock, Flame } from 'lucide-react';
import { Product } from '@/types';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { formatCurrency } from '@/utils/formatters';
import { getFoodImage } from '@/utils/foodImages';
import { useCart } from '@/contexts/CartContext';

interface FoodDetailModalProps {
  product: Product | null;
  categoryName?: string;
  isOpen: boolean;
  onClose: () => void;
}

export const FoodDetailModal: React.FC<FoodDetailModalProps> = ({
  product,
  categoryName,
  isOpen,
  onClose,
}) => {
  const { addToCart } = useCart();
  const [quantity, setQuantity] = useState<number>(1);
  const [portionSize, setPortionSize] = useState<'Standard' | 'Medium' | 'Large'>('Standard');
  const [specialNote, setSpecialNote] = useState<string>('');

  if (!product) return null;

  const imageUrl = getFoodImage(product.name, categoryName, product.image_url);
  const numericPrice = typeof product.price === 'string' ? parseFloat(product.price) : product.price;
  const totalPrice = (numericPrice || 0) * quantity;

  const handleAddToCart = () => {
    const noteWithPortion = portionSize !== 'Standard' 
      ? `Portion: ${portionSize}${specialNote ? ` • ${specialNote.trim()}` : ''}`
      : specialNote.trim() || undefined;
    
    addToCart(product, quantity, noteWithPortion);
    setQuantity(1);
    setSpecialNote('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="md">
      <div className="space-y-4">
        {/* Plate Hero Image with Soft Glow */}
        <div className="relative w-full aspect-[16/10] rounded-3xl overflow-hidden bg-slate-50 border border-slate-100 shadow-md">
          <img
            src={imageUrl}
            alt={product.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute top-3 left-3">
            <span className="px-3 py-1 rounded-full bg-white/90 backdrop-blur-md text-slate-900 border border-slate-200/80 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-xs">
              <Sparkles className="w-2.5 h-2.5 text-black" /> Chef Special
            </span>
          </div>
        </div>

        {/* Title, Rating & Price (Matching Middle Screen) */}
        <div>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              {product.name}
            </h2>
            <span className="text-xl font-black text-slate-900">
              {formatCurrency(product.price)}
            </span>
          </div>

          {/* Metadata Badges: Rating, Prep Time, Station */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/70 text-[11px] font-bold flex items-center gap-1">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> 4.9 (150+ Reviews)
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-500" /> 15-20 min
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold flex items-center gap-1">
              <Flame className="w-3 h-3 text-slate-500" /> Fresh Cooked
            </span>
          </div>
        </div>

        {/* Quick Choices (Pill Chips inspired by reference image) */}
        <div className="space-y-1.5 pt-1">
          <span className="text-xs font-bold text-slate-700 block">Try these quick choices:</span>
          <div className="flex items-center gap-2">
            {(['Standard', 'Medium', 'Large'] as const).map((choice) => (
              <button
                key={choice}
                onClick={() => setPortionSize(choice)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition select-none ${
                  portionSize === choice
                    ? 'bg-black text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {choice}
              </button>
            ))}
          </div>
        </div>

        {/* Description Card */}
        {product.description && (
          <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100 space-y-1">
            <h4 className="text-[11px] uppercase font-bold text-slate-500 tracking-wider">Description</h4>
            <p className="text-xs text-slate-700 leading-relaxed">
              {product.description}
            </p>
          </div>
        )}

        {/* Special Instructions for Kitchen */}
        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1.5">
            Special Instructions for Kitchen (Optional)
          </label>
          <input
            type="text"
            value={specialNote}
            onChange={(e) => setSpecialNote(e.target.value)}
            placeholder="e.g. Less spicy, sauce on the side, extra ice..."
            className="w-full px-4 py-2.5 rounded-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:border-black transition shadow-2xs"
          />
        </div>

        {/* Quantity Controls & Dual CTA Action (Matching Photo) */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
          {/* Capsule Stepper */}
          <div className="flex items-center gap-3 bg-slate-100 rounded-full px-3 py-1.5 border border-slate-200/60 shadow-2xs">
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="w-8 h-8 rounded-full bg-white hover:bg-slate-200 text-slate-800 flex items-center justify-center transition active:scale-90 shadow-2xs"
              aria-label="Decrease quantity"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="text-sm font-black text-slate-900 min-w-[20px] text-center">
              {quantity}
            </span>
            <button
              onClick={() => setQuantity((q) => q + 1)}
              className="w-8 h-8 rounded-full bg-black hover:bg-slate-800 text-white flex items-center justify-center transition active:scale-90 shadow-2xs"
              aria-label="Increase quantity"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Add to Basket Action */}
          <Button
            onClick={handleAddToCart}
            variant="primary"
            size="lg"
            className="flex-1"
            leftIcon={<ShoppingBag className="w-4 h-4" />}
          >
            Add to Basket • {formatCurrency(totalPrice)}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
