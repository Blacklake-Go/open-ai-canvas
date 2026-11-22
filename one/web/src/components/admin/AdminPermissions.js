'use client';

import { createContext, useContext, useMemo } from 'react';

const AdminPermissionsContext = createContext(null);

export function AdminPermissionsProvider({ permissions = [], children }) {
  const value = useMemo(() => new Set(permissions), [permissions]);
  return (
    <AdminPermissionsContext.Provider value={value}>
      {children}
    </AdminPermissionsContext.Provider>
  );
}

export function useHasPermission(permission) {
  const permissions = useContext(AdminPermissionsContext);
  if (!permission) return true;
  return Boolean(permissions?.has(permission));
}

export function PermissionGate({ permission, fallback = null, children }) {
  const allowed = useHasPermission(permission);
  return allowed ? children : fallback;
}
