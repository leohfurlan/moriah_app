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
  id: number; member_name?: string; category: string; status: string; amount: string; contribution_date: string;
  notes: string; attachments: ContributionAttachment[]; created_at: string;
  review_notes?: string;
  reviewed_by_name?: string | null;
  review_history?: Array<{
    status_before: string | null; status_after: string; reviewed_by_name: string | null; created_at: string;
  }>;
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

// ---- Fase 4: gestao de escalas -------------------------------------------
export interface MinistryRoleAdmin { id: number; name: string; ministry_id: number; ministry_name: string; is_filled: boolean; }
export interface Ministry { id: number; name: string; description: string; roles: Array<{ id: number; name: string; description: string }>; coordinator_names: string[]; members_count: number; }
export interface ScheduleCounts {
  pending: number; confirmed: number; declined: number; unavailable: number; conflict: number; replacement_needed: number; total: number;
}
export interface ScheduleAdminItem {
  id: number; name: string; status: ScheduleStatus; status_display: string; ministry: number | null; ministry_name: string;
  event: number; event_name: string; event_type: string; event_start_at: string; event_location: string;
  arrival_at?: string | null; rehearsal_at?: string | null; published_at?: string | null; counts: ScheduleCounts; created_at: string;
}
export interface ScheduleAdminTeamMember {
  id: number; member_id: number; member_name: string; member_email: string; member_phone: string;
  role_id: number; role_name: string; ministry_name: string; status: AssignmentStatus; status_display: string;
  conflict_reason: string; justification: string; substitution_for?: number | null; replaced_member_name: string;
  responded_at?: string | null;
}
export interface ScheduleSubstitutionItem {
  id: number; substitution_for: number; original_member_name: string; replacement_member_name: string;
  role_name: string; status: AssignmentStatus; status_display: string; justification: string; created_at: string;
}
export interface ScheduleCandidate {
  id: number; full_name: string; preferred_name: string; email: string; phone: string; status: string;
  ministry_names: string[]; role_names: string[]; already_assigned: boolean; available: boolean; conflict_reason: string;
}
export interface ScheduleAdminDetail extends ScheduleAdminItem {
  notes: string; created_by?: number | null; created_by_name: string; ministry_roles: MinistryRoleAdmin[];
  team: ScheduleAdminTeamMember[]; substitutions: ScheduleSubstitutionItem[];
  can_edit: boolean; can_publish: boolean; can_cancel: boolean;
}
export interface ScheduleCreateRequest {
  event_name: string; event_type: string; start_at: string; end_at?: string | null; location?: string;
  schedule_name: string; notes?: string; ministry_id?: number | null; status?: ScheduleStatus;
  arrival_at?: string | null; rehearsal_at?: string | null;
}
export interface ScheduleUpdateRequest {
  name?: string; notes?: string; arrival_at?: string | null; rehearsal_at?: string | null; ministry_id?: number | null;
  event_name?: string; event_start_at?: string; event_end_at?: string | null; event_location?: string;
}
