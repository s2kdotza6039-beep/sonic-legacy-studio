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
      ai_activity_log: {
        Row: {
          action: string
          actor: string
          actor_user_id: string | null
          command: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
        }
        Insert: {
          action: string
          actor?: string
          actor_user_id?: string | null
          command?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor?: string
          actor_user_id?: string | null
          command?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      ai_chat_conversations: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role?: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_drafts: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          command: string | null
          conversation_id: string | null
          created_at: string
          created_by: string | null
          draft_type: string
          id: string
          payload: Json
          published_at: string | null
          rejected_reason: string | null
          source: string
          status: string
          target_id: string | null
          target_table: string | null
          title: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          command?: string | null
          conversation_id?: string | null
          created_at?: string
          created_by?: string | null
          draft_type: string
          id?: string
          payload?: Json
          published_at?: string | null
          rejected_reason?: string | null
          source?: string
          status?: string
          target_id?: string | null
          target_table?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          command?: string | null
          conversation_id?: string | null
          created_at?: string
          created_by?: string | null
          draft_type?: string
          id?: string
          payload?: Json
          published_at?: string | null
          rejected_reason?: string | null
          source?: string
          status?: string
          target_id?: string | null
          target_table?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          banner_color: string | null
          body: string
          created_at: string
          ends_at: string | null
          id: string
          published_at: string | null
          starts_at: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          banner_color?: string | null
          body?: string
          created_at?: string
          ends_at?: string | null
          id?: string
          published_at?: string | null
          starts_at?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          banner_color?: string | null
          body?: string
          created_at?: string
          ends_at?: string | null
          id?: string
          published_at?: string | null
          starts_at?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
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
      betting_selections: {
        Row: {
          away: string
          created_at: string
          home: string
          id: string
          is_core: boolean
          kickoff: string | null
          league: string | null
          market: string
          probability: number
          result: string
          slip_id: string
        }
        Insert: {
          away: string
          created_at?: string
          home: string
          id?: string
          is_core?: boolean
          kickoff?: string | null
          league?: string | null
          market: string
          probability?: number
          result?: string
          slip_id: string
        }
        Update: {
          away?: string
          created_at?: string
          home?: string
          id?: string
          is_core?: boolean
          kickoff?: string | null
          league?: string | null
          market?: string
          probability?: number
          result?: string
          slip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "betting_selections_slip_id_fkey"
            columns: ["slip_id"]
            isOneToOne: false
            referencedRelation: "betting_slips"
            referencedColumns: ["id"]
          },
        ]
      }
      betting_slips: {
        Row: {
          actual_return: number | null
          category: string
          created_at: string
          estimated_odds: number
          id: string
          match_date: string
          notes: string | null
          potential_return: number
          result: string
          slip_number: number
          stake: number
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_return?: number | null
          category?: string
          created_at?: string
          estimated_odds?: number
          id?: string
          match_date: string
          notes?: string | null
          potential_return?: number
          result?: string
          slip_number: number
          stake?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          actual_return?: number | null
          category?: string
          created_at?: string
          estimated_odds?: number
          id?: string
          match_date?: string
          notes?: string | null
          potential_return?: number
          result?: string
          slip_number?: number
          stake?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      booking_enquiries: {
        Row: {
          artist_requested: string | null
          budget: number | null
          created_at: string
          email: string
          event_date: string | null
          event_type: string | null
          id: string
          message: string | null
          name: string
          notes: string | null
          phone: string | null
          status: string
          updated_at: string
          venue: string | null
        }
        Insert: {
          artist_requested?: string | null
          budget?: number | null
          created_at?: string
          email: string
          event_date?: string | null
          event_type?: string | null
          id?: string
          message?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
          venue?: string | null
        }
        Update: {
          artist_requested?: string | null
          budget?: number | null
          created_at?: string
          email?: string
          event_date?: string | null
          event_type?: string | null
          id?: string
          message?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
          venue?: string | null
        }
        Relationships: []
      }
      ceo_contacts: {
        Row: {
          category: string
          company: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          role: string | null
          updated_at: string
        }
        Insert: {
          category?: string
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ceo_notes: {
        Row: {
          content: string | null
          created_at: string
          id: string
          is_pinned: boolean
          title: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          is_pinned?: boolean
          title?: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          is_pinned?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      ceo_todos: {
        Row: {
          category: string
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          is_done: boolean
          priority: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_done?: boolean
          priority?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_done?: boolean
          priority?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      command_runs: {
        Row: {
          command: string
          completed_at: string | null
          draft_count: number
          draft_ids: string[]
          error_message: string | null
          id: string
          schedule_id: string | null
          started_at: string
          status: string
          triggered_by: string
          triggered_by_user: string | null
        }
        Insert: {
          command: string
          completed_at?: string | null
          draft_count?: number
          draft_ids?: string[]
          error_message?: string | null
          id?: string
          schedule_id?: string | null
          started_at?: string
          status?: string
          triggered_by?: string
          triggered_by_user?: string | null
        }
        Update: {
          command?: string
          completed_at?: string | null
          draft_count?: number
          draft_ids?: string[]
          error_message?: string | null
          id?: string
          schedule_id?: string | null
          started_at?: string
          status?: string
          triggered_by?: string
          triggered_by_user?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "command_runs_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "command_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      command_schedules: {
        Row: {
          command: string
          created_at: string
          day_of_week: number | null
          frequency: string
          hour_of_day: number
          id: string
          is_active: boolean
          last_run_at: string | null
          next_run_at: string | null
          notes: string | null
          updated_at: string
        }
        Insert: {
          command: string
          created_at?: string
          day_of_week?: number | null
          frequency?: string
          hour_of_day?: number
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          next_run_at?: string | null
          notes?: string | null
          updated_at?: string
        }
        Update: {
          command?: string
          created_at?: string
          day_of_week?: number | null
          frequency?: string
          hour_of_day?: number
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          next_run_at?: string | null
          notes?: string | null
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
      contract_templates: {
        Row: {
          content: string | null
          contract_type: string
          created_at: string
          created_by: string | null
          description: string | null
          file_name: string | null
          file_url: string | null
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          contract_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          contract_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      contracts: {
        Row: {
          contract_type: string
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          file_name: string | null
          file_url: string | null
          id: string
          notes: string | null
          party_name: string | null
          start_date: string | null
          status: string
          title: string
          updated_at: string
          value: number | null
        }
        Insert: {
          contract_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          notes?: string | null
          party_name?: string | null
          start_date?: string | null
          status?: string
          title: string
          updated_at?: string
          value?: number | null
        }
        Update: {
          contract_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          notes?: string | null
          party_name?: string | null
          start_date?: string | null
          status?: string
          title?: string
          updated_at?: string
          value?: number | null
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
      email_drafts: {
        Row: {
          body: string
          conversation_id: string | null
          created_at: string
          id: string
          recipient_email: string
          recipient_name: string | null
          sent_at: string | null
          sent_via: string | null
          source: string
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          body: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          recipient_email: string
          recipient_name?: string | null
          sent_at?: string | null
          sent_via?: string | null
          source?: string
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          body?: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          recipient_email?: string
          recipient_name?: string | null
          sent_at?: string | null
          sent_via?: string | null
          source?: string
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_drafts_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_chat_conversations"
            referencedColumns: ["id"]
          },
        ]
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
      events: {
        Row: {
          artist_name: string | null
          city: string | null
          country: string | null
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          image_url: string | null
          published_at: string | null
          start_date: string
          status: string
          ticket_url: string | null
          title: string
          updated_at: string
          venue: string | null
        }
        Insert: {
          artist_name?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          image_url?: string | null
          published_at?: string | null
          start_date: string
          status?: string
          ticket_url?: string | null
          title: string
          updated_at?: string
          venue?: string | null
        }
        Update: {
          artist_name?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          image_url?: string | null
          published_at?: string | null
          start_date?: string
          status?: string
          ticket_url?: string | null
          title?: string
          updated_at?: string
          venue?: string | null
        }
        Relationships: []
      }
      idea_boards: {
        Row: {
          color: string
          created_at: string
          description: string | null
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      ideas: {
        Row: {
          assigned_to: string | null
          board_id: string | null
          category: string
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          notes: string | null
          priority: string
          status: string
          submitted_by: string | null
          title: string
          updated_at: string
          votes: number
        }
        Insert: {
          assigned_to?: string | null
          board_id?: string | null
          category?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          priority?: string
          status?: string
          submitted_by?: string | null
          title: string
          updated_at?: string
          votes?: number
        }
        Update: {
          assigned_to?: string | null
          board_id?: string | null
          category?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          priority?: string
          status?: string
          submitted_by?: string | null
          title?: string
          updated_at?: string
          votes?: number
        }
        Relationships: [
          {
            foreignKeyName: "ideas_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "idea_boards"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          client_address: string | null
          client_email: string | null
          client_name: string
          created_at: string
          currency: string
          due_date: string | null
          file_url: string | null
          id: string
          invoice_number: string
          issue_date: string | null
          line_items: Json
          notes: string | null
          status: string
          subtotal: number
          tax: number
          total: number
          updated_at: string
        }
        Insert: {
          client_address?: string | null
          client_email?: string | null
          client_name: string
          created_at?: string
          currency?: string
          due_date?: string | null
          file_url?: string | null
          id?: string
          invoice_number: string
          issue_date?: string | null
          line_items?: Json
          notes?: string | null
          status?: string
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
        }
        Update: {
          client_address?: string | null
          client_email?: string | null
          client_name?: string
          created_at?: string
          currency?: string
          due_date?: string | null
          file_url?: string | null
          id?: string
          invoice_number?: string
          issue_date?: string | null
          line_items?: Json
          notes?: string | null
          status?: string
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      news_posts: {
        Row: {
          body: string
          category: string
          created_at: string
          excerpt: string | null
          id: string
          image_url: string | null
          published_at: string | null
          slug: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: string
          category?: string
          created_at?: string
          excerpt?: string | null
          id?: string
          image_url?: string | null
          published_at?: string | null
          slug?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          excerpt?: string | null
          id?: string
          image_url?: string | null
          published_at?: string | null
          slug?: string | null
          status?: string
          title?: string
          updated_at?: string
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
      sponsor_leads: {
        Row: {
          budget_range: string | null
          company: string
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          industry: string | null
          message: string | null
          notes: string | null
          phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          budget_range?: string | null
          company: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          industry?: string | null
          message?: string | null
          notes?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          budget_range?: string | null
          company?: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          industry?: string | null
          message?: string | null
          notes?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          auto_renew: boolean
          billing_cycle: string
          category: string
          cost: number
          created_at: string
          description: string | null
          expiry_date: string | null
          id: string
          notes: string | null
          reminder_days: number
          service_name: string
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          auto_renew?: boolean
          billing_cycle?: string
          category?: string
          cost?: number
          created_at?: string
          description?: string | null
          expiry_date?: string | null
          id?: string
          notes?: string | null
          reminder_days?: number
          service_name: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          auto_renew?: boolean
          billing_cycle?: string
          category?: string
          cost?: number
          created_at?: string
          description?: string | null
          expiry_date?: string | null
          id?: string
          notes?: string | null
          reminder_days?: number
          service_name?: string
          start_date?: string | null
          status?: string
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
      touring_log: {
        Row: {
          actual_cost: number | null
          artist_name: string | null
          budget: number | null
          city: string | null
          country: string
          created_at: string
          end_date: string | null
          event_name: string
          id: string
          notes: string | null
          start_date: string | null
          status: string
          updated_at: string
          venue: string | null
        }
        Insert: {
          actual_cost?: number | null
          artist_name?: string | null
          budget?: number | null
          city?: string | null
          country?: string
          created_at?: string
          end_date?: string | null
          event_name: string
          id?: string
          notes?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
          venue?: string | null
        }
        Update: {
          actual_cost?: number | null
          artist_name?: string | null
          budget?: number | null
          city?: string | null
          country?: string
          created_at?: string
          end_date?: string | null
          event_name?: string
          id?: string
          notes?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
          venue?: string | null
        }
        Relationships: []
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
      approve_ai_draft: { Args: { _draft_id: string }; Returns: string }
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
      reject_ai_draft: {
        Args: { _draft_id: string; _reason?: string }
        Returns: undefined
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
