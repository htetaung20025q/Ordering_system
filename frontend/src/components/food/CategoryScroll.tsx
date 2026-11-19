import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { Category } from '@/types';
import { Flame, Beef, Beer, CakeSlice, Sparkles } from 'lucide-react';

interface CategoryScrollProps {
  categories: Category[];
  selectedCategoryId: number | null;
  onSelectCategory: (categoryId: number | null) => void;
}

export const CategoryScroll: React.FC<CategoryScrollProps> = ({
  categories,
  selectedCategoryId,
  onSelectCategory,
}) => {
  const getCategoryIcon = (name: string) => {
    const clean = name.toLowerCase();
    if (clean.includes('burger') || clean.includes('main')) return Beef;
    if (clean.includes('drink') || clean.includes('bar')) return Beer;
    if (clean.includes('dessert') || clean.includes('side')) return CakeSlice;
    return Sparkles;
  };

  return (
    <div className="w-full overflow-x-auto no-scrollbar py-2 -mx-4 px-4 flex items-center gap-2">
      {/* "All Dishes" Pill */}
      <motion.button
        whileTap={{ scale: 0.94 }}
        onClick={() => onSelectCategory(null)}
        className={clsx(
          'relative flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold shrink-0 select-none shadow-2xs transition-colors duration-150',
          selectedCategoryId === null
            ? 'text-white'
            : 'bg-white text-slate-700 hover:text-black hover:bg-slate-50 border border-slate-200/80'
        )}
      >
        {selectedCategoryId === null && (
          <motion.div
            layoutId="categoryGlider"
            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            className="absolute inset-0 bg-black rounded-full shadow-sm"
          />
        )}
        <span className="relative z-10 flex items-center gap-1.5">
          <Flame className="w-3.5 h-3.5 text-current" />
          <span>All Dishes</span>
        </span>
      </motion.button>

      {/* Dynamic Categories */}
      {categories.map((cat) => {
        const Icon = getCategoryIcon(cat.name);
        const isSelected = selectedCategoryId === cat.id;

        return (
          <motion.button
            key={cat.id}
            whileTap={{ scale: 0.94 }}
            onClick={() => onSelectCategory(cat.id)}
            className={clsx(
              'relative flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold shrink-0 select-none shadow-2xs transition-colors duration-150',
              isSelected
                ? 'text-white'
                : 'bg-white text-slate-700 hover:text-black hover:bg-slate-50 border border-slate-200/80'
            )}
          >
            {isSelected && (
              <motion.div
                layoutId="categoryGlider"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                className="absolute inset-0 bg-black rounded-full shadow-sm"
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              <Icon className="w-3.5 h-3.5 text-current" />
              <span>{cat.name}</span>
            </span>
          </motion.button>
        );
      })}
    </div>
  );
};
