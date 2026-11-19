import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { TableProvider } from '@/contexts/TableContext';
import { CartProvider } from '@/contexts/CartContext';
import { OrderProvider } from '@/contexts/OrderContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/common/ProtectedRoute';

// Layouts
import { CustomerLayout } from '@/layouts/CustomerLayout';
import { KitchenLayout } from '@/layouts/KitchenLayout';
import { ManagerLayout } from '@/layouts/ManagerLayout';
import { AdminLayout } from '@/layouts/AdminLayout';

// Customer Pages
import { MenuPage } from '@/pages/MenuPage';
import { FoodDetailPage } from '@/pages/FoodDetailPage';
import { CartPage } from '@/pages/CartPage';
import { CheckoutPage } from '@/pages/CheckoutPage';
import { MyOrdersPage } from '@/pages/MyOrdersPage';
import { OrderTrackingPage } from '@/pages/OrderTrackingPage';
import { VoucherPage } from '@/pages/VoucherPage';

// Kitchen Pages
import { KitchenLoginPage } from '@/pages/kitchen/KitchenLoginPage';
import { KitchenKDSPage } from '@/pages/kitchen/KitchenKDSPage';

// Manager Pages
import { ManagerLoginPage } from '@/pages/manager/ManagerLoginPage';
import { ManagerMenuPage } from '@/pages/manager/ManagerMenuPage';
import { ManagerCategoryPage } from '@/pages/manager/ManagerCategoryPage';
import { ManagerAuditPage } from '@/pages/manager/ManagerAuditPage';

// Admin Pages
import { AdminLoginPage } from '@/pages/admin/AdminLoginPage';
import { AdminDashboardPage } from '@/pages/admin/AdminDashboardPage';
import { AdminAnalyticsPage } from '@/pages/admin/AdminAnalyticsPage';
import { AdminOrdersPage } from '@/pages/admin/AdminOrdersPage';
import { AdminTablesPage } from '@/pages/admin/AdminTablesPage';
import { AdminMenuOverviewPage } from '@/pages/admin/AdminMenuOverviewPage';

// Root redirect with QR query string preservation
const RootRedirect: React.FC = () => {
  const [searchParams] = useSearchParams();
  const queryString = searchParams.toString();
  return <Navigate to={`/customer${queryString ? `?${queryString}` : ''}`} replace />;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <TableProvider>
          <CartProvider>
            <OrderProvider>
              <Routes>
                {/* 1. ROOT & CUSTOMER INTERFACE (/customer) */}
                <Route path="/" element={<RootRedirect />} />

                <Route path="/customer" element={<CustomerLayout />}>
                  <Route index element={<MenuPage />} />
                  <Route path="menu" element={<MenuPage />} />
                  <Route path="food/:id" element={<FoodDetailPage />} />
                  <Route path="cart" element={<CartPage />} />
                  <Route path="checkout" element={<CheckoutPage />} />
                  <Route path="orders" element={<MyOrdersPage />} />
                  <Route path="orders/:id" element={<OrderTrackingPage />} />
                  <Route path="orders/:id/voucher" element={<VoucherPage />} />
                </Route>

                {/* Legacy/Direct Customer Routes Backward Compatibility */}
                <Route element={<CustomerLayout />}>
                  <Route path="/menu" element={<MenuPage />} />
                  <Route path="/food/:id" element={<FoodDetailPage />} />
                  <Route path="/cart" element={<CartPage />} />
                  <Route path="/checkout" element={<CheckoutPage />} />
                  <Route path="/orders" element={<MyOrdersPage />} />
                  <Route path="/orders/:id" element={<OrderTrackingPage />} />
                  <Route path="/orders/:id/voucher" element={<VoucherPage />} />
                </Route>

                {/* 2. KITCHEN INTERFACE (/kitchen) */}
                <Route path="/kitchen/login" element={<KitchenLoginPage />} />
                <Route
                  path="/kitchen"
                  element={
                    <ProtectedRoute allowedRoles={['kitchen', 'manager', 'admin']} loginPath="/kitchen/login">
                      <KitchenLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<KitchenKDSPage />} />
                  <Route path="kds" element={<KitchenKDSPage />} />
                  <Route path="history" element={<KitchenKDSPage />} />
                </Route>

                {/* 3. MANAGER INTERFACE (/manager) */}
                <Route path="/manager/login" element={<ManagerLoginPage />} />
                <Route
                  path="/manager"
                  element={
                    <ProtectedRoute allowedRoles={['manager', 'admin']} loginPath="/manager/login">
                      <ManagerLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<ManagerMenuPage />} />
                  <Route path="menu" element={<ManagerMenuPage />} />
                  <Route path="categories" element={<ManagerCategoryPage />} />
                  <Route path="audit" element={<ManagerAuditPage />} />
                </Route>

                {/* 4. ADMIN INTERFACE (/admin) — DESKTOP-FIRST BUSINESS DASHBOARD */}
                <Route path="/admin/login" element={<AdminLoginPage />} />
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute allowedRoles={['admin']} loginPath="/admin/login">
                      <AdminLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<AdminDashboardPage />} />
                  <Route path="dashboard" element={<AdminDashboardPage />} />
                  <Route path="analytics" element={<AdminAnalyticsPage />} />
                  <Route path="orders" element={<AdminOrdersPage />} />
                  <Route path="tables" element={<AdminTablesPage />} />
                  <Route path="menu" element={<AdminMenuOverviewPage />} />
                </Route>

                {/* Legacy Staff Route -> Redirect to Kitchen */}
                <Route path="/staff" element={<Navigate to="/kitchen" replace />} />

                {/* Catch-all redirect to Customer Menu */}
                <Route path="*" element={<Navigate to="/customer" replace />} />
              </Routes>
            </OrderProvider>
          </CartProvider>
        </TableProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
