export type FeeStatus = "not_requested" | "pending" | "paid" | "canceled" | "expired";

export interface FeePayment {
  id: string;
  driver_id: string;
  amount: number;
  status: FeeStatus;
  initial_due_date: string;  // 2 dias após primeiro acesso
  payment_due_date: string | null;  // 2 dias após solicitação
  paid_at: string | null;
  canceled_at: string | null;
  canceled_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface DriverBalance {
  driver_id: string;
  total_earnings: number;
  available: number;  // disponível para reserva
  reserved: number;   // reservado para taxas
  created_at: string;
  updated_at: string;
}

export interface FeePaymentWithProfile extends FeePayment {
  profiles?: {
    id: string;
    full_name: string;
    phone: string | null;
  };
}