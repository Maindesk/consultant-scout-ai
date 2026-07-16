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
          auto_insert_sso_in_email3: boolean
          auto_provision_demo: boolean
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
          auto_insert_sso_in_email3?: boolean
          auto_provision_demo?: boolean
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
          auto_insert_sso_in_email3?: boolean
          auto_provision_demo?: boolean
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
          main_site_contact_id: string | null
          main_site_sync_error: string | null
          main_site_synced_at: string | null
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
          main_site_contact_id?: string | null
          main_site_sync_error?: string | null
          main_site_synced_at?: string | null
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
          main_site_contact_id?: string | null
          main_site_sync_error?: string | null
          main_site_synced_at?: string | null
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
      lead_platform_sites: {
        Row: {
          created_at: string
          edit_sso_url: string | null
          id: string
          lead_id: string
          personalization_tags: Json
          project_id: string
          sso_expires_at: string | null
          subdomain: string | null
          template_id: string | null
          template_type: string | null
          updated_at: string
          website_id: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          edit_sso_url?: string | null
          id?: string
          lead_id: string
          personalization_tags?: Json
          project_id: string
          sso_expires_at?: string | null
          subdomain?: string | null
          template_id?: string | null
          template_type?: string | null
          updated_at?: string
          website_id?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          edit_sso_url?: string | null
          id?: string
          lead_id?: string
          personalization_tags?: Json
          project_id?: string
          sso_expires_at?: string | null
          subdomain?: string | null
          template_id?: string | null
          template_type?: string | null
          updated_at?: string
          website_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_platform_sites_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_platform_sites_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          main_site_contact_id: string | null
          main_site_tags: string[]
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
          won_at: string | null
          won_mrr_cents: number | null
          won_period: string | null
        }
        Insert: {
          ai_stage_reason?: string | null
          business_name?: string | null
          created_at?: string
          domain?: string | null
          email?: string | null
          id?: string
          location?: string | null
          main_site_contact_id?: string | null
          main_site_tags?: string[]
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
          won_at?: string | null
          won_mrr_cents?: number | null
          won_period?: string | null
        }
        Update: {
          ai_stage_reason?: string | null
          business_name?: string | null
          created_at?: string
          domain?: string | null
          email?: string | null
          id?: string
          location?: string | null
          main_site_contact_id?: string | null
          main_site_tags?: string[]
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
          won_at?: string | null
          won_mrr_cents?: number | null
          won_period?: string | null
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
      plans: {
        Row: {
          ai_credits_monthly: number
          code: string
          created_at: string
          emails_monthly: number
          id: string
          is_active: boolean
          leads_monthly: number
          name: string
          price_usd_monthly: number
          sort_order: number
        }
        Insert: {
          ai_credits_monthly: number
          code: string
          created_at?: string
          emails_monthly: number
          id?: string
          is_active?: boolean
          leads_monthly: number
          name: string
          price_usd_monthly: number
          sort_order?: number
        }
        Update: {
          ai_credits_monthly?: number
          code?: string
          created_at?: string
          emails_monthly?: number
          id?: string
          is_active?: boolean
          leads_monthly?: number
          name?: string
          price_usd_monthly?: number
          sort_order?: number
        }
        Relationships: []
      }
      platform_events: {
        Row: {
          error: string | null
          handled: boolean
          id: string
          payload: Json
          received_at: string
          topic: string
          workspace_id: string | null
        }
        Insert: {
          error?: string | null
          handled?: boolean
          id?: string
          payload: Json
          received_at?: string
          topic: string
          workspace_id?: string | null
        }
        Update: {
          error?: string | null
          handled?: boolean
          id?: string
          payload?: Json
          received_at?: string
          topic?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_events: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          external_subscription_id: string | null
          id: string
          lead_id: string | null
          occurred_at: string
          period: string | null
          plan_id: string | null
          plan_name: string | null
          type: string
          workspace_id: string
        }
        Insert: {
          amount_cents?: number
          created_at?: string
          currency?: string
          external_subscription_id?: string | null
          id?: string
          lead_id?: string | null
          occurred_at?: string
          period?: string | null
          plan_id?: string | null
          plan_name?: string | null
          type: string
          workspace_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          external_subscription_id?: string | null
          id?: string
          lead_id?: string | null
          occurred_at?: string
          period?: string | null
          plan_id?: string | null
          plan_name?: string | null
          type?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenue_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      search_configs: {
        Row: {
          audience_description: string | null
          created_at: string
          id: string
          is_default: boolean
          keywords: string[]
          locations: string[]
          name: string
          niches: string[]
          search_intents: string[]
          tech_stack: string[]
          user_id: string
        }
        Insert: {
          audience_description?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          keywords?: string[]
          locations?: string[]
          name: string
          niches?: string[]
          search_intents?: string[]
          tech_stack?: string[]
          user_id: string
        }
        Update: {
          audience_description?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          keywords?: string[]
          locations?: string[]
          name?: string
          niches?: string[]
          search_intents?: string[]
          tech_stack?: string[]
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          canceled_at: string | null
          created_at: string
          current_period_end: string
          current_period_start: string
          id: string
          plan_code: string
          provider: string | null
          provider_customer_id: string | null
          provider_subscription_id: string | null
          status: string
          trial_end: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          plan_code: string
          provider?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: string
          trial_end?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          plan_code?: string
          provider?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: string
          trial_end?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_code_fkey"
            columns: ["plan_code"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "subscriptions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      super_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      usage_counters: {
        Row: {
          ai_credits_used: number
          created_at: string
          emails_used: number
          id: string
          leads_discovered_used: number
          period_end: string
          period_start: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          ai_credits_used?: number
          created_at?: string
          emails_used?: number
          id?: string
          leads_discovered_used?: number
          period_end: string
          period_start: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          ai_credits_used?: number
          created_at?: string
          emails_used?: number
          id?: string
          leads_discovered_used?: number
          period_end?: string
          period_start?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_counters_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
          reply_contact_default_tag: string
          slug: string
          sync_replies_to_main_site: boolean
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
          reply_contact_default_tag?: string
          slug: string
          sync_replies_to_main_site?: boolean
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
          reply_contact_default_tag?: string
          slug?: string
          sync_replies_to_main_site?: boolean
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
      increment_usage: {
        Args: {
          _ai: number
          _emails: number
          _leads: number
          _period_end: string
          _period_start: string
          _workspace_id: string
        }
        Returns: undefined
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
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
