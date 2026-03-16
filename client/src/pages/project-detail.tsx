import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { AppLayout } from "@/components/app-layout";
import { PhaseProgress, getPhaseLabel, getPhaseColor } from "@/components/phase-progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Plus, Calendar, FileText, Camera,
  MapPin, User, ExternalLink, X,
  Cloud, Users, CheckCircle2, ClipboardList,
  HardHat, AlertTriangle, Search
} from "lucide-react";
import type {
  Project, Schedule, DailyLog, File as ProjectFile, Photo,
  DesignChange, DesignCheck, ConstructionTask, Inspection, Defect,
} from "@shared/schema";

function getCategoryLabel(cat: string) {
  const map: Record<string, string> = {
    MEETING: "회의", DEADLINE: "마감", INSPECTION: "검수", CONSTRUCTION: "시공",
    DRAWING: "도면", STRUCTURAL: "구조", INTERIOR: "인테리어", DOCUMENT: "문서", OTHER: "기타",
  };
  return map[cat] ?? cat;
}

function getScheduleCategoryColor(cat: string) {
  const map: Record<string, string> = {
    MEETING: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    DEADLINE: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    INSPECTION: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
    CONSTRUCTION: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  };
  return map[cat] ?? "bg-muted text-muted-foreground";
}

function getDesignCheckCategoryLabel(cat: string) {
  const map: Record<string, string> = {
    ARCHITECTURE: "건축", STRUCTURE: "구조", MEP: "기계/전기",
    INTERIOR: "인테리어", LANDSCAPE: "조경", PERMIT_DOC: "인허가 서류",
  };
  return map[cat] ?? cat;
}

function getDesignChangeStatusLabel(status: string) {
  const map: Record<string, string> = {
    REQUESTED: "요청", REVIEWING: "검토중", APPROVED: "승인", REJECTED: "반려", APPLIED: "적용완료",
  };
  return map[status] ?? status;
}

function getDesignChangeStatusColor(status: string) {
  const map: Record<string, string> = {
    REQUESTED: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    REVIEWING: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
    APPROVED: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    REJECTED: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    APPLIED: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  };
  return map[status] ?? "";
}

function getTaskStatusLabel(status: string) {
  const map: Record<string, string> = { NOT_STARTED: "미착수", IN_PROGRESS: "진행중", COMPLETED: "완료", DELAYED: "지연" };
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

function getInspectionResultLabel(result: string) {
  const map: Record<string, string> = { PASS: "합격", CONDITIONAL_PASS: "조건부합격", FAIL: "불합격", PENDING: "대기" };
  return map[result] ?? result;
}

function getInspectionResultColor(result: string) {
  const map: Record<string, string> = {
    PASS: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    CONDITIONAL_PASS: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
    FAIL: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    PENDING: "bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-300",
  };
  return map[result] ?? "";
}

function getDefectSeverityLabel(sev: string) {
  const map: Record<string, string> = { CRITICAL: "심각", MAJOR: "중대", MINOR: "경미", COSMETIC: "미관" };
  return map[sev] ?? sev;
}

function getDefectSeverityColor(sev: string) {
  const map: Record<string, string> = {
    CRITICAL: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    MAJOR: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    MINOR: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
    COSMETIC: "bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-300",
  };
  return map[sev] ?? "";
}

function getDefectStatusLabel(status: string) {
  const map: Record<string, string> = { OPEN: "접수", IN_REPAIR: "수리중", REPAIRED: "수리완료", VERIFIED: "확인", CLOSED: "종결" };
  return map[status] ?? status;
}

// Overview Tab
function OverviewTab({ project }: { project: Project }) {
  const { data: designChecks } = useQuery<DesignCheck[]>({ queryKey: [`/api/projects/${project.id}/design-checks`] });
  const { data: constructionTasks } = useQuery<ConstructionTask[]>({ queryKey: [`/api/projects/${project.id}/construction-tasks`] });
  const { data: inspections } = useQuery<Inspection[]>({ queryKey: [`/api/projects/${project.id}/inspections`] });
  const { data: defects } = useQuery<Defect[]>({ queryKey: [`/api/projects/${project.id}/defects`] });

  const designCompleted = designChecks?.filter((c) => c.isCompleted === 1).length ?? 0;
  const designTotal = designChecks?.length ?? 0;
  const designPct = designTotal > 0 ? Math.round((designCompleted / designTotal) * 100) : 0;

  const avgProgress = constructionTasks?.length
    ? Math.round(constructionTasks.reduce((sum, t) => sum + t.progress, 0) / constructionTasks.length)
    : 0;

  const inspCompleted = inspections?.filter((i) => i.result !== "PENDING").length ?? 0;
  const inspTotal = inspections?.length ?? 0;

  const unresolvedDefects = defects?.filter((d) => d.status !== "CLOSED" && d.status !== "VERIFIED").length ?? 0;

  return (
    <div className="space-y-6" data-testid="overview-tab">
      <Card>
        <CardHeader><CardTitle>프로젝트 정보</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {project.description && <p className="text-sm">{project.description}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {project.clientName && (
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">건축주:</span>
                <span>{project.clientName}</span>
              </div>
            )}
            {project.address && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">주소:</span>
                <span>{project.address}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>현재 진행 단계</CardTitle></CardHeader>
        <CardContent>
          <PhaseProgress currentPhase={project.currentPhase} />
        </CardContent>
      </Card>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="overview-stats">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <ClipboardList className="w-6 h-6 mx-auto text-blue-500 mb-1" />
            <p className="text-xs text-muted-foreground">설계 체크리스트</p>
            <p className="text-lg font-bold" data-testid="stat-design">{designPct}% 완료</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <HardHat className="w-6 h-6 mx-auto text-orange-500 mb-1" />
            <p className="text-xs text-muted-foreground">전체 공정률</p>
            <p className="text-lg font-bold" data-testid="stat-construction">{avgProgress}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <Search className="w-6 h-6 mx-auto text-purple-500 mb-1" />
            <p className="text-xs text-muted-foreground">검수 현황</p>
            <p className="text-lg font-bold" data-testid="stat-inspection">{inspCompleted}/{inspTotal} 완료</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <AlertTriangle className="w-6 h-6 mx-auto text-red-500 mb-1" />
            <p className="text-xs text-muted-foreground">하자 현황</p>
            <p className="text-lg font-bold" data-testid="stat-defect">미해결 {unresolvedDefects}건</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Design Tab (설계 탭)
function DesignTab({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const [checkDialogOpen, setCheckDialogOpen] = useState(false);
  const [changeDialogOpen, setChangeDialogOpen] = useState(false);
  const [selectedChange, setSelectedChange] = useState<DesignChange | null>(null);

  const { data: designChecks } = useQuery<DesignCheck[]>({ queryKey: [`/api/projects/${projectId}/design-checks`] });
  const { data: designChanges } = useQuery<DesignChange[]>({ queryKey: [`/api/projects/${projectId}/design-changes`] });
  const { data: files } = useQuery<ProjectFile[]>({ queryKey: [`/api/projects/${projectId}/files`] });

  const drawingFiles = files?.filter((f) => f.category === "DRAWING") ?? [];

  const checkMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", `/api/projects/${projectId}/design-checks`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/design-checks`] });
      toast({ title: "체크리스트 항목이 추가되었습니다" });
      setCheckDialogOpen(false);
    },
  });

  const toggleCheckMutation = useMutation({
    mutationFn: async ({ id, isCompleted }: { id: string; isCompleted: number }) => {
      await apiRequest("PATCH", `/api/design-checks/${id}`, {
        isCompleted,
        completedAt: isCompleted ? new Date().toISOString() : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/design-checks`] });
    },
  });

  const changeMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", `/api/projects/${projectId}/design-changes`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/design-changes`] });
      toast({ title: "설계변경이 등록되었습니다" });
      setChangeDialogOpen(false);
    },
  });

  const changeStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/design-changes/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/design-changes`] });
      toast({ title: "상태가 변경되었습니다" });
    },
  });

  const completedCount = designChecks?.filter((c) => c.isCompleted === 1).length ?? 0;
  const totalCount = designChecks?.length ?? 0;

  // Group checks by category
  const categories = ["ARCHITECTURE", "STRUCTURE", "MEP", "INTERIOR", "LANDSCAPE", "PERMIT_DOC"];
  const grouped: Record<string, DesignCheck[]> = {};
  categories.forEach((cat) => {
    const items = designChecks?.filter((c) => c.category === cat) ?? [];
    if (items.length > 0) grouped[cat] = items;
  });

  return (
    <div className="space-y-6" data-testid="design-tab">
      {/* A. 설계 체크리스트 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" /> 설계 체크리스트 ({completedCount}/{totalCount} 완료)
          </CardTitle>
          <Dialog open={checkDialogOpen} onOpenChange={setCheckDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="add-check-button"><Plus className="w-4 h-4 mr-1" />추가</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>체크리스트 항목 추가</DialogTitle></DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  checkMutation.mutate({
                    category: fd.get("category"),
                    title: fd.get("title"),
                    memo: fd.get("memo") || null,
                  });
                }}
                className="space-y-4"
                data-testid="check-form"
              >
                <div className="space-y-2">
                  <Label>카테고리</Label>
                  <select name="category" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" defaultValue="ARCHITECTURE" data-testid="check-category-select">
                    <option value="ARCHITECTURE">건축</option>
                    <option value="STRUCTURE">구조</option>
                    <option value="MEP">기계/전기</option>
                    <option value="INTERIOR">인테리어</option>
                    <option value="LANDSCAPE">조경</option>
                    <option value="PERMIT_DOC">인허가 서류</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="chk-title">항목명</Label>
                  <Input id="chk-title" name="title" required data-testid="check-title-input" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="chk-memo">메모</Label>
                  <Textarea id="chk-memo" name="memo" data-testid="check-memo-input" />
                </div>
                <Button type="submit" disabled={checkMutation.isPending} data-testid="check-submit">추가</Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {totalCount === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">체크리스트 항목이 없습니다</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(grouped).map(([cat, items]) => (
                <div key={cat}>
                  <h4 className="text-sm font-semibold text-muted-foreground mb-2">{getDesignCheckCategoryLabel(cat)}</h4>
                  <div className="space-y-1">
                    {items.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50" data-testid={`check-${item.id}`}>
                        <input
                          type="checkbox"
                          checked={item.isCompleted === 1}
                          onChange={() => toggleCheckMutation.mutate({ id: item.id, isCompleted: item.isCompleted === 1 ? 0 : 1 })}
                          className="w-4 h-4 rounded border-gray-300"
                          data-testid={`check-toggle-${item.id}`}
                        />
                        <span className={`text-sm flex-1 ${item.isCompleted === 1 ? "line-through text-muted-foreground" : ""}`}>{item.title}</span>
                        {item.memo && <span className="text-xs text-muted-foreground">{item.memo}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* B. 설계변경 이력 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>설계변경 이력</CardTitle>
          <Dialog open={changeDialogOpen} onOpenChange={setChangeDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="add-change-button"><Plus className="w-4 h-4 mr-1" />설계변경 등록</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>설계변경 등록</DialogTitle></DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  changeMutation.mutate({
                    title: fd.get("title"),
                    description: fd.get("description"),
                    reason: fd.get("reason") || null,
                    impactArea: fd.get("impactArea") || null,
                    status: "REQUESTED",
                  });
                }}
                className="space-y-4"
                data-testid="change-form"
              >
                <div className="space-y-2">
                  <Label htmlFor="dc-title">제목</Label>
                  <Input id="dc-title" name="title" required data-testid="change-title-input" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dc-desc">설명</Label>
                  <Textarea id="dc-desc" name="description" required data-testid="change-desc-input" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dc-reason">변경 사유</Label>
                  <Input id="dc-reason" name="reason" data-testid="change-reason-input" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dc-area">영향 범위</Label>
                  <Input id="dc-area" name="impactArea" placeholder="예: 1층 거실, 외부 마감" data-testid="change-area-input" />
                </div>
                <Button type="submit" disabled={changeMutation.isPending} data-testid="change-submit">등록</Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {!designChanges?.length ? (
            <p className="text-sm text-muted-foreground text-center py-4">설계변경 이력이 없습니다</p>
          ) : (
            <div className="space-y-3">
              {designChanges.map((dc) => (
                <div
                  key={dc.id}
                  className="p-3 rounded-lg border cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => setSelectedChange(dc)}
                  data-testid={`change-${dc.id}`}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{dc.title}</span>
                    <Badge variant="outline" className={getDesignChangeStatusColor(dc.status)}>
                      {getDesignChangeStatusLabel(dc.status)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{dc.description}</p>
                  {dc.impactArea && <p className="text-xs text-muted-foreground mt-0.5">영향 범위: {dc.impactArea}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Design Change Detail Dialog */}
      {selectedChange && (
        <Dialog open onOpenChange={() => setSelectedChange(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>{selectedChange.title}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Badge variant="outline" className={getDesignChangeStatusColor(selectedChange.status)}>
                {getDesignChangeStatusLabel(selectedChange.status)}
              </Badge>
              <p className="text-sm">{selectedChange.description}</p>
              {selectedChange.reason && <p className="text-sm"><strong>사유:</strong> {selectedChange.reason}</p>}
              {selectedChange.impactArea && <p className="text-sm"><strong>영향 범위:</strong> {selectedChange.impactArea}</p>}
              <div className="flex items-center gap-2">
                <Label className="text-xs">상태 변경:</Label>
                <select
                  value={selectedChange.status}
                  onChange={(e) => {
                    changeStatusMutation.mutate({ id: selectedChange.id, status: e.target.value });
                    setSelectedChange({ ...selectedChange, status: e.target.value as any });
                  }}
                  className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                  data-testid="change-status-select"
                >
                  <option value="REQUESTED">요청</option>
                  <option value="REVIEWING">검토중</option>
                  <option value="APPROVED">승인</option>
                  <option value="REJECTED">반려</option>
                  <option value="APPLIED">적용완료</option>
                </select>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* C. 도면 관리 */}
      <Card>
        <CardHeader><CardTitle>도면 관리</CardTitle></CardHeader>
        <CardContent>
          {!drawingFiles.length ? (
            <p className="text-sm text-muted-foreground text-center py-4">등록된 도면이 없습니다</p>
          ) : (
            <div className="space-y-2">
              {drawingFiles.map((f) => (
                <div key={f.id} className="flex items-center gap-3 p-3 rounded-lg border" data-testid={`drawing-${f.id}`}>
                  <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{f.title}</span>
                      {f.version && <Badge variant="default" className="text-xs">{f.version}</Badge>}
                    </div>
                    {f.description && <p className="text-xs text-muted-foreground mt-0.5">{f.description}</p>}
                  </div>
                  <a href={f.url} target="_blank" rel="noopener noreferrer" className="shrink-0" data-testid={`drawing-link-${f.id}`}>
                    <Button variant="ghost" size="icon" className="h-8 w-8"><ExternalLink className="w-4 h-4" /></Button>
                  </a>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Construction Tab (시공 탭)
function ConstructionTab({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [inspDialogOpen, setInspDialogOpen] = useState(false);
  const [defectDialogOpen, setDefectDialogOpen] = useState(false);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [expandedInsp, setExpandedInsp] = useState<string | null>(null);
  const [expandedDefect, setExpandedDefect] = useState<string | null>(null);

  const { data: tasks } = useQuery<ConstructionTask[]>({ queryKey: [`/api/projects/${projectId}/construction-tasks`] });
  const { data: inspections } = useQuery<Inspection[]>({ queryKey: [`/api/projects/${projectId}/inspections`] });
  const { data: defects } = useQuery<Defect[]>({ queryKey: [`/api/projects/${projectId}/defects`] });

  const avgProgress = tasks?.length
    ? Math.round(tasks.reduce((sum, t) => sum + t.progress, 0) / tasks.length)
    : 0;

  const statusCounts = {
    NOT_STARTED: tasks?.filter((t) => t.status === "NOT_STARTED").length ?? 0,
    IN_PROGRESS: tasks?.filter((t) => t.status === "IN_PROGRESS").length ?? 0,
    COMPLETED: tasks?.filter((t) => t.status === "COMPLETED").length ?? 0,
    DELAYED: tasks?.filter((t) => t.status === "DELAYED").length ?? 0,
  };

  const taskMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", `/api/projects/${projectId}/construction-tasks`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/construction-tasks`] });
      toast({ title: "공정이 추가되었습니다" });
      setTaskDialogOpen(false);
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      await apiRequest("PATCH", `/api/construction-tasks/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/construction-tasks`] });
    },
  });

  const inspMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", `/api/projects/${projectId}/inspections`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/inspections`] });
      toast({ title: "검수가 추가되었습니다" });
      setInspDialogOpen(false);
    },
  });

  const updateInspMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      await apiRequest("PATCH", `/api/inspections/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/inspections`] });
      toast({ title: "검수 정보가 수정되었습니다" });
    },
  });

  const defectMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", `/api/projects/${projectId}/defects`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/defects`] });
      toast({ title: "하자가 등록되었습니다" });
      setDefectDialogOpen(false);
    },
  });

  const updateDefectMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      await apiRequest("PATCH", `/api/defects/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/defects`] });
    },
  });

  const sortedTasks = tasks ? [...tasks].sort((a, b) => a.sortOrder - b.sortOrder) : [];

  return (
    <div className="space-y-6" data-testid="construction-tab">
      {/* A. 전체 공정률 */}
      <Card>
        <CardHeader><CardTitle>전체 공정률: {avgProgress}%</CardTitle></CardHeader>
        <CardContent>
          <div className="w-full bg-muted rounded-full h-4 mb-3" data-testid="overall-progress-bar">
            <div className="bg-primary h-4 rounded-full transition-all" style={{ width: `${avgProgress}%` }} />
          </div>
          <div className="flex gap-4 text-xs text-muted-foreground flex-wrap">
            <span>미착수 {statusCounts.NOT_STARTED}</span>
            <span>진행중 {statusCounts.IN_PROGRESS}</span>
            <span>완료 {statusCounts.COMPLETED}</span>
            <span>지연 {statusCounts.DELAYED}</span>
          </div>
        </CardContent>
      </Card>

      {/* B. 공정 목록 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><HardHat className="w-5 h-5" /> 공정 목록</CardTitle>
          <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="add-task-button"><Plus className="w-4 h-4 mr-1" />공정 추가</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>공정 추가</DialogTitle></DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  taskMutation.mutate({
                    title: fd.get("title"),
                    description: fd.get("description") || null,
                    category: fd.get("category"),
                    status: "NOT_STARTED",
                    progress: 0,
                    startDate: fd.get("startDate") || null,
                    endDate: fd.get("endDate") || null,
                    assignee: fd.get("assignee") || null,
                    sortOrder: (tasks?.length ?? 0) + 1,
                  });
                }}
                className="space-y-4"
                data-testid="task-form"
              >
                <div className="space-y-2">
                  <Label htmlFor="ct-title">공정명</Label>
                  <Input id="ct-title" name="title" required data-testid="task-title-input" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ct-desc">설명</Label>
                  <Textarea id="ct-desc" name="description" data-testid="task-desc-input" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ct-cat">공종</Label>
                  <Input id="ct-cat" name="category" required placeholder="예: 기초, 골조, 마감" data-testid="task-category-input" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ct-start">시작일</Label>
                    <Input id="ct-start" name="startDate" type="date" data-testid="task-start-input" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ct-end">종료일</Label>
                    <Input id="ct-end" name="endDate" type="date" data-testid="task-end-input" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ct-assignee">담당</Label>
                  <Input id="ct-assignee" name="assignee" data-testid="task-assignee-input" />
                </div>
                <Button type="submit" disabled={taskMutation.isPending} data-testid="task-submit">추가</Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {!sortedTasks.length ? (
            <p className="text-sm text-muted-foreground text-center py-4">등록된 공정이 없습니다</p>
          ) : (
            <div className="space-y-3">
              {sortedTasks.map((task) => (
                <div key={task.id} className="p-3 rounded-lg border" data-testid={`task-${task.id}`}>
                  <div
                    className="cursor-pointer"
                    onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
                  >
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className="text-sm font-medium">{task.title}</span>
                      <Badge variant="outline" className="text-xs">{task.category}</Badge>
                      <Badge variant="outline" className={getTaskStatusColor(task.status)}>
                        {getTaskStatusLabel(task.status)}
                      </Badge>
                      {task.assignee && <span className="text-xs text-muted-foreground">{task.assignee}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-muted rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${task.status === "DELAYED" ? "bg-red-500" : "bg-primary"}`}
                          style={{ width: `${task.progress}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium w-10 text-right">{task.progress}%</span>
                    </div>
                    {(task.startDate || task.endDate) && (
                      <p className="text-xs text-muted-foreground mt-1">{task.startDate} ~ {task.endDate}</p>
                    )}
                  </div>

                  {/* Expanded edit area */}
                  {expandedTask === task.id && (
                    <div className="mt-3 pt-3 border-t space-y-3" data-testid={`task-edit-${task.id}`}>
                      <div className="space-y-1">
                        <Label className="text-xs">진행률: {task.progress}%</Label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={task.progress}
                          onChange={(e) => {
                            const progress = parseInt(e.target.value);
                            updateTaskMutation.mutate({ id: task.id, data: { progress } });
                          }}
                          className="w-full"
                          data-testid={`task-progress-${task.id}`}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs">상태:</Label>
                        <select
                          value={task.status}
                          onChange={(e) => updateTaskMutation.mutate({ id: task.id, data: { status: e.target.value } })}
                          className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                          data-testid={`task-status-${task.id}`}
                        >
                          <option value="NOT_STARTED">미착수</option>
                          <option value="IN_PROGRESS">진행중</option>
                          <option value="COMPLETED">완료</option>
                          <option value="DELAYED">지연</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* C. 검수 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><Search className="w-5 h-5" /> 검수</CardTitle>
          <Dialog open={inspDialogOpen} onOpenChange={setInspDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="add-inspection-button"><Plus className="w-4 h-4 mr-1" />검수 추가</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>검수 추가</DialogTitle></DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  inspMutation.mutate({
                    title: fd.get("title"),
                    category: fd.get("category"),
                    scheduledDate: fd.get("scheduledDate") || null,
                    inspector: fd.get("inspector") || null,
                    result: "PENDING",
                  });
                }}
                className="space-y-4"
                data-testid="inspection-form"
              >
                <div className="space-y-2">
                  <Label htmlFor="insp-title">검수명</Label>
                  <Input id="insp-title" name="title" required data-testid="inspection-title-input" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="insp-cat">분류</Label>
                  <Input id="insp-cat" name="category" required placeholder="예: 구조검사, 방수검사" data-testid="inspection-category-input" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="insp-date">예정일</Label>
                  <Input id="insp-date" name="scheduledDate" type="date" data-testid="inspection-date-input" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="insp-inspector">검사자</Label>
                  <Input id="insp-inspector" name="inspector" data-testid="inspection-inspector-input" />
                </div>
                <Button type="submit" disabled={inspMutation.isPending} data-testid="inspection-submit">추가</Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {!inspections?.length ? (
            <p className="text-sm text-muted-foreground text-center py-4">등록된 검수가 없습니다</p>
          ) : (
            <div className="space-y-3">
              {inspections.map((insp) => (
                <div key={insp.id} className="p-3 rounded-lg border" data-testid={`inspection-${insp.id}`}>
                  <div
                    className="cursor-pointer"
                    onClick={() => setExpandedInsp(expandedInsp === insp.id ? null : insp.id)}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{insp.title}</span>
                      <Badge variant="outline" className="text-xs">{insp.category}</Badge>
                      <Badge variant="outline" className={getInspectionResultColor(insp.result)}>
                        {getInspectionResultLabel(insp.result)}
                      </Badge>
                    </div>
                    <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                      {insp.scheduledDate && <span>예정: {insp.scheduledDate}</span>}
                      {insp.completedDate && <span>완료: {insp.completedDate}</span>}
                      {insp.inspector && <span>검사자: {insp.inspector}</span>}
                    </div>
                    {insp.findings && <p className="text-xs mt-1 line-clamp-1">{insp.findings}</p>}
                  </div>

                  {expandedInsp === insp.id && (
                    <div className="mt-3 pt-3 border-t space-y-3" data-testid={`inspection-edit-${insp.id}`}>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs">결과:</Label>
                        <select
                          value={insp.result}
                          onChange={(e) => updateInspMutation.mutate({ id: insp.id, data: { result: e.target.value } })}
                          className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                          data-testid={`inspection-result-${insp.id}`}
                        >
                          <option value="PENDING">대기</option>
                          <option value="PASS">합격</option>
                          <option value="CONDITIONAL_PASS">조건부합격</option>
                          <option value="FAIL">불합격</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">완료일</Label>
                        <Input
                          type="date"
                          defaultValue={insp.completedDate || ""}
                          onChange={(e) => updateInspMutation.mutate({ id: insp.id, data: { completedDate: e.target.value || null } })}
                          className="h-8 text-xs"
                          data-testid={`inspection-completed-${insp.id}`}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">검사 소견</Label>
                        <Textarea
                          defaultValue={insp.findings || ""}
                          onBlur={(e) => updateInspMutation.mutate({ id: insp.id, data: { findings: e.target.value || null } })}
                          className="text-xs min-h-[60px]"
                          data-testid={`inspection-findings-${insp.id}`}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* D. 하자 관리 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5" /> 하자 관리</CardTitle>
          <Dialog open={defectDialogOpen} onOpenChange={setDefectDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="add-defect-button"><Plus className="w-4 h-4 mr-1" />하자 등록</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>하자 등록</DialogTitle></DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  defectMutation.mutate({
                    title: fd.get("title"),
                    description: fd.get("description"),
                    location: fd.get("location"),
                    severity: fd.get("severity"),
                    status: "OPEN",
                  });
                }}
                className="space-y-4"
                data-testid="defect-form"
              >
                <div className="space-y-2">
                  <Label htmlFor="def-title">제목</Label>
                  <Input id="def-title" name="title" required data-testid="defect-title-input" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="def-desc">설명</Label>
                  <Textarea id="def-desc" name="description" required data-testid="defect-desc-input" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="def-loc">위치</Label>
                  <Input id="def-loc" name="location" required placeholder="예: 1층 거실 남측 벽면" data-testid="defect-location-input" />
                </div>
                <div className="space-y-2">
                  <Label>심각도</Label>
                  <select name="severity" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" defaultValue="MINOR" data-testid="defect-severity-select">
                    <option value="CRITICAL">심각</option>
                    <option value="MAJOR">중대</option>
                    <option value="MINOR">경미</option>
                    <option value="COSMETIC">미관</option>
                  </select>
                </div>
                <Button type="submit" disabled={defectMutation.isPending} data-testid="defect-submit">등록</Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {!defects?.length ? (
            <p className="text-sm text-muted-foreground text-center py-4">등록된 하자가 없습니다</p>
          ) : (
            <div className="space-y-3">
              {defects.map((defect) => (
                <div key={defect.id} className="p-3 rounded-lg border" data-testid={`defect-${defect.id}`}>
                  <div
                    className="cursor-pointer"
                    onClick={() => setExpandedDefect(expandedDefect === defect.id ? null : defect.id)}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{defect.title}</span>
                      <Badge variant="outline" className={getDefectSeverityColor(defect.severity)}>
                        {getDefectSeverityLabel(defect.severity)}
                      </Badge>
                      <Badge variant="outline">{getDefectStatusLabel(defect.status)}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">위치: {defect.location}</p>
                    {defect.assignee && <p className="text-xs text-muted-foreground">담당: {defect.assignee}</p>}
                  </div>

                  {expandedDefect === defect.id && (
                    <div className="mt-3 pt-3 border-t space-y-3" data-testid={`defect-edit-${defect.id}`}>
                      <p className="text-sm">{defect.description}</p>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs">상태:</Label>
                        <select
                          value={defect.status}
                          onChange={(e) => updateDefectMutation.mutate({ id: defect.id, data: { status: e.target.value } })}
                          className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                          data-testid={`defect-status-${defect.id}`}
                        >
                          <option value="OPEN">접수</option>
                          <option value="IN_REPAIR">수리중</option>
                          <option value="REPAIRED">수리완료</option>
                          <option value="VERIFIED">확인</option>
                          <option value="CLOSED">종결</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">담당자</Label>
                        <Input
                          defaultValue={defect.assignee || ""}
                          onBlur={(e) => updateDefectMutation.mutate({ id: defect.id, data: { assignee: e.target.value || null } })}
                          className="h-8 text-xs"
                          data-testid={`defect-assignee-${defect.id}`}
                        />
                      </div>
                    </div>
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

// Schedule Tab
function ScheduleTab({ projectId, currentPhase }: { projectId: string; currentPhase: string }) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [logDialogOpen, setLogDialogOpen] = useState(false);

  const { data: schedules } = useQuery<Schedule[]>({ queryKey: [`/api/projects/${projectId}/schedules`] });
  const { data: dailyLogs } = useQuery<DailyLog[]>({ queryKey: [`/api/projects/${projectId}/daily-logs`] });

  const scheduleMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", `/api/projects/${projectId}/schedules`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/schedules`] });
      toast({ title: "일정이 추가되었습니다" });
      setDialogOpen(false);
    },
  });

  const logMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", `/api/projects/${projectId}/daily-logs`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/daily-logs`] });
      toast({ title: "작업일지가 추가되었습니다" });
      setLogDialogOpen(false);
    },
  });

  return (
    <div className="space-y-6" data-testid="schedule-tab">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" /> 일정
          </CardTitle>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="add-schedule-button"><Plus className="w-4 h-4 mr-1" />추가</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>일정 추가</DialogTitle></DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  scheduleMutation.mutate({
                    phase: currentPhase,
                    title: fd.get("title"),
                    date: fd.get("date"),
                    category: fd.get("category"),
                    memo: fd.get("memo") || null,
                  });
                }}
                className="space-y-4"
                data-testid="schedule-form"
              >
                <div className="space-y-2">
                  <Label htmlFor="s-title">제목</Label>
                  <Input id="s-title" name="title" required data-testid="schedule-title-input" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="s-date">날짜</Label>
                  <Input id="s-date" name="date" type="date" required data-testid="schedule-date-input" />
                </div>
                <div className="space-y-2">
                  <Label>카테고리</Label>
                  <select name="category" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" defaultValue="MEETING" data-testid="schedule-category-select">
                    <option value="MEETING">회의</option>
                    <option value="DEADLINE">마감</option>
                    <option value="INSPECTION">검수</option>
                    <option value="CONSTRUCTION">시공</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="s-memo">메모</Label>
                  <Textarea id="s-memo" name="memo" data-testid="schedule-memo-input" />
                </div>
                <Button type="submit" disabled={scheduleMutation.isPending} data-testid="schedule-submit">저장</Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {!schedules?.length ? (
            <p className="text-sm text-muted-foreground text-center py-6">등록된 일정이 없습니다</p>
          ) : (
            <div className="space-y-2">
              {schedules.sort((a, b) => a.date.localeCompare(b.date)).map((s) => (
                <div key={s.id} className="flex items-start gap-3 p-3 rounded-lg border" data-testid={`schedule-${s.id}`}>
                  <div className="text-sm text-muted-foreground whitespace-nowrap">{s.date}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{s.title}</span>
                      <Badge variant="outline" className={getScheduleCategoryColor(s.category)}>
                        {getCategoryLabel(s.category)}
                      </Badge>
                    </div>
                    {s.memo && <p className="text-xs text-muted-foreground mt-1">{s.memo}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>작업일지</CardTitle>
          <Dialog open={logDialogOpen} onOpenChange={setLogDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="add-log-button"><Plus className="w-4 h-4 mr-1" />추가</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>작업일지 작성</DialogTitle></DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  logMutation.mutate({
                    phase: currentPhase,
                    date: fd.get("date"),
                    content: fd.get("content"),
                    weather: fd.get("weather") || null,
                    workers: fd.get("workers") ? parseInt(fd.get("workers") as string) : null,
                  });
                }}
                className="space-y-4"
                data-testid="log-form"
              >
                <div className="space-y-2">
                  <Label htmlFor="l-date">날짜</Label>
                  <Input id="l-date" name="date" type="date" required data-testid="log-date-input" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="l-content">내용</Label>
                  <Textarea id="l-content" name="content" required data-testid="log-content-input" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="l-weather">날씨</Label>
                    <Input id="l-weather" name="weather" placeholder="맑음" data-testid="log-weather-input" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="l-workers">작업인원</Label>
                    <Input id="l-workers" name="workers" type="number" data-testid="log-workers-input" />
                  </div>
                </div>
                <Button type="submit" disabled={logMutation.isPending} data-testid="log-submit">저장</Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {!dailyLogs?.length ? (
            <p className="text-sm text-muted-foreground text-center py-6">작성된 작업일지가 없습니다</p>
          ) : (
            <div className="space-y-3">
              {dailyLogs.sort((a, b) => b.date.localeCompare(a.date)).map((log) => (
                <div key={log.id} className="p-3 rounded-lg border" data-testid={`log-${log.id}`}>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm font-medium">{log.date}</span>
                    {log.weather && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Cloud className="w-3 h-3" />{log.weather}
                      </span>
                    )}
                    {log.workers != null && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Users className="w-3 h-3" />{log.workers}명
                      </span>
                    )}
                  </div>
                  <p className="text-sm">{log.content}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Files Tab
function FilesTab({ projectId, currentPhase }: { projectId: string; currentPhase: string }) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: files } = useQuery<ProjectFile[]>({ queryKey: [`/api/projects/${projectId}/files`] });

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", `/api/projects/${projectId}/files`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/files`] });
      toast({ title: "파일이 추가되었습니다" });
      setDialogOpen(false);
    },
  });

  return (
    <div className="space-y-4" data-testid="files-tab">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="w-5 h-5" /> 파일 목록
        </h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="add-file-button"><Plus className="w-4 h-4 mr-1" />추가</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>파일 추가</DialogTitle></DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                mutation.mutate({
                  phase: currentPhase,
                  title: fd.get("title"),
                  url: fd.get("url"),
                  category: fd.get("category"),
                  version: fd.get("version") || null,
                  description: fd.get("description") || null,
                });
              }}
              className="space-y-4"
              data-testid="file-form"
            >
              <div className="space-y-2">
                <Label htmlFor="f-title">제목</Label>
                <Input id="f-title" name="title" required data-testid="file-title-input" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="f-url">Google Drive URL</Label>
                <Input id="f-url" name="url" type="url" required data-testid="file-url-input" />
              </div>
              <div className="space-y-2">
                <Label>카테고리</Label>
                <select name="category" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" defaultValue="DOCUMENT" data-testid="file-category-select">
                  <option value="DRAWING">도면</option>
                  <option value="STRUCTURAL">구조</option>
                  <option value="INTERIOR">인테리어</option>
                  <option value="DOCUMENT">문서</option>
                  <option value="OTHER">기타</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="f-version">버전</Label>
                <Input id="f-version" name="version" placeholder="v1.0" data-testid="file-version-input" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="f-desc">설명</Label>
                <Textarea id="f-desc" name="description" data-testid="file-desc-input" />
              </div>
              <Button type="submit" disabled={mutation.isPending} data-testid="file-submit">저장</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      {!files?.length ? (
        <p className="text-sm text-muted-foreground text-center py-8">등록된 파일이 없습니다</p>
      ) : (
        <div className="space-y-2">
          {files.map((f) => (
            <Card key={f.id} data-testid={`file-${f.id}`}>
              <CardContent className="py-3 flex items-center gap-3">
                <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{f.title}</span>
                    <Badge variant="outline" className="text-xs">{getCategoryLabel(f.category)}</Badge>
                    {f.version && <span className="text-xs text-muted-foreground">{f.version}</span>}
                  </div>
                  {f.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{f.description}</p>}
                </div>
                <a href={f.url} target="_blank" rel="noopener noreferrer" className="shrink-0" data-testid={`file-link-${f.id}`}>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// Photos Tab
function PhotosTab({ projectId, currentPhase }: { projectId: string; currentPhase: string }) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [lightbox, setLightbox] = useState<Photo | null>(null);
  const { data: photos } = useQuery<Photo[]>({ queryKey: [`/api/projects/${projectId}/photos`] });

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", `/api/projects/${projectId}/photos`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/photos`] });
      toast({ title: "사진이 추가되었습니다" });
      setDialogOpen(false);
    },
  });

  return (
    <div className="space-y-4" data-testid="photos-tab">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Camera className="w-5 h-5" /> 사진
        </h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="add-photo-button"><Plus className="w-4 h-4 mr-1" />추가</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>사진 추가</DialogTitle></DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                mutation.mutate({
                  phase: currentPhase,
                  imageUrl: fd.get("imageUrl"),
                  thumbnailUrl: fd.get("imageUrl"),
                  description: fd.get("description") || null,
                  tags: fd.get("tags") || null,
                  takenAt: fd.get("takenAt") || null,
                });
              }}
              className="space-y-4"
              data-testid="photo-form"
            >
              <div className="space-y-2">
                <Label htmlFor="p-url">이미지 URL</Label>
                <Input id="p-url" name="imageUrl" type="url" required data-testid="photo-url-input" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-desc">설명</Label>
                <Input id="p-desc" name="description" data-testid="photo-desc-input" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-tags">태그 (쉼표 구분)</Label>
                <Input id="p-tags" name="tags" placeholder="기초,공사" data-testid="photo-tags-input" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-date">촬영일</Label>
                <Input id="p-date" name="takenAt" type="date" data-testid="photo-date-input" />
              </div>
              <Button type="submit" disabled={mutation.isPending} data-testid="photo-submit">저장</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      {!photos?.length ? (
        <p className="text-sm text-muted-foreground text-center py-8">등록된 사진이 없습니다</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {photos.map((p) => (
            <div
              key={p.id}
              className="aspect-square rounded-lg overflow-hidden border cursor-pointer hover:opacity-80 transition-opacity relative group"
              onClick={() => setLightbox(p)}
              data-testid={`photo-${p.id}`}
            >
              <img src={p.imageUrl} alt={p.description || ""} className="w-full h-full object-cover" />
              {p.description && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {p.description}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <div className="relative max-w-4xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="absolute -top-10 right-0 text-white hover:text-white/80"
              onClick={() => setLightbox(null)}
              data-testid="lightbox-close"
            >
              <X className="w-6 h-6" />
            </Button>
            <img src={lightbox.imageUrl} alt={lightbox.description || ""} className="max-w-full max-h-[80vh] object-contain rounded-lg" />
            {lightbox.description && (
              <p className="text-white text-sm text-center mt-3">{lightbox.description}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Main ProjectDetail page
export default function ProjectDetail() {
  const [, params] = useRoute("/projects/:id");
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
      <div className="space-y-6" data-testid="project-detail">
        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className={getPhaseColor(project.currentPhase)}>
              {getPhaseLabel(project.currentPhase)}
            </Badge>
            <Badge variant={project.status === "ACTIVE" ? "default" : "secondary"}>
              {project.status === "ACTIVE" ? "진행중" : project.status === "COMPLETED" ? "완료" : "보류"}
            </Badge>
          </div>
        </div>

        <Tabs defaultValue="overview" data-testid="project-tabs">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="overview" data-testid="tab-overview">개요</TabsTrigger>
            <TabsTrigger value="design" data-testid="tab-design">설계</TabsTrigger>
            <TabsTrigger value="construction" data-testid="tab-construction">시공</TabsTrigger>
            <TabsTrigger value="schedule" data-testid="tab-schedule">일정</TabsTrigger>
            <TabsTrigger value="files" data-testid="tab-files">파일</TabsTrigger>
            <TabsTrigger value="photos" data-testid="tab-photos">사진</TabsTrigger>
          </TabsList>
          <TabsContent value="overview"><OverviewTab project={project} /></TabsContent>
          <TabsContent value="design"><DesignTab projectId={project.id} /></TabsContent>
          <TabsContent value="construction"><ConstructionTab projectId={project.id} /></TabsContent>
          <TabsContent value="schedule"><ScheduleTab projectId={project.id} currentPhase={project.currentPhase} /></TabsContent>
          <TabsContent value="files"><FilesTab projectId={project.id} currentPhase={project.currentPhase} /></TabsContent>
          <TabsContent value="photos"><PhotosTab projectId={project.id} currentPhase={project.currentPhase} /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
