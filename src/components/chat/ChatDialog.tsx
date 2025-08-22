
import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Send, X } from 'lucide-react';
import { useChat } from '@/hooks/useChat';
import { ChatParticipant } from '@/types/chat';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ChatDialogProps {
  isOpen: boolean;
  onClose: () => void;
  rideId: string;
  receiver: ChatParticipant;
  currentUserId: string;
}

export const ChatDialog = ({ 
  isOpen, 
  onClose, 
  rideId, 
  receiver, 
  currentUserId 
}: ChatDialogProps) => {
  const [messageText, setMessageText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { 
    messages, 
    loading, 
    sending, 
    sendMessage, 
    markMessagesAsRead 
  } = useChat({ rideId, receiverId: receiver.id });

  // Auto-scroll para última mensagem
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages]);

  // Marcar como lida quando abrir o chat
  useEffect(() => {
    if (isOpen) {
      markMessagesAsRead();
    }
  }, [isOpen, markMessagesAsRead]);

  const handleSendMessage = async () => {
    if (!messageText.trim() || sending) return;

    const success = await sendMessage(messageText);
    if (success) {
      setMessageText('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatMessageTime = (timestamp: string) => {
    return format(new Date(timestamp), 'HH:mm', { locale: ptBR });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md h-[500px] flex flex-col p-0">
        <DialogHeader className="p-4 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={receiver.avatar_url} alt={receiver.full_name} />
                <AvatarFallback className="text-xs">
                  {receiver.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <DialogTitle className="text-sm font-medium">
                {receiver.full_name}
              </DialogTitle>
            </div>
            <Button
              onClick={onClose}
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0">
          <ScrollArea className="flex-1 px-4">
            <div className="py-2 space-y-2">
              {loading && (
                <div className="text-center text-sm text-muted-foreground py-4">
                  Carregando mensagens...
                </div>
              )}
              
              {!loading && messages.length === 0 && (
                <div className="text-center text-sm text-muted-foreground py-4">
                  Nenhuma mensagem ainda. Inicie a conversa!
                </div>
              )}

              {messages.map((message) => {
                const isOwnMessage = message.sender_id === currentUserId;
                
                return (
                  <div
                    key={message.id}
                    className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                        isOwnMessage
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      <div className="break-words">{message.text}</div>
                      <div className={`text-xs mt-1 ${
                        isOwnMessage 
                          ? 'text-primary-foreground/70' 
                          : 'text-muted-foreground/70'
                      }`}>
                        {formatMessageTime(message.created_at)}
                        {isOwnMessage && message.read_at && (
                          <span className="ml-1">✓✓</span>
                        )}
                        {isOwnMessage && message.delivered_at && !message.read_at && (
                          <span className="ml-1">✓</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          <div className="p-4 border-t border-border/50">
            <div className="flex gap-2">
              <Input
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Digite sua mensagem..."
                maxLength={1000}
                disabled={sending}
                className="flex-1"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!messageText.trim() || sending}
                size="sm"
                className="px-3"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {messageText.length}/1000 caracteres
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
