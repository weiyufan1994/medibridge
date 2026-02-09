import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, Stethoscope, Hospital, User } from "lucide-react";
import { Streamdown } from "streamdown";
import { Link } from "wouter";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface RecommendedDoctor {
  doctorId: number;
  reason: string;
}

export default function Home() {
  const [sessionId, setSessionId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [recommendedDoctors, setRecommendedDoctors] = useState<RecommendedDoctor[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const sendMessageMutation = trpc.chat.sendMessage.useMutation({
    onSuccess: (data) => {
      setSessionId(data.sessionId);
      setMessages(prev => [
        ...prev,
        { role: "user", content: input },
        { role: "assistant", content: data.message }
      ]);
      setInput("");
      
      if (data.recommendedDoctors && data.recommendedDoctors.length > 0) {
        setRecommendedDoctors(data.recommendedDoctors);
      }
    }
  });

  const { data: doctorDetails } = trpc.doctors.getById.useQuery(
    { id: recommendedDoctors[0]?.doctorId || 0 },
    { enabled: recommendedDoctors.length > 0 }
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || sendMessageMutation.isPending) return;

    sendMessageMutation.mutate({
      sessionId: sessionId || undefined,
      message: input,
      chatHistory: messages
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-accent/20">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                <Stethoscope className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">MediBridge</h1>
                <p className="text-sm text-muted-foreground">AI智能医生推荐平台</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Link href="/hospitals">
                <Button variant="ghost" size="sm">
                  <Hospital className="w-4 h-4 mr-2" />
                  浏览医院
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="container py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chat Area */}
          <div className="lg:col-span-2">
            <Card className="h-[calc(100vh-12rem)]">
              <CardHeader className="border-b">
                <CardTitle>AI医疗咨询助手</CardTitle>
                <CardDescription>
                  告诉我您的症状，我将为您推荐最合适的医生
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 flex flex-col h-[calc(100%-5rem)]">
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {messages.length === 0 && (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                        <Stethoscope className="w-8 h-8 text-primary" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">欢迎使用MediBridge</h3>
                      <p className="text-muted-foreground max-w-md mx-auto">
                        请描述您的症状或健康问题，我们的AI助手将帮助您找到最合适的专科医生
                      </p>
                      <div className="mt-6 flex flex-wrap gap-2 justify-center">
                        <Badge variant="secondary" className="cursor-pointer" onClick={() => setInput("我最近经常头痛，持续了两周")}>
                          头痛问题
                        </Badge>
                        <Badge variant="secondary" className="cursor-pointer" onClick={() => setInput("我想做心脏检查")}>
                          心脏检查
                        </Badge>
                        <Badge variant="secondary" className="cursor-pointer" onClick={() => setInput("膝盖疼痛，上下楼梯困难")}>
                          关节疼痛
                        </Badge>
                      </div>
                    </div>
                  )}

                  {messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      {msg.role === "assistant" && (
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                          <Stethoscope className="w-5 h-5 text-primary-foreground" />
                        </div>
                      )}
                      <div
                        className={`max-w-[80%] rounded-lg p-4 ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground"
                        }`}
                      >
                        {msg.role === "assistant" ? (
                          <Streamdown>{msg.content}</Streamdown>
                        ) : (
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        )}
                      </div>
                      {msg.role === "user" && (
                        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                          <User className="w-5 h-5 text-secondary-foreground" />
                        </div>
                      )}
                    </div>
                  ))}

                  {sendMessageMutation.isPending && (
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                        <Stethoscope className="w-5 h-5 text-primary-foreground" />
                      </div>
                      <div className="bg-muted rounded-lg p-4">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="border-t p-4">
                  <div className="flex gap-2">
                    <Input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="描述您的症状..."
                      disabled={sendMessageMutation.isPending}
                      className="flex-1"
                    />
                    <Button
                      onClick={handleSend}
                      disabled={!input.trim() || sendMessageMutation.isPending}
                    >
                      {sendMessageMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recommendations Panel */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle>推荐医生</CardTitle>
                <CardDescription>
                  {recommendedDoctors.length > 0
                    ? "根据您的症状，我们为您推荐以下医生"
                    : "开始对话后，这里将显示推荐的医生"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {recommendedDoctors.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Hospital className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">暂无推荐</p>
                  </div>
                )}

                {recommendedDoctors.map((rec, idx) => (
                  <DoctorRecommendationCard
                    key={rec.doctorId}
                    doctorId={rec.doctorId}
                    reason={rec.reason}
                    rank={idx + 1}
                  />
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function DoctorRecommendationCard({
  doctorId,
  reason,
  rank
}: {
  doctorId: number;
  reason: string;
  rank: number;
}) {
  const { data, isLoading } = trpc.doctors.getById.useQuery({ id: doctorId });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const { doctor, hospital, department } = data;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-primary">#{rank}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-foreground truncate">{doctor.name}</h4>
            <p className="text-sm text-muted-foreground">{doctor.title}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              <Badge variant="outline" className="text-xs">{hospital.name}</Badge>
              <Badge variant="outline" className="text-xs">{department.name}</Badge>
            </div>
            {doctor.recommendationScore && (
              <div className="mt-2 flex items-center gap-1">
                <span className="text-xs text-muted-foreground">推荐度：</span>
                <span className="text-xs font-semibold text-secondary">{doctor.recommendationScore}</span>
              </div>
            )}
            <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{reason}</p>
            <Link href={`/doctor/${doctorId}`}>
              <Button variant="link" size="sm" className="px-0 h-auto mt-2">
                查看详情 →
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
