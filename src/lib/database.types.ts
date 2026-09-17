// Mirrors the Supabase schema (project: daylog). Regenerate after schema changes:
//   npx supabase gen types typescript --project-id ijcmrejyckhoajancfbr

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Table<Row, Required extends keyof Row, Rels extends unknown[] = []> = {
  Row: Row;
  Insert: Pick<Row, Required> & Partial<Omit<Row, Required>>;
  Update: Partial<Row>;
  Relationships: Rels;
};

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      action_types: Table<
        {
          id: string;
          user_id: string;
          name: string;
          category: string;
          emoji: string | null;
          color: string;
          archived: boolean;
          sort: number;
          created_at: string;
        },
        "name"
      >;
      actions: Table<
        {
          id: string;
          user_id: string;
          type_id: string | null;
          name: string;
          category: string;
          color: string;
          started_at: string;
          ended_at: string | null;
          effort: number | null;
          notes: string | null;
          created_at: string;
        },
        "name" | "category",
        [
          {
            foreignKeyName: "actions_type_id_fkey";
            columns: ["type_id"];
            isOneToOne: false;
            referencedRelation: "action_types";
            referencedColumns: ["id"];
          },
        ]
      >;
      pain_types: Table<
        {
          id: string;
          user_id: string;
          name: string;
          body_area: string | null;
          description: string | null;
          color: string;
          archived: boolean;
          sort: number;
          created_at: string;
        },
        "name"
      >;
      pain_levels: Table<
        {
          id: string;
          user_id: string;
          recorded_at: string;
          level: number;
          created_at: string;
        },
        "level"
      >;
      pain_events: Table<
        {
          id: string;
          user_id: string;
          type_id: string | null;
          name: string;
          color: string;
          occurred_at: string;
          intensity: number | null;
          notes: string | null;
          created_at: string;
        },
        "name",
        [
          {
            foreignKeyName: "pain_events_type_id_fkey";
            columns: ["type_id"];
            isOneToOne: false;
            referencedRelation: "pain_types";
            referencedColumns: ["id"];
          },
        ]
      >;
    };
    Views: { [_ in never]: never };
    Functions: {
      seed_default_types: { Args: never; Returns: undefined };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicSchema = Database["public"];
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];

export type ActionType = Tables<"action_types">;
export type Action = Tables<"actions">;
export type PainType = Tables<"pain_types">;
export type PainLevel = Tables<"pain_levels">;
export type PainEvent = Tables<"pain_events">;
