import AITriageChat from "@/features/triage/components/AITriageChat";
import TopHeader from "@/components/layout/TopHeader";

export default function AITriagePage() {
  return (
    <main className="w-screen h-screen overflow-hidden flex flex-col bg-white">
      <TopHeader />
      <div className="flex-1 w-full h-full overflow-hidden flex">
        <AITriageChat />
      </div>
    </main>
  );
}
