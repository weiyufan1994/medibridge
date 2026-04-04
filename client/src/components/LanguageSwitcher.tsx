import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Globe } from "lucide-react";
import { useLanguage, type LanguageMode } from "@/contexts/LanguageContext";

const options: Array<{ value: LanguageMode; label: string }> = [
  { value: "en", label: "English" },
  { value: "zh", label: "中文" },
];

export default function LanguageSwitcher() {
  const { mode, setMode } = useLanguage();

  return (
    <Select value={mode} onValueChange={(value) => setMode(value as LanguageMode)}>
      <SelectTrigger
        size="sm"
        aria-label="Switch language / 切换语言"
        title={mode === "zh" ? "切换语言" : "Switch language"}
        className="h-10 w-10 justify-center rounded-full border-transparent bg-transparent px-0 shadow-none hover:bg-slate-100 focus-visible:border-slate-200 focus-visible:ring-2 focus-visible:ring-slate-200/80 [&>svg:last-child]:hidden"
      >
        <Globe className="h-4 w-4" />
        <span className="sr-only">
          {mode === "zh" ? "切换语言" : "Switch language"}
        </span>
      </SelectTrigger>
      <SelectContent>
        {options.map(option => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
