export type UserRole =
  | 'SUPER_ADMIN'
  | 'TREINADOR'
  | 'PROPRIETARIO_EMPRESA'
  | 'ALUNO_GRADUADO'
  | 'ALUNO';

export type LegacyUserRole = 'admin' | 'coach' | 'aluno';
export type ProgramStatus = 'active' | 'archived';
export type InviteStatus = 'pending' | 'accepted' | 'expired';
export type InviteType = 'email' | 'link';

type TableShape<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole | LegacyUserRole;
  avatar_url: string | null;
  onboarding_completed_at?: string | null;
  disabled_at?: string | null;
  monitor_limit?: number | null;
  habit_reminder_enabled?: boolean | null;
  habit_reminder_time?: string | null;
  created_at: string;
}

export interface Program {
  id: string;
  name: string;
  description: string | null;
  status?: ProgramStatus | string | null;
  archived_at?: string | null;
  created_at: string;
}

export interface AdminProgramSummary {
  program: Program;
  turmasCount: number;
  ongoingTurmas: number;
  concludedTurmas: number;
  totalMembers: number;
  archivedTurmas?: number;
  isArchived?: boolean;
}

export interface Turma {
  id: string;
  program_id: string | null;
  name: string;
  treinador_id: string | null;
  fechamento_dia: number;
  fechamento_hora: string;
  weeks_count: number | null;
  start_date: string;
  created_at: string;
}

export interface AdminTurmaSummary {
  turma: Turma;
  programName: string | null;
  trainerName: string | null;
  memberCount: number;
  activeMemberCount: number;
  concludedMemberCount: number;
  ongoingCycleCount: number;
  concludedCycleCount: number;
  statusLabel: string;
  statusTone: 'draft' | 'active' | 'concluded';
  averageScore: number;
  riskPercentage: number;
}

export interface Cycle {
  id: string;
  aluno_id: string | null;
  turma_id: string | null;
  number: number;
  status: CycleStatus | string;
  start_date: string;
  end_date: string | null;
  created_at: string;
}

export type CycleStatus = 'active' | 'archived';
export type GoalStatus = 'active' | 'completed' | 'archived';

export interface Goal {
  id: string;
  cycle_id: string | null;
  title: string;
  description: string | null;
  indicator: string | null;
  deadline: string | null;
  order: number;
  status: GoalStatus | string | null;
  created_at: string;
}

export interface Tactic {
  id: string;
  goal_id: string | null;
  title: string;
  description: string | null;
  order: number;
  frequency: string | null;
  progress: number | null;
  created_at: string;
}

export type Tatic = Tactic;

export type Frequency = 'daily' | 'specific_days' | 'weekly';

export interface Task {
  id: string;
  tactic_id: string | null;
  tatic_id?: string | null;
  title: string;
  frequency: Frequency | string | null;
  specific_days: number[] | null;
  created_at: string;
}

export interface TaskCheckin {
  id: string;
  task_id: string | null;
  date: string;
  status: 'done' | 'not_done' | string | null;
  created_at: string;
}

export interface PlanTask extends Task {
  checkins: TaskCheckin[];
  progress: number;
  weeklyProgress: number;
  completedToday: boolean;
  dueToday: boolean;
}

export interface PlanTactic extends Tatic {
  tasks: PlanTask[];
  progress: number;
  completedTasks: number;
  totalTasks: number;
}

export interface PlanGoal extends Goal {
  tactics: PlanTactic[];
  progress: number;
  completedTasks: number;
  totalTasks: number;
}

export interface PlanSummary {
  cycleProgress: number;
  weeklyScore: number;
  cycleScore: number;
  currentWeek: number;
  totalWeeks: number;
  weekStart: string | null;
  weekEnd: string | null;
  completedToday: number;
  tasksDueToday: number;
  totalTasks: number;
  totalGoals: number;
  totalTactics: number;
  goalLimitReached: boolean;
  remainingGoals: number;
}

export interface WeeklyTaskItem extends PlanTask {
  scheduledDate: string;
  completedForDate: boolean;
  dueForDate: boolean;
}

export interface WeeklyTaskGroup {
  date: string;
  dayIndex: number;
  label: string;
  tasks: WeeklyTaskItem[];
  completedCount: number;
  dueCount: number;
}

export interface ActiveCycleState {
  currentWeek: number;
  totalWeeks: number;
  cycleProgress: number;
  weeklyScore: number;
  weekStart: string | null;
  weekEnd: string | null;
  goalLimitReached: boolean;
  remainingGoals: number;
  isActive: boolean;
}

export interface Habit {
  id: string;
  aluno_id: string | null;
  name: string;
  type: 'build' | 'abandon' | string | null;
  frequency: Frequency | string | null;
  specific_days: number[] | null;
  target_days: number | null;
  weekly_target?: number | null;
  is_paused: boolean | null;
  streak_reset_on?: string | null;
  created_at: string;
}

export interface HabitCheckin {
  id: string;
  habit_id: string | null;
  date: string;
  status: boolean;
  created_at: string;
}

export interface ROIBaseline {
  id: string;
  aluno_id: string | null;
  program_id: string | null;
  cycle_id?: string | null;
  baseline_income: number | null;
  investment: number | null;
  goal_income: number | null;
  initial_revenue?: number | null;
  target_revenue?: number | null;
  goal_status?: 'draft' | 'proposed' | 'approved' | 'rejected' | string | null;
  goal_note?: string | null;
  goal_proposed_by?: string | null;
  goal_proposed_at?: string | null;
  goal_approved_by?: string | null;
  goal_approved_at?: string | null;
  created_at: string;
}

export interface ROIResult {
  id: string;
  aluno_id: string | null;
  baseline_id?: string | null;
  program_id: string | null;
  cycle_id?: string | null;
  amount: number;
  date: string;
  description: string | null;
  created_at: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  secret_code: string;
  key?: string | null;
  image_url?: string | null;
  created_at: string;
}

export interface UserBadge {
  id: string;
  user_id: string | null;
  badge_id: string | null;
  unlocked_at: string;
  badge?: Badge | null;
}

export interface Enrollment {
  id: string;
  aluno_id: string | null;
  turma_id: string | null;
  monitor_id: string | null;
  graduated_monitor_id?: string | null;
  status: 'active' | 'inactive' | 'concluded' | string | null;
  created_at: string;
}

export interface AdminTurmaMember {
  enrollment: Enrollment;
  profile: Profile | null;
  cycle: Cycle | null;
  monitor?: Profile | null;
}

export interface MonitorAssignmentStats {
  monitor_id: string;
  monitor_name: string | null;
  monitor_email: string | null;
  monitor_limit: number | null;
  active_assignment_count: number;
  remaining_slots: number | null;
  is_disabled: boolean;
}

export interface CoachNote {
  id: string;
  treinador_id: string | null;
  aluno_id: string | null;
  content: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  is_read: boolean;
  read_at: string | null;
  edit_count: number;
  last_edited_by: string | null;
  treinador_name?: string;
  last_edited_by_name?: string;
}

export type CoachNoteTag = 'comportamental' | 'técnica' | 'elogio' | 'atenção' | 'progresso' | 'desafio' | 'meta' | 'outro';

export const COACH_NOTE_TAGS: { value: CoachNoteTag; label: string; color: string }[] = [
  { value: 'comportamental', label: 'Comportamental', color: 'bg-blue-500/10 border-blue-500/30 text-blue-400' },
  { value: 'técnica', label: 'Técnica', color: 'bg-purple-500/10 border-purple-500/30 text-purple-400' },
  { value: 'elogio', label: 'Elogio', color: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' },
  { value: 'atenção', label: 'Atenção', color: 'bg-amber-500/10 border-amber-500/30 text-amber-400' },
  { value: 'progresso', label: 'Progresso', color: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' },
  { value: 'desafio', label: 'Desafio', color: 'bg-rose-500/10 border-rose-500/30 text-rose-400' },
  { value: 'meta', label: 'Meta', color: 'bg-violet-500/10 border-violet-500/30 text-violet-400' },
  { value: 'outro', label: 'Outro', color: 'bg-neutral-500/10 border-neutral-500/30 text-neutral-400' },
];

export interface CoachNotesStats {
  aluno_id: string;
  total_notes: number;
  unread_notes: number;
  recent_notes_24h: number;
  last_note_at: string | null;
  last_unread_note_at: string | null;
}

export interface TurmaInvite {
  id: string;
  turma_id: string;
  created_by: string;
  email: string | null;
  token: string;
  invite_type: 'email' | 'link' | string;
  status: 'pending' | 'accepted' | 'expired' | string;
  expires_at: string | null;
  used_at: string | null;
  accepted_by: string | null;
  created_at: string;
}

export interface UserInvite {
  id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole | LegacyUserRole | string;
  monitor_limit: number | null;
  created_by: string | null;
  token: string;
  invite_type: InviteType | string;
  status: InviteStatus | string;
  expires_at: string | null;
  used_at: string | null;
  accepted_by: string | null;
  created_at: string;
}

export interface WeeklyScore {
  id: string;
  aluno_id: string;
  cycle_id: string;
  cycle_number?: number | null;
  week_number: number;
  score: number;
  week_start?: string | null;
  week_end?: string | null;
  week_ending?: string | null;
  completed_tasks?: number | null;
  expected_tasks?: number | null;
  is_final?: boolean | null;
  calculated_at?: string | null;
  created_at: string;
}

export interface ArchivedCycle extends Cycle {
  goals: PlanGoal[];
  summary: PlanSummary;
  weeklyScores: WeeklyScore[];
}

export interface GraduatedStudent {
  aluno_id: string;
  aluno_name: string;
  aluno_email: string;
  enrollment_id: string;
  turma_id: string | null;
  turma_name: string | null;
  latest_weekly_score: number;
  latest_score_week: string | null;
  weeks_below_60: number;
  has_active_alert: boolean;
  current_streak: number;
}

export interface LowScoreAlert {
  id: string;
  aluno_id: string;
  graduated_monitor_id: string;
  consecutive_low_weeks: number;
  first_low_week_date: string;
  last_low_week_date: string;
  alert_status: 'active' | 'resolved' | 'dismissed';
  resolved_at: string | null;
  dismissed_at: string | null;
  created_at: string;
  updated_at: string;
}

// =============================================
// M10 - Notificacoes
// =============================================

export type NotificationType =
  | 'HABIT_REMINDER'
  | 'WEEKLY_CLOSURE'
  | 'LOW_SCORE_ALERT'
  | 'BADGE_UNLOCK'
  | 'MESSAGE_RECEIVED';

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  HABIT_REMINDER: 'Lembrete de hábitos',
  WEEKLY_CLOSURE: 'Fechamento semanal',
  LOW_SCORE_ALERT: 'Alerta de score baixo',
  BADGE_UNLOCK: 'Conquista de badge',
  MESSAGE_RECEIVED: 'Mensagens recebidas',
};

export interface NotificationLog {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  url: string | null;
  payload: Record<string, unknown> | null;
  read_at: string | null;
  sent_at: string;
  created_at: string;
}

export interface NotificationPreference {
  id: string;
  user_id: string;
  notification_type: NotificationType;
  push_enabled: boolean;
  email_enabled: boolean;
  in_app_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  parent_message_id: string | null;
  read_at: string | null;
  sent_at: string;
  created_at: string;
  sender_name?: string | null;
  recipient_name?: string | null;
}

export interface MessageThread {
  partner_id: string;
  partner_name: string;
  partner_role: string;
  last_message: Message | null;
  unread_count: number;
  total_count: number;
}

export interface PushSubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  keys: Record<string, string>;
  user_agent: string | null;
  created_at: string;
}

// =============================================
// M11 - Gaps Transversais (LGPD/Auditoria/Offline)
// =============================================

export interface AuditLogEntry {
  id: string;
  actor_user_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  target_user_id: string | null;
  target_name: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export type ConsentType = 'terms_of_use' | 'privacy_policy' | 'data_processing' | 'marketing';

export interface ConsentRecord {
  consent_type: ConsentType | string;
  is_granted: boolean;
  granted_at: string | null;
  revoked_at: string | null;
}

export interface RoiAccessSummary {
  total_accesses: number;
  unique_accessors: number;
  last_accessed_at: string | null;
}

export type OfflineQueueOperationKind =
  | 'habit_checkin'
  | 'task_checkin'
  | 'message_mark_read';

export interface OfflineQueueOperation {
  id: string;
  kind: OfflineQueueOperationKind;
  payload: Record<string, unknown>;
  created_at: string;
  attempts: number;
  last_error?: string | null;
}

export interface TrainerLowScoreAlert {
  alert_id: string | null;
  aluno_id: string;
  aluno_name: string;
  aluno_email: string;
  turma_id: string | null;
  turma_name: string | null;
  latest_weekly_score: number;
  weeks_below_60: number;
  alert_status: 'active' | 'resolved' | 'dismissed' | string;
  graduated_monitor_id: string | null;
  graduated_monitor_name: string | null;
  first_low_week_date: string | null;
  last_low_week_date: string | null;
}

export interface Database {
  public: {
    Tables: {
      profiles: TableShape<Profile>;
      programs: TableShape<Program>;
      turmas: TableShape<Turma>;
      cycles: TableShape<Cycle>;
      goals: TableShape<Goal>;
      tactics: TableShape<Tactic>;
      tasks: TableShape<Task>;
      task_checkins: TableShape<TaskCheckin>;
      weekly_scores: TableShape<WeeklyScore>;
      habits: TableShape<Habit>;
      habit_checkins: TableShape<HabitCheckin>;
      roi_baselines: TableShape<ROIBaseline>;
      roi_results: TableShape<ROIResult>;
      badges: TableShape<Badge>;
      user_badges: TableShape<UserBadge>;
      enrollments: TableShape<Enrollment>;
      coach_notes: TableShape<CoachNote>;
      turma_invites: TableShape<TurmaInvite>;
      user_invites: TableShape<UserInvite>;
    };
    Views: Record<string, never>;
    Functions: {
      set_program_archived_state: {
        Args: {
          p_program_id: string;
          p_archived: boolean;
        };
        Returns: Program;
      };
      set_profile_role: {
        Args: {
          p_profile_id: string;
          p_role: UserRole | LegacyUserRole | string;
        };
        Returns: Profile;
      };
      set_profile_disabled_state: {
        Args: {
          p_profile_id: string;
          p_disabled: boolean;
        };
        Returns: Profile;
      };
      set_profile_monitor_limit: {
        Args: {
          p_profile_id: string;
          p_monitor_limit: number | null;
        };
        Returns: Profile;
      };
      create_user_invite: {
        Args: {
          p_email?: string | null;
          p_full_name?: string | null;
          p_role?: UserRole | LegacyUserRole | string | null;
          p_monitor_limit?: number | null;
          p_invite_type?: InviteType | string | null;
          p_expires_at?: string | null;
        };
        Returns: UserInvite;
      };
      get_user_invite_by_token: {
        Args: {
          p_token: string;
        };
        Returns: UserInvite | null;
      };
      accept_user_invite: {
        Args: {
          p_token: string;
        };
        Returns: {
          invite_id: string;
          profile_id: string;
          status: 'accepted';
          role: string;
        };
      };
      assign_monitor_to_enrollment: {
        Args: {
          p_enrollment_id: string;
          p_monitor_id: string | null;
        };
        Returns: Enrollment;
      };
      get_monitor_assignment_summary: {
        Args: Record<string, never>;
        Returns: MonitorAssignmentStats[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
