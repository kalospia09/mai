import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { MessageList } from "@/components/chat/message-list";
import { ChatInput } from "@/components/chat/chat-input";
import { Button } from "@/components/ui/button";
import { wsClient } from "@/lib/websocket";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { LogOut } from "lucide-react";

export default function Chat() {
  const [, setLocation] = useLocation();

  const { data: user } = useQuery({
    queryKey: ["/api/me"],
    onError: () => setLocation("/")
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["/api/messages"],
    onError: () => setLocation("/")
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => setLocation("/")
  });

  useEffect(() => {
    wsClient.connect();
    const unsubscribe = wsClient.addMessageListener((message) => {
      queryClient.setQueryData(["/api/messages"], (old: any) => [...(old || []), message]);
    });
    return unsubscribe;
  }, []);

  return (
    <div className="flex flex-col h-screen">
      <div className="flex justify-between items-center p-4 border-b bg-card">
        <h1 className="text-2xl font-bold">Chat Room</h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
        >
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
      
      <MessageList messages={messages} currentUserId={user?.id} />
      
      <ChatInput
        onSend={(content) => {
          if (user) {
            wsClient.sendMessage(user.id, content);
          }
        }}
        disabled={!user}
      />
    </div>
  );
}
