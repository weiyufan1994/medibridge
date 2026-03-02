import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Hospital, Stethoscope, Star, ThumbsUp, Calendar, ExternalLink, Globe } from "lucide-react";
import { getLocalizedField } from "@/lib/i18n";

type Lang = "zh" | "en";

type Doctor = {
  id: number;
  name: string;
  nameEn: string | null;
  title: string | null;
  titleEn: string | null;
  specialty: string | null;
  specialtyEn: string | null;
  expertise: string | null;
  expertiseEn: string | null;
  recommendationScore: string | number | null;
  onlineConsultation: string | null;
  onlineConsultationEn: string | null;
  appointmentAvailable: string | null;
  appointmentAvailableEn: string | null;
  satisfactionRate: string | null;
  satisfactionRateEn: string | null;
  attitudeScore: string | null;
  attitudeScoreEn: string | null;
  haodafUrl: string | null;
};

type HospitalInfo = {
  name: string;
  nameEn: string | null;
  city: string | null;
  cityEn: string | null;
  level: string | null;
  levelEn: string | null;
  address: string | null;
  addressEn: string | null;
  website: string | null;
};

type Department = {
  name: string;
  nameEn: string | null;
};

type DoctorDetailData = {
  doctor: Doctor;
  hospital: HospitalInfo;
  department: Department;
};

type Props = {
  data: DoctorDetailData;
  resolved: Lang;
};

export function DoctorDetailContent({ data, resolved }: Props) {
  const { doctor, hospital, department } = data;
  const doctorName = getLocalizedField({ lang: resolved, zh: doctor.name, en: doctor.nameEn });
  const doctorTitle = getLocalizedField({ lang: resolved, zh: doctor.title, en: doctor.titleEn });
  const doctorSpecialty = getLocalizedField({
    lang: resolved,
    zh: doctor.specialty,
    en: doctor.specialtyEn,
  });
  const doctorExpertise = getLocalizedField({
    lang: resolved,
    zh: doctor.expertise,
    en: doctor.expertiseEn,
  });
  const hospitalName = getLocalizedField({ lang: resolved, zh: hospital.name, en: hospital.nameEn });
  const departmentName = getLocalizedField({
    lang: resolved,
    zh: department.name,
    en: department.nameEn,
  });
  const hospitalCity = getLocalizedField({ lang: resolved, zh: hospital.city, en: hospital.cityEn });
  const hospitalLevel = getLocalizedField({ lang: resolved, zh: hospital.level, en: hospital.levelEn });
  const hospitalAddress = getLocalizedField({
    lang: resolved,
    zh: hospital.address,
    en: hospital.addressEn,
  });
  const consultation = getLocalizedField({
    lang: resolved,
    zh: doctor.onlineConsultation,
    en: doctor.onlineConsultationEn,
  });
  const appointment = getLocalizedField({
    lang: resolved,
    zh: doctor.appointmentAvailable,
    en: doctor.appointmentAvailableEn,
  });
  const satisfaction = getLocalizedField({
    lang: resolved,
    zh: doctor.satisfactionRate,
    en: doctor.satisfactionRateEn,
  });
  const attitude = getLocalizedField({
    lang: resolved,
    zh: doctor.attitudeScore,
    en: doctor.attitudeScoreEn,
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-3xl mb-1">{doctorName}</CardTitle>
              <CardDescription className="text-lg">{doctorTitle}</CardDescription>
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
              {hospitalName}
            </Badge>
            <Badge variant="outline">{departmentName}</Badge>
          </div>

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
          {doctor.specialty && (
            <div>
              <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-primary" />
                Specialty
              </h3>
              <div className="space-y-2">
                <p className="text-foreground font-medium">{doctorSpecialty}</p>
              </div>
            </div>
          )}

          <Separator />

          {doctor.expertise && (
            <div>
              <h3 className="font-semibold text-foreground mb-2">Areas of Expertise</h3>
              <div className="space-y-2">
                <p className="text-foreground font-medium">{doctorExpertise}</p>
              </div>
            </div>
          )}

          <Separator />

          <div>
            <h3 className="font-semibold text-foreground mb-3">Patient Ratings</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {doctor.satisfactionRate && (
                <div className="bg-accent/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <ThumbsUp className="w-4 h-4 text-primary" />
                    <span className="text-sm text-muted-foreground">Satisfaction</span>
                  </div>
                  <p className="text-lg font-semibold text-foreground">{satisfaction}</p>
                </div>
              )}
              {doctor.attitudeScore && (
                <div className="bg-accent/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Star className="w-4 h-4 text-primary" />
                    <span className="text-sm text-muted-foreground">Attitude</span>
                  </div>
                  <p className="text-lg font-semibold text-foreground">{attitude}</p>
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

          <div>
            <h3 className="font-semibold text-foreground mb-3">Services Available</h3>
            <div className="flex flex-wrap gap-2">
              {doctor.onlineConsultation && (
                <Badge variant="secondary" className="py-2 px-4">
                  Online Consultation: {consultation}
                </Badge>
              )}
              {doctor.appointmentAvailable && (
                <Badge variant="secondary" className="py-2 px-4">
                  Appointment: {appointment}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Hospital className="w-5 h-5 text-primary" />
            Hospital Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold text-foreground mb-1">{hospitalName}</h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {hospital.level && <Badge variant="outline">{hospitalLevel}</Badge>}
            {hospital.city && <Badge variant="outline">{hospitalCity}</Badge>}
          </div>
          {hospital.address && (
            <p className="text-sm text-muted-foreground">{hospitalAddress}</p>
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

      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-6 text-center">
          <h3 className="text-xl font-semibold mb-2">Ready to Book an Appointment?</h3>
          <p className="text-muted-foreground mb-4">
            Connect with Dr. {doctorName} for a professional triage consultation
          </p>
          <Button size="lg">
            <Calendar className="w-4 h-4 mr-2" />
            Schedule Consultation
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
