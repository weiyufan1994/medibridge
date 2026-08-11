import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import { Moon, Sun } from "lucide-react";
import { AiChatSection } from "./componentShowcase/AiChatSection";
import { DataDisplaySections } from "./componentShowcase/DataDisplaySections";
import { FeedbackSections } from "./componentShowcase/FeedbackSections";
import { FormSections } from "./componentShowcase/FormSections";
import { FoundationSections } from "./componentShowcase/FoundationSections";
import { LayoutSections } from "./componentShowcase/LayoutSections";
import { OverlayMenuSections } from "./componentShowcase/OverlayMenuSections";

export default function ComponentsShowcase() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="container max-w-6xl mx-auto">
        <div className="space-y-2 justify-between flex">
          <h2 className="text-3xl font-bold tracking-tight mb-6">
            Shadcn/ui Component Library
          </h2>
          <Button variant="outline" size="icon" onClick={toggleTheme}>
            {theme === "light" ? (
              <Moon className="h-5 w-5" />
            ) : (
              <Sun className="h-5 w-5" />
            )}
          </Button>
        </div>

        <div className="space-y-12">
          <FoundationSections />
          <FormSections />
          <DataDisplaySections />
          <FeedbackSections />
          <OverlayMenuSections />
          <LayoutSections />
          <AiChatSection />
        </div>
      </main>

      <footer className="border-t py-6 mt-12">
        <div className="container text-center text-sm text-muted-foreground">
          <p>Shadcn/ui Component Showcase</p>
        </div>
      </footer>
    </div>
  );
}
