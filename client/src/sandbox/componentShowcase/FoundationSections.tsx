import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check } from "lucide-react";

export function FoundationSections() {
  return (
    <>
      {/* Text Colors Section */}
      <section className="space-y-4">
        <h3 className="text-2xl font-semibold">Text Colors</h3>
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Foreground (Default)
                  </p>
                  <p className="text-foreground text-lg">
                    Default text color for main content
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Muted Foreground
                  </p>
                  <p className="text-muted-foreground text-lg">
                    Muted text for secondary information
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Primary</p>
                  <p className="text-primary text-lg font-medium">
                    Primary brand color text
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Secondary Foreground
                  </p>
                  <p className="text-secondary-foreground text-lg">
                    Secondary action text color
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Accent Foreground
                  </p>
                  <p className="text-accent-foreground text-lg">
                    Accent text for emphasis
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Destructive
                  </p>
                  <p className="text-destructive text-lg font-medium">
                    Error or destructive action text
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Card Foreground
                  </p>
                  <p className="text-card-foreground text-lg">
                    Text color on card backgrounds
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Popover Foreground
                  </p>
                  <p className="text-popover-foreground text-lg">
                    Text color in popovers
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Color Combinations Section */}
      <section className="space-y-4">
        <h3 className="text-2xl font-semibold">Color Combinations</h3>
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-primary text-primary-foreground rounded-lg p-4">
                <p className="font-medium mb-1">Primary</p>
                <p className="text-sm opacity-90">
                  Primary background with foreground text
                </p>
              </div>
              <div className="bg-secondary text-secondary-foreground rounded-lg p-4">
                <p className="font-medium mb-1">Secondary</p>
                <p className="text-sm opacity-90">
                  Secondary background with foreground text
                </p>
              </div>
              <div className="bg-muted text-muted-foreground rounded-lg p-4">
                <p className="font-medium mb-1">Muted</p>
                <p className="text-sm opacity-90">
                  Muted background with foreground text
                </p>
              </div>
              <div className="bg-accent text-accent-foreground rounded-lg p-4">
                <p className="font-medium mb-1">Accent</p>
                <p className="text-sm opacity-90">
                  Accent background with foreground text
                </p>
              </div>
              <div className="bg-destructive text-destructive-foreground rounded-lg p-4">
                <p className="font-medium mb-1">Destructive</p>
                <p className="text-sm opacity-90">
                  Destructive background with foreground text
                </p>
              </div>
              <div className="bg-card text-card-foreground rounded-lg p-4 border">
                <p className="font-medium mb-1">Card</p>
                <p className="text-sm opacity-90">
                  Card background with foreground text
                </p>
              </div>
              <div className="bg-popover text-popover-foreground rounded-lg p-4 border">
                <p className="font-medium mb-1">Popover</p>
                <p className="text-sm opacity-90">
                  Popover background with foreground text
                </p>
              </div>
              <div className="bg-background text-foreground rounded-lg p-4 border">
                <p className="font-medium mb-1">Background</p>
                <p className="text-sm opacity-90">
                  Default background with foreground text
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Buttons Section */}
      <section className="space-y-4">
        <h3 className="text-2xl font-semibold">Buttons</h3>
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              <Button>Default</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="link">Link</Button>
              <Button size="sm">Small</Button>
              <Button size="lg">Large</Button>
              <Button size="icon">
                <Check className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </>
  );
}
