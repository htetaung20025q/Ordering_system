import React from 'react';
import { BellRing, ArrowRight, Utensils } from 'lucide-react';

interface ReadyNotificationBannerProps {
  tableNumber?: string | null;
}

export const ReadyNotificationBanner: React.FC<ReadyNotificationBannerProps> = ({
  tableNumber,
}) => {
  return (
    <div className="bg-emerald-500 text-white rounded-3xl p-4 shadow-lg shadow-emerald-500/20 space-y-2.5 animate-bounce-short">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-full bg-white text-emerald-700 flex items-center justify-center shrink-0 shadow-xs">
          <BellRing className="w-5 h-5 animate-pulse" />
        </div>
        <div>
          <h3 className="font-black text-sm text-white tracking-tight">
            YOUR ORDER IS READY!
          </h3>
          <p className="text-xs text-emerald-50 font-medium">
            Fresh dishes for {tableNumber || 'your table'} are waiting.
          </p>
        </div>
      </div>

      <div className="bg-emerald-600/80 rounded-2xl p-3 border border-emerald-400/40 flex items-center justify-between text-xs text-white">
        <span className="flex items-center gap-1.5 font-bold">
          <Utensils className="w-3.5 h-3.5 text-white" />
          Please collect your food at the pickup counter.
        </span>
        <ArrowRight className="w-4 h-4 text-white shrink-0" />
      </div>
    </div>
  );
};
