import React, { useState } from 'react';
import { Download, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { OrderVoucherResponse } from '@/types';
import { Button } from '@/components/common/Button';
import { formatDate } from '@/utils/formatters';
import { downloadVoucherPdf } from '@/services/api/voucher';

interface DigitalVoucherViewProps {
  orderId: number;
  voucher: OrderVoucherResponse;
}

export const DigitalVoucherView: React.FC<DigitalVoucherViewProps> = ({
  orderId,
  voucher,
}) => {
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleDownload = async () => {
    setIsDownloading(true);
    setDownloadError(null);
    try {
      await downloadVoucherPdf(orderId, voucher.order_number);
    } catch {
      setDownloadError('Could not download PDF. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Official Voucher Ticket Card (Clean White Dining Receipt) */}
      <div className="relative bg-white rounded-3xl p-6 border border-slate-200 shadow-xl overflow-hidden text-slate-900">
        {/* Voucher Header */}
        <div className="text-center pb-4 border-b border-dashed border-slate-200">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-900 text-[10px] font-black uppercase tracking-widest mb-2 border border-slate-200">
            <Sparkles className="w-3 h-3 text-black" /> Official Confirmation Voucher
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">FLOW-SYS</h2>
          <p className="text-xs text-slate-500 font-medium">Artisan Gourmet Dining</p>
        </div>

        {/* Metadata Details Grid */}
        <div className="grid grid-cols-2 gap-3.5 py-4 text-xs border-b border-dashed border-slate-200">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Voucher Number</span>
            <span className="font-extrabold text-slate-900">{voucher.voucher_number}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Order Number</span>
            <span className="font-extrabold text-slate-900">{voucher.order_number}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Dining Table</span>
            <span className="font-extrabold text-black">{voucher.table_number || 'Dine-In'}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Confirmed At</span>
            <span className="font-extrabold text-slate-700">{formatDate(voucher.confirmed_at)}</span>
          </div>
        </div>

        {/* Confirmed Food Items */}
        <div className="py-4 border-b border-dashed border-slate-200">
          <h4 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2.5">
            Confirmed Food Items
          </h4>
          <div className="space-y-2">
            {voucher.items.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-800 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-100 text-black font-black text-[11px] flex items-center justify-center">
                    {item.quantity}x
                  </span>
                  {item.dish_name || (item as unknown as { item_name?: string }).item_name || 'Dish'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* TOTAL AMOUNT ONLY (Strict Business Invariant) */}
        <div className="pt-4 pb-2 text-center bg-slate-50 rounded-2xl p-4 border border-slate-100 my-2">
          <span className="text-[10px] uppercase font-extrabold text-slate-500 tracking-wider block mb-1">
            Total Amount Only
          </span>
          <span className="text-3xl font-black text-slate-900 tracking-tight block">
            {voucher.total_amount}
          </span>
          <p className="text-[10px] text-slate-400 mt-1 font-medium">
            (Total Amount Only • Zero Payment Method Displayed)
          </p>
        </div>

        {/* Voucher Status Confirmation Note */}
        <div className="pt-2 flex items-center justify-center gap-1.5 text-xs text-emerald-700 font-bold">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Order Confirmed by Chef</span>
        </div>
      </div>

      {downloadError && (
        <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{downloadError}</span>
        </div>
      )}

      {/* Action Button: Download PDF (Solid Black Pill) */}
      <Button
        onClick={handleDownload}
        variant="primary"
        size="lg"
        isLoading={isDownloading}
        leftIcon={<Download className="w-4 h-4" />}
        className="w-full shadow-lg shadow-black/10"
      >
        Download Official PDF Voucher
      </Button>
    </div>
  );
};
