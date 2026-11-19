import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, AlertCircle, ShieldCheck, CreditCard, Banknote, Sparkles } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { useTable } from '@/contexts/TableContext';
import { useOrder } from '@/contexts/OrderContext';
import { Button } from '@/components/common/Button';
import { formatCurrency, calculateBill } from '@/utils/formatters';
import { checkoutOrder } from '@/services/api/order';

export const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const { cart, subtotal, clearCart } = useCart();
  const { table, qrToken } = useTable();
  const { setActiveOrder } = useOrder();

  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'ewallet'>('cash');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const notesFromSession = sessionStorage.getItem('flowsys_order_notes') || '';
  const bill = calculateBill(subtotal);

  if (cart.length === 0) {
    navigate('/cart');
    return null;
  }

  const handlePlaceOrder = async () => {
    if (isSubmitting) return; // Prevent double submission
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const itemsPayload = cart.map((item) => ({
        product_id: item.product.id,
        quantity: item.quantity,
        special_instructions: item.special_instructions || null,
      }));

      const payload = {
        order_data: {
          order_type: 'dine_in',
          qr_token: qrToken || table?.qr_token || null,
          table_id: table ? table.id : null,
          special_instructions: notesFromSession.trim() || null,
          items: itemsPayload,
        },
        payment_method: paymentMethod,
        simulate_failure: false,
      };

      const response = await checkoutOrder(payload);

      // Order created successfully! Clear cart & session
      clearCart();
      sessionStorage.removeItem('flowsys_order_notes');
      setActiveOrder(response.order);

      // Navigate to Screen 05 (Order Live Tracking)
      navigate(`/orders/${response.order.id}`);
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : 'Order submission failed';
      setErrorMessage(detail);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/cart')}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-black bg-white hover:bg-slate-50 px-3.5 py-1.5 rounded-full border border-slate-200 transition shadow-2xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Edit Basket</span>
        </button>

        <span className="text-xs font-bold text-slate-500">Step 2 of 2</span>
      </div>

      <div className="pt-1">
        <h1 className="text-xl font-black text-slate-900 tracking-tight">Review & Confirm Order</h1>
        <p className="text-xs text-slate-500">Your dishes will be sent straight to the chef.</p>
      </div>

      {/* Dining Table Verification Card */}
      <div className="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-900">
            <Sparkles className="w-5 h-5 text-black" />
          </div>
          <div>
            <h4 className="text-xs font-black text-slate-900">Dine-In Table Verified</h4>
            <span className="text-sm font-extrabold text-black">
              {table ? table.table_number : 'Table 01 (Dine-In)'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Active</span>
        </div>
      </div>

      {/* Ordered Dishes Summary */}
      <div className="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm space-y-2.5">
        <h4 className="text-[11px] font-black uppercase text-slate-500 tracking-wider">
          Items in Order ({cart.length})
        </h4>
        <div className="divide-y divide-slate-100">
          {cart.map((item) => (
            <div key={item.product.id} className="py-2.5 flex items-center justify-between text-xs">
              <span className="text-slate-800 font-semibold flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-slate-100 text-black font-black text-[11px] flex items-center justify-center">
                  {item.quantity}x
                </span>
                {item.product.name}
              </span>
              <span className="font-bold text-slate-900">
                {formatCurrency((Number(item.product.price) || 0) * item.quantity)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Payment Method Selector */}
      <div className="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm space-y-3">
        <h4 className="text-[11px] font-black uppercase text-slate-500 tracking-wider">
          Select Payment Method
        </h4>

        <div className="grid grid-cols-2 gap-2.5">
          {/* Cash at Counter */}
          <button
            onClick={() => setPaymentMethod('cash')}
            className={`p-3.5 rounded-2xl border flex flex-col items-center gap-1.5 transition text-center select-none ${
              paymentMethod === 'cash'
                ? 'bg-black text-white border-black shadow-md'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Banknote className="w-5 h-5" />
            <span className="text-xs font-black">Cash at Counter</span>
            <span className={`text-[10px] ${paymentMethod === 'cash' ? 'text-slate-300' : 'text-slate-400'}`}>Pay when ready</span>
          </button>

          {/* Card / Electronic */}
          <button
            onClick={() => setPaymentMethod('card')}
            className={`p-3.5 rounded-2xl border flex flex-col items-center gap-1.5 transition text-center select-none ${
              paymentMethod === 'card'
                ? 'bg-black text-white border-black shadow-md'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <CreditCard className="w-5 h-5" />
            <span className="text-xs font-black">Card / MPU</span>
            <span className={`text-[10px] ${paymentMethod === 'card' ? 'text-slate-300' : 'text-slate-400'}`}>POS at Counter</span>
          </button>
        </div>
      </div>

      {/* Total Amount Card */}
      <div className="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-600">
          <span>Subtotal</span>
          <span>{formatCurrency(bill.subtotal)}</span>
        </div>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Taxes & Dining Service</span>
          <span>{formatCurrency(bill.tax + bill.service)}</span>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-sm font-black text-slate-900">
          <span>Total Payable</span>
          <span className="text-lg text-black">{formatCurrency(bill.total)}</span>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Anti-double click submit action */}
      <Button
        onClick={handlePlaceOrder}
        variant="primary"
        size="lg"
        isLoading={isSubmitting}
        leftIcon={<CheckCircle2 className="w-5 h-5" />}
        className="w-full shadow-lg shadow-black/10"
      >
        Place Dine-In Order • {formatCurrency(bill.total)}
      </Button>
    </div>
  );
};
