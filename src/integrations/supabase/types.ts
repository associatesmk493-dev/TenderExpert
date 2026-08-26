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
      attendance_logs: {
        Row: {
          check_in_time: string
          check_out_time: string | null
          created_at: string
          date: string
          id: string
          user_id: string
        }
        Insert: {
          check_in_time?: string
          check_out_time?: string | null
          created_at?: string
          date?: string
          id?: string
          user_id: string
        }
        Update: {
          check_in_time?: string
          check_out_time?: string | null
          created_at?: string
          date?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      lead_activities: {
        Row: {
          activity_type: string
          created_at: string
          description: string | null
          id: string
          lead_id: string
          user_id: string | null
        }
        Insert: {
          activity_type: string
          created_at?: string
          description?: string | null
          id?: string
          lead_id: string
          user_id?: string | null
        }
        Update: {
          activity_type?: string
          created_at?: string
          description?: string | null
          id?: string
          lead_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          booking_date: string | null
          budget: string | null
          car_interest: string | null
          created_at: string
          created_by: string | null
          customer_name: string
          date_of_birth: string | null
          delivery_date: string | null
          email: string | null
          follow_up_date: string | null
          funnel_stage: Database["public"]["Enums"]["funnel_stage"]
          id: string
          last_call_outcome: Database["public"]["Enums"]["call_outcome"] | null
          marriage_anniversary: string | null
          notes: string | null
          phone: string
          rnr_count: number
          showroom_id: string | null
          source_portal: Database["public"]["Enums"]["source_portal"]
          temperature: Database["public"]["Enums"]["lead_temperature"]
          updated_at: string
          walkin_date: string | null
        }
        Insert: {
          assigned_to?: string | null
          booking_date?: string | null
          budget?: string | null
          car_interest?: string | null
          created_at?: string
          created_by?: string | null
          customer_name: string
          date_of_birth?: string | null
          delivery_date?: string | null
          email?: string | null
          follow_up_date?: string | null
          funnel_stage?: Database["public"]["Enums"]["funnel_stage"]
          id?: string
          last_call_outcome?: Database["public"]["Enums"]["call_outcome"] | null
          marriage_anniversary?: string | null
          notes?: string | null
          phone: string
          rnr_count?: number
          showroom_id?: string | null
          source_portal?: Database["public"]["Enums"]["source_portal"]
          temperature?: Database["public"]["Enums"]["lead_temperature"]
          updated_at?: string
          walkin_date?: string | null
        }
        Update: {
          assigned_to?: string | null
          booking_date?: string | null
          budget?: string | null
          car_interest?: string | null
          created_at?: string
          created_by?: string | null
          customer_name?: string
          date_of_birth?: string | null
          delivery_date?: string | null
          email?: string | null
          follow_up_date?: string | null
          funnel_stage?: Database["public"]["Enums"]["funnel_stage"]
          id?: string
          last_call_outcome?: Database["public"]["Enums"]["call_outcome"] | null
          marriage_anniversary?: string | null
          notes?: string | null
          phone?: string
          rnr_count?: number
          showroom_id?: string | null
          source_portal?: Database["public"]["Enums"]["source_portal"]
          temperature?: Database["public"]["Enums"]["lead_temperature"]
          updated_at?: string
          walkin_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_showroom_id_fkey"
            columns: ["showroom_id"]
            isOneToOne: false
            referencedRelation: "showrooms"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_members: {
        Row: {
          created_at: string
          id: string
          platform_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_members_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
            referencedColumns: ["id"]
          },
        ]
      }
      platforms: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          date_of_birth: string | null
          date_of_joining: string | null
          full_name: string
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          date_of_joining?: string | null
          full_name: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          date_of_joining?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      showroom_members: {
        Row: {
          created_at: string
          id: string
          showroom_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          showroom_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          showroom_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "showroom_members_showroom_id_fkey"
            columns: ["showroom_id"]
            isOneToOne: false
            referencedRelation: "showrooms"
            referencedColumns: ["id"]
          },
        ]
      }
      showrooms: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          id: string
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
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
          role?: Database["public"]["Enums"]["app_role"]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "ceo" | "manager" | "team_member"
      call_outcome:
        | "walkin_scheduled"
        | "not_picked_up"
        | "not_interested"
        | "follow_up"
        | "switched_off"
        | "wrong_number"
      funnel_stage: "calling" | "walkin" | "booking" | "delivery"
      lead_temperature: "hot" | "warm" | "cold"
      source_portal:
        | "cardekho"
        | "carwale"
        | "olx"
        | "facebook"
        | "instagram"
        | "walk_in"
        | "reference"
        | "other"
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
      app_role: ["ceo", "manager", "team_member"],
      call_outcome: [
        "walkin_scheduled",
        "not_picked_up",
        "not_interested",
        "follow_up",
        "switched_off",
        "wrong_number",
      ],
      funnel_stage: ["calling", "walkin", "booking", "delivery"],
      lead_temperature: ["hot", "warm", "cold"],
      source_portal: [
        "cardekho",
        "carwale",
        "olx",
        "facebook",
        "instagram",
        "walk_in",
        "reference",
        "other",
      ],
    },
  },
} as const
