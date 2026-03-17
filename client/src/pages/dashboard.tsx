import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PhaseProgress, getPhaseLabel, getPhaseColor } from "@/components/phase-progress";
import { AppLayout } from "@/components/app-layout";
import { FolderKanban, Activity, AlertCircle, Plus, MapPin } from "lucide-react";
import type { Project, ClientRequest } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === "SUPER_ADMIN";

  const { data: projects, isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const activeProjects = projects?.filter((p) => p.status === "ACTIVE") ?? [];
  const totalProjects = projects?.length ?? 0;

  return (
    <AppLayout>
      <div className="space-y-6" data-testid="dashboard">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">대시보드</h1>
            <p className="text-muted-foreground text-sm">프로젝트 현황을 한눈에 확인하세요</p>
          </div>
          {isAdmin && (
            <Button onClick={() => setLocation("/projects")} data-testid="new-project-button">
              <Plus className="w-4 h-4 mr-2" />
              새 프로젝트
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <FolderKanban className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">전체 프로젝트</p>
                  <p className="text-2xl font-bold">{totalProjects}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Activity className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">진행 중</p>
                  <p className="text-2xl font-bold">{activeProjects.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <AlertCircle className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">보류</p>
                  <p className="text-2xl font-bold">{projects?.filter((p) => p.status === "ON_HOLD").length ?? 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Projects Grid */}
        <div>
          <h2 className="text-lg font-semibold mb-4">프로젝트 목록</h2>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map((i) => (
                <Card key={i}>
                  <CardContent className="pt-6 space-y-3">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {projects?.map((project) => (
                <Card
                  key={project.id}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => setLocation(`/projects/${project.id}`)}
                  data-testid={`project-card-${project.id}`}
                >
                  {project.coverImageUrl && (
                    <div className="h-44 overflow-hidden rounded-t-lg">
                      <img src={project.coverImageUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{project.name}</CardTitle>
                      <Badge
                        variant={project.status === "ACTIVE" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {project.status === "ACTIVE" ? "진행중" : project.status === "COMPLETED" ? "완료" : "보류"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {project.address && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {project.address}
                      </p>
                    )}
                    {project.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{project.description}</p>
                    )}
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={getPhaseColor(project.currentPhase)}>
                        {getPhaseLabel(project.currentPhase)}
                      </Badge>
                      {project.clientName && (
                        <span className="text-xs text-muted-foreground">건축주: {project.clientName}</span>
                      )}
                    </div>
                    <PhaseProgress currentPhase={project.currentPhase} compact />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
