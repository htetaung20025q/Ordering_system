import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  RefreshCw,
  XCircle,
  Sparkles,
  Ticket,
  ArrowRight,
  ChefHat,
  CheckCircle2,
} from 'lucide-react';
import { OrderResponse, OrderVoucherResponse } from '@/types';
import { fetchOrderById, cancelOrder } from '@/services/api/order';
import { fetchOrderVoucher } from '@/services/api/voucher';
import { OrderRealtimeService } from '@/services/websocket/orderSocket';
import { OrderStageTracker } from '@/components/order/OrderStageTracker';
import { ReadyNotificationBanner } from '@/components/order/ReadyNotificationBanner';
import { FloatingVoucherModal } from '@/components/voucher/FloatingVoucherModal';
import { Button } from '@/components/common/Button';
import { formatCurrency, formatDate } from '@/utils/formatters';

export const OrderTrackingPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [voucher, setVoucher] = useState<OrderVoucherResponse | null>(null);
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingVoucher, setIsLoadingVoucher] = useState<boolean>(false);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Track if floating modal has already auto-popped for this order session
  const hasAutoPoppedRef = useRef<boolean>(false);
  const orderId = id ? parseInt(id, 10) : null;

  useEffect(() => {
    if (!orderId) return;

    setIsLoading(true);
    fetchOrderById(orderId)
      .then((data) => {
        setOrder(data);
        if (data.voucher) {
          setVoucher(data.voucher);
        }
      })
      .catch((err) => setErrorMessage(err.detail || 'Could not load order'))
      .finally(() => setIsLoading(false));

    // Connect real-time updates / smart polling
    const realtimeService = new OrderRealtimeService(orderId, (updated) => {
      setOrder(updated);
      if (updated.voucher) {
        setVoucher(updated.voucher);
      }
    });

    return () => {
      realtimeService.destroy();
    };
  }, [orderId]);

  // Automated voucher fetch and auto-popup when Chef accepts/confirms order
  useEffect(() => {
    if (!order) return;

    const isConfirmedByChef =
      !!order.confirmed_at ||
      ['confirmed', 'preparing', 'cooking', 'ready', 'picked_up', 'served', 'completed'].includes(
        order.status
      );

    // If order confirmed and voucher not yet populated, fetch it
    if (isConfirmedByChef && !voucher && !isLoadingVoucher) {
      setIsLoadingVoucher(true);
      fetchOrderVoucher(order.id)
        .then((v) => {
          setVoucher(v);
        })
        .catch(() => {})
        .finally(() => setIsLoadingVoucher(false));
    }

    // Auto-pop the floating voucher modal ONCE when chef confirms
    if (isConfirmedByChef && !hasAutoPoppedRef.current) {
      hasAutoPoppedRef.current = true;
      setIsVoucherModalOpen(true);
    }
  }, [order?.status, order?.confirmed_at, order?.id, voucher, isLoadingVoucher]);

  const handleCancelOrder = async () => {
    if (!orderId || !confirm('Are you sure you want to cancel this order?')) return;
    setIsCancelling(true);
    try {
      const cancelled = await cancelOrder(orderId);
      setOrder(cancelled);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Could not cancel order');
    } finally {
      setIsCancelling(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-20 text-center text-slate-500 space-y-3">
        <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs">Connecting to Kitchen Display System...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="py-20 text-center space-y-3">
        <h3 className="text-base font-bold text-slate-900">Order Not Found</h3>
        <p className="text-xs text-slate-500">
          {errorMessage || `Order #${orderId} does not exist or has expired.`}
        </p>
        <Link to="/">
          <Button variant="secondary" size="sm">Back to Menu</Button>
        </Link>
      </div>
    );
  }

  const isReady = order.status === 'ready';
  const isAcceptedByChef =
    !!order.confirmed_at ||
    ['confirmed', 'preparing', 'cooking', 'ready', 'picked_up', 'served', 'completed'].includes(
      order.status
    );
  const canCancel = ['pending', 'new'].includes(order.status);

  return (
    <div className="space-y-4 pb-12">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/orders')}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-black bg-white hover:bg-slate-50 px-3.5 py-1.5 rounded-full border border-slate-200 transition shadow-2xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>My Orders</span>
        </button>

        <span className="text-xs font-extrabold text-black bg-white px-3 py-1 rounded-full border border-slate-200 shadow-2xs flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-black" />
          {order.table_number || 'Table 01'}
        </span>
      </div>

      {/* Order Title & Identification */}
      <div className="pt-1">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-black text-slate-900 tracking-tight">Order #{order.order_number}</h1>
          <button
            onClick={() => orderId && fetchOrderById(orderId).then(setOrder)}
            className="p-2 rounded-full bg-white hover:bg-slate-100 text-slate-600 hover:text-black border border-slate-200 transition shadow-2xs"
            title="Refresh Status"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-xs text-slate-500">Placed on {formatDate(order.created_at)}</p>
      </div>

      {/* PROMINENT READY NOTIFICATION (When Status is READY) */}
      {isReady && <ReadyNotificationBanner tableNumber={order.table_number} />}

      {/* Live 4-Stage Stepper Tracker */}
      <OrderStageTracker
        status={order.status}
        confirmedAt={order.confirmed_at}
        preparationDueAt={order.preparation_due_at}
        preparationDurationSeconds={order.preparation_duration_seconds}
      />

      {/* ======================================================== */}
      {/* CHEF ACCEPTED / VOUCHER ACTIONS SECTION                 */}
      {/* ======================================================== */}
      {isAcceptedByChef ? (
        <div className="space-y-3">
          {/* Order Accepted Success Banner */}
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2.5 shadow-2xs">
            <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <span className="block font-black text-emerald-950 text-[13px]">
                Order Accepted by Chief Chef!
              </span>
              <span className="text-[11px] text-emerald-700 font-medium">
                Your official confirmation voucher is ready.
              </span>
            </div>
          </div>

          {/* ⭐ PERSISTENT "VIEW VOUCHER" RE-OPEN CARD / BUTTON ⭐ */}
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => setIsVoucherModalOpen(true)}
            className="w-full flex items-center justify-between p-4 rounded-3xl bg-white border border-slate-200 hover:border-black hover:bg-slate-50 transition shadow-sm group text-left cursor-pointer"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-black text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                <Ticket className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-xs text-slate-900 block">
                    Official Kitchen Voucher
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase">
                    Confirmed
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 font-medium">
                  Confirmed by Chef • Click to view voucher
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-100 text-slate-900 text-xs font-bold group-hover:bg-black group-hover:text-white transition shrink-0">
              <span>View Voucher</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </motion.button>
        </div>
      ) : (
        /* Awaiting Chef Acceptance State */
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-3xl bg-amber-50/90 border border-amber-200 text-amber-900 text-xs space-y-1.5 shadow-2xs"
        >
          <div className="flex items-center gap-2 font-black">
            <ChefHat className="w-4 h-4 text-amber-600" />
            <span className="text-amber-950">Awaiting Kitchen Confirmation</span>
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse ml-auto" />
          </div>
          <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
            Your order has been transmitted to the kitchen. As soon as the Chef confirms your order, your official digital confirmation voucher will automatically float onto your screen!
          </p>
        </motion.div>
      )}

      {/* Ordered Food Items Breakdown */}
      <div className="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm space-y-2.5">
        <h4 className="text-[11px] font-black uppercase text-slate-500 tracking-wider">
          Ordered Dishes ({order.items.length})
        </h4>
        <div className="divide-y divide-slate-100">
          {order.items.map((item) => (
            <div key={item.id} className="py-2.5 flex items-center justify-between text-xs">
              <span className="text-slate-800 font-semibold flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-slate-100 text-black font-black text-[11px] flex items-center justify-center">
                  {item.quantity}x
                </span>
                {item.product_name}
              </span>
              <span className="font-bold text-slate-900">
                {formatCurrency(item.subtotal)}
              </span>
            </div>
          ))}
        </div>
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-black text-slate-900">
          <span>Order Total</span>
          <span className="text-sm text-black">{formatCurrency(order.total_amount)}</span>
        </div>
      </div>

      {/* Cancel Action if Order is Pending */}
      {canCancel && (
        <Button
          onClick={handleCancelOrder}
          variant="danger"
          size="md"
          isLoading={isCancelling}
          leftIcon={<XCircle className="w-4 h-4" />}
          className="w-full"
        >
          Cancel Order
        </Button>
      )}

      {/* ======================================================== */}
      {/* FLOATING VOUCHER MODAL ("FLOT DESIGN") DIALOG            */}
      {/* ======================================================== */}
      <FloatingVoucherModal
        isOpen={isVoucherModalOpen}
        onClose={() => setIsVoucherModalOpen(false)}
        orderId={order.id}
        voucher={voucher}
      />
    </div>
  );
};
