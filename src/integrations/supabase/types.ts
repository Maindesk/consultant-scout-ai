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
      automation_settings: {
        Row: {
          active_search_config_id: string | null
          auto_draft: boolean
          auto_enrich: boolean
          created_at: string
          daily_lead_target: number
          enabled: boolean
          id: string
          last_run_at: string | null
          last_run_summary: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active_search_config_id?: string | null
          auto_draft?: boolean
          auto_enrich?: boolean
          created_at?: string
          daily_lead_target?: number
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          last_run_summary?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active_search_config_id?: string | null
          auto_draft?: boolean
          auto_enrich?: boolean
          created_at?: string
          daily_lead_target?: number
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          last_run_summary?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_settings_active_search_config_id_fkey"
            columns: ["active_search_config_id"]
            isOneToOne: false
            referencedRelation: "search_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      business_profiles: {
        Row: {
          active_workspace_id: string | null
          ai_summary: string | null
          avg_close_rate: number | null
          avg_deal_value: number | null
          created_at: string
          currency: string | null
          daily_send_cap: number
          default_email_goal: string | null
          id: string
          ideal_client: string | null
          offer_description: string | null
          product_capabilities: string | null
          sender_email: string | null
          sender_name: string | null
          services: Json | null
          updated_at: string
          user_id: string
          value_proposition: string | null
          website_url: string | null
        }
        Insert: {
          active_workspace_id?: string | null
          ai_summary?: string | null
          avg_close_rate?: number | null
          avg_deal_value?: number | null
          created_at?: string
          currency?: string | null
          daily_send_cap?: number
          default_email_goal?: string | null
          id?: string
          ideal_client?: string | null
          offer_description?: string | null
          product_capabilities?: string | null
          sender_email?: string | null
          sender_name?: string | null
          services?: Json | null
          updated_at?: string
          user_id: string
          value_proposition?: string | null
          website_url?: string | null
        }
        Update: {
          active_workspace_id?: string | null
          ai_summary?: string | null
          avg_close_rate?: number | null
          avg_deal_value?: number | null
          created_at?: string
          currency?: string | null
          daily_send_cap?: number
          default_email_goal?: string | null
          id?: string
          ideal_client?: string | null
          offer_description?: string | null
          product_capabilities?: string | null
          sender_email?: string | null
          sender_name?: string | null
          services?: Json | null
          updated_at?: string
          user_id?: string
          value_proposition?: string | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_profiles_active_workspace_id_fkey"
            columns: ["active_workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      business_sources: {
        Row: {
          ai_notes: string | null
          created_at: string
          id: string
          label: string | null
          last_scraped_at: string | null
          scraped_markdown: string | null
          source_type: string
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          ai_notes?: string | null
          created_at?: string
          id?: string
          label?: string | null
          last_scraped_at?: string | null
          scraped_markdown?: string | null
          source_type?: string
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          ai_notes?: string | null
          created_at?: string
          id?: string
          label?: string | null
          last_scraped_at?: string | null
          scraped_markdown?: string | null
          source_type?: string
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      email_drafts: {
        Row: {
          body: string
          created_at: string
          day_offset: number
          id: string
          lead_id: string
          status: string
          step_number: number
          subject: string
          tone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          day_offset?: number
          id?: string
          lead_id: string
          status?: string
          step_number?: number
          subject: string
          tone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          day_offset?: number
          id?: string
          lead_id?: string
          status?: string
          step_number?: number
          subject?: string
          tone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_drafts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      email_sends: {
        Row: {
          body: string | null
          draft_id: string | null
          id: string
          lead_id: string
          provider_message_id: string | null
          sent_at: string
          status: string
          subject: string | null
          user_id: string
        }
        Insert: {
          body?: string | null
          draft_id?: string | null
          id?: string
          lead_id: string
          provider_message_id?: string | null
          sent_at?: string
          status?: string
          subject?: string | null
          user_id: string
        }
        Update: {
          body?: string | null
          draft_id?: string | null
          id?: string
          lead_id?: string
          provider_message_id?: string | null
          sent_at?: string
          status?: string
          subject?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_sends_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "email_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sends_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      inbound_messages: {
        Row: {
          body: string | null
          classification: string | null
          from_email: string | null
          id: string
          in_reply_to_send_id: string | null
          lead_id: string | null
          received_at: string
          reply_sent_at: string | null
          reply_status: string
          subject: string | null
          suggested_reply: string | null
          user_id: string
        }
        Insert: {
          body?: string | null
          classification?: string | null
          from_email?: string | null
          id?: string
          in_reply_to_send_id?: string | null
          lead_id?: string | null
          received_at?: string
          reply_sent_at?: string | null
          reply_status?: string
          subject?: string | null
          suggested_reply?: string | null
          user_id: string
        }
        Update: {
          body?: string | null
          classification?: string | null
          from_email?: string | null
          id?: string
          in_reply_to_send_id?: string | null
          lead_id?: string | null
          received_at?: string
          reply_sent_at?: string | null
          reply_status?: string
          subject?: string | null
          suggested_reply?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbound_messages_in_reply_to_send_id_fkey"
            columns: ["in_reply_to_send_id"]
            isOneToOne: false
            referencedRelation: "email_sends"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_enrichments: {
        Row: {
          business_summary: string | null
          created_at: string
          funnel_presence: string | null
          id: string
          lead_id: string
          offer: string | null
          pain_points: Json | null
          pricing_signals: string | null
          raw_markdown: string | null
          target_audience: string | null
          user_id: string
          website_signals: Json | null
        }
        Insert: {
          business_summary?: string | null
          created_at?: string
          funnel_presence?: string | null
          id?: string
          lead_id: string
          offer?: string | null
          pain_points?: Json | null
          pricing_signals?: string | null
          raw_markdown?: string | null
          target_audience?: string | null
          user_id: string
          website_signals?: Json | null
        }
        Update: {
          business_summary?: string | null
          created_at?: string
          funnel_presence?: string | null
          id?: string
          lead_id?: string
          offer?: string | null
          pain_points?: Json | null
          pricing_signals?: string | null
          raw_markdown?: string | null
          target_audience?: string | null
          user_id?: string
          website_signals?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_enrichments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          ai_stage_reason: string | null
          business_name: string | null
          created_at: string
          domain: string | null
          email: string | null
          id: string
          location: string | null
          name: string | null
          niche: string | null
          platform: string | null
          platform_alternatives: Json | null
          platform_confidence: number | null
          platform_matches: number | null
          search_config_id: string | null
          source: string | null
          stage_updated_at: string | null
          status: string
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          ai_stage_reason?: string | null
          business_name?: string | null
          created_at?: string
          domain?: string | null
          email?: string | null
          id?: string
          location?: string | null
          name?: string | null
          niche?: string | null
          platform?: string | null
          platform_alternatives?: Json | null
          platform_confidence?: number | null
          platform_matches?: number | null
          search_config_id?: string | null
          source?: string | null
          stage_updated_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          ai_stage_reason?: string | null
          business_name?: string | null
          created_at?: string
          domain?: string | null
          email?: string | null
          id?: string
          location?: string | null
          name?: string | null
          niche?: string | null
          platform?: string | null
          platform_alternatives?: Json | null
          platform_confidence?: number | null
          platform_matches?: number | null
          search_config_id?: string | null
          source?: string | null
          stage_updated_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_search_config_id_fkey"
            columns: ["search_config_id"]
            isOneToOne: false
            referencedRelation: "search_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      outbound_queue: {
        Row: {
          attempts: number
          created_at: string
          draft_id: string
          id: string
          last_error: string | null
          lead_id: string
          scheduled_at: string
          sent_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          draft_id: string
          id?: string
          last_error?: string | null
          lead_id: string
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          draft_id?: string
          id?: string
          last_error?: string | null
          lead_id?: string
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outbound_queue_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "email_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_queue_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      search_configs: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          keywords: string[]
          locations: string[]
          name: string
          niches: string[]
          tech_stack: string[]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          keywords?: string[]
          locations?: string[]
          name: string
          niches?: string[]
          tech_stack?: string[]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          keywords?: string[]
          locations?: string[]
          name?: string
          niches?: string[]
          tech_stack?: string[]
          user_id?: string
        }
        Relationships: []
      }
      workspace_members: {
        Row: {
          created_at: string
          id: string
          role: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          main_site_api_key_ciphertext: string | null
          main_site_domain: string | null
          name: string
          owner_id: string
          platform_client_key_ciphertext: string | null
          platform_wl_domain: string | null
          slug: string
          updated_at: string
          webhook_secret_ciphertext: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          main_site_api_key_ciphertext?: string | null
          main_site_domain?: string | null
          name: string
          owner_id: string
          platform_client_key_ciphertext?: string | null
          platform_wl_domain?: string | null
          slug: string
          updated_at?: string
          webhook_secret_ciphertext?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          main_site_api_key_ciphertext?: string | null
          main_site_domain?: string | null
          name?: string
          owner_id?: string
          platform_client_key_ciphertext?: string | null
          platform_wl_domain?: string | null
          slug?: string
          updated_at?: string
          webhook_secret_ciphertext?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_workspace_role: {
        Args: { _role: string; _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      is_workspace_member: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
