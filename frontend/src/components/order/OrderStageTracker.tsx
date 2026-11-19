import React from 'react';
import { CheckCircle2, Clock, ChefHat, Flame, BellRing } from 'lucide-react';
import clsx from 'clsx';
import { OrderStatus } from '@/types';
import { formatDate } from '@/utils/formatters';

interface OrderStageTrackerProps {
  status: OrderStatus | string;
  confirmedAt?: string | null;
  preparationDueAt?: string | null;
  preparationDurationSeconds?: number | null;
}

export const OrderStageTracker: React.FC<OrderStageTrackerProps> = ({
  status,
  confirmedAt,
  preparationDueAt,
}) => {
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const getRemainingTimeStr = () => {
    if (!preparationDueAt) return null;
    const diff = Math.max(0, Math.floor((new Date(preparationDueAt).getTime() - Date.now()) / 1000));
    if (diff <= 0) return 'Finishing prep — transitioning to cooking...';
    const mins = Math.floor(diff / 60);
    const secs = diff % 60;
    return `Estimated prep remaining: ~${mins}:${secs.toString().padStart(2, '0')}`;
  };
  const stages = [
    { key: 'confirmed', label: 'Confirmed', icon: CheckCircle2, description: 'Chef accepted your order and confirmed kitchen voucher.' },
    { key: 'preparing', label: 'Preparing', icon: ChefHat, description: 'Fresh ingredients are being prepped and assembled.' },
    { key: 'cooking', label: 'Cooking', icon: Flame, description: 'Your dishes are sizzling hot on the kitchen line.' },
    { key: 'ready', label: 'Order Ready', icon: BellRing, description: 'Dishes are freshly plated! Please collect at the pickup counter.' },
  ];

  const getStageIndex = (currentStatus: string): number => {
    const s = currentStatus.toLowerCase();
    if (s === 'confirmed' || s === 'accepted') return 0;
    if (s === 'preparing') return 1;
    if (s === 'cooking') return 2;
    if (['ready', 'picked_up', 'served', 'completed'].includes(s)) return 3;
    return -1;
  };

  const currentIdx = getStageIndex(status);

  return (
    <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-5">
      {/* Tracker Card Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-black text-white flex items-center justify-center">
            <Clock className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider">
              Live Kitchen Timeline
            </h3>
            {confirmedAt && (
              <span className="text-[10px] text-slate-400 block font-medium">
                Confirmed: {formatDate(confirmedAt)}
              </span>
            )}
          </div>
        </div>
        <span className="text-[11px] font-extrabold text-black bg-slate-100 px-3 py-1 rounded-full border border-slate-200 uppercase">
          {status}
        </span>
      </div>

      {/* HORIZONTAL STEPPER WITH CONTINUOUS MOVING GLOW LINE */}
      <div className="pt-2 pb-1">
        {/* Row of Nodes and Connecting Lines */}
        <div className="flex items-center justify-between relative px-2">
          {stages.map((stage, idx) => {
            const Icon = stage.icon;
            const isCompleted = currentIdx > idx;
            const isCurrent = currentIdx === idx;
            const isUpcoming = currentIdx < idx;

            return (
              <React.Fragment key={stage.key}>
                {/* Step Node */}
                <div className="relative z-10 flex flex-col items-center">
                  <div
                    className={clsx(
                      'w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 shadow-xs',
                      isCompleted && 'bg-emerald-500 text-white shadow-emerald-500/20',
                      isCurrent && 'bg-black text-white ring-4 ring-black/10 scale-110 shadow-md',
                      isUpcoming && 'bg-white text-slate-300 border-2 border-slate-200'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                </div>

                {/* Horizontal Connector Line between Nodes */}
                {idx < stages.length - 1 && (
                  <div className="flex-1 mx-2 relative glow-line-track">
                    {/* State 1: Completed connector (solid emerald) */}
                    {idx < currentIdx && (
                      <div className="glow-line-completed" />
                    )}

                    {/* State 2: Active connector with continuous moving glowing light */}
                    {idx === currentIdx && currentIdx < 3 && (
                      <div className="glow-line-active" />
                    )}

                    {/* State 3: All completed if reached ready */}
                    {currentIdx >= 3 && (
                      <div className="glow-line-completed" />
                    )}
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Labels below the horizontal nodes */}
        <div className="grid grid-cols-4 gap-1 text-center pt-3 text-xs">
          {stages.map((stage, idx) => {
            const isCompleted = currentIdx > idx;
            const isCurrent = currentIdx === idx;
            const isUpcoming = currentIdx < idx;

            return (
              <div key={stage.key} className="flex flex-col items-center">
                <span
                  className={clsx(
                    'font-bold text-[11px] truncate max-w-full block',
                    isCurrent && 'text-black font-black',
                    isCompleted && 'text-emerald-700',
                    isUpcoming && 'text-slate-400'
                  )}
                >
                  {stage.label}
                </span>

                {isCurrent && (
                  <span className="text-[9px] font-black uppercase text-panda-500 tracking-wider mt-0.5 animate-pulse">
                    In Progress
                  </span>
                )}
                {isCompleted && (
                  <span className="text-[9px] font-bold text-emerald-600 mt-0.5">
                    Completed
                  </span>
                )}
                {isUpcoming && (
                  <span className="text-[9px] font-medium text-slate-300 mt-0.5">
                    Pending
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Stage Description Card */}
      {currentIdx >= 0 && currentIdx < stages.length && (
        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 flex items-start gap-3">
          <div className="w-2 h-2 rounded-full bg-black mt-1.5 shrink-0 animate-ping" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-black text-slate-900">
                Current Stage: {stages[currentIdx].label}
              </h4>
              {currentIdx === 1 && getRemainingTimeStr() && (
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-mono text-[10px] font-black border border-amber-300">
                  {getRemainingTimeStr()}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
              {stages[currentIdx].description}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
