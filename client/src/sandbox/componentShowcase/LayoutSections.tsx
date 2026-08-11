import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Label } from "@/components/ui/label";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useState } from "react";
import { toast as sonnerToast } from "sonner";

export function LayoutSections() {
  const [date, setDate] = useState<Date | undefined>(new Date());

  return (
    <>
      {/* Calendar Section */}
      <section className="space-y-4">
        <h3 className="text-2xl font-semibold">Calendar</h3>
        <Card>
          <CardContent className="pt-6 flex justify-center">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              className="rounded-md border"
            />
          </CardContent>
        </Card>
      </section>

      {/* Carousel Section */}
      <section className="space-y-4">
        <h3 className="text-2xl font-semibold">Carousel</h3>
        <Card>
          <CardContent className="pt-6">
            <Carousel className="w-full max-w-xs mx-auto">
              <CarouselContent>
                {Array.from({ length: 5 }).map((_, index) => (
                  <CarouselItem key={index}>
                    <div className="p-1">
                      <Card>
                        <CardContent className="flex aspect-square items-center justify-center p-6">
                          <span className="text-4xl font-semibold">
                            {index + 1}
                          </span>
                        </CardContent>
                      </Card>
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious />
              <CarouselNext />
            </Carousel>
          </CardContent>
        </Card>
      </section>

      {/* Toggle Section */}
      <section className="space-y-4">
        <h3 className="text-2xl font-semibold">Toggle</h3>
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label>Toggle</Label>
              <div className="flex gap-2">
                <Toggle aria-label="Toggle italic">
                  <span className="font-bold">B</span>
                </Toggle>
                <Toggle aria-label="Toggle italic">
                  <span className="italic">I</span>
                </Toggle>
                <Toggle aria-label="Toggle underline">
                  <span className="underline">U</span>
                </Toggle>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Toggle Group</Label>
              <ToggleGroup type="multiple">
                <ToggleGroupItem value="bold" aria-label="Toggle bold">
                  <span className="font-bold">B</span>
                </ToggleGroupItem>
                <ToggleGroupItem value="italic" aria-label="Toggle italic">
                  <span className="italic">I</span>
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="underline"
                  aria-label="Toggle underline"
                >
                  <span className="underline">U</span>
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Aspect Ratio & Scroll Area Section */}
      <section className="space-y-4">
        <h3 className="text-2xl font-semibold">Layout Components</h3>
        <Card>
          <CardContent className="pt-6 space-y-6">
            <div className="space-y-2">
              <Label>Aspect Ratio (16/9)</Label>
              <AspectRatio ratio={16 / 9} className="bg-muted">
                <div className="flex h-full items-center justify-center">
                  <p className="text-muted-foreground">16:9 Aspect Ratio</p>
                </div>
              </AspectRatio>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Scroll Area</Label>
              <ScrollArea className="h-[200px] w-full rounded-md border overflow-hidden">
                <div className="p-4">
                  <div className="space-y-4">
                    {Array.from({ length: 20 }).map((_, i) => (
                      <div key={i} className="text-sm">
                        Item {i + 1}: This is a scrollable content area
                      </div>
                    ))}
                  </div>
                </div>
              </ScrollArea>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Resizable Section */}
      <section className="space-y-4">
        <h3 className="text-2xl font-semibold">Resizable Panels</h3>
        <Card>
          <CardContent className="pt-6">
            <ResizablePanelGroup
              direction="horizontal"
              className="min-h-[200px] rounded-lg border"
            >
              <ResizablePanel defaultSize={50}>
                <div className="flex h-full items-center justify-center p-6">
                  <span className="font-semibold">Panel One</span>
                </div>
              </ResizablePanel>
              <ResizableHandle />
              <ResizablePanel defaultSize={50}>
                <div className="flex h-full items-center justify-center p-6">
                  <span className="font-semibold">Panel Two</span>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </CardContent>
        </Card>
      </section>

      {/* Toast Section */}
      <section className="space-y-4">
        <h3 className="text-2xl font-semibold">Toast</h3>
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label>Sonner Toast</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    sonnerToast.success("Operation successful", {
                      description: "Your changes have been saved",
                    });
                  }}
                >
                  Success
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    sonnerToast.error("Operation failed", {
                      description:
                        "Cannot complete operation, please try again",
                    });
                  }}
                >
                  Error
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    sonnerToast.info("Information", {
                      description: "This is an information message",
                    });
                  }}
                >
                  Info
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    sonnerToast.warning("Warning", {
                      description: "Please note the impact of this operation",
                    });
                  }}
                >
                  Warning
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    sonnerToast.loading("Loading", {
                      description: "Please wait",
                    });
                  }}
                >
                  Loading
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const promise = new Promise(resolve =>
                      setTimeout(resolve, 2000)
                    );
                    sonnerToast.promise(promise, {
                      loading: "Processing...",
                      success: "Processing complete!",
                      error: "Processing failed",
                    });
                  }}
                >
                  Promise
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </>
  );
}
