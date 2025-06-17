export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      performance_metrics: {
        Row: {
          avg_loss: number
          avg_win: number
          calculation_time: string
          created_at: string
          current_drawdown: number
          id: string
          losing_trades: number
          max_drawdown: number
          model_performance: Json | null
          profit_factor: number
          session_id: string
          sharpe_ratio: number | null
          total_trades: number
          win_rate: number
          winning_trades: number
        }
        Insert: {
          avg_loss?: number
          avg_win?: number
          calculation_time?: string
          created_at?: string
          current_drawdown?: number
          id?: string
          losing_trades?: number
          max_drawdown?: number
          model_performance?: Json | null
          profit_factor?: number
          session_id: string
          sharpe_ratio?: number | null
          total_trades?: number
          win_rate?: number
          winning_trades?: number
        }
        Update: {
          avg_loss?: number
          avg_win?: number
          calculation_time?: string
          created_at?: string
          current_drawdown?: number
          id?: string
          losing_trades?: number
          max_drawdown?: number
          model_performance?: Json | null
          profit_factor?: number
          session_id?: string
          sharpe_ratio?: number | null
          total_trades?: number
          win_rate?: number
          winning_trades?: number
        }
        Relationships: [
          {
            foreignKeyName: "performance_metrics_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "trading_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_snapshots: {
        Row: {
          available_balance: number
          base_capital: number
          created_at: string
          day_pnl: number
          equity: number
          id: string
          indicators: Json | null
          locked_profits: number
          market_context: Json | null
          open_positions_count: number
          session_id: string
          snapshot_time: string
          total_pnl: number
        }
        Insert: {
          available_balance: number
          base_capital: number
          created_at?: string
          day_pnl: number
          equity: number
          id?: string
          indicators?: Json | null
          locked_profits: number
          market_context?: Json | null
          open_positions_count?: number
          session_id: string
          snapshot_time?: string
          total_pnl: number
        }
        Update: {
          available_balance?: number
          base_capital?: number
          created_at?: string
          day_pnl?: number
          equity?: number
          id?: string
          indicators?: Json | null
          locked_profits?: number
          market_context?: Json | null
          open_positions_count?: number
          session_id?: string
          snapshot_time?: string
          total_pnl?: number
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_snapshots_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "trading_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      positions: {
        Row: {
          created_at: string
          current_price: number
          entry_price: number
          entry_time: string
          exit_price: number | null
          exit_time: string | null
          external_id: string
          id: string
          max_adverse_excursion: number | null
          max_favorable_excursion: number | null
          partial_profits_taken: number | null
          prediction_data: Json | null
          realized_pnl: number
          session_id: string
          side: string
          size: number
          status: string
          symbol: string
          trailing_stop_price: number | null
          unrealized_pnl: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_price: number
          entry_price: number
          entry_time: string
          exit_price?: number | null
          exit_time?: string | null
          external_id: string
          id?: string
          max_adverse_excursion?: number | null
          max_favorable_excursion?: number | null
          partial_profits_taken?: number | null
          prediction_data?: Json | null
          realized_pnl?: number
          session_id: string
          side: string
          size: number
          status?: string
          symbol: string
          trailing_stop_price?: number | null
          unrealized_pnl?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_price?: number
          entry_price?: number
          entry_time?: string
          exit_price?: number | null
          exit_time?: string | null
          external_id?: string
          id?: string
          max_adverse_excursion?: number | null
          max_favorable_excursion?: number | null
          partial_profits_taken?: number | null
          prediction_data?: Json | null
          realized_pnl?: number
          session_id?: string
          side?: string
          size?: number
          status?: string
          symbol?: string
          trailing_stop_price?: number | null
          unrealized_pnl?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "positions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "trading_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      trading_sessions: {
        Row: {
          config: Json
          created_at: string
          current_balance: number
          day_pnl: number
          end_time: string | null
          equity: number
          id: string
          initial_balance: number
          locked_profits: number
          start_time: string
          status: string
          symbol: string
          total_pnl: number
          updated_at: string
          user_id: string
        }
        Insert: {
          config: Json
          created_at?: string
          current_balance: number
          day_pnl?: number
          end_time?: string | null
          equity: number
          id?: string
          initial_balance: number
          locked_profits?: number
          start_time?: string
          status?: string
          symbol: string
          total_pnl?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          current_balance?: number
          day_pnl?: number
          end_time?: string | null
          equity?: number
          id?: string
          initial_balance?: number
          locked_profits?: number
          start_time?: string
          status?: string
          symbol?: string
          total_pnl?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trading_signals: {
        Row: {
          action: string
          confidence: number
          created_at: string
          executed: boolean
          id: string
          indicators: Json | null
          market_context: Json | null
          position_id: string | null
          prediction_data: Json | null
          price: number
          quantity: number
          reasoning: string | null
          session_id: string
          signal_time: string
          symbol: string
        }
        Insert: {
          action: string
          confidence: number
          created_at?: string
          executed?: boolean
          id?: string
          indicators?: Json | null
          market_context?: Json | null
          position_id?: string | null
          prediction_data?: Json | null
          price: number
          quantity: number
          reasoning?: string | null
          session_id: string
          signal_time?: string
          symbol: string
        }
        Update: {
          action?: string
          confidence?: number
          created_at?: string
          executed?: boolean
          id?: string
          indicators?: Json | null
          market_context?: Json | null
          position_id?: string | null
          prediction_data?: Json | null
          price?: number
          quantity?: number
          reasoning?: string | null
          session_id?: string
          signal_time?: string
          symbol?: string
        }
        Relationships: [
          {
            foreignKeyName: "trading_signals_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trading_signals_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "trading_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_old_sessions: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_session_positions: {
        Args: { p_session_id: string }
        Returns: undefined
      }
      close_position: {
        Args: {
          p_session_id: string
          p_external_id: string
          p_exit_price: number
          p_realized_pnl: number
        }
        Returns: undefined
      }
      close_position_complete: {
        Args: {
          p_session_id: string
          p_external_id: string
          p_exit_price: number
          p_realized_pnl: number
        }
        Returns: undefined
      }
      get_active_positions_for_session: {
        Args: { p_session_id: string }
        Returns: {
          id: string
          external_id: string
          symbol: string
          side: string
          size: number
          entry_price: number
          current_price: number
          unrealized_pnl: number
          realized_pnl: number
          status: string
          entry_time: string
          prediction_data: Json
          created_at: string
          updated_at: string
        }[]
      }
      update_position_price_and_pnl: {
        Args: {
          p_session_id: string
          p_external_id: string
          p_current_price: number
          p_unrealized_pnl: number
        }
        Returns: undefined
      }
      validate_session_positions: {
        Args: { p_session_id: string }
        Returns: {
          position_count: number
          open_positions: number
          old_open_positions: number
          validation_status: string
        }[]
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

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
