import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { useChat } from "@/hooks/use-chat";
import { Phone, Video, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ChatHeader() {
  const { user, logoutMutation } = useAuth();
  const { onlineUsers, typingUsers } = useChat();
  const otherUser = onlineUsers.find(id => id !== user?.id);
  const isOtherTyping = typingUsers.includes(otherUser || 0);

  return (
    <div className="flex items-center justify-between p-4 border-b">
      <div className="flex items-center gap-3">
        <Avatar>
          <AvatarFallback>
            {otherUser ? 'U2' : 'U1'}
          </AvatarFallback>
        </Avatar>
        <div>
          <h2 className="font-semibold">
            {otherUser ? 'User 2' : 'User 1'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isOtherTyping ? 'typing...' : (otherUser ? 'online' : 'offline')}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button className="hover:text-primary">
          <Phone size={20} />
        </button>
        <button className="hover:text-primary">
          <Video size={20} />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger>
            <MoreVertical size={20} />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => logoutMutation.mutate()}>
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
