import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { AppLayout } from "@/components/app-layout";
import { PhaseProgress, getPhaseLabel, getPhaseColor } from "@/components/phase-progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Camera, FileText, MapPin, User, ExternalLink, X, ClipboardList, HardHat } from "lucide-react";
import type { Project, Schedule, Photo, File as ProjectFile, ConstructionTask } from "@shared/schema";

function getCategoryLabel(cat: string) {
  const map: Record<string, string> = {
    DRAWING: "도면", STRUCTURAL: "구조", INTERIOR: "인테리어", DOCUMENT: "문서", OTHER: "기타",
    MEETING: "회의", DEADLINE: "마감", INSPECTION: "검수", CONSTRUCTION: "시공",
  };
  return map[cat] ?? cat;
}

function getTaskStatusLabel(status: string) {
  const map: Record<string, string> = {
    NOT_STARTED: "미착수", IN_PROGRESS: "진행중", COMPLETED: "완료", DELAYED: "지연",
  };
  return map[status] ?? status;
}

function getTaskStatusColor(status: string) {
  const map: Record<string, string> = {
    NOT_STARTED: "bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-300",
    IN_PROGRESS: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    COMPLETED: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    DELAYED: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  };
  return map[status] ?? "";
}

export default function ClientProject() {
  const [, params] = useRoute("/client/projects/:id");
  const projectId = params?.id;

  const { data: project, isLoading } = useQuery<Project>({
    queryKey: [`/api/projects/${projectId}`],
    enabled: !!projectId,
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-4">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!project) {
    return (
      <AppLayout>
        <p className="text-muted-foreground text-center py-12">프로젝트를 찾을 수 없습니다</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6" data-testid="client-project-detail">
        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className={getPhaseColor(project.currentPhase)}>
              {getPhaseLabel(project.currentPhase)}
            </Badge>
          </div>
        </div>

        {/* Phase Progress */}
        <Card>
          <CardHeader><CardTitle>진행 현황</CardTitle></CardHeader>
          <CardContent>
            <PhaseProgress currentPhase={project.currentPhase} />
          </CardContent>
        </Card>

        <Tabs defaultValue="info" data-testid="client-project-tabs">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="info" data-testid="client-tab-info">프로젝트 정보</TabsTrigger>
            <TabsTrigger value="progress" data-testid="client-tab-progress">진행현황</TabsTrigger>
            <TabsTrigger value="schedule" data-testid="client-tab-schedule">일정</TabsTrigger>
            <TabsTrigger value="files" data-testid="client-tab-files">파일</TabsTrigger>
            <TabsTrigger value="photos" data-testid="client-tab-photos">사진</TabsTrigger>
          </TabsList>

          <TabsContent value="info">
            <Card>
              <CardContent className="pt-6 space-y-3">
                {project.description && <p className="text-sm">{project.description}</p>}
                {project.address && (
                  <p className="text-sm flex items-center gap-1 text-muted-foreground">
                    <MapPin className="w-4 h-4" />{project.address}
                  </p>
                )}
                {project.clientName && (
                  <p className="text-sm flex items-center gap-1 text-muted-foreground">
                    <User className="w-4 h-4" />건축주: {project.clientName}
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="progress">
            <ClientProgressView projectId={project.id} />
          </TabsContent>

          <TabsContent value="schedule">
            <ClientScheduleView projectId={project.id} />
          </TabsContent>

          <TabsContent value="files">
            <ClientFilesView projectId={project.id} />
          </TabsContent>

          <TabsContent value="photos">
            <ClientPhotosView projectId={project.id} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function ClientProgressView({ projectId }: { projectId: string }) {
  const { data: tasks } = useQuery<ConstructionTask[]>({
    queryKey: [`/api/projects/${projectId}/construction-tasks`],
  });

  const overallProgress = tasks?.length
    ? Math.round(tasks.reduce((sum, t) => sum + (t.progress ?? 0), 0) / tasks.length)
    : 0;

  const statusCounts = {
    NOT_STARTED: tasks?.filter((t) => t.status === "NOT_STARTED").length ?? 0,
    IN_PROGRESS: tasks?.filter((t) => t.status === "IN_PROGRESS").length ?? 0,
    COMPLETED: tasks?.filter((t) => t.status === "COMPLETED").length ?? 0,
    DELAYED: tasks?.filter((t) => t.status === "DELAYED").length ?? 0,
  };

  return (
    <div className="space-y-4" data-testid="client-progress-view">
      {/* Overall Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardHat className="w-5 h-5" />전체 공정률
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold">{overallProgress}%</span>
            </div>
            <Progress value={overallProgress} className="h-4" data-testid="client-overall-progress" />
            <div className="flex gap-4 text-sm text-muted-foreground flex-wrap">
              <span>미착수: {statusCounts.NOT_STARTED}건</span>
              <span>진행중: {statusCounts.IN_PROGRESS}건</span>
              <span>완료: {statusCounts.COMPLETED}건</span>
              <span>지연: {statusCounts.DELAYED}건</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Construction Tasks (read-only) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5" />공정 현황
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!tasks?.length ? (
            <p className="text-sm text-muted-foreground text-center py-6">등록된 공정이 없습니다</p>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <div key={task.id} className="p-3 rounded-lg border" data-testid={`client-task-${task.id}`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <span className="text-sm font-medium">{task.title}</span>
                      <span className="text-xs text-muted-foreground ml-2">{task.category}</span>
                    </div>
                    <Badge variant="outline" className={getTaskStatusColor(task.status)}>
                      {getTaskStatusLabel(task.status)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={task.progress ?? 0} className="h-2 flex-1" />
                    <span className="text-xs font-medium w-10 text-right">{task.progress ?? 0}%</span>
                  </div>
                  {(task.startDate || task.endDate) && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {task.startDate && `시작: ${task.startDate}`}
                      {task.startDate && task.endDate && " ~ "}
                      {task.endDate && `완료: ${task.endDate}`}
                    </p>
                  )}
                  {task.assignee && (
                    <p className="text-xs text-muted-foreground mt-0.5">담당: {task.assignee}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ClientScheduleView({ projectId }: { projectId: string }) {
  const { data: schedules } = useQuery<Schedule[]>({ queryKey: [`/api/projects/${projectId}/schedules`] });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Calendar className="w-5 h-5" />일정</CardTitle>
      </CardHeader>
      <CardContent>
        {!schedules?.length ? (
          <p className="text-sm text-muted-foreground text-center py-6">등록된 일정이 없습니다</p>
        ) : (
          <div className="space-y-2">
            {schedules.sort((a, b) => a.date.localeCompare(b.date)).map((s) => (
              <div key={s.id} className="flex items-start gap-3 p-3 rounded-lg border" data-testid={`client-schedule-${s.id}`}>
                <div className="text-sm text-muted-foreground whitespace-nowrap">{s.date}</div>
                <div>
                  <span className="text-sm font-medium">{s.title}</span>
                  {s.memo && <p className="text-xs text-muted-foreground mt-0.5">{s.memo}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ClientFilesView({ projectId }: { projectId: string }) {
  const { data: files } = useQuery<ProjectFile[]>({ queryKey: [`/api/projects/${projectId}/files`] });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5" />공유 파일</CardTitle>
      </CardHeader>
      <CardContent>
        {!files?.length ? (
          <p className="text-sm text-muted-foreground text-center py-6">공유된 파일이 없습니다</p>
        ) : (
          <div className="space-y-2">
            {files.map((f) => (
              <div key={f.id} className="flex items-center gap-3 p-3 rounded-lg border" data-testid={`client-file-${f.id}`}>
                <FileText className="w-5 h-5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">{f.title}</span>
                  <Badge variant="outline" className="ml-2 text-xs">{getCategoryLabel(f.category)}</Badge>
                </div>
                <a href={f.url} target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`client-file-link-${f.id}`}>
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </a>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ClientPhotosView({ projectId }: { projectId: string }) {
  const { data: photos } = useQuery<Photo[]>({ queryKey: [`/api/projects/${projectId}/photos`] });
  const [lightbox, setLightbox] = useState<Photo | null>(null);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Camera className="w-5 h-5" />현장 사진</CardTitle>
        </CardHeader>
        <CardContent>
          {!photos?.length ? (
            <p className="text-sm text-muted-foreground text-center py-6">등록된 사진이 없습니다</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {photos.map((p) => (
                <div
                  key={p.id}
                  className="aspect-square rounded-lg overflow-hidden border cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => setLightbox(p)}
                  data-testid={`client-photo-${p.id}`}
                >
                  <img src={p.imageUrl} alt={p.description || ""} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <div className="relative max-w-4xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="absolute -top-10 right-0 text-white hover:text-white/80" onClick={() => setLightbox(null)}>
              <X className="w-6 h-6" />
            </Button>
            <img src={lightbox.imageUrl} alt={lightbox.description || ""} className="max-w-full max-h-[80vh] object-contain rounded-lg" />
            {lightbox.description && <p className="text-white text-sm text-center mt-3">{lightbox.description}</p>}
          </div>
        </div>
      )}
    </>
  );
}
