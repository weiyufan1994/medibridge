import { ReactNode } from "react";
import TopHeader from "@/components/layout/TopHeader";

type AppLayoutProps = {
  title: string;
  rightElements?: ReactNode;
  isVisitRoom?: boolean;
  children: ReactNode;
};

export default function AppLayout({
  title,
  rightElements,
  isVisitRoom,
  children,
}: AppLayoutProps) {
  return (
    <div className="min-h-screen w-full flex flex-col bg-white text-foreground">
      <div className="sticky top-0 z-50">
        <TopHeader isVisitRoom={isVisitRoom} rightElements={rightElements} />
      </div>
      <main className="flex-1 min-h-0 w-full overflow-y-auto flex" aria-label={title}>
        {children}
      </main>
    </div>
  );
}
