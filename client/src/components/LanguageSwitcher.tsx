import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
      <SelectTrigger size="sm">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4" />
          <SelectValue placeholder="Language" />
        </div>
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
