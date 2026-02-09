import { useRoute, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Hospital, Stethoscope, Star, ThumbsUp, Calendar } from "lucide-react";
import { Loader2 } from "lucide-react";

export default function DoctorDetail() {
  const [, params] = useRoute("/doctor/:id");
  const doctorId = params?.id ? parseInt(params.id) : 0;

  const { data, isLoading, error } = trpc.doctors.getById.useQuery(
    { id: doctorId },
    { enabled: doctorId > 0 }
  );

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
                <div>
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
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Specialty */}
              {doctor.specialty && (
                <div>
                  <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                    <Stethoscope className="w-4 h-4 text-primary" />
                    Specialty
                  </h3>
                  <p className="text-muted-foreground">{doctor.specialty}</p>
                </div>
              )}

              <Separator />

              {/* Expertise */}
              {doctor.expertise && (
                <div>
                  <h3 className="font-semibold text-foreground mb-2">Areas of Expertise</h3>
                  <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {doctor.expertise}
                  </p>
                </div>
              )}

              <Separator />

              {/* Ratings */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {doctor.satisfactionRate && (
                  <div className="bg-accent/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <ThumbsUp className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium text-muted-foreground">Treatment Satisfaction</span>
                    </div>
                    <p className="text-lg font-semibold text-foreground">{doctor.satisfactionRate}</p>
                  </div>
                )}

                {doctor.attitudeScore && (
                  <div className="bg-accent/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Star className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium text-muted-foreground">Attitude Score</span>
                    </div>
                    <p className="text-lg font-semibold text-foreground">{doctor.attitudeScore}</p>
                  </div>
                )}

                {doctor.recommendationScore && (
                  <div className="bg-accent/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Star className="w-4 h-4 text-secondary fill-secondary" />
                      <span className="text-sm font-medium text-muted-foreground">Patient Recommendation</span>
                    </div>
                    <p className="text-lg font-semibold text-foreground">{doctor.recommendationScore}</p>
                  </div>
                )}
              </div>

              {/* Services */}
              {(doctor.onlineConsultation || doctor.appointmentAvailable) && (
                <>
                  <Separator />
                  <div>
                    <h3 className="font-semibold text-foreground mb-3">Services</h3>
                    <div className="space-y-2">
                      {doctor.onlineConsultation && (
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">Online Consultation</Badge>
                          <span className="text-sm text-muted-foreground">{doctor.onlineConsultation}</span>
                        </div>
                      )}
                      {doctor.appointmentAvailable && (
                        <div className="flex items-start gap-2">
                          <Badge variant="secondary" className="mt-0.5">
                            <Calendar className="w-3 h-3 mr-1" />
                            Appointment
                          </Badge>
                          <span className="text-sm text-muted-foreground flex-1">
                            {doctor.appointmentAvailable.length > 200
                              ? `${doctor.appointmentAvailable.substring(0, 200)}...`
                              : doctor.appointmentAvailable}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Hospital Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Hospital Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <span className="text-sm font-medium text-muted-foreground">Hospital: </span>
                <span className="text-foreground">{hospital.name}</span>
              </div>
              {hospital.nameEn && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">English Name: </span>
                  <span className="text-foreground">{hospital.nameEn}</span>
                </div>
              )}
              {hospital.city && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">City: </span>
                  <span className="text-foreground">{hospital.city}</span>
                </div>
              )}
              {hospital.level && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Level: </span>
                  <Badge variant="outline">{hospital.level}</Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Link href="/">
              <Button variant="outline" className="flex-1">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Consultation
              </Button>
            </Link>
            <Link href="/hospitals">
              <Button variant="outline" className="flex-1">
                <Hospital className="w-4 h-4 mr-2" />
                Browse More Hospitals
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
