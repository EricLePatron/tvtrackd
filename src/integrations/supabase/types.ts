export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      episodes: {
        Row: {
          air_date: string | null
          episode_number: number
          id: number
          overview: string | null
          season_number: number
          show_id: number
          still_path: string | null
          title: string | null
        }
        Insert: {
          air_date?: string | null
          episode_number: number
          id?: number
          overview?: string | null
          season_number: number
          show_id: number
          still_path?: string | null
          title?: string | null
        }
        Update: {
          air_date?: string | null
          episode_number?: number
          id?: number
          overview?: string | null
          season_number?: number
          show_id?: number
          still_path?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "episodes_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id"]
          },
        ]
      }
      import_runs: {
        Row: {
          created_at: string
          followed_shows: number
          id: number
          imported_episodes: number
          source: string
          unmatched: Json
          unmatched_count: number
          user_id: string
        }
        Insert: {
          created_at?: string
          followed_shows?: number
          id?: number
          imported_episodes?: number
          source?: string
          unmatched?: Json
          unmatched_count?: number
          user_id: string
        }
        Update: {
          created_at?: string
          followed_shows?: number
          id?: number
          imported_episodes?: number
          source?: string
          unmatched?: Json
          unmatched_count?: number
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          username?: string | null
        }
        Relationships: []
      }
      seasons: {
        Row: {
          episode_count: number | null
          id: number
          season_number: number
          show_id: number
        }
        Insert: {
          episode_count?: number | null
          id?: number
          season_number: number
          show_id: number
        }
        Update: {
          episode_count?: number | null
          id?: number
          season_number?: number
          show_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "seasons_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id"]
          },
        ]
      }
      shows: {
        Row: {
          backdrop_path: string | null
          cached_at: string
          first_air_date: string | null
          genres: string[]
          id: number
          media_type: string
          networks: Json | null
          overview: string | null
          poster_path: string | null
          status: string | null
          tagline: string | null
          title: string
          tmdb_id: number
          vote_average: number | null
          watch_providers: Json | null
        }
        Insert: {
          backdrop_path?: string | null
          cached_at?: string
          first_air_date?: string | null
          genres?: string[]
          id?: number
          media_type: string
          networks?: Json | null
          overview?: string | null
          poster_path?: string | null
          status?: string | null
          tagline?: string | null
          title: string
          tmdb_id: number
          vote_average?: number | null
          watch_providers?: Json | null
        }
        Update: {
          backdrop_path?: string | null
          cached_at?: string
          first_air_date?: string | null
          genres?: string[]
          id?: number
          media_type?: string
          networks?: Json | null
          overview?: string | null
          poster_path?: string | null
          status?: string | null
          tagline?: string | null
          title?: string
          tmdb_id?: number
          vote_average?: number | null
          watch_providers?: Json | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_shows: {
        Row: {
          created_at: string
          id: number
          manual_override: string | null
          show_id: number
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          manual_override?: string | null
          show_id: number
          status: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: number
          manual_override?: string | null
          show_id?: number
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_shows_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id"]
          },
        ]
      }
      watch_status: {
        Row: {
          episode_id: number
          id: number
          user_id: string
          watch_count: number
          watched_at: string
        }
        Insert: {
          episode_id: number
          id?: number
          user_id: string
          watch_count?: number
          watched_at?: string
        }
        Update: {
          episode_id?: number
          id?: number
          user_id?: string
          watch_count?: number
          watched_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "watch_status_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_computed_status: {
        Args: {
          p_new_watch_event?: boolean
          p_show_id: number
          p_user_id: string
        }
        Returns: undefined
      }
      compute_my_show_status: { Args: { p_show_id: number }; Returns: string }
      compute_show_status: {
        Args: { p_show_id: number; p_user_id: string }
        Returns: string
      }
      compute_tv_status: {
        Args: { p_show_id: number; p_user_id: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
