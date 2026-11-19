import React, { useState, useEffect, useCallback } from 'react';
import { Search, Eye, X, RefreshCw } from 'lucide-react';
import { OrderResponse, RestaurantTable } from '@/types';
import { fetchOrders } from '@/services/api/order';
import { fetchAdminTables } from '@/services/api/admin';
import { formatCurrency, formatDate } from '@/utils/formatters';

export const AdminOrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<OrderResponse[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tableFilter, setTableFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedOrder, setSelectedOrder] = useState<OrderResponse | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [orderList, tableList] = await Promise.all([
        fetchOrders(undefined, tableFilter === 'all' ? undefined : parseInt(tableFilter, 10)),
        fetchAdminTables(),
      ]);
      setOrders(orderList);
      setTables(tableList);
    } catch {
      // Keep state
    } finally {
      setIsLoading(false);
    }
  }, [tableFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredOrders = orders.filter((o) => {
    const matchesStatus = statusFilter === 'all' || o.status.toLowerCase() === statusFilter.toLowerCase();
    const matchesSearch = o.order_number.toLowerCase().includes(searchQuery.toLowerCase()) || (o.table_number || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'confirmed':
      case 'accepted':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'preparing':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'cooking':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'ready':
      case 'completed':
      case 'picked_up':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'cancelled':
        return 'bg-red-50 text-red-600 border-red-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">All Restaurant Orders & Audit</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit live and historical orders, table bindings, and item price snapshots
          </p>
        </div>

        <button
          onClick={loadData}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:text-black hover:bg-slate-50 transition shadow-2xs self-start"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Orders</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search order number or table..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none focus:border-black transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3.5 py-2 rounded-full bg-slate-50 border border-slate-200 text-xs text-slate-800 font-bold focus:outline-none focus:border-black"
          >
            <option value="all">All Statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="preparing">Preparing</option>
            <option value="cooking">Cooking</option>
            <option value="ready">Ready</option>
            <option value="picked_up">Picked Up</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            value={tableFilter}
            onChange={(e) => setTableFilter(e.target.value)}
            className="px-3.5 py-2 rounded-full bg-slate-50 border border-slate-200 text-xs text-slate-800 font-bold focus:outline-none focus:border-black"
          >
            <option value="all">All Dining Tables</option>
            {tables.map((t) => (
              <option key={t.id} value={t.id}>
                {t.table_number}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Orders Data Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-black tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-5">Order #</th>
                <th className="py-3 px-5">Table</th>
                <th className="py-3 px-5">Round</th>
                <th className="py-3 px-5">Dishes Summary</th>
                <th className="py-3 px-5">Placed At</th>
                <th className="py-3 px-5">Total (MMK)</th>
                <th className="py-3 px-5">Status</th>
                <th className="py-3 px-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No orders matching filter.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 px-5 font-mono font-bold text-slate-900">#{o.order_number}</td>
                    <td className="py-3.5 px-5 font-bold text-slate-800">{o.table_number || 'Takeaway'}</td>
                    <td className="py-3.5 px-5 font-mono text-slate-500">R{o.current_round}</td>
                    <td className="py-3.5 px-5 text-slate-700 max-w-xs truncate">
                      {o.items.map((i) => `${i.quantity}x ${i.item_name}`).join(', ')}
                    </td>
                    <td className="py-3.5 px-5 text-slate-500 text-[11px] font-mono">{formatDate(o.created_at)}</td>
                    <td className="py-3.5 px-5 font-mono font-black text-slate-900 text-sm">
                      {formatCurrency(o.total_amount)}
                    </td>
                    <td className="py-3.5 px-5">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide border ${getStatusBadge(o.status)}`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <button
                        onClick={() => setSelectedOrder(o)}
                        className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition flex items-center gap-1.5 ml-auto"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ORDER INSPECTION MODAL */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full border border-slate-200 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-black text-base text-slate-900">
                  Order #{selectedOrder.order_number}
                </h3>
                <span className="text-xs text-slate-500">
                  {selectedOrder.table_number} &bull; Placed {formatDate(selectedOrder.created_at)}
                </span>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Dish Snapshots */}
            <div className="space-y-2">
              <span className="text-xs font-black uppercase text-slate-400 tracking-wider">
                Immutable Order Item Snapshots
              </span>
              <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 divide-y divide-slate-200/60">
                {selectedOrder.items.map((item, idx) => (
                  <div key={idx} className="py-2 first:pt-0 last:pb-0 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-900">
                        {item.quantity}x {item.item_name}
                      </span>
                      <span className="text-[10px] text-slate-400 block font-mono">
                        Snapshot unit price: {formatCurrency(item.unit_price)}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-slate-900">
                      {formatCurrency(item.subtotal)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Status History */}
            {selectedOrder.status_history && selectedOrder.status_history.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-black uppercase text-slate-400 tracking-wider">
                  Lifecycle Status History
                </span>
                <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 space-y-1.5 text-xs">
                  {selectedOrder.status_history.map((h, idx) => (
                    <div key={idx} className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-800 uppercase">
                        &bull; {h.new_status}
                      </span>
                      <span className="text-slate-400 font-mono">
                        {formatDate(h.changed_timestamp)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2 flex items-center justify-between border-t border-slate-100">
              <span className="text-xs font-bold text-slate-500">Total Check Amount</span>
              <span className="text-lg font-black text-slate-900 font-mono">
                {formatCurrency(selectedOrder.total_amount)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
