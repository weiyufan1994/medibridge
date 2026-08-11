import { Card, CardContent } from "@/components/ui/card";
import { AIChatBox, type Message } from "@/features/triage";
import { useState } from "react";

export function AiChatSection() {
  const [chatMessages, setChatMessages] = useState<Message[]>([
    { role: "system", content: "You are a helpful assistant." },
  ]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  const handleChatSend = (content: string) => {
    // Add user message
    const newMessages: Message[] = [...chatMessages, { role: "user", content }];
    setChatMessages(newMessages);

    // Simulate AI response with delay
    setIsChatLoading(true);
    setTimeout(() => {
      const aiResponse: Message = {
        role: "assistant",
        content: `This is a **demo response**. In a real app, you would call a tRPC mutation here:\n\n\`\`\`typescript\nconst chatMutation = trpc.ai.chat.useMutation({\n  onSuccess: (response) => {\n    setChatMessages(prev => [...prev, {\n      role: "assistant",\n      content: response.choices[0].message.content\n    }]);\n  }\n});\n\nchatMutation.mutate({ messages: newMessages });\n\`\`\`\n\nYour message was: "${content}"`,
      };
      setChatMessages([...newMessages, aiResponse]);
      setIsChatLoading(false);
    }, 1500);
  };

  return (
    <>
      {/* AI ChatBox Section */}
      <section className="space-y-4">
        <h3 className="text-2xl font-semibold">AI ChatBox</h3>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <p>
                  A ready-to-use chat interface component that integrates with
                  the LLM system. Features markdown rendering, auto-scrolling,
                  and loading states.
                </p>
                <p className="mt-2">
                  This is a demo with simulated responses. In a real app, you'd
                  connect it to a tRPC mutation.
                </p>
              </div>
              <AIChatBox
                messages={chatMessages}
                onSendMessage={handleChatSend}
                isLoading={isChatLoading}
                placeholder="Try sending a message..."
                height="500px"
                emptyStateMessage="How can I help you today?"
                suggestedPrompts={[
                  "What is React?",
                  "Explain TypeScript",
                  "How to use tRPC?",
                  "Best practices for web development",
                ]}
              />
            </div>
          </CardContent>
        </Card>
      </section>
    </>
  );
}
