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
      cart_items: {
        Row: {
          created_at: string | null
          id: string
          product_id: string
          quantity: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id: string
          quantity?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string
          quantity?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          department: string
          display_order: number
          id: string
          image: string | null
          is_active: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department?: string
          display_order?: number
          id?: string
          image?: string | null
          is_active?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string
          display_order?: number
          id?: string
          image?: string | null
          is_active?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      delivery_fee_audit: {
        Row: {
          action: string
          changed_by: string | null
          changed_by_email: string | null
          created_at: string
          delivery_fee_id: string | null
          id: string
          new_values: Json | null
          old_values: Json | null
        }
        Insert: {
          action: string
          changed_by?: string | null
          changed_by_email?: string | null
          created_at?: string
          delivery_fee_id?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
        }
        Update: {
          action?: string
          changed_by?: string | null
          changed_by_email?: string | null
          created_at?: string
          delivery_fee_id?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
        }
        Relationships: []
      }
      delivery_fees: {
        Row: {
          city: string | null
          created_at: string
          fee: number
          id: string
          is_active: boolean
          is_default: boolean
          region: string
          updated_at: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          fee?: number
          id?: string
          is_active?: boolean
          is_default?: boolean
          region: string
          updated_at?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          fee?: number
          id?: string
          is_active?: boolean
          is_default?: boolean
          region?: string
          updated_at?: string
        }
        Relationships: []
      }
      discount_codes: {
        Row: {
          code: string
          created_at: string
          current_uses: number | null
          description: string | null
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean | null
          max_uses: number | null
          min_order_amount: number | null
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          code: string
          created_at?: string
          current_uses?: number | null
          description?: string | null
          discount_type: string
          discount_value: number
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          min_order_amount?: number | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          current_uses?: number | null
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          min_order_amount?: number | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      discount_usage: {
        Row: {
          discount_code_id: string
          id: string
          order_id: string | null
          used_at: string
          user_id: string
        }
        Insert: {
          discount_code_id: string
          id?: string
          order_id?: string | null
          used_at?: string
          user_id: string
        }
        Update: {
          discount_code_id?: string
          id?: string
          order_id?: string | null
          used_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discount_usage_discount_code_id_fkey"
            columns: ["discount_code_id"]
            isOneToOne: false
            referencedRelation: "discount_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_usage_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string | null
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          order_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          order_id?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          order_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          commission_amount: number | null
          commission_percent: number | null
          created_at: string | null
          id: string
          order_id: string
          price: number
          product_id: string
          quantity: number
          seller_earnings: number | null
          seller_id: string | null
          unit_price: number | null
        }
        Insert: {
          commission_amount?: number | null
          commission_percent?: number | null
          created_at?: string | null
          id?: string
          order_id: string
          price: number
          product_id: string
          quantity: number
          seller_earnings?: number | null
          seller_id?: string | null
          unit_price?: number | null
        }
        Update: {
          commission_amount?: number | null
          commission_percent?: number | null
          created_at?: string | null
          id?: string
          order_id?: string
          price?: number
          product_id?: string
          quantity?: number
          seller_earnings?: number | null
          seller_id?: string | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string | null
          currency: string
          delivery_fee: number
          discount_amount: number | null
          discount_code: string | null
          id: string
          payment_method: string
          shipping_address: string
          shipping_city: string
          shipping_email: string
          shipping_name: string
          shipping_phone: string
          shipping_region: string
          status: string
          total_amount: number
          tracking_code: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          currency?: string
          delivery_fee?: number
          discount_amount?: number | null
          discount_code?: string | null
          id?: string
          payment_method: string
          shipping_address: string
          shipping_city: string
          shipping_email: string
          shipping_name: string
          shipping_phone: string
          shipping_region: string
          status?: string
          total_amount: number
          tracking_code?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          currency?: string
          delivery_fee?: number
          discount_amount?: number | null
          discount_code?: string | null
          id?: string
          payment_method?: string
          shipping_address?: string
          shipping_city?: string
          shipping_email?: string
          shipping_name?: string
          shipping_phone?: string
          shipping_region?: string
          status?: string
          total_amount?: number
          tracking_code?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      payout_ledger: {
        Row: {
          commission_amount: number
          created_at: string
          gross_amount: number
          id: string
          order_id: string
          order_item_id: string
          paid_at: string | null
          paystack_reference: string | null
          seller_earnings: number
          seller_id: string
          status: string
        }
        Insert: {
          commission_amount: number
          created_at?: string
          gross_amount: number
          id?: string
          order_id: string
          order_item_id: string
          paid_at?: string | null
          paystack_reference?: string | null
          seller_earnings: number
          seller_id: string
          status?: string
        }
        Update: {
          commission_amount?: number
          created_at?: string
          gross_amount?: number
          id?: string
          order_id?: string
          order_item_id?: string
          paid_at?: string | null
          paystack_reference?: string | null
          seller_earnings?: number
          seller_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_ledger_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_ledger_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: true
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          default_commission_percent: number
          id: number
          updated_at: string
        }
        Insert: {
          default_commission_percent?: number
          id?: number
          updated_at?: string
        }
        Update: {
          default_commission_percent?: number
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      product_reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          product_id: string
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          product_id: string
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          product_id?: string
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string
          created_at: string | null
          department: string
          description: string | null
          id: string
          image: string
          images: string[] | null
          low_stock_threshold: number
          name: string
          price: number
          rejection_reason: string | null
          sale_ends_at: string | null
          sale_price: number | null
          seller_id: string | null
          status: Database["public"]["Enums"]["product_status"]
          stock: number
          updated_at: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          department?: string
          description?: string | null
          id?: string
          image: string
          images?: string[] | null
          low_stock_threshold?: number
          name: string
          price: number
          rejection_reason?: string | null
          sale_ends_at?: string | null
          sale_price?: number | null
          seller_id?: string | null
          status?: Database["public"]["Enums"]["product_status"]
          stock?: number
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          department?: string
          description?: string | null
          id?: string
          image?: string
          images?: string[] | null
          low_stock_threshold?: number
          name?: string
          price?: number
          rejection_reason?: string | null
          sale_ends_at?: string | null
          sale_price?: number | null
          seller_id?: string | null
          status?: Database["public"]["Enums"]["product_status"]
          stock?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          language_preference: string
          notification_settings: Json | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          language_preference?: string
          notification_settings?: Json | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          language_preference?: string
          notification_settings?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      seller_billing_authorizations: {
        Row: {
          card_brand: string | null
          created_at: string
          exp_month: number | null
          exp_year: number | null
          id: string
          is_default: boolean
          last4: string | null
          paystack_authorization_code: string
          user_id: string
        }
        Insert: {
          card_brand?: string | null
          created_at?: string
          exp_month?: number | null
          exp_year?: number | null
          id?: string
          is_default?: boolean
          last4?: string | null
          paystack_authorization_code: string
          user_id: string
        }
        Update: {
          card_brand?: string | null
          created_at?: string
          exp_month?: number | null
          exp_year?: number | null
          id?: string
          is_default?: boolean
          last4?: string | null
          paystack_authorization_code?: string
          user_id?: string
        }
        Relationships: []
      }
      seller_compliance_documents: {
        Row: {
          doc_type: string
          doc_url: string
          id: string
          notes: string | null
          seller_profile_id: string
          uploaded_at: string
          user_id: string
        }
        Insert: {
          doc_type: string
          doc_url: string
          id?: string
          notes?: string | null
          seller_profile_id: string
          uploaded_at?: string
          user_id: string
        }
        Update: {
          doc_type?: string
          doc_url?: string
          id?: string
          notes?: string | null
          seller_profile_id?: string
          uploaded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_compliance_documents_seller_profile_id_fkey"
            columns: ["seller_profile_id"]
            isOneToOne: false
            referencedRelation: "seller_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_profiles: {
        Row: {
          account_name: string | null
          account_number: string | null
          address: string | null
          applied_at: string
          approved_at: string | null
          bank_code: string | null
          bank_name: string | null
          bio: string | null
          business_address: string | null
          business_name: string
          business_registration_number: string | null
          business_type: string | null
          commission_override: number | null
          created_at: string
          date_of_birth: string | null
          email: string | null
          email_verified_at: string | null
          full_legal_name: string | null
          ghana_card_image_url: string | null
          ghana_card_number: string | null
          id: string
          id_document_back_url: string | null
          id_document_front_url: string | null
          id_document_number: string | null
          id_document_type: string | null
          identity_verified_at: string | null
          momo_account_name: string | null
          momo_number: string | null
          momo_provider: string | null
          payout_method: string
          paystack_subaccount_code: string | null
          phone: string | null
          phone_verified_at: string | null
          proof_of_address_issued_on: string | null
          proof_of_address_type: string | null
          proof_of_address_url: string | null
          rejection_reason: string | null
          return_address: string | null
          selfie_url: string | null
          status: Database["public"]["Enums"]["seller_status"]
          store_description: string | null
          store_logo_url: string | null
          store_name: string | null
          swift_bic: string | null
          tax_form_type: string | null
          tax_form_url: string | null
          tax_id: string | null
          updated_at: string
          user_id: string
          vat_number: string | null
        }
        Insert: {
          account_name?: string | null
          account_number?: string | null
          address?: string | null
          applied_at?: string
          approved_at?: string | null
          bank_code?: string | null
          bank_name?: string | null
          bio?: string | null
          business_address?: string | null
          business_name: string
          business_registration_number?: string | null
          business_type?: string | null
          commission_override?: number | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          email_verified_at?: string | null
          full_legal_name?: string | null
          ghana_card_image_url?: string | null
          ghana_card_number?: string | null
          id?: string
          id_document_back_url?: string | null
          id_document_front_url?: string | null
          id_document_number?: string | null
          id_document_type?: string | null
          identity_verified_at?: string | null
          momo_account_name?: string | null
          momo_number?: string | null
          momo_provider?: string | null
          payout_method?: string
          paystack_subaccount_code?: string | null
          phone?: string | null
          phone_verified_at?: string | null
          proof_of_address_issued_on?: string | null
          proof_of_address_type?: string | null
          proof_of_address_url?: string | null
          rejection_reason?: string | null
          return_address?: string | null
          selfie_url?: string | null
          status?: Database["public"]["Enums"]["seller_status"]
          store_description?: string | null
          store_logo_url?: string | null
          store_name?: string | null
          swift_bic?: string | null
          tax_form_type?: string | null
          tax_form_url?: string | null
          tax_id?: string | null
          updated_at?: string
          user_id: string
          vat_number?: string | null
        }
        Update: {
          account_name?: string | null
          account_number?: string | null
          address?: string | null
          applied_at?: string
          approved_at?: string | null
          bank_code?: string | null
          bank_name?: string | null
          bio?: string | null
          business_address?: string | null
          business_name?: string
          business_registration_number?: string | null
          business_type?: string | null
          commission_override?: number | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          email_verified_at?: string | null
          full_legal_name?: string | null
          ghana_card_image_url?: string | null
          ghana_card_number?: string | null
          id?: string
          id_document_back_url?: string | null
          id_document_front_url?: string | null
          id_document_number?: string | null
          id_document_type?: string | null
          identity_verified_at?: string | null
          momo_account_name?: string | null
          momo_number?: string | null
          momo_provider?: string | null
          payout_method?: string
          paystack_subaccount_code?: string | null
          phone?: string | null
          phone_verified_at?: string | null
          proof_of_address_issued_on?: string | null
          proof_of_address_type?: string | null
          proof_of_address_url?: string | null
          rejection_reason?: string | null
          return_address?: string | null
          selfie_url?: string | null
          status?: Database["public"]["Enums"]["seller_status"]
          store_description?: string | null
          store_logo_url?: string | null
          store_name?: string | null
          swift_bic?: string | null
          tax_form_type?: string | null
          tax_form_url?: string | null
          tax_id?: string | null
          updated_at?: string
          user_id?: string
          vat_number?: string | null
        }
        Relationships: []
      }
      shared_wishlists: {
        Row: {
          created_at: string
          id: string
          share_token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          share_token?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          share_token?: string
          user_id?: string
        }
        Relationships: []
      }
      subscribers: {
        Row: {
          email: string
          id: string
          is_active: boolean
          subscribed_at: string
        }
        Insert: {
          email: string
          id?: string
          is_active?: boolean
          subscribed_at?: string
        }
        Update: {
          email?: string
          id?: string
          is_active?: boolean
          subscribed_at?: string
        }
        Relationships: []
      }
      testimonials: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          rating: number
          role: string
          text: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          rating?: number
          role?: string
          text: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          rating?: number
          role?: string
          text?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_sellers: {
        Row: {
          approved_at: string | null
          bio: string | null
          business_name: string | null
          user_id: string | null
        }
        Insert: {
          approved_at?: string | null
          bio?: string | null
          business_name?: string | null
          user_id?: string | null
        }
        Update: {
          approved_at?: string | null
          bio?: string | null
          business_name?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      generate_tracking_code: { Args: never; Returns: string }
      get_order_by_tracking_code: {
        Args: { _tracking_code: string }
        Returns: {
          created_at: string
          currency: string
          id: string
          shipping_city: string
          shipping_name_masked: string
          shipping_region: string
          status: string
          total_amount: number
          tracking_code: string
          updated_at: string
        }[]
      }
      get_product_reviews: {
        Args: { _product_id: string }
        Returns: {
          avatar_url: string
          comment: string
          created_at: string
          full_name: string
          id: string
          is_own: boolean
          rating: number
        }[]
      }
      get_seller_earnings_summary: {
        Args: { _seller_id: string }
        Returns: {
          paid_earnings: number
          pending_earnings: number
          total_commission: number
          total_earnings: number
          total_gross: number
          total_orders: number
        }[]
      }
      get_shared_wishlist: {
        Args: { _token: string }
        Returns: {
          id: string
          image: string
          name: string
          owner_name: string
          price: number
          product_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_approved_seller: { Args: { _user_id: string }; Returns: boolean }
      resolve_delivery_fee: {
        Args: { _city: string; _region: string }
        Returns: number
      }
      seller_can_view_order: { Args: { _order_id: string }; Returns: boolean }
      validate_discount_code: {
        Args: { _code: string; _order_amount: number }
        Returns: {
          code: string
          discount_type: string
          discount_value: number
          id: string
          is_valid: boolean
          message: string
          min_order_amount: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user" | "rider" | "seller"
      product_status: "pending" | "approved" | "rejected" | "hidden"
      seller_status: "pending" | "approved" | "rejected" | "suspended"
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
      app_role: ["admin", "user", "rider", "seller"],
      product_status: ["pending", "approved", "rejected", "hidden"],
      seller_status: ["pending", "approved", "rejected", "suspended"],
    },
  },
} as const
