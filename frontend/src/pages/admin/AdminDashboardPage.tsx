import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  ShoppingBag,
  DollarSign,
  UtensilsCrossed,
  QrCode,
  ArrowUpRight,
  RefreshCw,
  AlertCircle,
  Users,
  Crown,
  Flame,
  Calendar,
  BarChart3,
  CheckCircle2,
} from 'lucide-react';
import { AdminAnalyticsResponse } from '@/types';
import { fetchAdminAnalytics } from '@/services/api/admin';
import { formatCurrency } from '@/utils/formatters';

export const AdminDashboardPage: React.FC = () => {
  const [range, setRange] = useState<'today' | '7d' | '30d'>('7d');
  const [chartMode, setChartMode] = useState<'orders' | 'revenue'>('orders');
  const [analytics, setAnalytics] = useState<AdminAnalyticsResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async (selectedRange: 'today' | '7d' | '30d') => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchAdminAnalytics(selectedRange);
      setAnalytics(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load executive analytics');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(range);
  }, [range]);

  const timeline = analytics?.daily_sales_timeline || [];
  const maxSales = Math.max(...timeline.map((d) => d.sales), 1000);
  const maxOrders = Math.max(...timeline.map((d) => d.orders), 1);
  const bestSellers = analytics?.best_sellers || [];
  const championItem = bestSellers.length > 0 ? bestSellers[0] : null;

  return (
    <div className="space-y-6 max-w-7xl">
      {/* 1. DASHBOARD TOP HEADER & RANGE FILTER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Executive Business Overview</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time authoritative restaurant metrics calculated directly from database records
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => loadData(range)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:text-black hover:bg-slate-50 transition shadow-2xs"
            title="Sync Live Metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Sync</span>
          </button>

          {/* Date Filter Tabs */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-full border border-slate-200 shadow-2xs">
            {(['today', '7d', '30d'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition select-none ${
                  range === r
                    ? 'bg-black text-white shadow-xs'
                    : 'text-slate-600 hover:text-black hover:bg-slate-100'
                }`}
              >
                {r === 'today' ? 'Today' : r === '7d' ? 'Last 7 Days' : 'Last 30 Days'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-3xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. 4 PRIMARY KPI METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Today's Sales */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Today's Sales</span>
            <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">
              {formatCurrency(analytics?.today_sales || 0)}
            </div>
            <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1 mt-1">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>Authoritative Revenue</span>
            </span>
          </div>
        </motion.div>

        {/* Metric 2: Today Orders */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Orders Today</span>
            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">
              {analytics?.today_orders_count || 0} Orders
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium mt-1">
              <span className="text-emerald-600 font-bold">{analytics?.completed_orders_count || 0} Ready/Done</span>
              <span>&bull;</span>
              <span className="text-amber-600 font-bold">{analytics?.pending_orders_count || 0} In Progress</span>
            </div>
          </div>
        </motion.div>

        {/* Metric 3: Average Order Value */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Avg Order Value (AOV)</span>
            <div className="w-8 h-8 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">
              {formatCurrency(analytics?.average_order_value || 0)}
            </div>
            <span className="text-[11px] text-slate-400 font-medium mt-1 block">
              Per confirmed dining ticket
            </span>
          </div>
        </motion.div>

        {/* Metric 4: Table Utilization */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Table Utilization</span>
            <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">
              {analytics?.active_tables_count || 0} / {analytics?.total_tables_count || 0}
            </div>
            <span className="text-[11px] text-slate-400 font-medium mt-1 block">
              Dining tables with active sessions
            </span>
          </div>
        </motion.div>
      </div>

      {/* 3. DAILY ORDER COUNT & REVENUE TIMELINE VISUALIZATION */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-black" />
              <h3 className="font-black text-sm text-slate-900">
                Daily Order Count & Performance Timeline
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Inspect how many orders were placed on each individual day across the period
            </p>
          </div>

          {/* Toggle View: Daily Order Count vs Sales Revenue */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-full self-start">
            <button
              onClick={() => setChartMode('orders')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition select-none ${
                chartMode === 'orders'
                  ? 'bg-black text-white shadow-xs'
                  : 'text-slate-600 hover:text-black'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Daily Orders (Count)</span>
            </button>
            <button
              onClick={() => setChartMode('revenue')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition select-none ${
                chartMode === 'revenue'
                  ? 'bg-black text-white shadow-xs'
                  : 'text-slate-600 hover:text-black'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Revenue (MMK)</span>
            </button>
          </div>
        </div>

        {/* Dynamic Bar Chart with Visible Daily Order Badges */}
        <div className="pt-6 pb-2">
          {timeline.length > 0 ? (
            <div className="h-56 flex items-end gap-2 sm:gap-4 justify-between px-2">
              {timeline.map((item, idx) => {
                const heightPct =
                  chartMode === 'orders'
                    ? Math.max(Math.round((item.orders / maxOrders) * 100), item.orders > 0 ? 10 : 4)
                    : Math.max(Math.round((item.sales / maxSales) * 100), item.sales > 0 ? 10 : 4);

                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 group h-full justify-end">
                    {/* Direct visible daily order tag above bar */}
                    <div className="text-[11px] font-black font-mono transition text-slate-900 group-hover:scale-110">
                      {chartMode === 'orders' ? (
                        <span className="px-1.5 py-0.5 rounded-md bg-slate-100 border border-slate-200">
                          {item.orders}
                        </span>
                      ) : (
                        <span className="hidden sm:inline text-[10px] text-slate-600">
                          {formatCurrency(item.sales)}
                        </span>
                      )}
                    </div>

                    {/* Bar graphic */}
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${heightPct}%` }}
                      transition={{ type: 'spring', damping: 20, stiffness: 220, delay: idx * 0.04 }}
                      className={`w-full max-w-[44px] rounded-2xl shadow-xs transition ${
                        item.orders > 0
                          ? 'bg-black group-hover:bg-slate-700'
                          : 'bg-slate-100 border border-dashed border-slate-300'
                      }`}
                    />

                    {/* Date label */}
                    <span className="text-[10px] font-bold text-slate-600 font-mono text-center">
                      {item.date}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-400 py-10 text-center">No timeline data available.</p>
          )}
        </div>

        {/* Day-by-Day Scannable Breakdown Cards */}
        <div className="pt-2 border-t border-slate-100">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
            Day-by-Day Breakdown
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {timeline.map((day, idx) => (
              <div
                key={idx}
                className="p-3 rounded-2xl bg-slate-50 border border-slate-100 hover:border-slate-300 hover:bg-white transition space-y-1.5"
              >
                <div className="text-[11px] font-bold text-slate-400 font-mono">{day.date}</div>
                <div className="text-lg font-black text-slate-900 font-mono">
                  {day.orders} <span className="text-[11px] font-bold text-slate-500 font-sans">orders</span>
                </div>
                <div className="text-[10px] text-emerald-600 font-bold">
                  {formatCurrency(day.sales)}
                </div>
                {day.completed_orders !== undefined && day.completed_orders > 0 && (
                  <div className="text-[9px] text-slate-400 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
                    <span>{day.completed_orders} completed</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. TWO-COLUMN LOWER SECTION: MOST ORDERED MENU & QUICK ACTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Most Ordered Menu Items (Leaderboard & Champion Card) */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-amber-500 fill-amber-500" />
                <h3 className="font-black text-sm text-slate-900">
                  Most Ordered Menu Items
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Ranked by total quantity and frequency of customer orders ({range === 'today' ? 'Today' : range === '7d' ? 'Last 7 Days' : 'Last 30 Days'})
              </p>
            </div>
            <span className="text-[11px] font-bold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full font-mono">
              Top Ranked
            </span>
          </div>

          {/* #1 MOST ORDERED CHAMPION HIGHLIGHT CARD */}
          {championItem && (
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-950 to-slate-900 text-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-black uppercase tracking-wider border border-amber-400/30">
                    <Crown className="w-3 h-3 text-amber-400" />
                    <span>#1 Most Ordered Dish</span>
                  </div>
                  <h4 className="text-lg font-black text-white tracking-tight">
                    {championItem.item_name}
                  </h4>
                  <div className="flex items-center gap-3 text-xs text-slate-300 font-medium">
                    <span className="font-black text-white font-mono text-sm">
                      {championItem.total_quantity} portions
                    </span>
                    <span>&bull;</span>
                    <span>Ordered in {championItem.order_count || championItem.total_quantity} tickets</span>
                    {championItem.percentage !== undefined && (
                      <>
                        <span>&bull;</span>
                        <span className="text-amber-300 font-bold">{championItem.percentage}% share</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-sm font-black text-amber-300 font-mono block">
                    {formatCurrency(championItem.total_revenue)}
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">
                    Revenue
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Leaderboard Table / Ranked List */}
          <div className="space-y-3">
            {bestSellers.length > 0 ? (
              bestSellers.map((item, idx) => (
                <div
                  key={idx}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-100 hover:border-slate-300 transition gap-3"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-7 h-7 rounded-full font-black text-xs flex items-center justify-center font-mono shrink-0 ${
                        idx === 0
                          ? 'bg-amber-400 text-black'
                          : idx === 1
                          ? 'bg-slate-300 text-slate-900'
                          : idx === 2
                          ? 'bg-amber-700 text-white'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      #{idx + 1}
                    </span>

                    <div className="space-y-1">
                      <span className="font-bold text-xs text-slate-900 block">
                        {item.item_name}
                      </span>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <span className="font-black text-slate-900 font-mono">
                          {item.total_quantity} portions
                        </span>
                        <span>&bull;</span>
                        <span>{item.order_count || item.total_quantity} orders placed</span>
                        {item.percentage !== undefined && (
                          <span className="text-slate-400">({item.percentage}%)</span>
                        )}
                      </div>

                      {/* Visual Popularity Progress Bar */}
                      {item.percentage !== undefined && (
                        <div className="w-36 h-1.5 bg-slate-200 rounded-full overflow-hidden mt-1">
                          <div
                            className="h-full bg-black rounded-full"
                            style={{ width: `${Math.min(item.percentage, 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-right sm:self-center">
                    <span className="font-black text-xs text-slate-900 font-mono block">
                      {formatCurrency(item.total_revenue)}
                    </span>
                    <span className="text-[10px] text-emerald-600 font-bold uppercase">
                      Total Revenue
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 py-6 text-center">
                No orders recorded in this period.
              </p>
            )}
          </div>
        </div>

        {/* Quick Operations Console */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-black text-sm text-slate-900 pb-2 border-b border-slate-100">
            Quick Administrative Links
          </h3>

          <div className="space-y-2">
            <Link
              to="/admin/tables"
              className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 hover:border-black hover:bg-slate-50 transition group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-800 group-hover:bg-black group-hover:text-white transition">
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-xs text-slate-900 block">Tables & QR Stands</span>
                  <span className="text-[10px] text-slate-400">Export branded 4x6 cards</span>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-black" />
            </Link>

            <Link
              to="/admin/orders"
              className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 hover:border-black hover:bg-slate-50 transition group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-800 group-hover:bg-black group-hover:text-white transition">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-xs text-slate-900 block">All Restaurant Orders</span>
                  <span className="text-[10px] text-slate-400">Inspect live tickets & history</span>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-black" />
            </Link>

            <Link
              to="/admin/menu"
              className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 hover:border-black hover:bg-slate-50 transition group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-800 group-hover:bg-black group-hover:text-white transition">
                  <UtensilsCrossed className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-xs text-slate-900 block">Menu Overview</span>
                  <span className="text-[10px] text-slate-400">Audit pricing and stations</span>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-black" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
