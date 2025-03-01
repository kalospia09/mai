import { Message, User } from "@shared/schema";
import { format } from "date-fns";
import { Check, CheckCheck, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useChat } from "@/hooks/use-chat";
import { Card } from "@/components/ui/card";

interface MessageBubbleProps {
  message: Message;
  onReply: (message: Message) => void;
}

export function MessageBubble({ message, onReply }: MessageBubbleProps) {
  const { user } = useAuth();
  const { deleteMessage } = useChat();
  const isMine = message.senderId === user?.id;

  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-4`}>
      <Card
        className={`max-w-[70%] p-3 ${
          isMine ? 'bg-primary text-primary-foreground' : 'bg-secondary'
        }`}
        onDoubleClick={() => onReply(message)}
      >
        {message.isDeleted ? (
          <p className="italic text-sm">This message was deleted</p>
        ) : (
          <>
            {message.replyToId && (
              <div className="mb-2 p-2 border-l-2 text-sm opacity-80">
                Replying to a message
              </div>
            )}
            
            <p className="break-words">{message.content}</p>
            
            {message.mediaUrl && (
              <div className="mt-2">
                {message.mediaUrl.endsWith('.mp3') ? (
                  <audio controls src={message.mediaUrl} className="w-full" />
                ) : (
                  <img src={message.mediaUrl} alt="Media" className="max-w-full rounded" />
                )}
              </div>
            )}
            
            <div className="flex items-center justify-end gap-2 mt-1 text-xs opacity-80">
              <span>{format(new Date(message.timestamp), 'HH:mm')}</span>
              {isMine && (
                <>
                  {message.isRead ? (
                    <CheckCheck size={16} />
                  ) : (
                    <Check size={16} />
                  )}
                  <button 
                    onClick={() => deleteMessage(message.id)}
                    className="hover:text-destructive"
                  >
                    <Trash2 size={16} />
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
