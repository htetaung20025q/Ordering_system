import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { OrderVoucherResponse } from '@/types';
import { fetchOrderVoucher } from '@/services/api/voucher';
import { DigitalVoucherView } from '@/components/voucher/DigitalVoucherView';
import { Button } from '@/components/common/Button';

export const VoucherPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [voucher, setVoucher] = useState<OrderVoucherResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const orderId = id ? parseInt(id, 10) : null;

  useEffect(() => {
    if (!orderId) return;

    setIsLoading(true);
    fetchOrderVoucher(orderId)
      .then((data) => setVoucher(data))
      .catch((err) => {
        setErrorMessage(
          err.status === 404
            ? 'Voucher has not been generated yet. It is created automatically when the Chef confirms your order.'
            : (err.detail || 'Could not load voucher')
        );
      })
      .finally(() => setIsLoading(false));
  }, [orderId]);

  if (isLoading) {
    return (
      <div className="py-20 text-center text-slate-500 space-y-3">
        <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs">Retrieving official digital voucher...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-12">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(orderId ? `/orders/${orderId}` : '/orders')}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-black bg-white hover:bg-slate-50 px-3.5 py-1.5 rounded-full border border-slate-200 transition shadow-2xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Order Tracking</span>
        </button>
      </div>

      {voucher ? (
        <DigitalVoucherView orderId={orderId!} voucher={voucher} />
      ) : (
        <div className="bg-white rounded-3xl p-6 text-center space-y-3 border border-slate-100 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="font-extrabold text-base text-slate-900">Voucher Pending Confirmation</h3>
          <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
            {errorMessage}
          </p>
          <Button
            onClick={() => navigate(orderId ? `/orders/${orderId}` : '/orders')}
            variant="secondary"
            size="sm"
          >
            Track Order Status
          </Button>
        </div>
      )}
    </div>
  );
};
