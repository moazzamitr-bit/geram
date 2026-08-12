export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export type ProfileRow = {
  id: string;
  phone: string | null;
  email: string | null;
  first_name: string;
  last_name: string;
  kyc_status: string;
  role: string;
  onboarding_done: boolean;
  created_at: string;
};

export type WalletRow = {
  id: string;
  user_id: string;
  gold_mg: number;
  silver_mg: number;
  copper_mg: number;
  toman_available: number;
  toman_pending: number;
  avg_buy_price_toman: number;
  avg_buy_price_silver_toman: number;
  avg_buy_price_copper_toman: number;
};

export type TransactionRow = {
  id: string;
  user_id: string;
  tracking_code: string;
  type: string;
  instrument: string;
  gold_mg: number;
  amount_toman: number;
  fee_toman: number;
  price_per_gram_toman: number;
  status: string;
  payment_ref: string | null;
  note: string | null;
  created_at: string;
};

export type SupportTicketRow = {
  id: string;
  user_id: string;
  category: string;
  subject: string;
  status: string;
  created_at: string;
};

export type DeliveryRow = {
  id: string;
  user_id: string;
  product_name: string;
  weight_grams: number;
  method: string;
  fee_toman: number;
  status: string;
  created_at: string;
};

export type MarketPriceRow = {
  id: string;
  price_toman: number;
  source: string;
  change_percent: number | null;
  observed_at: string;
};
