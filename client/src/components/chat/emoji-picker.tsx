import { useEffect, useRef } from 'react';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface EmojiPickerProps {
  onEmojiSelect: (emoji: any) => void;
}

export function EmojiPicker({ onEmojiSelect }: EmojiPickerProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Handle keyboard shortcuts for emoji picker
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'e' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        buttonRef.current?.click();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, []);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          ref={buttonRef}
          variant="ghost" 
          size="icon"
          className="hover:bg-accent"
          title="Press Ctrl+E to open emoji picker"
        >
          😊
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        side="top" 
        align="start" 
        className="w-auto p-0 border-none shadow-lg"
      >
        <Picker
          data={data}
          onEmojiSelect={(emoji: any) => {
            onEmojiSelect(emoji);
          }}
          previewPosition="none"
          skinTonePosition="none"
          theme="light"
          set="native"
          maxFrequentRows={2}
        />
      </PopoverContent>
    </Popover>
  );
}
