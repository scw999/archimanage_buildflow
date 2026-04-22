import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { AppLayout } from "@/components/app-layout";
import { PhaseProgress, getPhaseLabel, getPhaseColor } from "@/components/phase-progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Calendar, Camera, FileText, MapPin, User, ExternalLink, Download, X, ClipboardList, HardHat, MessageSquare, Plus, ChevronDown, ChevronRight, FolderTree, Pencil, Trash2, Building2, Ruler, Layers, CheckCircle2 } from "lucide-react";
import type { Project, Schedule, Photo, File as ProjectFile, ConstructionTask, ClientRequest, Comment, DesignChange, DesignCheck } from "@shared/schema";

type CommentWithAuthor = Comment & { authorName?: string | null; authorRole?: string | null };

function getRoleLabel(role?: string | null): string {
  const map: Record<string, string> = { SUPER_ADMIN: "관리자", PM: "매니저", MEMBER: "팀원", CLIENT: "건축주" };
  return role ? (map[role] ?? role) : "";
}

function isImageLikeUrl(url: string) {
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(url) || url.includes("/api/photos/file/") || url.includes("/uploads/photos/");
}

function extractGoogleDriveFileId(url: string) {
  const patterns = [/\/file\/d\/([^/]+)/, /[?&]id=([^&]+)/];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

function getDownloadableUrl(url: string) {
  const driveId = extractGoogleDriveFileId(url);
  if (driveId) return `https://drive.google.com/uc?export=download&id=${driveId}`;
  return url;
}

function AttachmentPreviewGrid({ attachments }: { attachments: string[] }) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  if (!attachments.length) return null;

  return (
    <>
      <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
        {attachments.map((url, i) => {
          const isImage = isImageLikeUrl(url);
          return isImage ? (
            <button key={`${url}-${i}`} type="button" className="aspect-square rounded overflow-hidden border hover:opacity-90 transition-opacity" onClick={() => setLightboxUrl(url)}>
              <img src={url} alt="attachment" className="w-full h-full object-cover" />
            </button>
          ) : (
            <a key={`${url}-${i}`} href={getDownloadableUrl(url)} download target="_blank" rel="noopener noreferrer" className="aspect-square rounded border p-3 flex flex-col items-center justify-center gap-2 hover:bg-muted/40 transition-colors">
              <FileText className="w-6 h-6 text-muted-foreground" />
              <span className="text-[11px] text-center text-muted-foreground line-clamp-3 break-all">파일 다운로드</span>
            </a>
          );
        })}
      </div>

      {lightboxUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setLightboxUrl(null)}>
          <div className="relative max-w-5xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="absolute -top-10 right-0 text-white hover:text-white/80" onClick={() => setLightboxUrl(null)}>
              <X className="w-6 h-6" />
            </Button>
            <img src={lightboxUrl} alt="attachment preview" className="max-w-full max-h-[85vh] object-contain rounded-lg" />
          </div>
        </div>
      )}
    </>
  );
}

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
        {project.coverImageUrl && (
          <div className="aspect-[16/6] overflow-hidden rounded-lg border bg-muted">
            <img src={project.coverImageUrl} alt={project.name} className="w-full h-full object-cover object-center" data-testid="client-project-cover" />
          </div>
        )}

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
            <TabsTrigger value="design" data-testid="client-tab-design">설계</TabsTrigger>
            <TabsTrigger value="construction" data-testid="client-tab-construction">시공</TabsTrigger>
            <TabsTrigger value="progress" data-testid="client-tab-progress">진행현황</TabsTrigger>
            <TabsTrigger value="schedule" data-testid="client-tab-schedule">일정</TabsTrigger>
            <TabsTrigger value="photos" data-testid="client-tab-photos">사진</TabsTrigger>
            <TabsTrigger value="requests" data-testid="client-tab-requests">요청사항</TabsTrigger>
          </TabsList>

          <TabsContent value="info">
            <ClientInfoView project={project} />
          </TabsContent>

          <TabsContent value="design">
            <ClientDesignView projectId={project.id} />
          </TabsContent>

          <TabsContent value="construction">
            <ClientConstructionView projectId={project.id} />
          </TabsContent>

          <TabsContent value="progress">
            <ClientProgressView projectId={project.id} />
          </TabsContent>

          <TabsContent value="schedule">
            <ClientScheduleView projectId={project.id} />
          </TabsContent>

          <TabsContent value="photos">
            <ClientPhotosView projectId={project.id} />
          </TabsContent>

          <TabsContent value="requests">
            <ClientRequestsView projectId={project.id} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function InfoRow({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex items-start gap-2 text-sm">
      {icon && <span className="text-muted-foreground shrink-0 mt-0.5">{icon}</span>}
      <span className="text-muted-foreground w-28 shrink-0">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function ClientInfoView({ project }: { project: Project }) {
  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        {project.description && (
          <p className="text-sm whitespace-pre-wrap" data-testid="client-info-description">{project.description}</p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 pt-2 border-t">
          <InfoRow icon={<MapPin className="w-4 h-4" />} label="주소" value={project.address} />
          <InfoRow icon={<User className="w-4 h-4" />} label="건축주" value={project.clientName} />
          <InfoRow icon={<Building2 className="w-4 h-4" />} label="주용도" value={project.mainUse} />
          <InfoRow icon={<Layers className="w-4 h-4" />} label="구조" value={project.structureType} />
          <InfoRow icon={<Layers className="w-4 h-4" />} label="층수" value={project.floors} />
          <InfoRow icon={<Ruler className="w-4 h-4" />} label="건축면적" value={project.buildingArea ? `${project.buildingArea} m²` : null} />
          <InfoRow icon={<Ruler className="w-4 h-4" />} label="연면적" value={project.totalFloorArea ? `${project.totalFloorArea} m²` : null} />
          <InfoRow icon={<Ruler className="w-4 h-4" />} label="건폐율" value={project.buildingCoverage ? `${project.buildingCoverage}%` : null} />
          <InfoRow icon={<Ruler className="w-4 h-4" />} label="용적률" value={project.floorAreaRatio ? `${project.floorAreaRatio}%` : null} />
        </div>
        {project.specialNotes && (
          <div className="pt-3 border-t">
            <p className="text-xs text-muted-foreground mb-1">특기사항</p>
            <p className="text-sm whitespace-pre-wrap">{project.specialNotes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function getDesignChangeStatusLabel(s: string): string {
  const map: Record<string, string> = { REQUESTED: "요청됨", REVIEWING: "검토중", APPROVED: "승인", REJECTED: "반려", APPLIED: "반영" };
  return map[s] ?? s;
}
function getDesignChangeStatusColor(s: string): string {
  const map: Record<string, string> = {
    REQUESTED: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    REVIEWING: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
    APPROVED: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    REJECTED: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    APPLIED: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  };
  return map[s] ?? "";
}

function ClientDesignView({ projectId }: { projectId: string }) {
  const { data: files } = useQuery<ProjectFile[]>({ queryKey: [`/api/projects/${projectId}/files`] });
  const { data: changes } = useQuery<DesignChange[]>({ queryKey: [`/api/projects/${projectId}/design-changes`] });
  const { data: checks } = useQuery<DesignCheck[]>({ queryKey: [`/api/projects/${projectId}/design-checks`] });
  const designFiles = (files ?? []).filter((f) => f.phase === "DESIGN" || f.phase === "PERMIT");
  const completedChecks = (checks ?? []).filter((c) => c.isCompleted === 1).length;
  const totalChecks = (checks ?? []).length;

  return (
    <div className="space-y-4" data-testid="client-design-view">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5" />설계 파일</CardTitle>
        </CardHeader>
        <CardContent>
          {!designFiles.length ? (
            <p className="text-sm text-muted-foreground text-center py-4">공유된 설계 파일이 없습니다</p>
          ) : (
            <div className="space-y-2">
              {designFiles.map((f) => (
                <div key={f.id} className="flex items-center gap-3 p-3 rounded-lg border" data-testid={`client-design-file-${f.id}`}>
                  <FileText className="w-5 h-5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">{f.title}</span>
                    <Badge variant="outline" className="ml-2 text-xs">{getCategoryLabel(f.category)}</Badge>
                    {f.version && <span className="ml-2 text-xs text-muted-foreground">{f.version}</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    <a href={f.url} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon" className="h-8 w-8"><ExternalLink className="w-4 h-4" /></Button>
                    </a>
                    <a href={getDownloadableUrl(f.url)} download target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon" className="h-8 w-8"><Download className="w-4 h-4" /></Button>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Pencil className="w-5 h-5" />설계 변경 내역</CardTitle>
        </CardHeader>
        <CardContent>
          {!changes?.length ? (
            <p className="text-sm text-muted-foreground text-center py-4">등록된 설계 변경이 없습니다</p>
          ) : (
            <div className="space-y-2">
              {changes.map((c) => (
                <div key={c.id} className="p-3 rounded-lg border" data-testid={`client-design-change-${c.id}`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{c.title}</span>
                    <Badge variant="outline" className={getDesignChangeStatusColor(c.status)}>{getDesignChangeStatusLabel(c.status)}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{c.description}</p>
                  {c.reason && <p className="text-xs text-muted-foreground mt-1">사유: {c.reason}</p>}
                  {c.impactArea && <p className="text-xs text-muted-foreground">영향 범위: {c.impactArea}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />설계 체크리스트
            <span className="text-sm font-normal text-muted-foreground">{completedChecks}/{totalChecks} 완료</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!checks?.length ? (
            <p className="text-sm text-muted-foreground text-center py-4">등록된 체크리스트 항목이 없습니다</p>
          ) : (
            <div className="space-y-2">
              {checks.map((c) => (
                <div key={c.id} className="flex items-start gap-2 p-2 rounded border text-sm" data-testid={`client-design-check-${c.id}`}>
                  <CheckCircle2 className={`w-4 h-4 mt-0.5 shrink-0 ${c.isCompleted === 1 ? "text-green-600" : "text-muted-foreground"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={c.isCompleted === 1 ? "line-through text-muted-foreground" : ""}>{c.title}</span>
                      <Badge variant="outline" className="text-[10px]">{c.category}</Badge>
                    </div>
                    {c.memo && <p className="text-xs text-muted-foreground mt-0.5">{c.memo}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ClientConstructionView({ projectId }: { projectId: string }) {
  const { data: tasks } = useQuery<ConstructionTask[]>({ queryKey: [`/api/projects/${projectId}/construction-tasks`] });
  const { data: files } = useQuery<ProjectFile[]>({ queryKey: [`/api/projects/${projectId}/files`] });
  const { data: photos } = useQuery<Photo[]>({ queryKey: [`/api/projects/${projectId}/photos`] });
  const [lightbox, setLightbox] = useState<Photo | null>(null);

  const constructionFiles = (files ?? []).filter((f) => f.phase === "CONSTRUCTION");
  const constructionPhotos = (photos ?? []).filter((p) => p.phase === "CONSTRUCTION");

  return (
    <div className="space-y-4" data-testid="client-construction-view">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><HardHat className="w-5 h-5" />시공 공정</CardTitle>
        </CardHeader>
        <CardContent>
          {!tasks?.length ? (
            <p className="text-sm text-muted-foreground text-center py-4">등록된 공정이 없습니다</p>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <div key={task.id} className="p-3 rounded-lg border" data-testid={`client-construction-task-${task.id}`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <span className="font-medium">{task.title}</span>
                      <span className="text-sm text-muted-foreground ml-2">{task.category}</span>
                    </div>
                    <Badge variant="outline" className={getTaskStatusColor(task.status)}>
                      {getTaskStatusLabel(task.status)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={task.progress ?? 0} className="h-2.5 flex-1" />
                    <span className="text-sm font-medium w-10 text-right">{task.progress ?? 0}%</span>
                  </div>
                  {(task.startDate || task.endDate) && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {task.startDate && `시작: ${task.startDate}`}
                      {task.startDate && task.endDate && " ~ "}
                      {task.endDate && `완료: ${task.endDate}`}
                    </p>
                  )}
                  {task.assignee && <p className="text-sm text-muted-foreground mt-0.5">담당: {task.assignee}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5" />시공 파일</CardTitle>
        </CardHeader>
        <CardContent>
          {!constructionFiles.length ? (
            <p className="text-sm text-muted-foreground text-center py-4">공유된 시공 파일이 없습니다</p>
          ) : (
            <div className="space-y-2">
              {constructionFiles.map((f) => (
                <div key={f.id} className="flex items-center gap-3 p-3 rounded-lg border">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">{f.title}</span>
                    <Badge variant="outline" className="ml-2 text-xs">{getCategoryLabel(f.category)}</Badge>
                  </div>
                  <a href={f.url} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="icon" className="h-8 w-8"><ExternalLink className="w-4 h-4" /></Button>
                  </a>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />시공 현장 사진
            <span className="text-sm font-normal text-muted-foreground">({constructionPhotos.length}장)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!constructionPhotos.length ? (
            <p className="text-sm text-muted-foreground text-center py-4">등록된 사진이 없습니다</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {constructionPhotos.map((p) => (
                <div key={p.id} className="aspect-square rounded-lg overflow-hidden border cursor-pointer hover:opacity-80 transition-opacity relative group"
                  onClick={() => setLightbox(p)}>
                  <img src={p.imageUrl} alt={p.description || ""} className="w-full h-full object-cover" />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {p.takenAt || "날짜없음"}
                    {(p as any).subCategory && ` · ${(p as any).subCategory}`}
                  </div>
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
            <div className="text-white text-sm text-center mt-3">
              {lightbox.takenAt && <span>{lightbox.takenAt}</span>}
              {lightbox.description && <span> - {lightbox.description}</span>}
              {(lightbox as any).subCategory && <span className="ml-2 text-white/60">[{(lightbox as any).subCategory}]</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ClientProgressView({ projectId }: { projectId: string }) {
  const { data: tasks } = useQuery<ConstructionTask[]>({
    queryKey: [`/api/projects/${projectId}/construction-tasks`],
  });
  const { data: photos } = useQuery<Photo[]>({ queryKey: [`/api/projects/${projectId}/photos`] });
  const { data: requests } = useQuery<ClientRequest[]>({ queryKey: [`/api/projects/${projectId}/requests`] });
  const [lightbox, setLightbox] = useState<Photo | null>(null);
  const [expandedReq, setExpandedReq] = useState<string | null>(null);

  const overallProgress = tasks?.length
    ? Math.round(tasks.reduce((sum, t) => sum + (t.progress ?? 0), 0) / tasks.length)
    : 0;

  const statusCounts = {
    NOT_STARTED: tasks?.filter((t) => t.status === "NOT_STARTED").length ?? 0,
    IN_PROGRESS: tasks?.filter((t) => t.status === "IN_PROGRESS").length ?? 0,
    COMPLETED: tasks?.filter((t) => t.status === "COMPLETED").length ?? 0,
    DELAYED: tasks?.filter((t) => t.status === "DELAYED").length ?? 0,
  };

  const progressPhotos = (photos ?? []).filter((p) => p.phase === "CONSTRUCTION").slice().sort((a, b) => (b.takenAt ?? "").localeCompare(a.takenAt ?? ""));
  const activeRequests = (requests ?? []).filter((r) => r.phase === "CONSTRUCTION");

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
                      <span className="font-medium">{task.title}</span>
                      <span className="text-sm text-muted-foreground ml-2">{task.category}</span>
                    </div>
                    <Badge variant="outline" className={getTaskStatusColor(task.status)}>
                      {getTaskStatusLabel(task.status)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={task.progress ?? 0} className="h-2.5 flex-1" />
                    <span className="text-sm font-medium w-10 text-right">{task.progress ?? 0}%</span>
                  </div>
                  {(task.startDate || task.endDate) && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {task.startDate && `시작: ${task.startDate}`}
                      {task.startDate && task.endDate && " ~ "}
                      {task.endDate && `완료: ${task.endDate}`}
                    </p>
                  )}
                  {task.assignee && (
                    <p className="text-sm text-muted-foreground mt-0.5">담당: {task.assignee}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Construction Photos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />최근 현장 사진
            <span className="text-sm font-normal text-muted-foreground">({progressPhotos.length}장)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!progressPhotos.length ? (
            <p className="text-sm text-muted-foreground text-center py-6">등록된 사진이 없습니다</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {progressPhotos.slice(0, 8).map((p) => (
                <div key={p.id} className="aspect-square rounded-lg overflow-hidden border cursor-pointer hover:opacity-80 transition-opacity relative group"
                  onClick={() => setLightbox(p)} data-testid={`client-progress-photo-${p.id}`}>
                  <img src={p.imageUrl} alt={p.description || ""} className="w-full h-full object-cover" />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {p.takenAt || "날짜없음"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Comments/Requests inline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />요청사항 및 댓글
            <span className="text-sm font-normal text-muted-foreground">({activeRequests.length}건)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!activeRequests.length ? (
            <p className="text-sm text-muted-foreground text-center py-6">등록된 요청사항이 없습니다</p>
          ) : (
            <div className="space-y-2">
              {activeRequests.map((req) => (
                <div key={req.id} className="border rounded-lg p-3" data-testid={`client-progress-req-${req.id}`}>
                  <div className="flex items-center gap-2 cursor-pointer" onClick={() => setExpandedReq(expandedReq === req.id ? null : req.id)}>
                    {expandedReq === req.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    <span className="text-sm font-medium">{req.title}</span>
                  </div>
                  {expandedReq === req.id && (
                    <div className="mt-2 ml-6">
                      <p className="text-sm mb-2">{req.content}</p>
                      <InlineComments requestId={req.id} />
                    </div>
                  )}
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
            <div className="text-white text-sm text-center mt-3">
              {lightbox.takenAt && <span>{lightbox.takenAt}</span>}
              {lightbox.description && <span> - {lightbox.description}</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InlineComments({ requestId }: { requestId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: comments } = useQuery<CommentWithAuthor[]>({ queryKey: [`/api/requests/${requestId}/comments`] });
  const canManage = user?.role === "SUPER_ADMIN" || user?.role === "PM";

  const addMutation = useMutation({
    mutationFn: async (content: string) => { await apiRequest("POST", `/api/requests/${requestId}/comments`, { content }); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/requests/${requestId}/comments`] }); },
  });
  const updateMutation = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => { await apiRequest("PATCH", `/api/comments/${id}`, { content }); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/requests/${requestId}/comments`] }); toast({ title: "댓글이 수정되었습니다" }); },
  });
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/comments/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/requests/${requestId}/comments`] }); toast({ title: "댓글이 삭제되었습니다" }); },
  });

  return (
    <div className="space-y-2">
      {comments?.map((c) => (
        <ClientCommentItem
          key={c.id}
          comment={c}
          canEdit={canManage || c.authorId === user?.id}
          canDelete={canManage || c.authorId === user?.id}
          onUpdate={(content) => updateMutation.mutate({ id: c.id, content })}
          onDelete={() => deleteMutation.mutate(c.id)}
        />
      ))}
      <form onSubmit={(e) => {
        e.preventDefault(); const fd = new FormData(e.currentTarget);
        const content = (fd.get("comment") as string)?.trim();
        if (content) { addMutation.mutate(content); e.currentTarget.reset(); }
      }} className="flex gap-2">
        <Input name="comment" placeholder="댓글 입력..." className="text-sm" />
        <Button type="submit" size="sm">등록</Button>
      </form>
    </div>
  );
}

function ClientCommentItem({
  comment, canEdit, canDelete, onUpdate, onDelete,
}: {
  comment: CommentWithAuthor;
  canEdit: boolean;
  canDelete: boolean;
  onUpdate: (content: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.content);
  const edited = !!comment.updatedAt;

  return (
    <div className="p-2 bg-muted/50 rounded text-sm space-y-1" data-testid={`client-comment-${comment.id}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{comment.authorName ?? "사용자"}</span>
          {comment.authorRole && <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">{getRoleLabel(comment.authorRole)}</Badge>}
          {edited && <span>(수정됨)</span>}
        </div>
        {!editing && (canEdit || canDelete) && (
          <div className="flex items-center gap-0.5 shrink-0">
            {canEdit && (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setDraft(comment.content); setEditing(true); }} data-testid={`client-comment-edit-${comment.id}`}>
                <Pencil className="w-3 h-3" />
              </Button>
            )}
            {canDelete && (
              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive"
                onClick={() => { if (confirm("이 댓글을 삭제하시겠습니까?")) onDelete(); }}
                data-testid={`client-comment-delete-${comment.id}`}>
                <Trash2 className="w-3 h-3" />
              </Button>
            )}
          </div>
        )}
      </div>
      {editing ? (
        <div className="space-y-1">
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} className="text-sm min-h-[60px]" />
          <div className="flex gap-1 justify-end">
            <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditing(false)}>취소</Button>
            <Button size="sm" className="h-7" disabled={!draft.trim() || draft === comment.content}
              onClick={() => { onUpdate(draft.trim()); setEditing(false); }}>저장</Button>
          </div>
        </div>
      ) : (
        <div className="whitespace-pre-wrap">{comment.content}</div>
      )}
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
                <div className="text-sm text-muted-foreground whitespace-nowrap font-medium">
                  <div>{s.date}</div>
                  {(s as any).time && <div className="text-xs">{(s as any).time}</div>}
                </div>
                <div className="flex-1">
                  <span className="font-medium">{s.title}</span>
                  {(s as any).location && <p className="text-sm text-muted-foreground mt-0.5"><MapPin className="w-3 h-3 inline mr-1" />{(s as any).location}</p>}
                  {s.memo && <p className="text-sm text-muted-foreground mt-0.5">{s.memo}</p>}
                </div>
                <Badge variant="outline" className="text-xs shrink-0">{getCategoryLabel((s as any).category || "")}</Badge>
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
                <div className="flex items-center gap-1">
                  <a href={f.url} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`client-file-link-${f.id}`}>
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </a>
                  <a href={getDownloadableUrl(f.url)} download target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`client-file-download-${f.id}`}>
                      <Download className="w-4 h-4" />
                    </Button>
                  </a>
                </div>
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
  const [expandedPhase, setExpandedPhase] = useState<string | null>(null);
  const [expandedSub, setExpandedSub] = useState<string | null>(null);

  const phases = ["DESIGN", "PERMIT", "CONSTRUCTION", "COMPLETION", "PORTFOLIO"];

  const photosByPhase: Record<string, Record<string, Photo[]>> = {};
  phases.forEach((phase) => {
    const phasePhotos = photos?.filter((p) => p.phase === phase) ?? [];
    const grouped: Record<string, Photo[]> = {};
    phasePhotos.forEach((p) => {
      const sub = (p as any).subCategory || "미분류";
      if (!grouped[sub]) grouped[sub] = [];
      grouped[sub].push(p);
    });
    if (Object.keys(grouped).length > 0) photosByPhase[phase] = grouped;
  });

  const totalByPhase = (phase: string) => photos?.filter((p) => p.phase === phase).length ?? 0;
  const totalPhotos = photos?.length ?? 0;

  return (
    <>
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5" /> 현장 사진
              <span className="text-sm font-normal text-muted-foreground">({totalPhotos}장)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!totalPhotos ? (
              <p className="text-sm text-muted-foreground text-center py-6">등록된 사진이 없습니다</p>
            ) : (
              <div className="space-y-2">
                {phases.map((phase) => {
                  const count = totalByPhase(phase);
                  if (count === 0) return null;
                  const isExpanded = expandedPhase === phase;
                  const subGroups = photosByPhase[phase] || {};

                  return (
                    <div key={phase} className="border rounded-lg p-3">
                      <div className="cursor-pointer flex items-center gap-2"
                        onClick={() => setExpandedPhase(isExpanded ? null : phase)}>
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        <FolderTree className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{getPhaseLabel(phase)}</span>
                        <Badge variant="outline" className="text-xs ml-auto">{count}장</Badge>
                      </div>
                      {isExpanded && (
                        <div className="ml-6 mt-2 space-y-2">
                          {Object.entries(subGroups).map(([sub, subPhotos]) => {
                            const subKey = `${phase}-${sub}`;
                            const isSubExpanded = expandedSub === subKey;
                            return (
                              <div key={subKey}>
                                <div className="cursor-pointer flex items-center gap-2 py-1"
                                  onClick={() => setExpandedSub(isSubExpanded ? null : subKey)}>
                                  {isSubExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                  <span className="text-sm">{sub}</span>
                                  <span className="text-xs text-muted-foreground">({subPhotos.length})</span>
                                </div>
                                {isSubExpanded && (
                                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mt-2 ml-4">
                                    {subPhotos.map((p) => (
                                      <div key={p.id}
                                        className="aspect-square rounded-lg overflow-hidden border cursor-pointer hover:opacity-80 transition-opacity relative group"
                                        onClick={() => setLightbox(p)}>
                                        <img src={p.imageUrl} alt={p.description || ""} className="w-full h-full object-cover" />
                                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                          {p.takenAt || "날짜없음"}
                                          {p.description && ` - ${p.description}`}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <div className="relative max-w-4xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="absolute -top-10 right-0 text-white hover:text-white/80" onClick={() => setLightbox(null)}>
              <X className="w-6 h-6" />
            </Button>
            <img src={lightbox.imageUrl} alt={lightbox.description || ""} className="max-w-full max-h-[80vh] object-contain rounded-lg" />
            <div className="text-white text-sm text-center mt-3">
              {lightbox.takenAt && <span>{lightbox.takenAt}</span>}
              {lightbox.description && <span> - {lightbox.description}</span>}
              {(lightbox as any).subCategory && <span className="ml-2 text-white/60">[{(lightbox as any).subCategory}]</span>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function getRequestStatusLabel(status: string) {
  const map: Record<string, string> = {
    NEW: "신규", REVIEWING: "검토중", IN_PROGRESS: "진행중",
    RESOLVED: "해결", ON_HOLD: "보류", REJECTED: "반려",
  };
  return map[status] ?? status;
}

function getRequestStatusColor(status: string) {
  const map: Record<string, string> = {
    NEW: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    REVIEWING: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
    IN_PROGRESS: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
    RESOLVED: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    ON_HOLD: "bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-300",
    REJECTED: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  };
  return map[status] ?? "";
}

function getRequestCategoryLabel(cat: string) {
  const map: Record<string, string> = {
    DESIGN_CHANGE: "설계변경", MATERIAL_CHANGE: "자재변경",
    ADDITIONAL_WORK: "추가공사", SCHEDULE_CHANGE: "일정변경", OTHER: "기타",
  };
  return map[cat] ?? cat;
}

function ClientRequestsView({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: requests = [] } = useQuery<ClientRequest[]>({ queryKey: [`/api/projects/${projectId}/requests`] });
  const [expandedReq, setExpandedReq] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const canManage = user?.role === "SUPER_ADMIN" || user?.role === "PM";

  const { data: comments } = useQuery<CommentWithAuthor[]>({
    queryKey: [`/api/requests/${expandedReq}/comments`],
    enabled: !!expandedReq,
  });

  const requestMutation = useMutation({
    mutationFn: async (data: any) => { await apiRequest("POST", `/api/projects/${projectId}/requests`, data); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/requests`] }); toast({ title: "요청사항이 등록되었습니다" }); setDialogOpen(false); },
  });

  const commentMutation = useMutation({
    mutationFn: async ({ requestId, content }: { requestId: string; content: string }) => {
      await apiRequest("POST", `/api/requests/${requestId}/comments`, { content });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/requests/${expandedReq}/comments`] }); },
  });

  const updateCommentMutation = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      await apiRequest("PATCH", `/api/comments/${id}`, { content });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/requests/${expandedReq}/comments`] }); toast({ title: "댓글이 수정되었습니다" }); },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/comments/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/requests/${expandedReq}/comments`] }); toast({ title: "댓글이 삭제되었습니다" }); },
  });

  const resolved = requests.filter((r) => r.status === "RESOLVED").length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" /> 요청사항
          <span className="text-sm font-normal text-muted-foreground">{resolved}/{requests.length} 해결</span>
        </CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" />요청 등록</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>요청사항 등록</DialogTitle></DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault(); const fd = new FormData(e.currentTarget);
              requestMutation.mutate({
                title: fd.get("title"), content: fd.get("content"),
                category: fd.get("category"), priority: fd.get("priority"), status: "NEW",
                phase: "CONSTRUCTION",
              });
            }} className="space-y-4">
              <div className="space-y-2"><Label>제목</Label><Input name="title" required /></div>
              <div className="space-y-2"><Label>내용</Label><Textarea name="content" required /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>분류</Label>
                  <select name="category" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" defaultValue="OTHER">
                    <option value="DESIGN_CHANGE">설계변경</option><option value="MATERIAL_CHANGE">자재변경</option>
                    <option value="ADDITIONAL_WORK">추가공사</option><option value="SCHEDULE_CHANGE">일정변경</option><option value="OTHER">기타</option>
                  </select>
                </div>
                <div className="space-y-2"><Label>우선순위</Label>
                  <select name="priority" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" defaultValue="NORMAL">
                    <option value="URGENT">긴급</option><option value="HIGH">높음</option>
                    <option value="NORMAL">보통</option><option value="LOW">낮음</option>
                  </select>
                </div>
              </div>
              <Button type="submit" disabled={requestMutation.isPending} className="w-full">등록</Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {!requests.length ? (
          <p className="text-sm text-muted-foreground text-center py-6">등록된 요청사항이 없습니다</p>
        ) : (
          <div className="space-y-2">
            {requests.map((req) => {
              const attachments: string[] = (req as any).attachments ? JSON.parse((req as any).attachments) : [];
              return (
                <div key={req.id} className="p-3 rounded-lg border">
                  <div className="cursor-pointer" onClick={() => setExpandedReq(expandedReq === req.id ? null : req.id)}>
                    <div className="flex items-center gap-2 flex-wrap">
                      {expandedReq === req.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      <span className="text-sm font-medium">{req.title}</span>
                      <Badge variant="outline" className={getRequestStatusColor(req.status)}>{getRequestStatusLabel(req.status)}</Badge>
                      <Badge variant="outline" className="text-xs">{getRequestCategoryLabel(req.category)}</Badge>
                      {attachments.length > 0 && <span className="text-xs text-muted-foreground"><Camera className="w-3 h-3 inline" /> {attachments.length}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1 ml-6">{req.content}</p>
                  </div>
                  {expandedReq === req.id && (
                    <div className="mt-3 pt-3 border-t space-y-3 ml-6">
                      <p className="text-sm">{req.content}</p>
                      {attachments.length > 0 && <AttachmentPreviewGrid attachments={attachments} />}
                      <div className="space-y-2">
                        <p className="text-sm font-semibold">댓글</p>
                        {comments?.map((c) => (
                          <ClientCommentItem
                            key={c.id}
                            comment={c}
                            canEdit={canManage || c.authorId === user?.id}
                            canDelete={canManage || c.authorId === user?.id}
                            onUpdate={(content) => updateCommentMutation.mutate({ id: c.id, content })}
                            onDelete={() => deleteCommentMutation.mutate(c.id)}
                          />
                        ))}
                        <form onSubmit={(e) => {
                          e.preventDefault(); const fd = new FormData(e.currentTarget);
                          const content = fd.get("comment") as string;
                          if (content) { commentMutation.mutate({ requestId: req.id, content }); e.currentTarget.reset(); }
                        }} className="flex gap-2">
                          <Input name="comment" placeholder="댓글 입력..." className="text-sm" />
                          <Button type="submit" size="sm">등록</Button>
                        </form>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
