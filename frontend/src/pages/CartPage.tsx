import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShoppingBag, ArrowLeft, ArrowRight, Utensils, Sparkles } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { useTable } from '@/contexts/TableContext';
import { CartItemList } from '@/components/cart/CartItemList';
import { Button } from '@/components/common/Button';
import { formatCurrency, calculateBill } from '@/utils/formatters';

export const CartPage: React.FC = () => {
  const navigate = useNavigate();
  const { cart, updateQuantity, removeFromCart, subtotal, totalItemCount } = useCart();
  const { table } = useTable();
  const [generalNotes, setGeneralNotes] = useState<string>('');

  const bill = calculateBill(subtotal);

  if (cart.length === 0) {
    return (
      <div className="py-20 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto shadow-inner">
          <ShoppingBag className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-lg font-black text-slate-900">Your Basket is Empty</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
            Explore our artisan dishes, burgers, and chilled drinks to get started.
          </p>
        </div>
        <Link to="/">
          <Button variant="primary" size="md" leftIcon={<Utensils className="w-4 h-4" />}>
            Browse Restaurant Menu
          </Button>
        </Link>
      </div>
    );
  }

  const handleProceedToCheckout = () => {
    sessionStorage.setItem('flowsys_order_notes', generalNotes);
    navigate('/checkout');
  };

  return (
    <div className="space-y-4 pb-8">
      {/* Header with Back to Menu */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-black bg-white hover:bg-slate-50 px-3.5 py-1.5 rounded-full border border-slate-200 transition shadow-2xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Add More Dishes</span>
        </button>

        <span className="text-xs font-extrabold text-slate-900 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-2xs flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-black" />
          {table ? table.table_number : 'Dine-In Table'}
        </span>
      </div>

      <div className="flex items-center justify-between pt-1">
        <h2 className="text-xl font-black text-slate-900 tracking-tight">Shopping Basket</h2>
        <span className="text-xs font-bold text-slate-500">
          {totalItemCount} {totalItemCount === 1 ? 'dish' : 'dishes'}
        </span>
      </div>

      {/* Cart Items List */}
      <CartItemList
        items={cart}
        onUpdateQuantity={updateQuantity}
        onRemoveItem={removeFromCart}
      />

      {/* Dining Instructions Pill Container */}
      <div className="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm space-y-1.5">
        <label className="block text-[11px] font-black uppercase text-slate-500 tracking-wider">
          Dining Instructions for Kitchen
        </label>
        <textarea
          rows={2}
          value={generalNotes}
          onChange={(e) => setGeneralNotes(e.target.value)}
          placeholder="e.g. Please serve drinks first, extra napkins, serve hot..."
          className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:border-black transition resize-none"
        />
      </div>

      {/* Order Summary Breakdown (Matching Right Screen in Photo) */}
      <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-3">
        <h4 className="text-xs font-black uppercase text-slate-900 tracking-wider">
          Order Summary
        </h4>
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between text-slate-600">
            <span>Subtotals for products</span>
            <span className="font-bold text-slate-900">{formatCurrency(bill.subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-slate-500">
            <span>Commercial Tax (5%)</span>
            <span className="font-bold text-slate-700">{formatCurrency(bill.tax)}</span>
          </div>
          <div className="flex items-center justify-between text-slate-500">
            <span>Dining Service Fee (10%)</span>
            <span className="font-bold text-slate-700">{formatCurrency(bill.service)}</span>
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-sm font-black text-slate-900">
            <span>Total</span>
            <span className="text-lg font-black text-slate-900">{formatCurrency(bill.total)}</span>
          </div>
        </div>
      </div>

      {/* Checkout Full-width Black Pill Action Button */}
      <Button
        onClick={handleProceedToCheckout}
        variant="primary"
        size="lg"
        rightIcon={<ArrowRight className="w-4 h-4" />}
        className="w-full shadow-lg shadow-black/10"
      >
        Checkout • {formatCurrency(bill.total)}
      </Button>
    </div>
  );
};
