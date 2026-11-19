import React from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Receipt, ChevronRight, Clock } from 'lucide-react';
import { useOrder } from '@/contexts/OrderContext';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { Badge } from '@/components/common/Badge';

export const MyOrdersPage: React.FC = () => {
  const { recentOrders } = useOrder();

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'ready':
        return <Badge variant="success" size="sm" dot>Ready for Pickup</Badge>;
      case 'cooking':
        return <Badge variant="warning" size="sm" dot>Cooking Now</Badge>;
      case 'preparing':
        return <Badge variant="warning" size="sm" dot>Preparing</Badge>;
      case 'confirmed':
      case 'accepted':
        return <Badge variant="purple" size="sm" dot>Confirmed</Badge>;
      case 'served':
      case 'picked_up':
      case 'completed':
        return <Badge variant="default" size="sm">Collected</Badge>;
      case 'cancelled':
        return <Badge variant="danger" size="sm">Cancelled</Badge>;
      default:
        return <Badge variant="default" size="sm">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4 pb-12">
      <div className="pt-1">
        <h1 className="text-xl font-black text-slate-900 tracking-tight">My Table Orders</h1>
        <p className="text-xs text-slate-500">Track current preparation and view past vouchers.</p>
      </div>

      {recentOrders.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="py-20 text-center space-y-3"
        >
          <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto shadow-inner">
            <Receipt className="w-7 h-7" />
          </div>
          <div>
            <h3 className="font-extrabold text-base text-slate-900">No Orders Yet</h3>
            <p className="text-xs text-slate-500 mt-1">Orders placed from this device will appear here.</p>
          </div>
          <Link to="/" className="inline-block pt-2">
            <motion.button
              whileTap={{ scale: 0.94 }}
              className="px-5 py-2 rounded-full bg-black hover:bg-slate-800 text-white text-xs font-bold transition shadow-sm"
            >
              Start Dining Order
            </motion.button>
          </Link>
        </motion.div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {recentOrders.map((order, idx) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
              >
                <Link
                  to={`/orders/${order.id}`}
                  className="block bg-white rounded-3xl p-4 border border-slate-100 shadow-sm hover:shadow-md transition group"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-slate-900">
                        #{order.order_number}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Round {order.current_round}
                      </span>
                    </div>
                    {getStatusBadge(order.status)}
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-black text-slate-900 block font-mono">
                        {formatCurrency(order.total_amount)}
                      </span>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5 font-medium">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {formatDate(order.created_at)}
                      </span>
                    </div>

                    <div className="w-8 h-8 rounded-full bg-slate-50 group-hover:bg-black group-hover:text-white flex items-center justify-center text-slate-400 transition">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};
