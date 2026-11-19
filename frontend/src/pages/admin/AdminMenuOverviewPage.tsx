import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, ExternalLink } from 'lucide-react';
import { Product, Category } from '@/types';
import { fetchProducts, fetchCategories } from '@/services/api/menu';
import { formatCurrency } from '@/utils/formatters';
import { getFoodImage } from '@/utils/foodImages';

export const AdminMenuOverviewPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [prods, cats] = await Promise.all([fetchProducts(), fetchCategories()]);
      setProducts(prods);
      setCategories(cats);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const activeCount = products.filter((p) => p.is_available).length;
  const mainKitchenCount = products.filter((p) => p.station === 'main_kitchen').length;
  const barCount = products.filter((p) => p.station === 'bar').length;
  const dessertCount = products.filter((p) => p.station === 'dessert').length;

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Menu Catalog & Station Overview</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit restaurant menu pricing distribution, categories, and kitchen station allocations
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="p-2.5 rounded-full bg-white border border-slate-200 text-slate-600 hover:text-black hover:bg-slate-50 transition shadow-2xs"
            title="Refresh Catalog"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            to="/manager"
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-black text-white hover:bg-slate-800 text-xs font-bold transition shadow-xs"
          >
            <span>Open Manager Menu Editor</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Food Items</span>
          <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">{products.length} Items</div>
          <span className="text-[10px] text-emerald-600 font-bold block">{activeCount} Currently Available</span>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Main Kitchen Dishes</span>
          <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">{mainKitchenCount} Dishes</div>
          <span className="text-[10px] text-slate-500 font-medium block">Hot Kitchen & Grills</span>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Bar & Beverages</span>
          <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">{barCount} Drinks</div>
          <span className="text-[10px] text-slate-500 font-medium block">Cocktails, Teas & Juices</span>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Pastry & Dessert</span>
          <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">{dessertCount} Treats</div>
          <span className="text-[10px] text-slate-500 font-medium block">Pastry Kitchen</span>
        </div>
      </div>

      {/* Catalog Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-black text-sm text-slate-900">Current Authoritative Menu Catalog</h3>
          <span className="text-xs font-mono font-bold text-slate-400">{products.length} Products Loaded</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-black tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-5">Dish</th>
                <th className="py-3 px-5">Category</th>
                <th className="py-3 px-5">Price (MMK)</th>
                <th className="py-3 px-5">Kitchen Station</th>
                <th className="py-3 px-5">Stock State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((p) => {
                const cat = categories.find((c) => c.id === p.category_id)?.name || 'Mains';
                const imgUrl = getFoodImage(p.name);

                return (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-3">
                        <img src={imgUrl} alt={p.name} className="w-9 h-9 rounded-xl object-cover bg-slate-100" />
                        <div>
                          <span className="font-bold text-slate-900 block">{p.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{p.sku}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-5 font-medium text-slate-700">{cat}</td>
                    <td className="py-3 px-5 font-black text-slate-900 font-mono text-sm">{formatCurrency(p.price)}</td>
                    <td className="py-3 px-5">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold uppercase">
                        {p.station.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          p.is_available ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                        }`}
                      >
                        {p.is_available ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
