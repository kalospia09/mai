import { Message } from "@shared/schema";
import { format } from "date-fns";
import { Check, CheckCheck } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useChat } from "@/hooks/use-chat";
import { Card } from "@/components/ui/card";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

interface MessageBubbleProps {
  message: Message;
  onReply: (message: Message) => void;
}

export function MessageBubble({ message, onReply }: MessageBubbleProps) {
  const { user } = useAuth();
  const { deleteMessage } = useChat();
  const isMine = message.senderId === user?.id;

  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-2`}>
      <ContextMenu>
        <ContextMenuTrigger>
          <Card
            className={`max-w-[60%] p-2 ${
              isMine ? 'bg-primary text-primary-foreground' : 'bg-secondary'
            }`}
          >
            {message.isDeleted ? (
              <p className="italic text-sm">This message was deleted</p>
            ) : (
              <>
                {message.replyToId && (
                  <div className="mb-1 p-1 border-l-2 text-sm opacity-80">
                    Replying to a message
                  </div>
                )}

                <p className="break-words text-sm">{message.content}</p>

                {message.mediaUrl && (
                  <div className="mt-1">
                    {message.mediaUrl.endsWith('.mp3') ? (
                      <audio controls src={message.mediaUrl} className="w-full" />
                    ) : (
                      <img src={message.mediaUrl} alt="Media" className="max-w-full rounded" />
                    )}
                  </div>
                )}

                <div className="flex items-center justify-end gap-1 mt-1 text-xs opacity-70">
                  <span>{format(new Date(message.timestamp), 'HH:mm')}</span>
                  {isMine && (
                    message.isRead ? (
                      <CheckCheck size={12} />
                    ) : (
                      <Check size={12} />
                    )
                  )}
                </div>
              </>
            )}
          </Card>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={() => onReply(message)}>
            Reply
          </ContextMenuItem>
          {isMine && !message.isDeleted && (
            <ContextMenuItem 
              onSelect={() => deleteMessage(message.id)}
              className="text-destructive"
            >
              Delete
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );
}