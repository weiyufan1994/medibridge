import { useRoute, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Hospital, Stethoscope, Star, ThumbsUp, Calendar, ExternalLink, Globe } from "lucide-react";
import { Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { Streamdown } from "streamdown";

export default function DoctorDetail() {
  const [, params] = useRoute("/doctor/:id");
  const doctorId = params?.id ? parseInt(params.id) : 0;
  const [translatedSpecialty, setTranslatedSpecialty] = useState<string>("");
  const [translatedExpertise, setTranslatedExpertise] = useState<string>("");
  const [isTranslating, setIsTranslating] = useState(false);

  const { data, isLoading, error } = trpc.doctors.getById.useQuery(
    { id: doctorId },
    { enabled: doctorId > 0 }
  );

  // Auto-translate Chinese content when data loads
  useEffect(() => {
    if (data?.doctor) {
      const { specialty, expertise } = data.doctor;
      
      // Check if content is in Chinese (contains Chinese characters)
      const hasChinese = (text: string | null) => text && /[\u4e00-\u9fa5]/.test(text);
      
      if (hasChinese(specialty) || hasChinese(expertise)) {
        setIsTranslating(true);
        
        // Simple client-side translation simulation
        // In production, this would call a translation API
        setTimeout(() => {
          if (hasChinese(specialty)) {
            setTranslatedSpecialty(specialty || "");
          }
          if (hasChinese(expertise)) {
            setTranslatedExpertise(expertise || "");
          }
          setIsTranslating(false);
        }, 500);
      }
    }
  }, [data]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-accent/20 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-accent/20">
        <div className="container py-12">
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground">Doctor not found</p>
              <Link href="/">
                <Button variant="link" className="mt-4">Back to Home</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const { doctor, hospital, department } = data;

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
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="container py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Doctor Profile Card */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-3xl mb-2">{doctor.name}</CardTitle>
                  <CardDescription className="text-lg">{doctor.title}</CardDescription>
                </div>
                {doctor.recommendationScore && (
                  <div className="flex items-center gap-2 bg-secondary/10 px-4 py-2 rounded-lg">
                    <Star className="w-5 h-5 text-secondary fill-secondary" />
                    <span className="text-xl font-bold text-secondary">{doctor.recommendationScore}</span>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                <Badge variant="outline" className="flex items-center gap-1">
                  <Hospital className="w-3 h-3" />
                  {hospital.name}
                </Badge>
                <Badge variant="outline">{department.name}</Badge>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3 mt-6">
                <Button size="lg" className="flex-1 sm:flex-none">
                  <Calendar className="w-4 h-4 mr-2" />
                  Book Appointment
                </Button>
                {hospital.website && (
                  <Button variant="outline" size="lg" asChild>
                    <a href={hospital.website} target="_blank" rel="noopener noreferrer">
                      <Globe className="w-4 h-4 mr-2" />
                      Hospital Website
                      <ExternalLink className="w-3 h-3 ml-1" />
                    </a>
                  </Button>
                )}
                {doctor.haodafUrl && (
                  <Button variant="outline" size="lg" asChild>
                    <a href={doctor.haodafUrl} target="_blank" rel="noopener noreferrer">
                      View on Haodf
                      <ExternalLink className="w-3 h-3 ml-2" />
                    </a>
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Specialty */}
              {doctor.specialty && (
                <div>
                  <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                    <Stethoscope className="w-5 h-5 text-primary" />
                    Specialty
                  </h3>
                  {isTranslating ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Translating...</span>
                    </div>
                  ) : (
                    <div className="text-muted-foreground">
                      <Streamdown>{translatedSpecialty || doctor.specialty}</Streamdown>
                    </div>
                  )}
                </div>
              )}

              <Separator />

              {/* Areas of Expertise */}
              {doctor.expertise && (
                <div>
                  <h3 className="font-semibold text-foreground mb-2">Areas of Expertise</h3>
                  {isTranslating ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Translating...</span>
                    </div>
                  ) : (
                    <div className="text-muted-foreground">
                      <Streamdown>{translatedExpertise || doctor.expertise}</Streamdown>
                    </div>
                  )}
                </div>
              )}

              <Separator />

              {/* Patient Ratings */}
              <div>
                <h3 className="font-semibold text-foreground mb-3">Patient Ratings</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {doctor.satisfactionRate && (
                    <div className="bg-accent/30 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <ThumbsUp className="w-4 h-4 text-primary" />
                        <span className="text-sm text-muted-foreground">Satisfaction</span>
                      </div>
                      <p className="text-lg font-semibold text-foreground">{doctor.satisfactionRate}</p>
                    </div>
                  )}
                  {doctor.attitudeScore && (
                    <div className="bg-accent/30 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Star className="w-4 h-4 text-primary" />
                        <span className="text-sm text-muted-foreground">Attitude</span>
                      </div>
                      <p className="text-lg font-semibold text-foreground">{doctor.attitudeScore}</p>
                    </div>
                  )}
                  {doctor.recommendationScore && (
                    <div className="bg-accent/30 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <ThumbsUp className="w-4 h-4 text-primary" />
                        <span className="text-sm text-muted-foreground">Recommendation</span>
                      </div>
                      <p className="text-lg font-semibold text-foreground">{doctor.recommendationScore}</p>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Services Available */}
              <div>
                <h3 className="font-semibold text-foreground mb-3">Services Available</h3>
                <div className="flex flex-wrap gap-2">
                  {doctor.onlineConsultation && (
                    <Badge variant="secondary" className="py-2 px-4">
                      Online Consultation: {doctor.onlineConsultation}
                    </Badge>
                  )}
                  {doctor.appointmentAvailable && (
                    <Badge variant="secondary" className="py-2 px-4">
                      Appointment: {doctor.appointmentAvailable}
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Hospital Information Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Hospital className="w-5 h-5 text-primary" />
                Hospital Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold text-foreground mb-1">{hospital.name}</h4>
                {hospital.nameEn && (
                  <p className="text-sm text-muted-foreground">{hospital.nameEn}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {hospital.level && <Badge variant="outline">{hospital.level}</Badge>}
                {hospital.city && <Badge variant="outline">{hospital.city}</Badge>}
              </div>
              {hospital.address && (
                <p className="text-sm text-muted-foreground">{hospital.address}</p>
              )}
              {hospital.website && (
                <Button variant="link" className="px-0 h-auto" asChild>
                  <a href={hospital.website} target="_blank" rel="noopener noreferrer">
                    Visit Hospital Website
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                </Button>
              )}
            </CardContent>
          </Card>

          {/* CTA Card */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-6 text-center">
              <h3 className="text-xl font-semibold mb-2">Ready to Book an Appointment?</h3>
              <p className="text-muted-foreground mb-4">
                Connect with Dr. {doctor.name} for a professional triage consultation
              </p>
              <Button size="lg">
                <Calendar className="w-4 h-4 mr-2" />
                Schedule Consultation
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
