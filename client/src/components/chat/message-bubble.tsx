import { Message } from "@shared/schema";
import { format } from "date-fns";
import { Check, CheckCheck } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useChat } from "@/hooks/use-chat";
import { cn } from "@/lib/utils";
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
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-1`}>
      <ContextMenu>
        <ContextMenuTrigger>
          <div
            className={cn(
              "px-3 py-1.5 rounded-2xl max-w-[85%] group relative",
              isMine ? "bg-primary text-primary-foreground" : "bg-muted",
              message.isDeleted && "opacity-50"
            )}
          >
            {message.isDeleted ? (
              <p className="italic text-sm">This message was deleted</p>
            ) : (
              <>
                {message.replyToId && (
                  <div className="mb-1 pl-2 border-l-2 text-xs opacity-75">
                    Replying to a message
                  </div>
                )}

                <p className="break-words text-sm leading-relaxed">{message.content}</p>

                {message.mediaUrl && (
                  <div className="mt-1 rounded overflow-hidden">
                    {message.mediaUrl.endsWith('.mp3') ? (
                      <audio controls src={message.mediaUrl} className="w-full h-8" />
                    ) : (
                      <img src={message.mediaUrl} alt="Media" className="max-w-full" />
                    )}
                  </div>
                )}

                <div className="flex items-center justify-end gap-0.5 mt-0.5">
                  <span className="text-[10px] opacity-75">
                    {format(new Date(message.timestamp), 'HH:mm')}
                  </span>
                  {isMine && (
                    <span className="opacity-75">
                      {message.isRead ? (
                        <CheckCheck size={12} />
                      ) : (
                        <Check size={12} />
                      )}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
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