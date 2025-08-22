
export interface ChatMessage {
  id: string;
  ride_id: string;
  sender_id: string;
  receiver_id: string;
  text: string;
  created_at: string;
  delivered_at: string | null;
  read_at: string | null;
}

export interface ChatParticipant {
  id: string;
  full_name: string;
  avatar_url?: string;
}
