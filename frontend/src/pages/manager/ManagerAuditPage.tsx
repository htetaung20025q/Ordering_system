import React, { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { Product } from '@/types';
import { fetchProducts, updateProduct } from '@/services/api/menu';
import { formatCurrency } from '@/utils/formatters';
import { getFoodImage } from '@/utils/foodImages';

export const ManagerAuditPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchProducts();
      setProducts(data);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggle = async (p: Product) => {
    try {
      await updateProduct(p.id, { is_available: !p.is_available });
      setProducts((prev) =>
        prev.map((item) => (item.id === p.id ? { ...item, is_available: !item.is_available } : item))
      );
    } catch {
      // Ignored
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Live Customer Menu Audit</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Simulated view of the customer ordering menu with instant availability toggles
          </p>
        </div>

        <button
          onClick={loadData}
          className="p-2.5 rounded-full bg-white border border-slate-200 text-slate-600 hover:text-black hover:bg-slate-50 transition shadow-2xs"
          title="Refresh Menu"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {products.map((p) => {
          const imgUrl = getFoodImage(p.name);
          return (
            <div
              key={p.id}
              className={`bg-white rounded-3xl p-3 border transition shadow-2xs flex flex-col justify-between ${
                p.is_available ? 'border-slate-200' : 'border-slate-200 opacity-60 bg-slate-50'
              }`}
            >
              <div className="space-y-2">
                <div className="aspect-4/3 rounded-2xl overflow-hidden bg-slate-100 relative">
                  <img src={imgUrl} alt={p.name} className="w-full h-full object-cover" />
                  {!p.is_available && (
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-2xs flex items-center justify-center">
                      <span className="text-[10px] font-black uppercase text-white px-2 py-1 bg-red-600 rounded-full">
                        Sold Out
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="font-bold text-xs text-slate-900 leading-snug line-clamp-1">{p.name}</h4>
                  <span className="text-xs font-black text-slate-900 font-mono mt-0.5 block">
                    {formatCurrency(p.price)}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 mt-2 flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                  {p.station.replace('_', ' ')}
                </span>
                <button
                  onClick={() => handleToggle(p)}
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-full transition flex items-center gap-1 ${
                    p.is_available
                      ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      : 'bg-red-50 text-red-600 hover:bg-red-100'
                  }`}
                >
                  {p.is_available ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                  <span>{p.is_available ? 'In Stock' : 'Disabled'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
