export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      accounts: {
        Row: {
          id: string
          user_id: string
          name: string
          account_type: 'cash' | 'bank' | 'credit_card'
          institution: string | null
          currency: string
          initial_balance: number
          current_balance: number
          credit_limit: number | null
          closing_day: number | null
          payment_due_day: number | null
          color: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          account_type: 'cash' | 'bank' | 'credit_card'
          institution?: string | null
          currency?: string
          initial_balance?: number
          current_balance?: number
          credit_limit?: number | null
          closing_day?: number | null
          payment_due_day?: number | null
          color?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          account_type?: 'cash' | 'bank' | 'credit_card'
          institution?: string | null
          currency?: string
          initial_balance?: number
          current_balance?: number
          credit_limit?: number | null
          closing_day?: number | null
          payment_due_day?: number | null
          color?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      categories: {
        Row: {
          id: string
          user_id: string
          name: string
          category_type: 'income' | 'expense'
          icon: string | null
          color: string | null
          is_default: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          category_type: 'income' | 'expense'
          icon?: string | null
          color?: string | null
          is_default?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          category_type?: 'income' | 'expense'
          icon?: string | null
          color?: string | null
          is_default?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      transactions: {
        Row: {
          id: string
          user_id: string
          account_id: string
          category_id: string
          description: string
          amount: number
          transaction_type: 'income' | 'expense'
          transaction_date: string
          is_installment: boolean
          installment_count: number
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          account_id: string
          category_id: string
          description: string
          amount: number
          transaction_type: 'income' | 'expense'
          transaction_date: string
          is_installment?: boolean
          installment_count?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          account_id?: string
          category_id?: string
          description?: string
          amount?: number
          transaction_type?: 'income' | 'expense'
          transaction_date?: string
          is_installment?: boolean
          installment_count?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_owner_fkey"
            columns: ["user_id", "account_id"]
            referencedRelation: "accounts"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "transactions_category_owner_fkey"
            columns: ["user_id", "category_id"]
            referencedRelation: "categories"
            referencedColumns: ["user_id", "id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}