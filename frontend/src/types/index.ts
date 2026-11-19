export type UserRole = 'admin' | 'manager' | 'cashier' | 'waiter' | 'kitchen' | 'customer';

export type OrderType = 'dine_in' | 'pickup' | 'delivery';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'cooking'
  | 'ready'
  | 'picked_up'
  | 'served'
  | 'completed'
  | 'cancelled'
  | 'accepted'
  | 'new';

export type TicketStatus =
  | 'new'
  | 'accepted'
  | 'preparing'
  | 'cooking'
  | 'ready'
  | 'served'
  | 'cancelled';

export type KitchenStation = 'main_kitchen' | 'bar' | 'dessert';

export interface Category {
  id: number;
  name: string;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Product {
  id: number;
  category_id: number;
  name: string;
  description?: string | null;
  price: number | string;
  sku: string;
  station: KitchenStation | string;
  is_available: boolean;
  prep_time_minutes?: number;
  image_url?: string | null;
  current_stock?: number;
  created_at?: string;
  updated_at?: string;
}

export interface RestaurantTable {
  id: number;
  restaurant_id: number;
  table_number: string;
  seating_capacity: number;
  qr_token: string;
  is_active: boolean;
  active_orders_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  special_instructions?: string;
}

export interface OrderItemResponse {
  id: number;
  order_id?: number;
  product_id: number;
  product_name?: string;
  item_name?: string;
  unit_price: number | string;
  quantity: number;
  subtotal: number | string;
  special_instructions?: string | null;
  prep_time_minutes?: number;
  station?: string;
  round_number?: number;
}

export interface OrderVoucherResponse {
  id?: number;
  voucher_number: string;
  order_number: string;
  table_number: string;
  confirmed_at: string;
  confirmed_by?: number | null;
  items: Array<{
    dish_name: string;
    quantity: number;
    special_instructions?: string | null;
  }>;
  total_amount: string; // Strictly formatted string, e.g. "15,000 MMK"
}

export interface OrderStatusHistoryItem {
  id: number;
  order_id: number;
  previous_status?: string | null;
  new_status: string;
  changed_by?: number | null;
  is_system?: boolean;
  actor_type?: string;
  notes?: string | null;
  created_at?: string;
  changed_timestamp?: string;
}

export interface OrderResponse {
  id: number;
  order_number: string;
  customer_id?: number | null;
  table_id?: number | null;
  table_number?: string | null;
  order_type: OrderType | string;
  status: OrderStatus | string;
  delivery_address?: string | null;
  special_instructions?: string | null;
  total_amount: number | string;
  currency: string;
  current_round: number;
  confirmed_at?: string | null;
  confirmed_by?: number | null;
  confirmed_total?: number | string | null;
  preparing_at?: string | null;
  preparation_duration_seconds?: number | null;
  preparation_due_at?: string | null;
  cooking_at?: string | null;
  ready_at?: string | null;
  picked_up_at?: string | null;
  created_at: string;
  updated_at?: string;
  items: OrderItemResponse[];
  voucher?: OrderVoucherResponse | null;
  status_history?: OrderStatusHistoryItem[];
}

export interface KitchenTicketItem {
  order_item_id?: number;
  product_id: number;
  item_name: string;
  quantity: number;
  notes?: string | null;
  special_instructions?: string | null;
}

export interface KitchenTicketResponse {
  id: number;
  order_id: number;
  round_number: number;
  station: KitchenStation | string;
  status: TicketStatus | string;
  table_number?: string | null;
  special_instructions?: string | null;
  preparing_at?: string | null;
  preparation_due_at?: string | null;
  preparation_duration_seconds?: number | null;
  cooking_at?: string | null;
  ticket_items: KitchenTicketItem[];
  created_at: string;
  updated_at?: string;
}

export interface UserResponse {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  role: UserRole | string;
  user_id: number;
  username: string;
}

export interface BestSellerItem {
  item_name: string;
  total_quantity: number;
  total_revenue: number;
  order_count?: number;
  percentage?: number;
}

export interface DailySalesTimeline {
  date: string;
  sales: number;
  orders: number;
  completed_orders?: number;
  cancelled_orders?: number;
}

export interface AdminAnalyticsResponse {
  currency: string;
  date_range: string;
  today_sales: number;
  today_orders_count: number;
  completed_orders_count: number;
  pending_orders_count: number;
  cancelled_orders_count: number;
  average_order_value: number;
  active_tables_count: number;
  total_tables_count: number;
  best_sellers: BestSellerItem[];
  daily_sales_timeline: DailySalesTimeline[];
}

export interface ProductCreateInput {
  category_id: number;
  name: string;
  description?: string;
  price: number;
  sku: string;
  station?: KitchenStation | string;
  is_available?: boolean;
  initial_stock?: number;
}

export interface ProductUpdateInput {
  category_id?: number;
  name?: string;
  description?: string;
  price?: number;
  sku?: string;
  station?: KitchenStation | string;
  is_available?: boolean;
}

export interface CategoryCreateInput {
  name: string;
  description?: string;
  is_active?: boolean;
}

export interface CategoryUpdateInput {
  name?: string;
  description?: string;
  is_active?: boolean;
}
