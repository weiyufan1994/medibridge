import { useEffect, useRef } from "react";
import { Loader2, Paperclip, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type ChatComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  isSending?: boolean;
  hint: string;
  placeholder: string;
  onSelectAttachment?: (file: File) => void;
};

export function ChatComposer({
  value,
  onChange,
  onSend,
  disabled = false,
  isSending = false,
  hint,
  placeholder,
  onSelectAttachment,
}: ChatComposerProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
  }, [value]);

  return (
    <div className="bg-white px-4 py-3">
      <div className="flex items-end gap-3 rounded-2xl border border-slate-200/80 bg-white px-3 py-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={event => {
            const file = event.target.files?.[0];
            if (file) {
              onSelectAttachment?.(file);
            }
            event.currentTarget.value = "";
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-full text-slate-500 hover:bg-slate-100"
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
          aria-label="Upload medical image"
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={event => onChange(event.target.value)}
          placeholder={placeholder}
          rows={1}
          disabled={disabled}
          className="min-h-[46px] max-h-[180px] resize-none border-0 bg-transparent px-0 py-2 shadow-none focus-visible:ring-0"
          onKeyDown={event => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSend();
            }
          }}
        />
        <Button
          type="button"
          onClick={onSend}
          disabled={disabled || !value.trim()}
          className="h-9 w-9 shrink-0 rounded-full bg-teal-600 p-0 hover:bg-teal-700 disabled:opacity-60"
          aria-label="Send message"
        >
          {isSending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
      <p className="mt-2 text-right text-xs text-slate-500">{hint}</p>
    </div>
  );
}
