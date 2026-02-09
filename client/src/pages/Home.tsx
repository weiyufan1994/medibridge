import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, Stethoscope, Hospital, User, ArrowRight, CheckCircle2 } from "lucide-react";
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
  const [showChat, setShowChat] = useState(false);
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || sendMessageMutation.isPending) return;

    if (!showChat) {
      setShowChat(true);
    }

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

  const handleQuickStart = (query: string) => {
    setInput(query);
    setShowChat(true);
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
                <p className="text-sm text-muted-foreground">AI-Powered Medical Bridge to China</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Link href="/hospitals">
                <Button variant="ghost" size="sm">
                  <Hospital className="w-4 h-4 mr-2" />
                  Browse Hospitals
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {!showChat ? (
        /* Introduction Section */
        <div className="container py-16">
          <div className="max-w-5xl mx-auto">
            {/* Hero Section */}
            <div className="text-center mb-16">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-6">
                <Stethoscope className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
                Connect with Top Chinese Medical Experts
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
                MediBridge uses AI to match you with the best doctors and specialists from Shanghai's premier hospitals. Get expert medical opinions and treatment options in China.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" className="text-lg px-8" onClick={() => setShowChat(true)}>
                  Start Consultation
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                <Link href="/hospitals">
                  <Button size="lg" variant="outline" className="text-lg px-8">
                    Browse Hospitals
                  </Button>
                </Link>
              </div>
            </div>

            {/* Features Grid */}
            <div className="grid md:grid-cols-3 gap-6 mb-16">
              <Card>
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                    <CheckCircle2 className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle>AI-Powered Matching</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Our intelligent system analyzes your symptoms and medical needs to recommend the most suitable specialists.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                    <Hospital className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle>Top Hospitals</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Access over 1,100 doctors from 6 prestigious Grade-A tertiary hospitals in Shanghai.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                    <Stethoscope className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle>Expert Specialists</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Connect with highly-rated specialists across cardiology, oncology, orthopedics, and more.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* How It Works */}
            <div className="bg-card rounded-lg p-8 border">
              <h3 className="text-2xl font-bold text-center mb-8">How It Works</h3>
              <div className="grid md:grid-cols-3 gap-8">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold mx-auto mb-4">
                    1
                  </div>
                  <h4 className="font-semibold mb-2">Describe Your Condition</h4>
                  <p className="text-sm text-muted-foreground">
                    Chat with our AI assistant about your symptoms and medical history
                  </p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold mx-auto mb-4">
                    2
                  </div>
                  <h4 className="font-semibold mb-2">Get Recommendations</h4>
                  <p className="text-sm text-muted-foreground">
                    Receive personalized doctor recommendations based on your needs
                  </p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold mx-auto mb-4">
                    3
                  </div>
                  <h4 className="font-semibold mb-2">Connect with Doctors</h4>
                  <p className="text-sm text-muted-foreground">
                    View detailed profiles and connect with your chosen specialists
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Start Examples */}
            <div className="mt-12 text-center">
              <p className="text-muted-foreground mb-4">Try asking about:</p>
              <div className="flex flex-wrap gap-3 justify-center">
                <Badge 
                  variant="secondary" 
                  className="cursor-pointer hover:bg-secondary/80 py-2 px-4 text-sm"
                  onClick={() => handleQuickStart("I have persistent chest pain and shortness of breath")}
                >
                  Heart Problems
                </Badge>
                <Badge 
                  variant="secondary" 
                  className="cursor-pointer hover:bg-secondary/80 py-2 px-4 text-sm"
                  onClick={() => handleQuickStart("I need a cancer screening and consultation")}
                >
                  Cancer Screening
                </Badge>
                <Badge 
                  variant="secondary" 
                  className="cursor-pointer hover:bg-secondary/80 py-2 px-4 text-sm"
                  onClick={() => handleQuickStart("I have chronic knee pain when walking")}
                >
                  Joint Pain
                </Badge>
                <Badge 
                  variant="secondary" 
                  className="cursor-pointer hover:bg-secondary/80 py-2 px-4 text-sm"
                  onClick={() => handleQuickStart("I need a neurological consultation")}
                >
                  Neurological Issues
                </Badge>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Chat Interface */
        <div className="container py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chat Area */}
            <div className="lg:col-span-2">
              <Card className="h-[calc(100vh-12rem)]">
                <CardHeader className="border-b">
                  <CardTitle>AI Medical Consultation</CardTitle>
                  <CardDescription>
                    Describe your symptoms and we'll recommend the best doctors for you
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
                        <h3 className="text-lg font-semibold mb-2">Welcome to MediBridge</h3>
                        <p className="text-muted-foreground max-w-md mx-auto">
                          Please describe your symptoms or health concerns, and our AI will help you find the most suitable specialist
                        </p>
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
                        placeholder="Describe your symptoms..."
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
                  <CardTitle>Recommended Doctors</CardTitle>
                  <CardDescription>
                    {recommendedDoctors.length > 0
                      ? "Based on your symptoms, we recommend:"
                      : "Start chatting to see doctor recommendations"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {recommendedDoctors.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Hospital className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">No recommendations yet</p>
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
      )}
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
                <span className="text-xs text-muted-foreground">Rating:</span>
                <span className="text-xs font-semibold text-secondary">{doctor.recommendationScore}</span>
              </div>
            )}
            <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{reason}</p>
            <div className="mt-3 flex gap-2">
              <Link href={`/doctor/${doctorId}`}>
                <Button variant="outline" size="sm" className="text-xs">
                  View Profile
                </Button>
              </Link>
              <Button size="sm" className="text-xs">
                Book Appointment
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
