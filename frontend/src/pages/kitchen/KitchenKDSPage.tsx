import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, AlertCircle, ChefHat, Flame, CheckCircle2, Check, Timer } from 'lucide-react';
import { KitchenTicketResponse } from '@/types';
import { fetchKDSTickets, executeChefOrderAction, dismissKDSTicket } from '@/services/api/kds';

export const KitchenKDSPage: React.FC = () => {
  const [tickets, setTickets] = useState<KitchenTicketResponse[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [stationFilter, setStationFilter] = useState<string>('all');
  const [actionError, setActionError] = useState<string | null>(null);

  const loadTickets = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchKDSTickets(true);
      setTickets(data);
    } catch {
      // Keep existing tickets on transient network hiccups
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTickets();
    const timer = setInterval(loadTickets, 3000);
    return () => clearInterval(timer);
  }, [loadTickets]);

  // Live 1-second ticker for smooth countdown timers without network requests
  const [, setTick] = useState(0);
  useEffect(() => {
    const tickInterval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(tickInterval);
  }, []);

  const handleAction = async (orderId: number, action: 'accept' | 'confirm' | 'prepare' | 'cook' | 'ready' | 'pickup') => {
    setActionError(null);
    try {
      await executeChefOrderAction(orderId, action);
      await loadTickets();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to update order status');
    }
  };

  const handleDismiss = async (ticketId: number) => {
    try {
      await dismissKDSTicket(ticketId);
      setTickets((prev) => prev.filter((t) => t.id !== ticketId));
    } catch {
      // Ignored
    }
  };

  const getRemainingPrepSeconds = (dueAt?: string | null): number => {
    if (!dueAt) return 0;
    return Math.max(0, Math.floor((new Date(dueAt).getTime() - Date.now()) / 1000));
  };

  const formatPrepRemaining = (dueAt?: string | null): string => {
    if (!dueAt) return 'Timing queued...';
    const seconds = getRemainingPrepSeconds(dueAt);
    if (seconds <= 0) return 'Moving to Cooking...';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const filteredTickets = tickets.filter((t) => {
    if (stationFilter === 'all') return true;
    return t.station === stationFilter;
  });

  const newTickets = filteredTickets.filter((t) => t.status === 'new' || t.status === 'accepted');
  const preparingTickets = filteredTickets.filter((t) => t.status === 'preparing');
  const cookingTickets = filteredTickets.filter((t) => t.status === 'cooking');
  const readyTickets = filteredTickets.filter((t) => t.status === 'ready');

  const getElapsedTime = (createdAt: string) => {
    const elapsedMinutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
    if (elapsedMinutes < 1) return 'Just now';
    return `${elapsedMinutes}m ago`;
  };

  const renderOrderCard = (ticket: KitchenTicketResponse, stage: 'new' | 'preparing' | 'cooking' | 'ready') => {
    const isUrgent = (Date.now() - new Date(ticket.created_at).getTime()) / 60000 > 15;

    return (
      <motion.div
        key={ticket.id}
        layout
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.2 } }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className={`bg-white rounded-3xl p-4 border transition-all space-y-3.5 shadow-xs ${
          isUrgent
            ? 'border-black border-2 shadow-sm'
            : 'border-black hover:shadow-md'
        }`}
      >
        {/* Card Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-black text-slate-900">#{ticket.order_id}</span>
              {ticket.table_number && (
                <span className="px-2 py-0.5 rounded-full bg-black text-white text-[10px] font-black">
                  {ticket.table_number}
                </span>
              )}
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-bold text-slate-700">
                Round {ticket.round_number}
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-500 block mt-0.5">
              {getElapsedTime(ticket.created_at)}
            </span>
          </div>

          <div className="text-right">
            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 border border-slate-200 text-[10px] font-bold uppercase tracking-wider block">
              {ticket.station}
            </span>
          </div>
        </div>

        {/* Order-level Customer Dining Note */}
        {ticket.special_instructions && (
          <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-300 text-amber-950 flex items-start gap-2 shadow-2xs">
            <span className="px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 text-[9px] font-black uppercase tracking-wider shrink-0 mt-0.5">
              Order Note
            </span>
            <span className="text-xs font-black text-amber-950 leading-tight">
              "{ticket.special_instructions}"
            </span>
          </div>
        )}

        {/* Dish Items */}
        <div className="space-y-2.5">
          {ticket.ticket_items.map((item, idx) => {
            const note = item.special_instructions || item.notes;
            return (
              <div key={idx} className="flex flex-col text-xs bg-slate-50/80 p-2.5 rounded-2xl border border-slate-100">
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-md bg-black text-white font-black text-[11px] flex items-center justify-center shrink-0">
                    {item.quantity}x
                  </span>
                  <span className="text-slate-900 font-bold leading-snug pt-0.5">
                    {item.item_name}
                  </span>
                </div>

                {/* High-Visibility Chef Note Warning Badge */}
                {note && (
                  <div className="mt-1.5 ml-7 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-100 border border-amber-400 text-amber-950 text-xs font-black shadow-2xs self-start">
                    <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse shrink-0" />
                    <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider">
                      NOTE:
                    </span>
                    <span className="text-amber-950 font-black">"{note}"</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Semi-Automatic Preparation Live Timer / Stage Status */}
        {stage === 'preparing' && (
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-300 text-amber-950 space-y-2 shadow-2xs">
            <div className="flex items-center justify-between text-xs font-black">
              <span className="flex items-center gap-1.5 text-amber-900">
                <Timer className="w-3.5 h-3.5 animate-spin text-amber-700" style={{ animationDuration: '4s' }} />
                Auto-Cooking In:
              </span>
              <span className="font-mono text-xs font-black bg-amber-200/80 px-2 py-0.5 rounded-full text-amber-950">
                {formatPrepRemaining(ticket.preparation_due_at)}
              </span>
            </div>
            {ticket.preparation_duration_seconds && ticket.preparation_due_at && (
              <div className="w-full bg-amber-200/80 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-amber-600 h-1.5 rounded-full transition-all duration-1000"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(
                        0,
                        ((ticket.preparation_duration_seconds - getRemainingPrepSeconds(ticket.preparation_due_at)) /
                          ticket.preparation_duration_seconds) *
                          100
                      )
                    )}%`,
                  }}
                />
              </div>
            )}
          </div>
        )}

        {stage === 'cooking' && (
          <div className="p-2.5 rounded-2xl bg-orange-500/10 border border-orange-300 text-orange-950 flex items-center justify-between shadow-2xs">
            <span className="flex items-center gap-1.5 text-xs font-black text-orange-950">
              <Flame className="w-4 h-4 text-orange-600 animate-pulse" />
              Cooking on Line
            </span>
            <span className="text-[10px] font-bold text-orange-900 bg-orange-200/80 px-2.5 py-0.5 rounded-full">
              In Progress
            </span>
          </div>
        )}

        {stage === 'ready' && (
          <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-300 text-emerald-950 flex items-center justify-between shadow-2xs">
            <span className="flex items-center gap-1.5 text-xs font-black text-emerald-950">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Ready at Counter
            </span>
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-900 bg-emerald-200/80 px-2.5 py-0.5 rounded-full">
              Awaiting Pickup
            </span>
          </div>
        )}

        {/* Chef Control Buttons (Customer-Style Pill Buttons) */}
        <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-200">
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={() => handleDismiss(ticket.id)}
            className="px-3 py-2 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100 text-[11px] font-bold transition"
          >
            Dismiss
          </motion.button>

          {stage === 'new' && (
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => handleAction(ticket.order_id, 'accept')}
              className="flex-1 px-4 py-2.5 rounded-full bg-black hover:bg-slate-800 text-white text-xs font-black transition shadow-xs flex items-center justify-center gap-1.5"
            >
              <ChefHat className="w-4 h-4" />
              <span>Accept Order</span>
            </motion.button>
          )}

          {stage === 'preparing' && (
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => handleAction(ticket.order_id, 'ready')}
              className="flex-1 px-4 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition shadow-xs flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Mark as Ready</span>
            </motion.button>
          )}

          {stage === 'cooking' && (
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => handleAction(ticket.order_id, 'ready')}
              className="flex-1 px-4 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition shadow-xs flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Mark as Ready</span>
            </motion.button>
          )}

          {stage === 'ready' && (
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => handleAction(ticket.order_id, 'pickup')}
              className="flex-1 px-4 py-2.5 rounded-full bg-slate-900 hover:bg-black text-white text-xs font-black transition shadow-xs flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Confirm Pickup</span>
            </motion.button>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Top Station Filter Bar */}
      <div className="bg-white p-3 rounded-3xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-slate-500 mr-1 hidden sm:inline">Station:</span>
          {['all', 'main_kitchen', 'bar', 'dessert'].map((st) => (
            <motion.button
              key={st}
              whileTap={{ scale: 0.94 }}
              onClick={() => setStationFilter(st)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition select-none uppercase tracking-wider ${
                stationFilter === st
                  ? 'bg-black text-white shadow-xs'
                  : 'text-slate-600 hover:text-black hover:bg-slate-100'
              }`}
            >
              {st.replace('_', ' ')}
            </motion.button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
            Active: <span className="font-mono text-slate-900 font-extrabold">{filteredTickets.length}</span>
          </span>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={loadTickets}
            className="p-2 rounded-full bg-white border border-slate-200 text-slate-600 hover:text-black transition shadow-xs"
            title="Refresh Tickets"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </motion.button>
        </div>
      </div>

      {actionError && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-3xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{actionError}</span>
        </motion.div>
      )}

      {/* 4 Swimlane Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Column 1: New / Accepted */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
              <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                New Orders ({newTickets.length})
              </h3>
            </div>
          </div>
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {newTickets.length === 0 ? (
                <motion.div
                  key="empty-new"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="p-8 rounded-3xl bg-white/70 border border-dashed border-slate-200 text-center text-xs text-slate-400"
                >
                  No new orders waiting
                </motion.div>
              ) : (
                newTickets.map((t) => renderOrderCard(t, 'new'))
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Column 2: Preparing */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                Preparing ({preparingTickets.length})
              </h3>
            </div>
          </div>
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {preparingTickets.length === 0 ? (
                <motion.div
                  key="empty-prep"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="p-8 rounded-3xl bg-white/70 border border-dashed border-slate-200 text-center text-xs text-slate-400"
                >
                  No orders preparing
                </motion.div>
              ) : (
                preparingTickets.map((t) => renderOrderCard(t, 'preparing'))
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Column 3: Cooking */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
              <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                Cooking ({cookingTickets.length})
              </h3>
            </div>
          </div>
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {cookingTickets.length === 0 ? (
                <motion.div
                  key="empty-cook"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="p-8 rounded-3xl bg-white/70 border border-dashed border-slate-200 text-center text-xs text-slate-400"
                >
                  No orders on stove/grill
                </motion.div>
              ) : (
                cookingTickets.map((t) => renderOrderCard(t, 'cooking'))
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Column 4: Ready for Pickup */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                Ready for Pickup ({readyTickets.length})
              </h3>
            </div>
          </div>
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {readyTickets.length === 0 ? (
                <motion.div
                  key="empty-ready"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="p-8 rounded-3xl bg-white/70 border border-dashed border-slate-200 text-center text-xs text-slate-400"
                >
                  No orders ready for pickup
                </motion.div>
              ) : (
                readyTickets.map((t) => renderOrderCard(t, 'ready'))
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};
