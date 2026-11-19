import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Minus, ShoppingBag, Sparkles, Star, Clock, Flame } from 'lucide-react';
import { Product } from '@/types';
import { fetchProductById } from '@/services/api/menu';
import { Button } from '@/components/common/Button';
import { formatCurrency } from '@/utils/formatters';
import { getFoodImage } from '@/utils/foodImages';
import { useCart } from '@/contexts/CartContext';

export const FoodDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [portionSize, setPortionSize] = useState<'Standard' | 'Medium' | 'Large'>('Standard');
  const [specialNote, setSpecialNote] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    fetchProductById(parseInt(id, 10))
      .then((data) => setProduct(data))
      .catch((err) => console.error(err))
      .finally(() => setIsLoading(false));
  }, [id]);

  if (isLoading) {
    return (
      <div className="py-20 text-center text-slate-500">
        <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs">Loading culinary details...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="py-20 text-center text-slate-500 space-y-3">
        <h3 className="text-base font-bold text-slate-900">Dish Not Found</h3>
        <Button variant="secondary" size="sm" onClick={() => navigate('/')}>
          Back to Menu
        </Button>
      </div>
    );
  }

  const imageUrl = getFoodImage(product.name, undefined, product.image_url);
  const numericPrice = typeof product.price === 'string' ? parseFloat(product.price) : product.price;
  const totalPrice = (numericPrice || 0) * quantity;

  const handleAddToCart = () => {
    const noteWithPortion = portionSize !== 'Standard'
      ? `Portion: ${portionSize}${specialNote ? ` • ${specialNote.trim()}` : ''}`
      : specialNote.trim() || undefined;

    addToCart(product, quantity, noteWithPortion);
    navigate('/cart');
  };

  return (
    <div className="space-y-4 pb-8">
      {/* Top Bar with Back Action */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-black bg-white hover:bg-slate-100 px-3.5 py-1.5 rounded-full border border-slate-200 transition shadow-xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
        <span className="px-3 py-1 rounded-full bg-black text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
          <Sparkles className="w-2.5 h-2.5" /> Chef Special
        </span>
      </div>

      {/* Hero Plate Image */}
      <div className="relative w-full aspect-[4/3] rounded-3xl overflow-hidden bg-slate-50 border border-slate-100 shadow-md">
        <img src={imageUrl} alt={product.name} className="w-full h-full object-cover" />
      </div>

      {/* Title & Price */}
      <div className="flex items-start justify-between gap-3 pt-1">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">{product.name}</h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/70 text-[11px] font-bold flex items-center gap-1">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> 4.9 (150+ Reviews)
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-500" /> 15-20 min
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold flex items-center gap-1">
              <Flame className="w-3 h-3 text-slate-500" /> Station: {product.station}
            </span>
          </div>
        </div>
        <span className="text-2xl font-black text-slate-900 shrink-0">
          {formatCurrency(product.price)}
        </span>
      </div>

      {/* Quick Choices (Pill Chips) */}
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

      {/* Description */}
      {product.description && (
        <div className="bg-white rounded-3xl p-4 border border-slate-100 shadow-xs space-y-1">
          <h4 className="text-[11px] font-black uppercase text-slate-500 tracking-wider">Description</h4>
          <p className="text-xs text-slate-700 leading-relaxed">{product.description}</p>
        </div>
      )}

      {/* Special Request */}
      <div className="space-y-2">
        <label className="block text-xs font-bold text-slate-800">
          Special Instructions for Chef
        </label>

        {/* Quick-tap instruction chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { label: '🌶️ No Spicy', value: 'No spicy' },
            { label: '🧅 No Onions', value: 'No onions' },
            { label: '🧂 Less Salt', value: 'Less salt' },
            { label: '🥣 Sauce on Side', value: 'Sauce on side' },
            { label: '🔥 Extra Spicy', value: 'Extra spicy' },
          ].map((chip) => {
            const isSelected = specialNote.includes(chip.value);
            return (
              <button
                key={chip.value}
                type="button"
                onClick={() => {
                  if (isSelected) {
                    setSpecialNote((prev) =>
                      prev
                        .replace(chip.value, '')
                        .replace(/,\s*,/g, ',')
                        .replace(/^,\s*|,\s*$/g, '')
                        .trim()
                    );
                  } else {
                    setSpecialNote((prev) => (prev ? `${prev}, ${chip.value}` : chip.value));
                  }
                }}
                className={`px-3 py-1 rounded-full text-xs font-bold transition select-none ${
                  isSelected
                    ? 'bg-black text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 shadow-2xs'
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        <input
          type="text"
          value={specialNote}
          onChange={(e) => setSpecialNote(e.target.value)}
          placeholder="e.g. No spicy, sauce on side, well done..."
          className="w-full px-4 py-2.5 rounded-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:border-black transition shadow-2xs"
        />
      </div>

      {/* Stepper & Action Button (Dual Pill CTA) */}
      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 bg-slate-100 rounded-full px-3 py-1.5 border border-slate-200/60 shadow-2xs">
          <button
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="w-8 h-8 rounded-full bg-white hover:bg-slate-200 text-slate-800 flex items-center justify-center transition active:scale-90 shadow-2xs"
            aria-label="Decrease quantity"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <span className="text-sm font-black text-slate-900 min-w-[20px] text-center">{quantity}</span>
          <button
            onClick={() => setQuantity((q) => q + 1)}
            className="w-8 h-8 rounded-full bg-black hover:bg-slate-800 text-white flex items-center justify-center transition active:scale-90 shadow-2xs"
            aria-label="Increase quantity"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

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
  );
};
