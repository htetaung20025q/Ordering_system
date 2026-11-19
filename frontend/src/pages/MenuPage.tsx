import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, UtensilsCrossed } from 'lucide-react';
import { Category, Product } from '@/types';
import { fetchCategories, fetchProducts } from '@/services/api/menu';
import { CategoryScroll } from '@/components/food/CategoryScroll';
import { FoodCard } from '@/components/food/FoodCard';
import { FoodDetailModal } from '@/components/food/FoodDetailModal';
import { FoodCardSkeleton } from '@/components/common/Skeleton';

export const MenuPage: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([fetchCategories(), fetchProducts()])
      .then(([cats, prods]) => {
        setCategories(cats);
        setProducts(prods);
      })
      .catch((err) => {
        console.error('Failed to load menu data:', err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const categoryMap = useMemo(() => {
    const map = new Map<number, string>();
    categories.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [categories]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCategory = selectedCategoryId === null || p.category_id === selectedCategoryId;
      const matchesSearch =
        searchQuery === '' ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategoryId, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Search Input Bar (White Glass Capsule) */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search artisan burgers, drinks, fries..."
          className="w-full pl-11 pr-4 py-3 rounded-full bg-white border border-slate-200/90 text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:border-black transition shadow-sm shadow-slate-100"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500 hover:text-black bg-slate-100 px-2 py-0.5 rounded-full"
          >
            Clear
          </button>
        )}
      </div>

      {/* Horizontal Category Pill Scroll */}
      <CategoryScroll
        categories={categories}
        selectedCategoryId={selectedCategoryId}
        onSelectCategory={setSelectedCategoryId}
      />

      {/* Section Header */}
      <div className="flex items-center justify-between pt-1">
        <h3 className="font-extrabold text-sm text-slate-900 tracking-tight">
          {selectedCategoryId
            ? categoryMap.get(selectedCategoryId) || 'Specialties'
            : searchQuery
            ? `Search Results (${filteredProducts.length})`
            : 'Popular Gourmet Specialties'}
        </h3>
        <span className="text-[11px] text-slate-500 font-bold">
          {filteredProducts.length} {filteredProducts.length === 1 ? 'dish' : 'dishes'}
        </span>
      </div>

      {/* Food Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <FoodCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="py-16 text-center text-slate-500 space-y-2"
        >
          <UtensilsCrossed className="w-10 h-10 mx-auto text-slate-300 mb-2" />
          <h4 className="font-bold text-sm text-slate-800">No dishes found</h4>
          <p className="text-xs text-slate-400">Try a different search query or category.</p>
        </motion.div>
      ) : (
        <motion.div layout className="grid grid-cols-2 gap-3">
          <AnimatePresence mode="popLayout">
            {filteredProducts.map((product) => (
              <FoodCard
                key={product.id}
                product={product}
                categoryName={categoryMap.get(product.category_id)}
                onOpenDetail={(prod) => setSelectedProduct(prod)}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Food Detail Modal */}
      <FoodDetailModal
        product={selectedProduct}
        categoryName={selectedProduct ? categoryMap.get(selectedProduct.category_id) : undefined}
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />
    </div>
  );
};
