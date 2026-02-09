import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Hospital, Stethoscope, Search, ChevronRight, Loader2 } from "lucide-react";

export default function Hospitals() {
  const [selectedHospitalId, setSelectedHospitalId] = useState<number | null>(null);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: hospitals, isLoading: hospitalsLoading } = trpc.hospitals.getAll.useQuery();
  
  const { data: departments, isLoading: departmentsLoading } = trpc.hospitals.getDepartments.useQuery(
    { hospitalId: selectedHospitalId! },
    { enabled: selectedHospitalId !== null }
  );

  const { data: doctors, isLoading: doctorsLoading } = trpc.doctors.getByDepartment.useQuery(
    { departmentId: selectedDepartmentId!, limit: 50 },
    { enabled: selectedDepartmentId !== null }
  );

  const filteredDoctors = doctors?.filter(d =>
    d.doctor.name.includes(searchQuery) ||
    d.doctor.expertise?.includes(searchQuery) ||
    d.doctor.specialty?.includes(searchQuery)
  );

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
                <p className="text-sm text-muted-foreground">浏览医院和科室</p>
              </div>
            </div>
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回首页
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="container py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Hospitals List */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Hospital className="w-5 h-5 text-primary" />
                医院列表
              </CardTitle>
              <CardDescription>选择医院查看科室</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {hospitalsLoading && (
                <div className="py-8 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                </div>
              )}
              {hospitals?.map((hospital) => (
                <Button
                  key={hospital.id}
                  variant={selectedHospitalId === hospital.id ? "default" : "ghost"}
                  className="w-full justify-start text-left h-auto py-3"
                  onClick={() => {
                    setSelectedHospitalId(hospital.id);
                    setSelectedDepartmentId(null);
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{hospital.name}</p>
                    {hospital.level && (
                      <p className="text-xs text-muted-foreground mt-0.5">{hospital.level}</p>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 flex-shrink-0 ml-2" />
                </Button>
              ))}
            </CardContent>
          </Card>

          {/* Departments List */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>科室列表</CardTitle>
              <CardDescription>
                {selectedHospitalId ? "选择科室查看医生" : "请先选择医院"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {!selectedHospitalId && (
                <div className="py-8 text-center text-muted-foreground">
                  <Hospital className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">请先选择医院</p>
                </div>
              )}
              {departmentsLoading && (
                <div className="py-8 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                </div>
              )}
              {departments?.map((dept) => (
                <Button
                  key={dept.id}
                  variant={selectedDepartmentId === dept.id ? "default" : "ghost"}
                  className="w-full justify-start text-left"
                  onClick={() => setSelectedDepartmentId(dept.id)}
                >
                  {dept.name}
                  <ChevronRight className="w-4 h-4 ml-auto" />
                </Button>
              ))}
            </CardContent>
          </Card>

          {/* Doctors List */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>医生列表</CardTitle>
              <CardDescription>
                {selectedDepartmentId
                  ? `共 ${filteredDoctors?.length || 0} 位医生`
                  : "请先选择科室"}
              </CardDescription>
              {selectedDepartmentId && (
                <div className="mt-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="搜索医生姓名或专长..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {!selectedDepartmentId && (
                <div className="py-12 text-center text-muted-foreground">
                  <Stethoscope className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">请先选择科室</p>
                </div>
              )}
              {doctorsLoading && (
                <div className="py-12 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                </div>
              )}
              {filteredDoctors && filteredDoctors.length === 0 && selectedDepartmentId && (
                <div className="py-12 text-center text-muted-foreground">
                  <p className="text-sm">未找到匹配的医生</p>
                </div>
              )}
              {filteredDoctors?.map(({ doctor, hospital, department }) => (
                <Card key={doctor.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-foreground">{doctor.name}</h4>
                          {doctor.recommendationScore && (
                            <Badge variant="secondary" className="text-xs">
                              ★ {doctor.recommendationScore}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{doctor.title}</p>
                        {doctor.specialty && (
                          <p className="text-sm text-muted-foreground mb-2">
                            <span className="font-medium">专业方向：</span>
                            {doctor.specialty}
                          </p>
                        )}
                        {doctor.expertise && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            <span className="font-medium">专业擅长：</span>
                            {doctor.expertise}
                          </p>
                        )}
                      </div>
                      <Link href={`/doctor/${doctor.id}`}>
                        <Button size="sm" variant="outline">
                          查看详情
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
