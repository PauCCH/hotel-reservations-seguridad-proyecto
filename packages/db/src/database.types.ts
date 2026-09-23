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
      amenities: {
        Row: {
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          entity: string | null
          entity_id: string | null
          id: string
          ip_address: string | null
          metadata: Json
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json
          user_agent?: string | null
        }
        Relationships: []
      }
      cms_content: {
        Row: {
          content: Json
          id: string
          locale: string
          section: string
          updated_at: string
        }
        Insert: {
          content?: Json
          id?: string
          locale: string
          section: string
          updated_at?: string
        }
        Update: {
          content?: Json
          id?: string
          locale?: string
          section?: string
          updated_at?: string
        }
        Relationships: []
      }
      gallery_content: {
        Row: {
          description: string
          gallery_item_id: string
          id: string
          locale: string
          title: string
          updated_at: string
        }
        Insert: {
          description?: string
          gallery_item_id: string
          id?: string
          locale: string
          title?: string
          updated_at?: string
        }
        Update: {
          description?: string
          gallery_item_id?: string
          id?: string
          locale?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gallery_content_gallery_item_id_fkey"
            columns: ["gallery_item_id"]
            isOneToOne: false
            referencedRelation: "gallery_items"
            referencedColumns: ["id"]
          },
        ]
      }
      gallery_items: {
        Row: {
          created_at: string
          id: string
          image_url: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      pending_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          revoked_at: string | null
          revoked_by: string | null
          status: Database["public"]["Enums"]["invitation_status"]
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          status?: Database["public"]["Enums"]["invitation_status"]
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          status?: Database["public"]["Enums"]["invitation_status"]
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          full_name: string | null
          id: string
          is_active: boolean
        }
        Insert: {
          full_name?: string | null
          id: string
          is_active?: boolean
        }
        Update: {
          full_name?: string | null
          id?: string
          is_active?: boolean
        }
        Relationships: []
      }
      reservations: {
        Row: {
          adults: number
          cancellation_reason: string | null
          check_in: string
          check_out: string
          children: number
          code: string
          created_at: string
          currency: string
          guest_email: string
          guest_name: string
          guest_phone: string
          id: string
          pets: number
          price_per_night: number
          room_id: string
          status: string
          total_amount: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          adults?: number
          cancellation_reason?: string | null
          check_in: string
          check_out: string
          children?: number
          code?: string
          created_at?: string
          currency?: string
          guest_email: string
          guest_name: string
          guest_phone: string
          id?: string
          pets?: number
          price_per_night: number
          room_id: string
          status?: string
          total_amount: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          adults?: number
          cancellation_reason?: string | null
          check_in?: string
          check_out?: string
          children?: number
          code?: string
          created_at?: string
          currency?: string
          guest_email?: string
          guest_name?: string
          guest_phone?: string
          id?: string
          pets?: number
          price_per_night?: number
          room_id?: string
          status?: string
          total_amount?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservations_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      room_amenities: {
        Row: {
          amenity_id: string
          created_at: string | null
          room_id: string
        }
        Insert: {
          amenity_id: string
          created_at?: string | null
          room_id: string
        }
        Update: {
          amenity_id?: string
          created_at?: string | null
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_amenities_amenity_id_fkey"
            columns: ["amenity_id"]
            isOneToOne: false
            referencedRelation: "amenities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_amenities_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_images: {
        Row: {
          created_at: string | null
          id: string
          position: number
          room_id: string
          storage_path: string
          url: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          position?: number
          room_id: string
          storage_path: string
          url: string
        }
        Update: {
          created_at?: string | null
          id?: string
          position?: number
          room_id?: string
          storage_path?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_images_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_schedules: {
        Row: {
          created_at: string | null
          id: string
          room_id: string
          schedule_type: string
          time_slot: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          room_id: string
          schedule_type: string
          time_slot: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          room_id?: string
          schedule_type?: string
          time_slot?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "room_schedules_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          capacity_adults: number
          capacity_kids: number
          category: string
          created_at: string
          description: string | null
          high_season_fee: number
          id: string
          is_active: boolean
          is_pet_friendly: boolean
          name: string
          regular_fee: number
          updated_at: string
        }
        Insert: {
          capacity_adults: number
          capacity_kids: number
          category: string
          created_at?: string
          description?: string | null
          high_season_fee: number
          id?: string
          is_active?: boolean
          is_pet_friendly?: boolean
          name: string
          regular_fee: number
          updated_at?: string
        }
        Update: {
          capacity_adults?: number
          capacity_kids?: number
          category?: string
          created_at?: string
          description?: string | null
          high_season_fee?: number
          id?: string
          is_active?: boolean
          is_pet_friendly?: boolean
          name?: string
          regular_fee?: number
          updated_at?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          id: string
          setting_key: string
          setting_value: string
          updated_at: string
        }
        Insert: {
          id?: string
          setting_key: string
          setting_value: string
          updated_at?: string
        }
        Update: {
          id?: string
          setting_key?: string
          setting_value?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          created_at: string | null
          granted_by: string | null
          permission: Database["public"]["Enums"]["user_permission"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          granted_by?: string | null
          permission: Database["public"]["Enums"]["user_permission"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          granted_by?: string | null
          permission?: Database["public"]["Enums"]["user_permission"]
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_admins: {
        Args: never
        Returns: {
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          role: string
        }[]
      }
      has_permission: {
        Args: { p_permission: Database["public"]["Enums"]["user_permission"] }
        Returns: boolean
      }
      is_admin_or_owner: { Args: never; Returns: boolean }
      set_admin_permissions: { Args: { admin_id: string }; Returns: undefined }
      set_owner_permissions: { Args: { owner_id: string }; Returns: undefined }
    }
    Enums: {
      invitation_status: "pending" | "accepted" | "revoked" | "expired"
      user_permission:
        | "view:dashboard"
        | "reservations:view"
        | "reservations:edit"
        | "reservations:delete"
        | "admins:view"
        | "admins:invite"
        | "admins:disable"
        | "admins:revoke"
        | "cms:manage"
        | "permissions:manage"
        | "rooms:manage"
        | "invoices:view"
        | "clients:view"
        | "audit:view"
      user_role: "owner" | "admin" | "client"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      invitation_status: ["pending", "accepted", "revoked", "expired"],
      user_permission: [
        "view:dashboard",
        "reservations:view",
        "reservations:edit",
        "reservations:delete",
        "admins:view",
        "admins:invite",
        "admins:disable",
        "admins:revoke",
        "cms:manage",
        "permissions:manage",
        "rooms:manage",
        "invoices:view",
        "clients:view",
        "audit:view",
      ],
      user_role: ["owner", "admin", "client"],
    },
  },
} as const
