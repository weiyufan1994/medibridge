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

  const wrapperClass =
    tone === "embedded"
      ? "flex items-end gap-2.5 rounded-2xl border border-slate-300 bg-white px-3 py-2.5 shadow-sm transition focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-500/25"
      : "flex items-end gap-3 rounded-2xl border border-slate-300 bg-slate-50/90 px-3 py-2.5 shadow-sm transition focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-500/20";

  const hintClass =
    tone === "embedded"
      ? "mt-1.5 px-1 text-right text-xs text-slate-600"
      : "mt-2 text-right text-xs text-slate-600";

  return (
    <div className={tone === "embedded" ? "bg-transparent" : "bg-white px-5 py-4"}>
      <div className={wrapperClass}>
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
          className="h-11 w-11 shrink-0 self-center rounded-full p-0 text-slate-700 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-teal-500/40"
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
          className="min-h-[48px] max-h-[180px] resize-none border-0 bg-transparent px-0 py-2 leading-6 text-slate-800 shadow-none placeholder:text-slate-500 focus-visible:ring-0"
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
          className="h-11 w-11 shrink-0 self-center rounded-full bg-teal-600 p-0 text-white shadow-sm transition-opacity hover:bg-teal-700 focus-visible:ring-2 focus-visible:ring-teal-500/40 disabled:opacity-40"
          aria-label="Send message"
        >
          {isSending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
      <p className={hintClass}>
        {hint}
      </p>
    </div>
  );
}
