import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';

interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  logo_url?: string;
  primary_color?: string;
}

interface TenantContextType {
  tenant: Tenant | null;
  loading: boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenant] = useState<Tenant | null>({
    id: 'default-tenant',
    name: 'Missing Trigger',
    subdomain: 'app',
    primary_color: '#ef4444'
  });

  return (
    <TenantContext.Provider value={{ tenant, loading: false }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}
