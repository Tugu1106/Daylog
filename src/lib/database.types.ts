// Generated from Supabase (project: daylog). Regenerate after schema changes:
//   npx supabase gen types typescript --project-id ijcmrejyckhoajancfbr > src/lib/database.types.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      activity_logs: {
        Row: {
          category: string;
          created_at: string;
          duration_min: number | null;
          effort: number | null;
          exercise_id: string | null;
          id: string;
          name: string;
          notes: string | null;
          pain_after: number | null;
          pain_before: number | null;
          pain_next_day: number | null;
          reps: number | null;
          sets: number | null;
          started_at: string;
          tags: string[];
          user_id: string;
          weight_kg: number | null;
        };
        Insert: {
          category: string;
          created_at?: string;
          duration_min?: number | null;
          effort?: number | null;
          exercise_id?: string | null;
          id?: string;
          name: string;
          notes?: string | null;
          pain_after?: number | null;
          pain_before?: number | null;
          pain_next_day?: number | null;
          reps?: number | null;
          sets?: number | null;
          started_at?: string;
          tags?: string[];
          user_id?: string;
          weight_kg?: number | null;
        };
        Update: Partial<Database["public"]["Tables"]["activity_logs"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "activity_logs_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
        ];
      };
      daily_checkins: {
        Row: {
          created_at: string;
          day: string;
          id: string;
          mood: number | null;
          morning_stiffness: number | null;
          notes: string | null;
          overall_pain: number | null;
          sitting_hours: number | null;
          sleep_hours: number | null;
          sleep_quality: number | null;
          steps: number | null;
          stress: number | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          day?: string;
          id?: string;
          mood?: number | null;
          morning_stiffness?: number | null;
          notes?: string | null;
          overall_pain?: number | null;
          sitting_hours?: number | null;
          sleep_hours?: number | null;
          sleep_quality?: number | null;
          steps?: number | null;
          stress?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["daily_checkins"]["Insert"]>;
        Relationships: [];
      };
      exercises: {
        Row: {
          archived: boolean;
          category: string;
          created_at: string;
          default_duration_min: number | null;
          description: string | null;
          id: string;
          name: string;
          user_id: string;
        };
        Insert: {
          archived?: boolean;
          category?: string;
          created_at?: string;
          default_duration_min?: number | null;
          description?: string | null;
          id?: string;
          name: string;
          user_id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["exercises"]["Insert"]>;
        Relationships: [];
      };
      pain_logs: {
        Row: {
          body_areas: string[];
          context: string | null;
          created_at: string;
          id: string;
          intensity: number;
          logged_at: string;
          notes: string | null;
          pain_types: string[];
          tags: string[];
          user_id: string;
        };
        Insert: {
          body_areas?: string[];
          context?: string | null;
          created_at?: string;
          id?: string;
          intensity: number;
          logged_at?: string;
          notes?: string | null;
          pain_types?: string[];
          tags?: string[];
          user_id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["pain_logs"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: {
      activity_effectiveness: {
        Row: {
          activity_key: string | null;
          avg_duration_min: number | null;
          avg_next_day_change: number | null;
          avg_pain_change: number | null;
          category: string | null;
          last_done: string | null;
          name: string | null;
          sessions: number | null;
          user_id: string | null;
        };
        Relationships: [];
      };
    };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicSchema = Database["public"];
export type Tables<T extends keyof (PublicSchema["Tables"] & PublicSchema["Views"])> =
  (PublicSchema["Tables"] & PublicSchema["Views"])[T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
