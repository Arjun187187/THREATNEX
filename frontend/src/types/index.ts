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

export type ProviderStatusType =
  | 'success'
  | 'clean'
  | 'not_found'
  | 'unconfigured'
  | 'unsupported'
  | 'rate_limited'
  | 'timeout'
  | 'error';

export interface ProviderResult {
  provider: string;
  supported: boolean;
  status: ProviderStatusType;
  message?: string | null;
  attribution: string;
  source_timestamp?: string | null;
  malicious: number;
  suspicious: number;
  harmless: number;
  undetected: number;
  reputation_score?: number | null;
  confidence_score?: number | null;
  verdict: 'malicious' | 'suspicious' | 'clean' | 'unknown';
  tags: string[];
  evidence: Record<string, any>;
}

export interface IOCEnrichmentResponse {
  value: string;
  normalized_value: string;
  ioc_type: IOCType;
  is_valid: boolean;
  queried_at: string;
  overall_verdict: 'malicious' | 'suspicious' | 'clean' | 'unknown';
  calculated_severity: IOCSeverity;
  overall_confidence: number;
  total_detections: number;
  summary: string;
  tags: string[];
  providers: ProviderResult[];
  saved_in_inventory: boolean;
  indicator_id?: string | null;
  investigation_record_id?: string | null;
}

export interface IOCInvestigationHistoryItem {
  id: string;
  indicator_value: string;
  ioc_type: IOCType;
  verdict: string;
  severity: IOCSeverity;
  confidence: number;
  total_detections: number;
  summary?: string | null;
  user_id?: string | null;
  indicator_id?: string | null;
  created_at: string;
}

export interface MitreTechnique {
  technique_id: string;
  technique_name: string;
  tactic: string;
  evidence: string;
  confidence: 'High' | 'Medium' | 'Low' | string;
}

export interface AIAnalysisDetail {
  executive_summary: string;
  threat_classification: string;
  reasoning: string;
  risk_level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'CLEAN' | 'UNKNOWN' | string;
  confidence_score: number;
  provider_evidence_summary: Record<string, string>;
  confirmed_evidence: string[];
  hypotheses: string[];
  false_positive_analysis: string;
  recommended_investigation_steps: string[];
  recommended_containment_actions: string[];
  mitre_techniques: MitreTechnique[];
  analyst_conclusion: string;
}

export interface AIAnalysisResponse {
  id: string;
  investigation_id?: string | null;
  indicator_value: string;
  ioc_type: string;
  model_name: string;
  risk_level: string;
  threat_classification: string;
  confidence_score: number;
  executive_summary: string;
  analysis_details: AIAnalysisDetail;
  operator_id?: string | null;
  created_at: string;
}

export interface AIAnalysisListItem {
  id: string;
  investigation_id?: string | null;
  indicator_value: string;
  ioc_type: string;
  model_name: string;
  risk_level: string;
  threat_classification: string;
  confidence_score: number;
  executive_summary: string;
  operator_id?: string | null;
  created_at: string;
}

export interface AIAnalysisRequest {
  investigation_id?: string | null;
  indicator_value?: string | null;
  ioc_type?: string | null;
}

export interface ThreatFeedItem {
  id: string;
  indicator_value: string;
  ioc_type: IOCType | string;
  provider: string;
  source_feed?: string | null;
  threat_category: string;
  severity: IOCSeverity | string;
  confidence: number;
  description?: string | null;
  tags: string[];
  external_reference?: string | null;
  first_seen?: string | null;
  last_seen?: string | null;
  raw_metadata?: Record<string, any> | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ThreatFeedListResponse {
  items: ThreatFeedItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface FeedProviderStatus {
  provider: string;
  status: string;
  last_synced_at?: string | null;
  items_count: number;
  last_error?: string | null;
  attribution: string;
  rate_limit_info?: string | null;
}

export interface FeedStatsResponse {
  total_items: number;
  by_severity: Record<string, number>;
  by_type: Record<string, number>;
  by_provider: Record<string, number>;
  last_sync_time?: string | null;
}

export interface ProviderSyncResult {
  provider: string;
  status: string;
  items_ingested: number;
  items_updated: number;
  error?: string | null;
  duration_ms: number;
}

export interface FeedSyncResponse {
  status: string;
  message: string;
  results: ProviderSyncResult[];
  total_ingested: number;
  total_updated: number;
}



