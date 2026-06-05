export interface Tenant {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TenantMember {
  id: string;
  tenant_id: string;
  user_id: string;
  role: 'admin' | 'supervisor' | 'worker';
  created_at: string;
}

export interface TenantWithMeta extends Tenant {
  userRole: 'admin' | 'supervisor' | 'worker';
}
