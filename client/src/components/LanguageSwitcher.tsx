import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage, type LanguageMode } from "@/contexts/LanguageContext";

const options: Array<{ value: LanguageMode; label: string }> = [
  { value: "auto", label: "Auto (Follow input)" },
  { value: "en", label: "English" },
  { value: "zh", label: "中文" },
];

export default function LanguageSwitcher() {
  const { mode, setMode } = useLanguage();

  return (
    <Select value={mode} onValueChange={(value) => setMode(value as LanguageMode)}>
      <SelectTrigger size="sm">
        <SelectValue placeholder="Language" />
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
