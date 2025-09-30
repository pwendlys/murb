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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_setup: {
        Row: {
          admin_user_id: string
          created_at: string | null
          password_set: boolean | null
          updated_at: string | null
        }
        Insert: {
          admin_user_id: string
          created_at?: string | null
          password_set?: boolean | null
          updated_at?: string | null
        }
        Update: {
          admin_user_id?: string
          created_at?: string | null
          password_set?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      bd_ativo: {
        Row: {
          created_at: string | null
          id: number
          num: number
        }
        Insert: {
          created_at?: string | null
          id?: number
          num: number
        }
        Update: {
          created_at?: string | null
          id?: number
          num?: number
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          created_at: string | null
          delivered_at: string | null
          id: string
          read_at: string | null
          receiver_id: string
          ride_id: string
          sender_id: string
          text: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          delivered_at?: string | null
          id?: string
          read_at?: string | null
          receiver_id: string
          ride_id: string
          sender_id: string
          text: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          delivered_at?: string | null
          id?: string
          read_at?: string | null
          receiver_id?: string
          ride_id?: string
          sender_id?: string
          text?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      driver_balances: {
        Row: {
          available: number | null
          created_at: string | null
          driver_id: string
          reserved: number | null
          total_earnings: number | null
          updated_at: string | null
        }
        Insert: {
          available?: number | null
          created_at?: string | null
          driver_id: string
          reserved?: number | null
          total_earnings?: number | null
          updated_at?: string | null
        }
        Update: {
          available?: number | null
          created_at?: string | null
          driver_id?: string
          reserved?: number | null
          total_earnings?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      driver_details: {
        Row: {
          created_at: string | null
          driver_license: string | null
          id: string
          updated_at: string | null
          user_id: string
          vehicle_brand: string | null
          vehicle_color: string | null
          vehicle_model: string | null
          vehicle_plate: string | null
          vehicle_type: string | null
        }
        Insert: {
          created_at?: string | null
          driver_license?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
          vehicle_brand?: string | null
          vehicle_color?: string | null
          vehicle_model?: string | null
          vehicle_plate?: string | null
          vehicle_type?: string | null
        }
        Update: {
          created_at?: string | null
          driver_license?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
          vehicle_brand?: string | null
          vehicle_color?: string | null
          vehicle_model?: string | null
          vehicle_plate?: string | null
          vehicle_type?: string | null
        }
        Relationships: []
      }
      driver_passenger_ratings: {
        Row: {
          comment: string | null
          created_at: string | null
          created_by: string
          id: string
          rating: number
          ride_id: string
          updated_at: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          created_by: string
          id?: string
          rating: number
          ride_id: string
          updated_at?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          created_by?: string
          id?: string
          rating?: number
          ride_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      driver_payout_requests: {
        Row: {
          admin_notes: string | null
          amount: number
          created_at: string | null
          driver_id: string
          id: string
          notes: string | null
          payment_details: Json
          payment_method: string
          processed_at: string | null
          processed_by: string | null
          status: Database["public"]["Enums"]["payout_status"] | null
          updated_at: string | null
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          created_at?: string | null
          driver_id: string
          id?: string
          notes?: string | null
          payment_details: Json
          payment_method: string
          processed_at?: string | null
          processed_by?: string | null
          status?: Database["public"]["Enums"]["payout_status"] | null
          updated_at?: string | null
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          created_at?: string | null
          driver_id?: string
          id?: string
          notes?: string | null
          payment_details?: Json
          payment_method?: string
          processed_at?: string | null
          processed_by?: string | null
          status?: Database["public"]["Enums"]["payout_status"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      driver_subscriptions: {
        Row: {
          created_at: string | null
          driver_id: string
          end_date: string
          id: string
          plan_id: string
          start_date: string
          status: Database["public"]["Enums"]["subscription_status"] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          driver_id: string
          end_date: string
          id?: string
          plan_id: string
          start_date: string
          status?: Database["public"]["Enums"]["subscription_status"] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          driver_id?: string
          end_date?: string
          id?: string
          plan_id?: string
          start_date?: string
          status?: Database["public"]["Enums"]["subscription_status"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      fee_payments: {
        Row: {
          actual_fee_amount: number | null
          amount: number
          available_balance_before: number | null
          canceled_at: string | null
          canceled_reason: string | null
          created_at: string | null
          driver_id: string
          id: string
          initial_due_date: string
          paid_at: string | null
          payment_due_date: string | null
          status: Database["public"]["Enums"]["fee_status"] | null
          updated_at: string | null
        }
        Insert: {
          actual_fee_amount?: number | null
          amount: number
          available_balance_before?: number | null
          canceled_at?: string | null
          canceled_reason?: string | null
          created_at?: string | null
          driver_id: string
          id?: string
          initial_due_date: string
          paid_at?: string | null
          payment_due_date?: string | null
          status?: Database["public"]["Enums"]["fee_status"] | null
          updated_at?: string | null
        }
        Update: {
          actual_fee_amount?: number | null
          amount?: number
          available_balance_before?: number | null
          canceled_at?: string | null
          canceled_reason?: string | null
          created_at?: string | null
          driver_id?: string
          id?: string
          initial_due_date?: string
          paid_at?: string | null
          payment_due_date?: string | null
          status?: Database["public"]["Enums"]["fee_status"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      locations: {
        Row: {
          heading: number | null
          id: string
          lat: number
          lng: number
          speed: number | null
          timestamp: string | null
          user_id: string
        }
        Insert: {
          heading?: number | null
          id?: string
          lat: number
          lng: number
          speed?: number | null
          timestamp?: string | null
          user_id: string
        }
        Update: {
          heading?: number | null
          id?: string
          lat?: number
          lng?: number
          speed?: number | null
          timestamp?: string | null
          user_id?: string
        }
        Relationships: []
      }
      pricing_settings: {
        Row: {
          created_at: string | null
          fixed_price: number | null
          fixed_price_active: boolean | null
          id: string
          price_per_km: number | null
          price_per_km_active: boolean | null
          service_fee_type: string | null
          service_fee_value: number | null
          singleton: boolean | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          fixed_price?: number | null
          fixed_price_active?: boolean | null
          id?: string
          price_per_km?: number | null
          price_per_km_active?: boolean | null
          service_fee_type?: string | null
          service_fee_value?: number | null
          singleton?: boolean | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          fixed_price?: number | null
          fixed_price_active?: boolean | null
          id?: string
          price_per_km?: number | null
          price_per_km_active?: boolean | null
          service_fee_type?: string | null
          service_fee_value?: number | null
          singleton?: boolean | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          full_name: string
          id: string
          is_active: boolean | null
          phone: string | null
          updated_at: string | null
          user_type: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          full_name: string
          id: string
          is_active?: boolean | null
          phone?: string | null
          updated_at?: string | null
          user_type: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string
          id?: string
          is_active?: boolean | null
          phone?: string | null
          updated_at?: string | null
          user_type?: string
        }
        Relationships: []
      }
      ride_ratings: {
        Row: {
          comment: string | null
          created_at: string | null
          id: string
          rating: number
          reviewee_id: string
          reviewer_id: string
          ride_id: string
          updated_at: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          id?: string
          rating: number
          reviewee_id: string
          reviewer_id: string
          ride_id: string
          updated_at?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          id?: string
          rating?: number
          reviewee_id?: string
          reviewer_id?: string
          ride_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      rides: {
        Row: {
          actual_price: number | null
          completed_at: string | null
          created_at: string | null
          destination_address: string
          destination_lat: number
          destination_lng: number
          driver_arrived: boolean | null
          driver_en_route: boolean | null
          driver_id: string | null
          driver_to_pickup_distance_km: number | null
          driver_to_pickup_duration_min: number | null
          en_route_started_at: string | null
          estimated_distance: number | null
          estimated_duration: number | null
          estimated_price: number | null
          id: string
          origin_address: string
          origin_lat: number
          origin_lng: number
          passenger_id: string
          payment_method: string | null
          pickup_arrived_at: string | null
          started_at: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          actual_price?: number | null
          completed_at?: string | null
          created_at?: string | null
          destination_address: string
          destination_lat: number
          destination_lng: number
          driver_arrived?: boolean | null
          driver_en_route?: boolean | null
          driver_id?: string | null
          driver_to_pickup_distance_km?: number | null
          driver_to_pickup_duration_min?: number | null
          en_route_started_at?: string | null
          estimated_distance?: number | null
          estimated_duration?: number | null
          estimated_price?: number | null
          id?: string
          origin_address: string
          origin_lat: number
          origin_lng: number
          passenger_id: string
          payment_method?: string | null
          pickup_arrived_at?: string | null
          started_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          actual_price?: number | null
          completed_at?: string | null
          created_at?: string | null
          destination_address?: string
          destination_lat?: number
          destination_lng?: number
          driver_arrived?: boolean | null
          driver_en_route?: boolean | null
          driver_id?: string | null
          driver_to_pickup_distance_km?: number | null
          driver_to_pickup_duration_min?: number | null
          en_route_started_at?: string | null
          estimated_distance?: number | null
          estimated_duration?: number | null
          estimated_price?: number | null
          id?: string
          origin_address?: string
          origin_lat?: number
          origin_lng?: number
          passenger_id?: string
          payment_method?: string | null
          pickup_arrived_at?: string | null
          started_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          created_at: string | null
          duration_days: number
          id: string
          is_active: boolean | null
          name: string
          price_cents: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          duration_days: number
          id?: string
          is_active?: boolean | null
          name: string
          price_cents: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          duration_days?: number
          id?: string
          is_active?: boolean | null
          name?: string
          price_cents?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      subscription_requests: {
        Row: {
          admin_notes: string | null
          current_subscription_id: string | null
          driver_id: string
          id: string
          plan_id: string
          processed_at: string | null
          processed_by: string | null
          requested_at: string | null
          status: string | null
        }
        Insert: {
          admin_notes?: string | null
          current_subscription_id?: string | null
          driver_id: string
          id?: string
          plan_id: string
          processed_at?: string | null
          processed_by?: string | null
          requested_at?: string | null
          status?: string | null
        }
        Update: {
          admin_notes?: string | null
          current_subscription_id?: string | null
          driver_id?: string
          id?: string
          plan_id?: string
          processed_at?: string | null
          processed_by?: string | null
          requested_at?: string | null
          status?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_subscription_payment: {
        Args: { p_request_id: string }
        Returns: {
          created_at: string | null
          driver_id: string
          end_date: string
          id: string
          plan_id: string
          start_date: string
          status: Database["public"]["Enums"]["subscription_status"] | null
          updated_at: string | null
        }
      }
      calculate_driver_balance: {
        Args: { p_driver_id: string }
        Returns: {
          available: number | null
          created_at: string | null
          driver_id: string
          reserved: number | null
          total_earnings: number | null
          updated_at: string | null
        }
      }
      cancel_fee: {
        Args: { p_fee_id: string; p_reason: string }
        Returns: {
          actual_fee_amount: number | null
          amount: number
          available_balance_before: number | null
          canceled_at: string | null
          canceled_reason: string | null
          created_at: string | null
          driver_id: string
          id: string
          initial_due_date: string
          paid_at: string | null
          payment_due_date: string | null
          status: Database["public"]["Enums"]["fee_status"] | null
          updated_at: string | null
        }
      }
      get_driver_subscription_status: {
        Args: { p_driver_id: string }
        Returns: {
          days_remaining: number
          duration_days: number
          end_date: string
          has_pending_request: boolean
          plan_name: string
          price_cents: number
          start_date: string
          status: Database["public"]["Enums"]["subscription_status"]
          subscription_id: string
        }[]
      }
      inserir_3x_e_parar: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      mark_fee_paid: {
        Args: { p_fee_id: string }
        Returns: {
          actual_fee_amount: number | null
          amount: number
          available_balance_before: number | null
          canceled_at: string | null
          canceled_reason: string | null
          created_at: string | null
          driver_id: string
          id: string
          initial_due_date: string
          paid_at: string | null
          payment_due_date: string | null
          status: Database["public"]["Enums"]["fee_status"] | null
          updated_at: string | null
        }
      }
      request_fee_payment: {
        Args: Record<PropertyKey, never>
        Returns: {
          actual_fee_amount: number | null
          amount: number
          available_balance_before: number | null
          canceled_at: string | null
          canceled_reason: string | null
          created_at: string | null
          driver_id: string
          id: string
          initial_due_date: string
          paid_at: string | null
          payment_due_date: string | null
          status: Database["public"]["Enums"]["fee_status"] | null
          updated_at: string | null
        }
      }
      request_subscription_renewal: {
        Args: { p_plan_id: string }
        Returns: {
          admin_notes: string | null
          current_subscription_id: string | null
          driver_id: string
          id: string
          plan_id: string
          processed_at: string | null
          processed_by: string | null
          requested_at: string | null
          status: string | null
        }
      }
    }
    Enums: {
      fee_status: "not_requested" | "pending" | "paid" | "canceled" | "expired"
      payout_status: "pending" | "approved" | "rejected" | "paid"
      subscription_status: "ativa" | "vencida" | "cancelada" | "pendente"
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
      fee_status: ["not_requested", "pending", "paid", "canceled", "expired"],
      payout_status: ["pending", "approved", "rejected", "paid"],
      subscription_status: ["ativa", "vencida", "cancelada", "pendente"],
    },
  },
} as const
