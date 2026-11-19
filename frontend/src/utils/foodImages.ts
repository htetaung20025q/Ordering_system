/**
 * Curated high-resolution gourmet food photography
 * Matched to restaurant seed products and categories for a native app feel
 */
const FOOD_IMAGE_MAP: Record<string, string> = {
  'signature truffle burger': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80',
  'crispy hot chicken': 'https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=800&q=80',
  'classic cheeseburger': 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=800&q=80',
  'iced peach tea': 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=800&q=80',
  'craft ipa beer': 'https://images.unsplash.com/photo-1608270191986-77e8a93aa5ec?auto=format&fit=crop&w=800&q=80',
  'sparkling water': 'https://images.unsplash.com/photo-1559839914-ba2ae647c050?auto=format&fit=crop&w=800&q=80',
  'golden truffle fries': 'https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=800&q=80',
  'molten chocolate lava cake': 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=800&q=80',
};

const CATEGORY_DEFAULT_IMAGES: Record<string, string> = {
  mains: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=800&q=80',
  drinks: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=800&q=80',
  desserts: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=800&q=80',
};

const DEFAULT_FOOD_IMAGE = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80';

export function getFoodImage(name: string, categoryName?: string, customUrl?: string | null): string {
  if (customUrl && customUrl.startsWith('http')) {
    return customUrl;
  }
  const cleanName = name.toLowerCase().trim();
  for (const [key, url] of Object.entries(FOOD_IMAGE_MAP)) {
    if (cleanName.includes(key) || key.includes(cleanName)) {
      return url;
    }
  }
  if (categoryName) {
    const cleanCat = categoryName.toLowerCase();
    for (const [key, url] of Object.entries(CATEGORY_DEFAULT_IMAGES)) {
      if (cleanCat.includes(key)) {
        return url;
      }
    }
  }
  return DEFAULT_FOOD_IMAGE;
}
