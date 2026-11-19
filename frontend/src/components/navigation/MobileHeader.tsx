import React from 'react';
import { Link } from 'react-router-dom';
import { UtensilsCrossed, ShieldAlert } from 'lucide-react';
import { useTable } from '@/contexts/TableContext';

export const MobileHeader: React.FC = () => {
  const { table } = useTable();

  return (
    <header className="sticky top-0 z-40 w-full glass-header px-4 py-3 flex items-center justify-between">
      {/* Brand Identity */}
      <Link to="/" className="flex items-center gap-2.5 group">
        <div className="w-9 h-9 rounded-full bg-black text-white flex items-center justify-center shadow-md shadow-black/10 group-hover:scale-105 transition">
          <UtensilsCrossed className="w-4 h-4 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-sm tracking-tight text-slate-900">FLOW-SYS</span>
            <span className="text-[10px] font-bold px-1.5 py-0.2 bg-black text-white rounded-md">
              Gourmet
            </span>
          </div>
          <p className="text-[10px] text-slate-500 font-medium leading-none">Artisan Dining</p>
        </div>
      </Link>

      {/* Right Actions: Table Identification & Staff Login Link */}
      <div className="flex items-center gap-2">
        {/* Table Identification Pill */}
        <div className="px-3 py-1 rounded-full bg-white border border-slate-200/80 shadow-xs flex items-center gap-1.5 text-xs font-bold text-slate-800">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>{table ? table.table_number : 'Table 01'}</span>
        </div>

        {/* Staff Portal Shortcut (Isolated) */}
        <Link
          to="/staff"
          className="p-2 rounded-full bg-white hover:bg-slate-100 border border-slate-200/70 text-slate-600 hover:text-black transition text-xs flex items-center gap-1 font-semibold shadow-xs"
          title="Staff Login"
        >
          <ShieldAlert className="w-4 h-4" />
          <span className="hidden sm:inline text-[11px]">Staff Login</span>
        </Link>
      </div>
    </header>
  );
};
