import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, CheckCircle2 } from 'lucide-react';
import { OrderVoucherResponse } from '@/types';
import { DigitalVoucherView } from './DigitalVoucherView';
import { Button } from '@/components/common/Button';

interface FloatingVoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: number;
  voucher: OrderVoucherResponse | null;
}

export const FloatingVoucherModal: React.FC<FloatingVoucherModalProps> = ({
  isOpen,
  onClose,
  orderId,
  voucher,
}) => {
  // Close on Escape key press & prevent background scrolling when open
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          {/* Frosted Glass Dark Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-md"
            aria-hidden="true"
          />

          {/* Floating Voucher Card Dialog ("Flot Design") */}
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.9, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 24 }}
            transition={{ type: 'spring', damping: 25, stiffness: 320 }}
            className="relative z-10 w-full max-w-lg max-h-[90vh] bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </span>
                <div>
                  <h3 className="font-black text-xs text-slate-900 uppercase tracking-wider">
                    Order Accepted by Chef
                  </h3>
                  <span className="text-[10px] text-slate-500 font-medium">
                    Official Kitchen Confirmation Voucher
                  </span>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white hover:bg-slate-200 text-slate-600 hover:text-black border border-slate-200 flex items-center justify-center transition shadow-2xs"
                title="Close Voucher"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Modal Content */}
            <div className="p-6 overflow-y-auto space-y-4">
              {voucher ? (
                <DigitalVoucherView orderId={orderId} voucher={voucher} />
              ) : (
                <div className="py-16 text-center space-y-3 text-slate-500">
                  <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs font-bold">Rendering official voucher...</p>
                </div>
              )}
            </div>

            {/* Modal Bottom Footer */}
            <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
                <Sparkles className="w-3.5 h-3.5 text-black" />
                <span>You can re-open this voucher anytime from your order tracking screen.</span>
              </div>
              <Button
                onClick={onClose}
                variant="secondary"
                size="sm"
                className="shrink-0 bg-white hover:bg-slate-100"
              >
                Close
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
