import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/common/Button';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: (UserRole | string)[];
  loginPath: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  loginPath,
}) => {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-black border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold text-slate-500">Verifying security credentials...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to={loginPath} state={{ from: location }} replace />;
  }

  const roleValue = typeof user.role === 'string' ? user.role : String(user.role);
  const isAuthorized = allowedRoles.includes(roleValue) || roleValue === 'admin';

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
        <div className="max-w-md w-full bg-white rounded-3xl p-6 border border-slate-200 shadow-xl text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900">Access Restricted</h2>
            <p className="text-xs text-slate-500 mt-1">
              Your account ({user.username} &bull; <span className="uppercase font-bold">{user.role}</span>) does not have permission to view this interface.
            </p>
          </div>
          <div className="pt-2 flex flex-col gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={async () => {
                await logout();
              }}
            >
              Sign In with Different Account
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
