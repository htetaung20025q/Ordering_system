import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChefHat,
  QrCode,
  LogOut,
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Shield,
  User,
  Printer,
  Download,
  Edit2,
  Trash2,
  X,
  Users,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { KitchenTicketResponse, RestaurantTable, OrderResponse } from '@/types';
import { fetchKDSTickets, executeChefOrderAction, dismissKDSTicket } from '@/services/api/kds';
import {
  fetchAdminTables,
  rotateTableQR,
  updateAdminTable,
  deleteAdminTable,
  getTableQrUrl,
  getTableCardUrl,
  createAdminTable,
} from '@/services/api/admin';
import { fetchOrdersByTable } from '@/services/api/order';
import { Button } from '@/components/common/Button';
import { formatCurrency, formatDate } from '@/utils/formatters';

export const StaffPortalPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, login, logout } = useAuth();

  const [activeTab, setActiveTab] = useState<'kds' | 'tables'>('kds');
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  // KDS State
  const [tickets, setTickets] = useState<KitchenTicketResponse[]>([]);
  const [isLoadingKDS, setIsLoadingKDS] = useState<boolean>(false);

  // Admin Tables State
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [tableOrders, setTableOrders] = useState<OrderResponse[]>([]);
  const [newTableNumber, setNewTableNumber] = useState<string>('');
  const [newTableCapacity, setNewTableCapacity] = useState<number>(4);

  // Edit & Delete & Card Modal State
  const [editingTable, setEditingTable] = useState<RestaurantTable | null>(null);
  const [editTableNumber, setEditTableNumber] = useState<string>('');
  const [editTableCapacity, setEditTableCapacity] = useState<number>(4);
  const [tableToDelete, setTableToDelete] = useState<RestaurantTable | null>(null);
  const [tableActionError, setTableActionError] = useState<string | null>(null);
  const [isRotatingQR, setIsRotatingQR] = useState<boolean>(false);

  useEffect(() => {
    if (isAuthenticated) {
      if (activeTab === 'kds') {
        loadKDSTickets();
      } else if (activeTab === 'tables') {
        loadTables();
      }
    }
  }, [isAuthenticated, activeTab]);

  const loadKDSTickets = async () => {
    setIsLoadingKDS(true);
    try {
      const data = await fetchKDSTickets(true);
      setTickets(data);
    } catch {
      // Ignored
    } finally {
      setIsLoadingKDS(false);
    }
  };

  const loadTables = async () => {
    try {
      const data = await fetchAdminTables();
      setTables(data);
      if (data.length > 0 && !selectedTableId) {
        handleSelectTable(data[0].id);
      }
    } catch {
      // Ignored
    }
  };

  const handleSelectTable = async (tableId: number) => {
    setSelectedTableId(tableId);
    try {
      const orders = await fetchOrdersByTable(tableId);
      setTableOrders(orders);
    } catch {
      setTableOrders([]);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      await login(username, password);
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : 'Invalid credentials');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleChefAction = async (orderId: number, action: 'confirm' | 'prepare' | 'cook' | 'ready' | 'pickup') => {
    try {
      await executeChefOrderAction(orderId, action);
      await loadKDSTickets();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to execute Chef action');
    }
  };

  const handleDismiss = async (ticketId: number) => {
    try {
      await dismissKDSTicket(ticketId);
      setTickets((prev) => prev.filter((t) => t.id !== ticketId));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to dismiss ticket');
    }
  };

  const handleStartEdit = (table: RestaurantTable, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTable(table);
    setEditTableNumber(table.table_number);
    setEditTableCapacity(table.seating_capacity);
    setTableActionError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTable) return;
    setTableActionError(null);
    try {
      await updateAdminTable(editingTable.id, {
        table_number: editTableNumber,
        seating_capacity: editTableCapacity,
      });
      setEditingTable(null);
      await loadTables();
    } catch (err: unknown) {
      setTableActionError(err instanceof Error ? err.message : 'Failed to update table');
    }
  };

  const handlePromptDelete = (table: RestaurantTable, e: React.MouseEvent) => {
    e.stopPropagation();
    setTableToDelete(table);
    setTableActionError(null);
  };

  const handleConfirmDelete = async () => {
    if (!tableToDelete) return;
    setTableActionError(null);
    try {
      await deleteAdminTable(tableToDelete.id);
      if (selectedTableId === tableToDelete.id) {
        setSelectedTableId(null);
        setTableOrders([]);
      }
      setTableToDelete(null);
      await loadTables();
    } catch (err: unknown) {
      setTableActionError(err instanceof Error ? err.message : 'Failed to delete table');
    }
  };

  const handleRotateQR = async (tableId: number) => {
    if (!confirm('Rotate QR token for this table? Previous printed QR codes will be invalidated.')) return;
    setIsRotatingQR(true);
    setTableActionError(null);
    try {
      await rotateTableQR(tableId);
      await loadTables();
    } catch (err: unknown) {
      setTableActionError(err instanceof Error ? err.message : 'Failed to rotate QR');
    } finally {
      setIsRotatingQR(false);
    }
  };

  const handlePrintCard = () => {
    window.print();
  };

  const handleToggleActive = async (table: RestaurantTable) => {
    setTableActionError(null);
    try {
      await updateAdminTable(table.id, { is_active: !table.is_active });
      await loadTables();
    } catch (err: unknown) {
      setTableActionError(err instanceof Error ? err.message : 'Failed to update table');
    }
  };

  const handleCreateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableNumber) return;
    setTableActionError(null);
    try {
      await createAdminTable(newTableNumber, newTableCapacity);
      setNewTableNumber('');
      await loadTables();
    } catch (err: unknown) {
      setTableActionError(err instanceof Error ? err.message : 'Failed to create table');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="py-10 space-y-6 max-w-sm mx-auto">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-black transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Customer Menu</span>
          </button>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xl space-y-4">
          <div className="text-center space-y-1">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-black mx-auto">
              <Shield className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-black text-slate-900">Staff Login</h2>
            <p className="text-xs text-slate-500">Chief KDS & Table Administration Portal</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-3 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter staff username"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                className="w-full px-4 py-2.5 rounded-full bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-black transition placeholder:text-slate-400"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter staff password"
                autoComplete="current-password"
                required
                className="w-full px-4 py-2.5 rounded-full bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-black transition placeholder:text-slate-400"
              />
            </div>

            {loginError && (
              <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isLoggingIn}
              disabled={!username.trim() || !password}
              className="w-full shadow-md shadow-black/10"
            >
              Sign In to Staff Console
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-12">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-black bg-white hover:bg-slate-50 px-3.5 py-1.5 rounded-full border border-slate-200 transition shadow-2xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Exit to Customer App</span>
        </button>

        <button
          onClick={() => logout()}
          className="flex items-center gap-1 text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 px-3 py-1.5 rounded-full border border-red-200 transition"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Logout</span>
        </button>
      </div>

      {/* Staff User Banner */}
      <div className="bg-white rounded-3xl p-4 flex items-center justify-between border border-slate-100 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-slate-100 text-black flex items-center justify-center font-bold">
            <User className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-black text-slate-900">{user?.full_name}</span>
            <span className="text-[10px] text-slate-500 block font-bold uppercase">Role: {user?.role}</span>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-full border border-slate-200/60">
          <button
            onClick={() => setActiveTab('kds')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'kds' ? 'bg-black text-white shadow-xs' : 'text-slate-600 hover:text-black'
            }`}
          >
            <ChefHat className="w-3.5 h-3.5" />
            <span>Chief KDS</span>
          </button>
          {['admin', 'manager'].includes(user?.role || '') && (
            <button
              onClick={() => setActiveTab('tables')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'tables' ? 'bg-black text-white shadow-xs' : 'text-slate-600 hover:text-black'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Tables & QR</span>
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: CHIEF KDS SCREEN */}
      {activeTab === 'kds' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black uppercase text-slate-800 tracking-wider">
              Active Kitchen Tickets ({tickets.length})
            </h3>
            <button
              onClick={loadKDSTickets}
              className="p-2 rounded-full bg-white hover:bg-slate-100 text-slate-600 hover:text-black border border-slate-200 transition shadow-2xs"
              title="Refresh"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {isLoadingKDS ? (
            <div className="py-16 text-center text-slate-500">
              <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs">Updating tickets...</p>
            </div>
          ) : tickets.length === 0 ? (
            <div className="py-16 text-center text-slate-500 space-y-2 bg-white rounded-3xl border border-slate-100 shadow-sm">
              <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-600" />
              <h4 className="text-sm font-bold text-slate-900">All Clear, Chief!</h4>
              <p className="text-xs text-slate-400">No active customer tickets waiting right now.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.map((ticket) => {
                const actionConfig: Record<string, { text: string; action: 'confirm' | 'prepare' | 'cook' | 'ready' | 'pickup'; btnClass: string }> = {
                  new: { text: '👨‍🍳 Confirm Order (Create Voucher)', action: 'confirm', btnClass: 'bg-emerald-600 hover:bg-emerald-700' },
                  accepted: { text: '👨‍🍳 Start Prep', action: 'prepare', btnClass: 'bg-black hover:bg-slate-800' },
                  confirmed: { text: '👨‍🍳 Start Prep', action: 'prepare', btnClass: 'bg-black hover:bg-slate-800' },
                  preparing: { text: '🔥 Start Cooking', action: 'cook', btnClass: 'bg-amber-600 hover:bg-amber-700' },
                  cooking: { text: '✅ Mark as Ready (Alert Counter)', action: 'ready', btnClass: 'bg-emerald-600 hover:bg-emerald-700' },
                  ready: { text: '📦 Mark Picked Up', action: 'pickup', btnClass: 'bg-slate-800 hover:bg-slate-900' },
                };

                const currentAction = actionConfig[ticket.status];

                return (
                  <div key={ticket.id} className="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200">
                            {ticket.status}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">Round {ticket.round_number}</span>
                        </div>
                        <h4 className="font-black text-sm text-slate-900 mt-1">Order #{ticket.order_id}</h4>
                      </div>
                      <span className="text-[10px] font-black uppercase text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
                        {ticket.station}
                      </span>
                    </div>

                    {/* Ordered Dishes List */}
                    <div className="space-y-1.5 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Customer Dishes:</div>
                      {ticket.ticket_items.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs font-semibold">
                          <span className="text-slate-800 flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-white text-black font-black text-[11px] flex items-center justify-center shadow-2xs border border-slate-100">
                              {item.quantity}x
                            </span>
                            {item.item_name}
                          </span>
                          {item.special_instructions && (
                            <span className="text-[10px] text-amber-600 font-bold">
                              ({item.special_instructions})
                            </span>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Chief Controls */}
                    <div className="pt-1 flex items-center justify-between gap-2">
                      <button
                        onClick={() => handleDismiss(ticket.id)}
                        className="px-3 py-2 rounded-full text-slate-500 hover:text-black hover:bg-slate-100 text-xs font-bold transition"
                      >
                        Dismiss
                      </button>

                      {currentAction ? (
                        <button
                          onClick={() => handleChefAction(ticket.order_id, currentAction.action)}
                          className={`flex-1 px-4 py-2 rounded-full text-white text-xs font-black shadow-sm transition active:scale-95 ${currentAction.btnClass}`}
                        >
                          {currentAction.text}
                        </button>
                      ) : (
                        <span className="text-xs font-bold text-slate-400">Completed</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: TABLES & QR MANAGEMENT SCREEN */}
      {activeTab === 'tables' && (
        <div className="space-y-4">
          {/* Table Action Error Banner */}
          {tableActionError && (
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{tableActionError}</span>
              </div>
              <button
                onClick={() => setTableActionError(null)}
                className="text-red-500 hover:text-red-800 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Create New Table */}
          <div className="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm space-y-3">
            <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">
              Create New Dining Table
            </h4>
            <form onSubmit={handleCreateTable} className="flex items-center gap-2">
              <input
                type="text"
                placeholder="e.g. Table 05"
                value={newTableNumber}
                onChange={(e) => setNewTableNumber(e.target.value)}
                required
                className="flex-1 px-4 py-2 rounded-full bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-black"
              />
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={newTableCapacity}
                  onChange={(e) => setNewTableCapacity(parseInt(e.target.value, 10))}
                  className="w-10 bg-transparent text-slate-900 text-xs text-center focus:outline-none font-bold"
                  title="Guest Capacity"
                />
              </div>
              <Button type="submit" variant="primary" size="sm">
                Add Table
              </Button>
            </form>
          </div>

          {/* Tables List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                All Restaurant Tables ({tables.length})
              </h4>
              <span className="text-[11px] text-slate-400 font-medium">Click to select & export QR</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {tables.map((t) => (
                <div
                  key={t.id}
                  onClick={() => handleSelectTable(t.id)}
                  className={`p-3.5 rounded-3xl border cursor-pointer transition select-none ${
                    selectedTableId === t.id
                      ? 'bg-slate-100 border-black shadow-xs ring-1 ring-black'
                      : 'bg-white border-slate-100 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-black text-sm text-slate-900">{t.table_number}</span>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${t.is_active ? 'bg-emerald-500' : 'bg-red-400'}`} />
                      <button
                        onClick={(e) => handleStartEdit(t, e)}
                        className="p-1 text-slate-400 hover:text-slate-800 rounded-full hover:bg-slate-200 transition"
                        title="Edit Table"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => handlePromptDelete(t, e)}
                        className="p-1 text-slate-400 hover:text-red-600 rounded-full hover:bg-red-50 transition"
                        title="Delete Table"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-between">
                    <span>Capacity: {t.seating_capacity} guests</span>
                    {(t.active_orders_count ?? 0) > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-black text-[9px]">
                        {t.active_orders_count} active
                      </span>
                    )}
                  </div>

                  <div className="pt-2 flex items-center justify-between gap-1 text-[10px]">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleActive(t);
                      }}
                      className="text-slate-500 hover:text-black underline font-medium"
                    >
                      {t.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRotateQR(t.id);
                      }}
                      className="text-amber-600 hover:text-amber-700 underline font-bold"
                    >
                      Rotate QR
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Selected Table QR & Live Orders */}
          {selectedTableId && (() => {
            const selectedTable = tables.find((t) => t.id === selectedTableId);
            if (!selectedTable) return null;

            return (
              <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-4">
                {/* Header & Quick Action Buttons */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-black text-base text-slate-900">
                        {selectedTable.table_number}
                      </h4>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        selectedTable.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                      }`}>
                        {selectedTable.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Table Stand Card & Live Order Synchronization
                    </p>
                  </div>

                  {/* Export Options */}
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={getTableCardUrl(selectedTable.id)}
                      download={`table_${selectedTable.table_number.toLowerCase().replace(/\s+/g, '_')}_qr_card.png`}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-black text-white hover:bg-slate-800 text-xs font-bold transition shadow-xs"
                      title="Download high-resolution tabletop stand card with table number"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export Card (PNG)</span>
                    </a>
                    <button
                      onClick={handlePrintCard}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition"
                      title="Print tabletop tent card directly"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print Stand</span>
                    </button>
                    <button
                      onClick={() => handleRotateQR(selectedTable.id)}
                      disabled={isRotatingQR}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-amber-700 text-xs font-bold transition"
                      title="Invalidate current QR and generate a new token"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isRotatingQR ? 'animate-spin' : ''}`} />
                      <span>Rotate QR</span>
                    </button>
                    <div className="flex items-center gap-1 pl-1 text-[11px]">
                      <a
                        href={getTableQrUrl(selectedTable.id, 'png')}
                        download={`table_${selectedTable.id}_qr.png`}
                        className="px-2 py-1 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold border border-slate-200"
                        title="Download raw QR without card framing"
                      >
                        Raw PNG
                      </a>
                      <a
                        href={getTableQrUrl(selectedTable.id, 'svg')}
                        download={`table_${selectedTable.id}_qr.svg`}
                        className="px-2 py-1 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold border border-slate-200"
                        title="Download raw SVG vector"
                      >
                        SVG
                      </a>
                    </div>
                  </div>
                </div>

                {/* Printable Table Stand Card Preview */}
                <div className="bg-slate-50 p-4 rounded-3xl border border-slate-200 flex flex-col items-center">
                  <div
                    id="table-stand-card"
                    className="w-full max-w-[340px] bg-white rounded-3xl p-6 border-2 border-slate-900 shadow-md text-center space-y-4"
                  >
                    {/* Brand Header */}
                    <div className="space-y-0.5">
                      <div className="text-xs font-black tracking-widest text-slate-900 uppercase">
                        FLOW-SYS BISTRO
                      </div>
                      <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                        Contactless Dining & Ordering
                      </div>
                    </div>

                    {/* Table Hero Banner */}
                    <div className="bg-black text-white py-3 px-4 rounded-2xl shadow-xs">
                      <div className="text-lg font-black tracking-tight">
                        {selectedTable.table_number.toUpperCase().startsWith('TABLE')
                          ? selectedTable.table_number.toUpperCase()
                          : `TABLE ${selectedTable.table_number.toUpperCase()}`}
                      </div>
                      <div className="text-[11px] text-slate-300 font-medium">
                        Capacity: {selectedTable.seating_capacity} Guests
                      </div>
                    </div>

                    {/* High-Resolution QR Code */}
                    <div className="p-3 bg-white border border-slate-200 rounded-2xl inline-block shadow-2xs">
                      <img
                        src={getTableQrUrl(selectedTable.id, 'png')}
                        alt={`QR Code for ${selectedTable.table_number}`}
                        className="w-44 h-44 object-contain mx-auto"
                      />
                    </div>

                    {/* Instruction Box */}
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-center space-y-1">
                      <div className="text-[11px] font-black uppercase text-slate-900 tracking-wide">
                        How to Order from Your Phone
                      </div>
                      <div className="text-[10px] text-slate-600 leading-relaxed">
                        1. Open Camera &bull; 2. Scan QR &bull; 3. Browse & Place Order
                      </div>
                    </div>

                    {/* Stand Card Footer */}
                    <div className="text-[9px] text-slate-400 font-semibold tracking-wider uppercase pt-1">
                      Flow-Sys Encrypted QR &bull; Stand {selectedTable.table_number}
                    </div>
                  </div>
                </div>

                {/* Filtered Orders for this Table */}
                <div>
                  <h5 className="text-[11px] font-black uppercase text-slate-500 tracking-wider mb-2">
                    Orders associated with {selectedTable.table_number} ({tableOrders.length})
                  </h5>
                  {tableOrders.length === 0 ? (
                    <p className="text-xs text-slate-400 py-3 text-center">No orders placed at this table yet.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {tableOrders.map((o) => (
                        <div key={o.id} className="p-2.5 rounded-2xl bg-slate-50 text-xs flex items-center justify-between border border-slate-100">
                          <div>
                            <span className="font-bold text-slate-900">#{o.order_number}</span>
                            <span className="text-[10px] text-slate-500 block">{formatDate(o.created_at)}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-slate-900">{formatCurrency(o.total_amount)}</span>
                            <span className="text-[10px] text-slate-500 block uppercase font-bold">{o.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* EDIT TABLE MODAL */}
          {editingTable && (
            <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-slate-200 shadow-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-sm text-slate-900">
                    Edit {editingTable.table_number}
                  </h3>
                  <button
                    onClick={() => setEditingTable(null)}
                    className="p-1 rounded-full text-slate-400 hover:text-slate-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleSaveEdit} className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Table Number / Name
                    </label>
                    <input
                      type="text"
                      value={editTableNumber}
                      onChange={(e) => setEditTableNumber(e.target.value)}
                      required
                      className="w-full px-4 py-2 rounded-full bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-black"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Seating Capacity (Guests)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={editTableCapacity}
                      onChange={(e) => setEditTableCapacity(parseInt(e.target.value, 10))}
                      required
                      className="w-full px-4 py-2 rounded-full bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-black"
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingTable(null)}
                      className="px-4 py-2 rounded-full text-slate-600 hover:bg-slate-100 text-xs font-bold transition"
                    >
                      Cancel
                    </button>
                    <Button type="submit" variant="primary" size="sm">
                      Save Changes
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* DELETE TABLE CONFIRMATION MODAL */}
          {tableToDelete && (
            <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-slate-200 shadow-2xl space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-slate-900">
                      Delete {tableToDelete.table_number}?
                    </h3>
                    <p className="text-xs text-slate-500">
                      This action cannot be undone.
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 text-[11px] text-slate-600 border border-slate-100">
                  Note: If this table has active in-progress orders, the system will block deletion to protect active dining sessions.
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setTableToDelete(null)}
                    className="px-4 py-2 rounded-full text-slate-600 hover:bg-slate-100 text-xs font-bold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDelete}
                    className="px-4 py-2 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition shadow-xs"
                  >
                    Confirm Delete
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
