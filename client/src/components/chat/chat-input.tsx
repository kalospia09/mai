import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Mic, Send, Paperclip, X } from "lucide-react";
import { useChat } from "@/hooks/use-chat";
import { Message } from "@shared/schema";
import data from '@emoji-mart/data'
import Picker from '@emoji-mart/react'
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface ChatInputProps {
  replyTo: Message | null;
  onCancelReply: () => void;
}

export function ChatInput({ replyTo, onCancelReply }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { sendMessage, setTyping } = useChat();
  
  useEffect(() => {
    const timeout = setTimeout(() => {
      setTyping(message.length > 0);
    }, 300);

    return () => {
      clearTimeout(timeout);
      setTyping(false);
    };
  }, [message]);

  const handleSend = () => {
    if (!message && !mediaPreview) return;
    
    sendMessage(
      message,
      replyTo?.id,
      mediaPreview
    );
    
    setMessage("");
    setMediaPreview(null);
    onCancelReply();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      setMediaPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleEmojiSelect = (emoji: any) => {
    setMessage(prev => prev + emoji.native);
  };

  return (
    <div className="p-4 border-t">
      {replyTo && (
        <div className="flex items-center gap-2 mb-2 p-2 bg-secondary rounded">
          <span className="text-sm">Replying to: {replyTo.content}</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={onCancelReply}
          >
            <X size={16} />
          </Button>
        </div>
      )}

      {mediaPreview && (
        <div className="mb-2 relative">
          <img 
            src={mediaPreview} 
            alt="Preview" 
            className="w-20 h-20 object-cover rounded"
          />
          <Button
            variant="destructive"
            size="icon"
            className="absolute top-0 right-0"
            onClick={() => setMediaPreview(null)}
          >
            <X size={16} />
          </Button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon">
              😊
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Picker 
              data={data} 
              onEmojiSelect={handleEmojiSelect}
              theme="light"
            />
          </PopoverContent>
        </Popover>

        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          onChange={handleFileSelect}
          accept="image/*,audio/*"
        />
        
        <Button
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip size={20} />
        </Button>

        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a message"
          onKeyPress={(e) => e.key === "Enter" && handleSend()}
        />

        {message || mediaPreview ? (
          <Button onClick={handleSend}>
            <Send size={20} />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onMouseDown={() => setIsRecording(true)}
            onMouseUp={() => setIsRecording(false)}
          >
            <Mic size={20} className={isRecording ? "text-destructive" : ""} />
          </Button>
        )}
      </div>
    </div>
  );
}
