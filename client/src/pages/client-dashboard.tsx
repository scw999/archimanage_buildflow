import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PhaseProgress, getPhaseLabel, getPhaseColor } from "@/components/phase-progress";
import { MapPin, FolderKanban } from "lucide-react";
import type { Project } from "@shared/schema";

export default function ClientDashboard() {
  const [, setLocation] = useLocation();
  const { data: projects, isLoading } = useQuery<Project[]>({ queryKey: ["/api/projects"] });

  return (
    <AppLayout>
      <div className="space-y-6" data-testid="client-dashboard">
        <div>
          <h1 className="text-2xl font-bold">내 프로젝트</h1>
          <p className="text-muted-foreground text-sm">참여 중인 건축 프로젝트를 확인하세요</p>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-center py-12">로딩 중...</p>
        ) : !projects?.length ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FolderKanban className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">참여 중인 프로젝트가 없습니다</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map((project) => (
              <Card
                key={project.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => setLocation(`/client/projects/${project.id}`)}
                data-testid={`client-project-card-${project.id}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{project.name}</CardTitle>
                    <Badge variant={project.status === "ACTIVE" ? "default" : "secondary"}>
                      {project.status === "ACTIVE" ? "진행중" : project.status === "COMPLETED" ? "완료" : "보류"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {project.address && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />{project.address}
                    </p>
                  )}
                  {project.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{project.description}</p>
                  )}
                  <Badge variant="outline" className={getPhaseColor(project.currentPhase)}>
                    {getPhaseLabel(project.currentPhase)}
                  </Badge>
                  <PhaseProgress currentPhase={project.currentPhase} compact />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
