import { Loader2, Send } from "lucide-react";
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
};

export function ChatComposer({
  value,
  onChange,
  onSend,
  disabled = false,
  isSending = false,
  hint,
  placeholder,
}: ChatComposerProps) {
  return (
    <div className="p-4">
      <div className="flex items-end gap-3">
        <Textarea
          value={value}
          onChange={event => onChange(event.target.value)}
          placeholder={placeholder}
          rows={2}
          disabled={disabled}
          className="min-h-[76px] resize-none border-slate-200 bg-white"
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
          className="h-10 w-10 shrink-0 bg-sky-600 p-0 hover:bg-sky-700 disabled:opacity-60"
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
