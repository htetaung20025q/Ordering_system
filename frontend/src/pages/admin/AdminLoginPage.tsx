import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, AlertCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/common/Button';

export const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please enter both administrator username and password');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await login(username.trim(), password);
      navigate('/admin');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid administrator credentials');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fb] flex flex-col justify-center items-center p-4 selection:bg-black selection:text-white">
      <div className="w-full max-w-sm space-y-4">
        <button
          onClick={() => navigate('/customer')}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-black transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Customer Menu</span>
        </button>

        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xl space-y-5 text-slate-900">
          <div className="text-center space-y-1.5">
            <div className="w-12 h-12 rounded-full bg-black text-white flex items-center justify-center font-black mx-auto shadow-md shadow-black/10">
              <Shield className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-black tracking-tight">Executive Admin Console</h2>
            <p className="text-xs text-slate-500">Business Oversight, Analytics & Table Management</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Admin Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter admin username"
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
                placeholder="Enter admin password"
                autoComplete="current-password"
                required
                className="w-full px-4 py-2.5 rounded-full bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-black transition placeholder:text-slate-400"
              />
            </div>

            {error && (
              <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isLoading}
              disabled={!username.trim() || !password}
              className="w-full shadow-md shadow-black/10"
            >
              Sign In to Admin Console
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};
