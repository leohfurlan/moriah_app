export type UserRole =
  | "admin"
  | "pastor"
  | "secretary"
  | "treasurer"
  | "cell_leader"
  | "coordinator"
  | "member";

export interface LoginResponse {
  access: string;
  refresh: string;
}

export interface MeResponse {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  role: UserRole;
  church: number | null;
  church_name?: string;
  member_id?: number;
  member_name?: string;
}

export interface MemberProfile {
  id: number;
  full_name: string;
  preferred_name: string;
  email: string;
  phone: string;
  birth_date?: string;
  address: string;
  marital_status: string;
  status: string;
  joined_at?: string;
  notes: string;
  cell?: number;
  cell_name?: string;
  ministry_names: string[];
}

export interface ContributionAttachment {
  id: number;
  original_name: string;
  file_url: string;
  created_at: string;
}

export interface Contribution {
  id: number;
  category: string;
  status: string;
  amount: string;
  contribution_date: string;
  notes: string;
  attachments: ContributionAttachment[];
  created_at: string;
}

export interface ScheduleAssignment {
  id: number;
  schedule: number;
  schedule_name: string;
  event_name: string;
  event_start_at: string;
  role_name: string;
  ministry_name: string;
  status: "pending" | "confirmed" | "declined";
  justification: string;
  responded_at?: string | null;
}
