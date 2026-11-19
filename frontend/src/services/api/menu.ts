import { apiClient } from './client';
import {
  Category,
  Product,
  RestaurantTable,
  ProductCreateInput,
  ProductUpdateInput,
  CategoryCreateInput,
  CategoryUpdateInput,
} from '@/types';

export async function fetchCategories(): Promise<Category[]> {
  return apiClient<Category[]>('/categories');
}

export async function createCategory(data: CategoryCreateInput): Promise<Category> {
  return apiClient<Category>('/categories', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateCategory(id: number, data: CategoryUpdateInput): Promise<Category> {
  return apiClient<Category>(`/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteCategory(id: number): Promise<void> {
  return apiClient<void>(`/categories/${id}`, {
    method: 'DELETE',
  });
}

export async function fetchProducts(categoryId?: number): Promise<Product[]> {
  const query = categoryId ? `?category_id=${categoryId}` : '';
  return apiClient<Product[]>(`/products${query}`);
}

export async function fetchProductById(id: number): Promise<Product> {
  return apiClient<Product>(`/products/${id}`);
}

export async function createProduct(data: ProductCreateInput): Promise<Product> {
  return apiClient<Product>('/products', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateProduct(id: number, data: ProductUpdateInput): Promise<Product> {
  return apiClient<Product>(`/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteProduct(id: number): Promise<void> {
  return apiClient<void>(`/products/${id}`, {
    method: 'DELETE',
  });
}

export async function resolveTableByToken(token: string): Promise<RestaurantTable> {
  return apiClient<RestaurantTable>(`/tables/resolve?token=${encodeURIComponent(token)}`);
}
