
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { ChatMessage } from '@/types/chat';
import { toast } from 'sonner';

interface UseChatProps {
  rideId: string;
  receiverId: string;
}

export const useChat = ({ rideId, receiverId }: UseChatProps) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Filtro básico de palavrões
  const filterProfanity = (text: string): string => {
    const badWords = ['porra', 'merda', 'caralho', 'puta', 'fdp', 'desgraça'];
    let filtered = text;
    badWords.forEach(word => {
      const regex = new RegExp(word, 'gi');
      filtered = filtered.replace(regex, '*'.repeat(word.length));
    });
    return filtered;
  };

  // Mascarar telefones e links
  const maskSensitiveContent = (text: string): string => {
    // Mascarar telefones
    const phoneRegex = /(\+55\s?)?\(?(\d{2})\)?\s?9?\d{4}-?\d{4}/g;
    let masked = text.replace(phoneRegex, '[TELEFONE REMOVIDO]');
    
    // Mascarar URLs
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    masked = masked.replace(urlRegex, '[LINK REMOVIDO]');
    
    return masked;
  };

  const fetchMessages = useCallback(async () => {
    if (!user || !rideId) return;

    try {
      const { data, error } = await (supabase as any)
        .from('chat_messages')
        .select('*')
        .eq('ride_id', rideId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const typedMessages = (data || []) as ChatMessage[];
      setMessages(typedMessages);
      
      // Contar mensagens não lidas
      const unread = typedMessages.filter(msg => 
        msg.receiver_id === user.id && !msg.read_at
      ).length;
      setUnreadCount(unread);
    } catch (error) {
      console.error('Erro ao buscar mensagens:', error);
    } finally {
      setLoading(false);
    }
  }, [user, rideId]);

  const sendMessage = async (text: string): Promise<boolean> => {
    if (!user || !text.trim() || sending) return false;

    setSending(true);
    try {
      // Aplicar filtros
      let filteredText = filterProfanity(text.trim());
      filteredText = maskSensitiveContent(filteredText);

      if (filteredText.length > 1000) {
        toast.error('Mensagem muito longa (máximo 1000 caracteres)');
        return false;
      }

      const { error } = await (supabase as any)
        .from('chat_messages')
        .insert({
          ride_id: rideId,
          sender_id: user.id,
          receiver_id: receiverId,
          text: filteredText,
        });

      if (error) throw error;

      return true;
    } catch (error: any) {
      console.error('Erro ao enviar mensagem:', error);
      toast.error('Erro ao enviar mensagem');
      return false;
    } finally {
      setSending(false);
    }
  };

  const markMessagesAsRead = async () => {
    if (!user || !rideId) return;

    try {
      const { error } = await (supabase as any)
        .from('chat_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('ride_id', rideId)
        .eq('receiver_id', user.id)
        .is('read_at', null);

      if (error) throw error;

      setUnreadCount(0);
    } catch (error) {
      console.error('Erro ao marcar mensagens como lidas:', error);
    }
  };

  // Configurar realtime
  useEffect(() => {
    if (!rideId) return;

    fetchMessages();

    const channel = supabase
      .channel(`chat-${rideId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `ride_id=eq.${rideId}`,
        },
        (payload) => {
          const newMessage = payload.new as ChatMessage;
          setMessages(prev => [...prev, newMessage]);
          
          // Se a mensagem é para mim, incrementar contador
          if (newMessage.receiver_id === user?.id) {
            setUnreadCount(prev => prev + 1);
            toast.success('Nova mensagem no chat');
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
          filter: `ride_id=eq.${rideId}`,
        },
        (payload) => {
          const updatedMessage = payload.new as ChatMessage;
          setMessages(prev => 
            prev.map(msg => 
              msg.id === updatedMessage.id ? updatedMessage : msg
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [rideId, user, fetchMessages]);

  return {
    messages,
    loading,
    sending,
    unreadCount,
    sendMessage,
    markMessagesAsRead,
    refreshMessages: fetchMessages
  };
};
