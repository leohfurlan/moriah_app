export type UserRole =
  | "admin"
  | "pastor"
  | "secretary"
  | "treasurer"
  | "cell_leader"
  | "coordinator"
  | "member";

export interface LoginResponse { access: string; refresh: string; }
export interface MeResponse {
  id: number; email: string; first_name: string; last_name: string; phone: string;
  role: UserRole; church: number | null; church_name?: string; member_id?: number | null; member_name?: string | null;
  roles: UserRole[]; capabilities: string[]; has_member_profile: boolean; can_access_management: boolean;
}
export interface MemberProfile {
  id: number; full_name: string; preferred_name: string; email: string; phone: string;
  birth_date?: string; address: string; marital_status: string; status: string; joined_at?: string;
  notes: string; family?: { id: number; name: string }; family_relationships?: Array<{ id: number; relationship_type: string; related_member: number; related_member_name: string }>;
  cell?: number; cell_name?: string; ministry_names: string[];
}
export interface MemberUpdateRequest {
  id: number; requested_changes: Record<string, string>; status: "pending" | "approved" | "rejected";
  review_notes: string; created_at: string; reviewed_at?: string | null;
}
export interface ContributionAttachment { id: number; original_name: string; file_url: string; created_at: string; }
export interface Contribution {
  id: number; category: string; status: string; amount: string; contribution_date: string;
  notes: string; attachments: ContributionAttachment[]; created_at: string;
}
export type ScheduleStatus = "draft" | "published" | "cancelled";
export type AssignmentStatus = "pending" | "confirmed" | "declined" | "unavailable" | "conflict" | "replacement_needed";
export interface ScheduleAssignment {
  id: number; schedule: number; schedule_name: string; schedule_status: ScheduleStatus; event_name: string;
  event_start_at: string; arrival_at?: string | null; rehearsal_at?: string | null; role_name: string;
  ministry_name: string; status: AssignmentStatus; justification: string; conflict_reason: string;
  substitution_for?: number | null; responded_at?: string | null;
}
export interface ScheduleItem {
  id: number; order: number; item_type: "song" | "moment" | "reading" | "other"; item_type_display: string;
  song?: number | null; title: string; song_title?: string | null; artist?: string | null; song_key: string;
  effective_key: string; bpm?: number | null; effective_bpm?: number | null; duration_seconds?: number | null;
  effective_duration_seconds?: number | null; reference_url: string; spotify_url?: string | null;
  youtube_url?: string | null; chord_url?: string | null; notes: string;
}
export interface TeamMember {
  id: number; member_name: string; role_name: string; ministry_name: string; status: AssignmentStatus;
  status_display: string; conflict_reason: string; substitution_for?: number | null; is_me: boolean;
}
export interface ScheduleAssignmentDetail extends ScheduleAssignment {
  status_display: string; event_location: string; event_type: string; schedule_notes: string;
  team: TeamMember[]; repertoire: ScheduleItem[];
}
export interface ChurchEvent { id: number; name: string; event_type: string; event_type_display: string; start_at: string; end_at?: string | null; location: string; description: string; }
export type CommitmentType = "personal" | "ministry" | "cell" | "meeting" | "other";
export interface PersonalCommitment {
  id: number; title: string; commitment_type: CommitmentType; starts_at: string; ends_at?: string | null;
  status: "planned" | "cancelled"; notes: string; created_at: string; updated_at: string;
}
