
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ChatButtonProps {
  unreadCount: number;
  onClick: () => void;
  disabled?: boolean;
}

export const ChatButton = ({ unreadCount, onClick, disabled }: ChatButtonProps) => {
  return (
    <Button
      onClick={onClick}
      variant="outline"
      size="sm"
      className="h-8 w-8 p-0 relative border-primary/30 hover:bg-primary/5"
      disabled={disabled}
    >
      <MessageCircle className="w-3 h-3" />
      {unreadCount > 0 && (
        <Badge 
          variant="destructive" 
          className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center"
        >
          {unreadCount > 9 ? '9+' : unreadCount}
        </Badge>
      )}
    </Button>
  );
};
