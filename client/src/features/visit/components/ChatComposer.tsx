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
  tone?: "default" | "embedded";
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
  tone = "default",
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
    <div className={tone === "embedded" ? "bg-transparent px-2 py-2" : "bg-white px-5 py-4"}>
      <div
        className={
          tone === "embedded"
            ? "flex items-center gap-3 rounded-xl px-3 py-2 transition-colors"
            : "flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 shadow-sm transition-colors focus-within:border-teal-500 focus-within:shadow-inner"
        }
      >
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
          className="h-9 w-9 shrink-0 items-center self-center rounded-full p-0 text-slate-700 hover:bg-slate-200/80"
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
          className="min-h-[46px] max-h-[180px] resize-none border-0 bg-transparent px-0 py-2 leading-6 shadow-none focus-visible:ring-0"
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
          className="h-9 w-9 shrink-0 items-center self-center rounded-full bg-teal-600 p-0 text-white shadow-sm transition-opacity hover:bg-teal-700 disabled:opacity-40"
          aria-label="Send message"
        >
          {isSending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
      <p className={tone === "embedded" ? "mt-1 px-1 text-right text-xs text-slate-500" : "mt-2 text-right text-xs text-slate-500"}>
        {hint}
      </p>
    </div>
  );
}
