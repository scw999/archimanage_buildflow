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
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Calendar, Camera, FileText, MapPin, User, ExternalLink, Download, X, ClipboardList, HardHat, MessageSquare, Plus, ChevronDown, ChevronRight, FolderTree } from "lucide-react";
import type { Project, Schedule, Photo, File as ProjectFile, ConstructionTask, ClientRequest, Comment } from "@shared/schema";

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
            <TabsTrigger value="requests" data-testid="client-tab-requests">요청사항</TabsTrigger>
          </TabsList>

          <TabsContent value="info">
            <Card>
              <CardContent className="pt-6 space-y-3">
                {project.description && <p>{project.description}</p>}
                {project.address && (
                  <p className="flex items-center gap-1.5 text-muted-foreground">
                    <MapPin className="w-4 h-4" />{project.address}
                  </p>
                )}
                {project.clientName && (
                  <p className="flex items-center gap-1.5 text-muted-foreground">
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

          <TabsContent value="requests">
            <ClientRequestsView projectId={project.id} />
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
  const { data: requests = [] } = useQuery<ClientRequest[]>({ queryKey: [`/api/projects/${projectId}/requests`] });
  const [expandedReq, setExpandedReq] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: comments } = useQuery<Comment[]>({
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
                          <div key={c.id} className="p-2 bg-muted/50 rounded text-sm">{c.content}</div>
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
