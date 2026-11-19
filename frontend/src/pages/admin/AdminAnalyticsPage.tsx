import React, { useState, useEffect } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { AdminAnalyticsResponse } from '@/types';
import { fetchAdminAnalytics } from '@/services/api/admin';
import { formatCurrency } from '@/utils/formatters';

export const AdminAnalyticsPage: React.FC = () => {
  const [range, setRange] = useState<'today' | '7d' | '30d'>('7d');
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
      setError(err instanceof Error ? err.message : 'Failed to load sales analytics');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(range);
  }, [range]);

  const timeline = analytics?.daily_sales_timeline || [];
  const totalPeriodSales = timeline.reduce((acc, curr) => acc + curr.sales, 0);
  const totalPeriodOrders = timeline.reduce((acc, curr) => acc + curr.orders, 0);

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Page Header & Range Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Sales Analytics & Revenue Reports</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit sales performance, ticket volume, and revenue timelines
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData(range)}
            className="p-2 rounded-full bg-white border border-slate-200 text-slate-600 hover:text-black transition"
            title="Refresh Analytics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {/* Date Filter Tabs */}
          <div className="flex items-center gap-1.5 bg-white p-1 rounded-full border border-slate-200 shadow-2xs">
            {(['today', '7d', '30d'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition select-none ${
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

      {/* Aggregate Range Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Period Revenue</span>
          <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">
            {formatCurrency(totalPeriodSales)}
          </div>
          <span className="text-[10px] text-emerald-600 font-bold block">Authoritative Database Sales</span>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Period Orders</span>
          <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">
            {totalPeriodOrders} Orders
          </div>
          <span className="text-[10px] text-slate-500 font-medium block">Across all dining tables</span>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Avg Ticket Size</span>
          <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">
            {formatCurrency(totalPeriodOrders > 0 ? totalPeriodSales / totalPeriodOrders : 0)}
          </div>
          <span className="text-[10px] text-slate-500 font-medium block">Revenue per check</span>
        </div>
      </div>

      {/* Daily Breakdown Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-black text-sm text-slate-900">Historical Daily Timeline Breakdown</h3>
          <span className="text-xs font-mono font-bold text-slate-400">{timeline.length} Recorded Days</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-black tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-5">Date</th>
                <th className="py-3 px-5">Sales Revenue (MMK)</th>
                <th className="py-3 px-5">Order Count</th>
                <th className="py-3 px-5">Average Order Value</th>
                <th className="py-3 px-5 text-right">% of Period Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {timeline.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    No sales data found for this range.
                  </td>
                </tr>
              ) : (
                timeline.map((item, idx) => {
                  const pct = totalPeriodSales > 0 ? ((item.sales / totalPeriodSales) * 100).toFixed(1) : '0';
                  const avg = item.orders > 0 ? item.sales / item.orders : 0;

                  return (
                    <tr key={idx} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-5 font-bold text-slate-900 font-mono">{item.date}</td>
                      <td className="py-3.5 px-5 font-black text-slate-900 font-mono text-sm">
                        {formatCurrency(item.sales)}
                      </td>
                      <td className="py-3.5 px-5 font-medium text-slate-700">{item.orders} orders</td>
                      <td className="py-3.5 px-5 font-mono text-slate-600">{formatCurrency(avg)}</td>
                      <td className="py-3.5 px-5 text-right font-mono font-bold text-slate-900">{pct}%</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
