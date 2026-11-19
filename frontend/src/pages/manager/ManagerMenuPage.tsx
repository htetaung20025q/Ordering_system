import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  X,
  Sparkles,
} from 'lucide-react';
import { Product, Category, KitchenStation } from '@/types';
import { fetchProducts, fetchCategories, createProduct, updateProduct, deleteProduct } from '@/services/api/menu';
import { Button } from '@/components/common/Button';
import { formatCurrency } from '@/utils/formatters';
import { getFoodImage } from '@/utils/foodImages';

export const ManagerMenuPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<number | 'all'>('all');
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  // Form Fields
  const [formName, setFormName] = useState<string>('');
  const [formCategoryId, setFormCategoryId] = useState<number>(1);
  const [formPrice, setFormPrice] = useState<number>(5000);
  const [formSku, setFormSku] = useState<string>('');
  const [formStation, setFormStation] = useState<KitchenStation>('main_kitchen');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formIsAvailable, setFormIsAvailable] = useState<boolean>(true);
  const [formStock, setFormStock] = useState<number>(50);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [prods, cats] = await Promise.all([fetchProducts(), fetchCategories()]);
      setProducts(prods);
      setCategories(cats);
      if (cats.length > 0 && !formCategoryId) {
        setFormCategoryId(cats[0].id);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load menu data');
    } finally {
      setIsLoading(false);
    }
  }, [formCategoryId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenCreate = () => {
    setFormName('');
    setFormCategoryId(categories[0]?.id || 1);
    setFormPrice(5000);
    setFormSku(`SKU-${Date.now().toString().slice(-4)}`);
    setFormStation('main_kitchen');
    setFormDescription('');
    setFormIsAvailable(true);
    setFormStock(50);
    setIsCreateModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setFormName(p.name);
    setFormCategoryId(p.category_id);
    setFormPrice(Number(p.price));
    setFormSku(p.sku);
    setFormStation(p.station as KitchenStation);
    setFormDescription(p.description || '');
    setFormIsAvailable(p.is_available);
    setIsCreateModalOpen(false);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, {
          name: formName,
          category_id: formCategoryId,
          price: formPrice,
          sku: formSku,
          station: formStation,
          description: formDescription,
          is_available: formIsAvailable,
        });
        setEditingProduct(null);
      } else {
        await createProduct({
          name: formName,
          category_id: formCategoryId,
          price: formPrice,
          sku: formSku,
          station: formStation,
          description: formDescription,
          is_available: formIsAvailable,
          initial_stock: formStock,
        });
        setIsCreateModalOpen(false);
      }
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save product');
    }
  };

  const handleToggleAvailability = async (p: Product) => {
    try {
      await updateProduct(p.id, { is_available: !p.is_available });
      setProducts((prev) =>
        prev.map((item) => (item.id === p.id ? { ...item, is_available: !item.is_available } : item))
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to toggle availability');
    }
  };

  const handleDeleteProduct = async () => {
    if (!productToDelete) return;
    try {
      await deleteProduct(productToDelete.id);
      setProductToDelete(null);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Cannot delete product linked to orders');
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === 'all' || p.category_id === selectedCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Page Title & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Menu Items Management</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Create, update prices, manage descriptions, and toggle food availability
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
          <Button variant="primary" size="sm" onClick={handleOpenCreate} className="shadow-xs">
            <Plus className="w-4 h-4 mr-1.5" />
            <span>Add Food Item</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search & Category Filter Toolbar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search dish name or SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none focus:border-black transition"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap ${
              selectedCategory === 'all'
                ? 'bg-black text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:text-black'
            }`}
          >
            All Categories ({products.length})
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap ${
                selectedCategory === c.id
                  ? 'bg-black text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:text-black'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Food Items High-Density Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-black tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Dish</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Price (MMK)</th>
                <th className="py-3 px-4">Kitchen Station</th>
                <th className="py-3 px-4">Availability</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No food items matching filter
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const catName = categories.find((c) => c.id === p.category_id)?.name || 'Mains';
                  const imgUrl = getFoodImage(p.name);

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={imgUrl}
                            alt={p.name}
                            className="w-11 h-11 rounded-2xl object-cover bg-slate-100 border border-slate-100 shadow-2xs shrink-0"
                          />
                          <div>
                            <span className="font-bold text-slate-900 block text-xs leading-snug">
                              {p.name}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              SKU: {p.sku}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-700">{catName}</td>
                      <td className="py-3.5 px-4">
                        <span className="font-black text-slate-900 text-sm font-mono">
                          {formatCurrency(p.price)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold uppercase tracking-wide">
                          {p.station.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => handleToggleAvailability(p)}
                          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold transition ${
                            p.is_available
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-red-50 text-red-600 border border-red-200'
                          }`}
                        >
                          {p.is_available ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                          <span>{p.is_available ? 'Available' : 'Unavailable'}</span>
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEdit(p)}
                            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500 hover:text-black transition"
                            title="Edit Item & Price"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setProductToDelete(p)}
                            className="p-1.5 rounded-full hover:bg-red-50 text-slate-400 hover:text-red-600 transition"
                            title="Delete Item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT MODAL */}
      {(isCreateModalOpen || editingProduct) && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-black text-sm text-slate-900">
                {editingProduct ? `Edit ${editingProduct.name}` : 'Create New Food Item'}
              </h3>
              <button
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setEditingProduct(null);
                }}
                className="p-1 rounded-full text-slate-400 hover:text-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Dish Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  placeholder="e.g. Crispy Duck Breast"
                  className="w-full px-4 py-2.5 rounded-full bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-black"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Price (MMK)</label>
                  <input
                    type="number"
                    min="100"
                    step="100"
                    value={formPrice}
                    onChange={(e) => setFormPrice(parseFloat(e.target.value))}
                    required
                    className="w-full px-4 py-2.5 rounded-full bg-slate-50 border border-slate-200 text-xs text-slate-900 font-mono font-bold focus:outline-none focus:border-black"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">SKU Code</label>
                  <input
                    type="text"
                    value={formSku}
                    onChange={(e) => setFormSku(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 rounded-full bg-slate-50 border border-slate-200 text-xs text-slate-900 font-mono focus:outline-none focus:border-black"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                  <select
                    value={formCategoryId}
                    onChange={(e) => setFormCategoryId(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2.5 rounded-full bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-black"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Station</label>
                  <select
                    value={formStation}
                    onChange={(e) => setFormStation(e.target.value as KitchenStation)}
                    className="w-full px-3 py-2.5 rounded-full bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-black"
                  >
                    <option value="main_kitchen">Main Kitchen</option>
                    <option value="bar">Bar & Drinks</option>
                    <option value="dessert">Dessert & Pastry</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={2}
                  placeholder="Appetizing description of ingredients and flavors..."
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-black resize-none"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-xs font-bold text-slate-700">Available to Order</span>
                <input
                  type="checkbox"
                  checked={formIsAvailable}
                  onChange={(e) => setFormIsAvailable(e.target.checked)}
                  className="w-4 h-4 rounded text-black focus:ring-black"
                />
              </div>

              {editingProduct && (
                <div className="p-3 rounded-2xl bg-blue-50 text-[11px] text-blue-700 border border-blue-100 flex items-start gap-2">
                  <Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" />
                  <span>
                    Price changes apply immediately to upcoming customer orders. Existing orders and vouchers preserve their original price snapshot.
                  </span>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setEditingProduct(null);
                  }}
                  className="px-4 py-2 rounded-full text-slate-600 hover:bg-slate-100 text-xs font-bold transition"
                >
                  Cancel
                </button>
                <Button type="submit" variant="primary" size="sm">
                  {editingProduct ? 'Update Dish' : 'Create Dish'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-sm text-slate-900">Delete {productToDelete.name}?</h3>
                <p className="text-xs text-slate-500">This will remove the item from the catalog.</p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 text-[11px] text-slate-600 border border-slate-100">
              Note: If this dish is referenced by past orders, database integrity will protect historical order snapshots.
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                className="px-4 py-2 rounded-full text-slate-600 hover:bg-slate-100 text-xs font-bold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteProduct}
                className="px-4 py-2 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition shadow-xs"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
