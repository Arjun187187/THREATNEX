export type IOCType = 'ipv4' | 'ipv6' | 'domain' | 'url' | 'md5' | 'sha1' | 'sha256' | 'cve';

export type IOCSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info' | 'unknown';

export interface User {
  id: string;
  email: string;
  username: string;
  full_name?: string | null;
  is_active: boolean;
  is_verified: boolean;
  roles: string[];
  created_at: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface Indicator {
  id: string;
  value: string;
  ioc_type: IOCType;
  severity: IOCSeverity;
  confidence: number;
  description?: string | null;
  tags?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface IOCValidationResult {
  value: string;
  is_valid: boolean;
  ioc_type: IOCType | null;
  message: string;
}

export type InvestigationStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type InvestigationPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Investigation {
  id: string;
  title: string;
  description?: string | null;
  status: InvestigationStatus;
  priority: InvestigationPriority;
  owner_id?: string | null;
  assigned_to?: string | null;
  indicators: Indicator[];
  created_at: string;
  updated_at: string;
}

export interface DashboardStats {
  total_investigations: number;
  open_investigations: number;
  in_progress_investigations: number;
  resolved_investigations: number;
  total_indicators: number;
  critical_high_indicators: number;
  ioc_by_type: Record<string, number>;
  investigations_by_priority: Record<string, number>;
}
