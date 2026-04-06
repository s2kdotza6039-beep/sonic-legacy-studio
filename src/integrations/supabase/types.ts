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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      artist_activities: {
        Row: {
          activity_type: string
          artist_id: string
          created_at: string
          description: string
          id: string
          metadata: Json | null
          updated_at: string
        }
        Insert: {
          activity_type?: string
          artist_id: string
          created_at?: string
          description: string
          id?: string
          metadata?: Json | null
          updated_at?: string
        }
        Update: {
          activity_type?: string
          artist_id?: string
          created_at?: string
          description?: string
          id?: string
          metadata?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "artist_activities_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      artist_scorecards: {
        Row: {
          artist_name: string
          audience_growth: number
          business_cooperation: number
          content_brand: number
          created_at: string
          discipline: number
          id: string
          live_performance: number
          music_output: number
          review_month: string
          tier: string | null
          total_score: number | null
          updated_at: string
        }
        Insert: {
          artist_name: string
          audience_growth?: number
          business_cooperation?: number
          content_brand?: number
          created_at?: string
          discipline?: number
          id?: string
          live_performance?: number
          music_output?: number
          review_month: string
          tier?: string | null
          total_score?: number | null
          updated_at?: string
        }
        Update: {
          artist_name?: string
          audience_growth?: number
          business_cooperation?: number
          content_brand?: number
          created_at?: string
          discipline?: number
          id?: string
          live_performance?: number
          music_output?: number
          review_month?: string
          tier?: string | null
          total_score?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      artists: {
        Row: {
          created_at: string
          email: string | null
          file_url: string | null
          genre: string | null
          id: string
          music_link: string | null
          name: string
          notes: string | null
          phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          file_url?: string | null
          genre?: string | null
          id?: string
          music_link?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          file_url?: string | null
          genre?: string | null
          id?: string
          music_link?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      content_posts: {
        Row: {
          created_at: string
          id: string
          platform: string | null
          posted_at: string | null
          tag: string
          title: string
          updated_at: string
          url: string | null
          views: number
        }
        Insert: {
          created_at?: string
          id?: string
          platform?: string | null
          posted_at?: string | null
          tag?: string
          title: string
          updated_at?: string
          url?: string | null
          views?: number
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string | null
          posted_at?: string | null
          tag?: string
          title?: string
          updated_at?: string
          url?: string | null
          views?: number
        }
        Relationships: []
      }
      deals: {
        Row: {
          amount: number | null
          client_name: string
          closed_at: string | null
          created_at: string
          deal_title: string
          id: string
          notes: string | null
          stage: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          client_name: string
          closed_at?: string | null
          created_at?: string
          deal_title: string
          id?: string
          notes?: string | null
          stage?: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          client_name?: string
          closed_at?: string | null
          created_at?: string
          deal_title?: string
          id?: string
          notes?: string | null
          stage?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reminders: {
        Row: {
          created_at: string
          due_at: string
          email_sent: boolean
          id: string
          is_done: boolean
          message: string
          related_id: string
          related_type: string
          reminder_type: string
        }
        Insert: {
          created_at?: string
          due_at: string
          email_sent?: boolean
          id?: string
          is_done?: boolean
          message: string
          related_id: string
          related_type: string
          reminder_type: string
        }
        Update: {
          created_at?: string
          due_at?: string
          email_sent?: boolean
          id?: string
          is_done?: boolean
          message?: string
          related_id?: string
          related_type?: string
          reminder_type?: string
        }
        Relationships: []
      }
      royalty_alerts: {
        Row: {
          action_required: string | null
          alert_type: string
          created_at: string
          id: string
          message: string
          resolved_at: string | null
          severity: string
          song_id: string | null
          source: string | null
          status: string
        }
        Insert: {
          action_required?: string | null
          alert_type: string
          created_at?: string
          id?: string
          message: string
          resolved_at?: string | null
          severity?: string
          song_id?: string | null
          source?: string | null
          status?: string
        }
        Update: {
          action_required?: string | null
          alert_type?: string
          created_at?: string
          id?: string
          message?: string
          resolved_at?: string | null
          severity?: string
          song_id?: string | null
          source?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "royalty_alerts_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      royalty_income: {
        Row: {
          created_at: string
          fees: number
          gross: number
          id: string
          month: string
          net: number
          notes: string | null
          paid: boolean
          payment_date: string | null
          song_id: string | null
          source: string
          territory: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          fees?: number
          gross?: number
          id?: string
          month: string
          net?: number
          notes?: string | null
          paid?: boolean
          payment_date?: string | null
          song_id?: string | null
          source: string
          territory?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          fees?: number
          gross?: number
          id?: string
          month?: string
          net?: number
          notes?: string | null
          paid?: boolean
          payment_date?: string | null
          song_id?: string | null
          source?: string
          territory?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "royalty_income_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      songs: {
        Row: {
          actual_publishing: number
          artist_name: string | null
          created_at: string
          expected_publishing: number
          id: string
          isrc: string | null
          iswc: string | null
          platform: string | null
          registered_capasso: boolean
          registered_samro: boolean
          release_date: string | null
          streams: number
          title: string
          updated_at: string
        }
        Insert: {
          actual_publishing?: number
          artist_name?: string | null
          created_at?: string
          expected_publishing?: number
          id?: string
          isrc?: string | null
          iswc?: string | null
          platform?: string | null
          registered_capasso?: boolean
          registered_samro?: boolean
          release_date?: string | null
          streams?: number
          title: string
          updated_at?: string
        }
        Update: {
          actual_publishing?: number
          artist_name?: string | null
          created_at?: string
          expected_publishing?: number
          id?: string
          isrc?: string | null
          iswc?: string | null
          platform?: string | null
          registered_capasso?: boolean
          registered_samro?: boolean
          release_date?: string | null
          streams?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      territory_data: {
        Row: {
          actual_revenue: number
          country: string
          created_at: string
          expected_revenue: number
          id: string
          song_id: string
          streams: number
          updated_at: string
        }
        Insert: {
          actual_revenue?: number
          country: string
          created_at?: string
          expected_revenue?: number
          id?: string
          song_id: string
          streams?: number
          updated_at?: string
        }
        Update: {
          actual_revenue?: number
          country?: string
          created_at?: string
          expected_revenue?: number
          id?: string
          song_id?: string
          streams?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "territory_data_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role: "founder" | "executive" | "artist"
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
      app_role: ["founder", "executive", "artist"],
    },
  },
} as const
