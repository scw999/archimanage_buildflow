import { useState, useEffect, useCallback } from "react";
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
import { DateInput } from "@/components/date-input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Plus, Calendar, FileText, Camera,
  MapPin, User, ExternalLink, X,
  Cloud, Users, CheckCircle2, ClipboardList,
  HardHat, AlertTriangle, Search, MessageSquare,
  FolderTree, ChevronDown, ChevronRight, Building2, Ruler, Layers, Trash2,
  ArrowUp, ArrowDown, Pencil
} from "lucide-react";
import type {
  Project, Schedule, DailyLog, File as ProjectFile, Photo,
  DesignChange, DesignCheck, ConstructionTask, Inspection, Defect,
  ClientRequest, Comment,
} from "@shared/schema";

// ─── Preset Data ─────────────────────────────────────────────
const CONSTRUCTION_CATEGORIES = [
  { value: "가설공사", label: "가설공사" },
  { value: "토공사", label: "토공사" },
  { value: "기초공사", label: "기초공사" },
  { value: "철근콘크리트공사", label: "철근콘크리트공사" },
  { value: "철골공사", label: "철골공사" },
  { value: "조적공사", label: "조적공사" },
  { value: "방수공사", label: "방수공사" },
  { value: "석공사", label: "석공사" },
  { value: "타일공사", label: "타일공사" },
  { value: "목공사", label: "목공사" },
  { value: "금속공사", label: "금속공사" },
  { value: "창호공사", label: "창호공사 (유리 포함)" },
  { value: "도장공사", label: "도장공사" },
  { value: "수장공사", label: "수장공사 (도배/바닥재)" },
  { value: "단열공사", label: "단열공사" },
  { value: "지붕공사", label: "지붕공사" },
  { value: "전기공사", label: "전기공사" },
  { value: "설비공사", label: "설비공사 (급배수/난방)" },
  { value: "소방공사", label: "소방공사" },
  { value: "통신공사", label: "통신공사" },
  { value: "승강기공사", label: "승강기공사" },
  { value: "조경공사", label: "조경공사" },
  { value: "외부마감", label: "외부마감" },
  { value: "준공청소", label: "준공청소" },
  { value: "기타", label: "기타" },
];

const SCHEDULE_PRESETS = [
  { title: "건축주 미팅", category: "MEETING" },
  { title: "설계 검토 회의", category: "MEETING" },
  { title: "시공사 미팅", category: "MEETING" },
  { title: "중간 설계 보고", category: "MEETING" },
  { title: "최종 설계 보고", category: "MEETING" },
  { title: "인허가 서류 제출 마감", category: "DEADLINE" },
  { title: "건축허가 신청", category: "DEADLINE" },
  { title: "착공신고", category: "DEADLINE" },
  { title: "사용승인 신청", category: "DEADLINE" },
  { title: "콘센트/스위치 위치 확인", category: "INSPECTION" },
  { title: "조명 위치 확인", category: "INSPECTION" },
  { title: "타일 시공 검수", category: "INSPECTION" },
  { title: "방수 검사", category: "INSPECTION" },
  { title: "구조 안전 검사", category: "INSPECTION" },
  { title: "전기 안전 검사", category: "INSPECTION" },
  { title: "소방 검사", category: "INSPECTION" },
  { title: "기초 콘크리트 타설", category: "CONSTRUCTION" },
  { title: "골조 공사 착수", category: "CONSTRUCTION" },
  { title: "지붕 공사", category: "CONSTRUCTION" },
  { title: "외부 마감 착수", category: "CONSTRUCTION" },
  { title: "내부 마감 착수", category: "CONSTRUCTION" },
  { title: "설비 배관 검토", category: "CONSTRUCTION" },
  { title: "마감재 선정", category: "MEETING" },
  { title: "가구 배치 확인", category: "MEETING" },
  { title: "포트폴리오 촬영", category: "MEETING" },
];

const PHOTO_SUB_CATEGORIES: Record<string, string[]> = {
  DESIGN: ["현황사진", "컨셉이미지", "모델링", "기타"],
  PERMIT: ["인허가서류", "현장사진", "기타"],
  CONSTRUCTION: [
    "가설공사", "토공사", "기초공사",
    "골조공사-지하", "골조공사-1층", "골조공사-2층", "골조공사-3층",
    "골조공사-4층", "골조공사-5층이상", "골조공사-옥상",
    "방수공사", "전기공사", "설비공사", "창호공사",
    "외부마감", "내부마감", "타일공사", "도장공사",
    "목공사", "조경공사", "전경", "기타",
  ],
  COMPLETION: ["최종검수", "하자보수", "준공사진", "기타"],
  PORTFOLIO: ["외관", "내부", "디테일", "야간", "드론", "기타"],
};

// ─── Label Helpers ───────────────────────────────────────────
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

function getRequestStatusLabel(status: string) {
  const map: Record<string, string> = {
    NEW: "신규", REVIEWING: "검토중", IN_PROGRESS: "진행중", RESOLVED: "해결",
    ON_HOLD: "보류", REJECTED: "반려",
  };
  return map[status] ?? status;
}

function getRequestStatusColor(status: string) {
  const map: Record<string, string> = {
    NEW: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    REVIEWING: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
    IN_PROGRESS: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    RESOLVED: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    ON_HOLD: "bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-300",
    REJECTED: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  };
  return map[status] ?? "";
}

function getRequestPriorityLabel(p: string) {
  const map: Record<string, string> = { URGENT: "긴급", HIGH: "높음", NORMAL: "보통", LOW: "낮음" };
  return map[p] ?? p;
}

// ─── Overview Tab ────────────────────────────────────────────
function OverviewTab({ project }: { project: Project }) {
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);

  const { data: designChecks } = useQuery<DesignCheck[]>({ queryKey: [`/api/projects/${project.id}/design-checks`] });
  const { data: constructionTasks } = useQuery<ConstructionTask[]>({ queryKey: [`/api/projects/${project.id}/construction-tasks`] });
  const { data: inspections } = useQuery<Inspection[]>({ queryKey: [`/api/projects/${project.id}/inspections`] });
  const { data: defects } = useQuery<Defect[]>({ queryKey: [`/api/projects/${project.id}/defects`] });

  const designCompleted = designChecks?.filter((c) => c.isCompleted === 1).length ?? 0;
  const designTotal = designChecks?.length ?? 0;
  const designPct = designTotal > 0 ? Math.round((designCompleted / designTotal) * 100) : 0;
  const avgProgress = constructionTasks?.length
    ? Math.round(constructionTasks.reduce((sum, t) => sum + t.progress, 0) / constructionTasks.length) : 0;
  const inspCompleted = inspections?.filter((i) => i.result !== "PENDING").length ?? 0;
  const inspTotal = inspections?.length ?? 0;
  const unresolvedDefects = defects?.filter((d) => d.status !== "CLOSED" && d.status !== "VERIFIED").length ?? 0;

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("PATCH", `/api/projects/${project.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${project.id}`] });
      toast({ title: "프로젝트 정보가 수정되었습니다" });
      setEditOpen(false);
    },
  });

  const p = project as any;

  return (
    <div className="space-y-6" data-testid="overview-tab">
      {/* 프로젝트 정보 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>프로젝트 정보</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>수정</Button>
        </CardHeader>
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

      {/* 건축 개요 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Building2 className="w-5 h-5" /> 건축 개요</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground mb-1">건축면적</p>
              <p className="font-medium">{p.buildingArea ? `${p.buildingArea}m²` : "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">연면적</p>
              <p className="font-medium">{p.totalFloorArea ? `${p.totalFloorArea}m²` : "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">건폐율</p>
              <p className="font-medium">{p.buildingCoverage ? `${p.buildingCoverage}%` : "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">용적률</p>
              <p className="font-medium">{p.floorAreaRatio ? `${p.floorAreaRatio}%` : "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">층수</p>
              <p className="font-medium">{p.floors || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">구조</p>
              <p className="font-medium">{p.structureType || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">주용도</p>
              <p className="font-medium">{p.mainUse || "-"}</p>
            </div>
          </div>
          {p.specialNotes && (
            <div className="mt-4 pt-3 border-t">
              <p className="text-xs text-muted-foreground mb-1">특이사항</p>
              <p className="text-sm">{p.specialNotes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 현재 진행 단계 */}
      <Card>
        <CardHeader><CardTitle>현재 진행 단계</CardTitle></CardHeader>
        <CardContent>
          <PhaseProgress currentPhase={project.currentPhase} />
        </CardContent>
      </Card>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <ClipboardList className="w-6 h-6 mx-auto text-blue-500 mb-1" />
            <p className="text-xs text-muted-foreground">설계 체크리스트</p>
            <p className="text-lg font-bold">{designPct}% 완료</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <HardHat className="w-6 h-6 mx-auto text-orange-500 mb-1" />
            <p className="text-xs text-muted-foreground">전체 공정률</p>
            <p className="text-lg font-bold">{avgProgress}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <Search className="w-6 h-6 mx-auto text-purple-500 mb-1" />
            <p className="text-xs text-muted-foreground">검수 현황</p>
            <p className="text-lg font-bold">{inspCompleted}/{inspTotal} 완료</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <AlertTriangle className="w-6 h-6 mx-auto text-red-500 mb-1" />
            <p className="text-xs text-muted-foreground">하자 현황</p>
            <p className="text-lg font-bold">미해결 {unresolvedDefects}건</p>
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>프로젝트 정보 수정</DialogTitle></DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              updateMutation.mutate({
                description: fd.get("description") || null,
                clientName: fd.get("clientName") || null,
                address: fd.get("address") || null,
                buildingArea: fd.get("buildingArea") || null,
                totalFloorArea: fd.get("totalFloorArea") || null,
                buildingCoverage: fd.get("buildingCoverage") || null,
                floorAreaRatio: fd.get("floorAreaRatio") || null,
                floors: fd.get("floors") || null,
                structureType: fd.get("structureType") || null,
                mainUse: fd.get("mainUse") || null,
                specialNotes: fd.get("specialNotes") || null,
              });
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>설명</Label>
              <Textarea name="description" defaultValue={project.description || ""} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>건축주</Label>
                <Input name="clientName" defaultValue={project.clientName || ""} />
              </div>
              <div className="space-y-2">
                <Label>주소</Label>
                <Input name="address" defaultValue={project.address || ""} />
              </div>
            </div>
            <h4 className="text-sm font-semibold pt-2">건축 개요</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>건축면적 (m²)</Label>
                <Input name="buildingArea" defaultValue={p.buildingArea || ""} />
              </div>
              <div className="space-y-2">
                <Label>연면적 (m²)</Label>
                <Input name="totalFloorArea" defaultValue={p.totalFloorArea || ""} />
              </div>
              <div className="space-y-2">
                <Label>건폐율 (%)</Label>
                <Input name="buildingCoverage" defaultValue={p.buildingCoverage || ""} />
              </div>
              <div className="space-y-2">
                <Label>용적률 (%)</Label>
                <Input name="floorAreaRatio" defaultValue={p.floorAreaRatio || ""} />
              </div>
              <div className="space-y-2">
                <Label>층수</Label>
                <Input name="floors" placeholder="예: 지하1층/지상3층" defaultValue={p.floors || ""} />
              </div>
              <div className="space-y-2">
                <Label>구조</Label>
                <Input name="structureType" placeholder="예: 철근콘크리트조" defaultValue={p.structureType || ""} />
              </div>
              <div className="space-y-2">
                <Label>주용도</Label>
                <Input name="mainUse" placeholder="예: 단독주택" defaultValue={p.mainUse || ""} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>특이사항</Label>
              <Textarea name="specialNotes" defaultValue={p.specialNotes || ""} />
            </div>
            <Button type="submit" disabled={updateMutation.isPending}>저장</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Design Tab ──────────────────────────────────────────────
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
    mutationFn: async (data: any) => { await apiRequest("POST", `/api/projects/${projectId}/design-checks`, data); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/design-checks`] });
      toast({ title: "체크리스트 항목이 추가되었습니다" });
      setCheckDialogOpen(false);
    },
  });

  const toggleCheckMutation = useMutation({
    mutationFn: async ({ id, isCompleted }: { id: string; isCompleted: number }) => {
      await apiRequest("PATCH", `/api/design-checks/${id}`, { isCompleted, completedAt: isCompleted ? new Date().toISOString() : null });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/design-checks`] }); },
  });

  const changeMutation = useMutation({
    mutationFn: async (data: any) => { await apiRequest("POST", `/api/projects/${projectId}/design-changes`, data); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/design-changes`] });
      toast({ title: "설계변경이 등록되었습니다" });
      setChangeDialogOpen(false);
    },
  });

  const changeStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => { await apiRequest("PATCH", `/api/design-changes/${id}`, { status }); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/design-changes`] });
      toast({ title: "상태가 변경되었습니다" });
    },
  });

  const completedCount = designChecks?.filter((c) => c.isCompleted === 1).length ?? 0;
  const totalCount = designChecks?.length ?? 0;

  const categories = ["ARCHITECTURE", "STRUCTURE", "MEP", "INTERIOR", "LANDSCAPE", "PERMIT_DOC"];
  const grouped: Record<string, DesignCheck[]> = {};
  categories.forEach((cat) => {
    const items = designChecks?.filter((c) => c.category === cat) ?? [];
    if (items.length > 0) grouped[cat] = items;
  });

  return (
    <div className="space-y-6" data-testid="design-tab">
      {/* 설계 체크리스트 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" /> 설계 체크리스트 ({completedCount}/{totalCount} 완료)
          </CardTitle>
          <Dialog open={checkDialogOpen} onOpenChange={setCheckDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-4 h-4 mr-1" />추가</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>체크리스트 항목 추가</DialogTitle></DialogHeader>
              <form onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                checkMutation.mutate({ category: fd.get("category"), title: fd.get("title"), memo: fd.get("memo") || null });
              }} className="space-y-4">
                <div className="space-y-2">
                  <Label>카테고리</Label>
                  <select name="category" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" defaultValue="ARCHITECTURE">
                    <option value="ARCHITECTURE">건축</option>
                    <option value="STRUCTURE">구조</option>
                    <option value="MEP">기계/전기</option>
                    <option value="INTERIOR">인테리어</option>
                    <option value="LANDSCAPE">조경</option>
                    <option value="PERMIT_DOC">인허가 서류</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>항목명</Label>
                  <Input name="title" required />
                </div>
                <div className="space-y-2">
                  <Label>메모</Label>
                  <Textarea name="memo" />
                </div>
                <p className="text-xs text-muted-foreground">* 설계 체크리스트 항목은 시공 탭의 체크리스트에도 자동으로 표시됩니다</p>
                <Button type="submit" disabled={checkMutation.isPending}>추가</Button>
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
                      <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                        <input type="checkbox" checked={item.isCompleted === 1}
                          onChange={() => toggleCheckMutation.mutate({ id: item.id, isCompleted: item.isCompleted === 1 ? 0 : 1 })}
                          className="w-4 h-4 rounded border-gray-300" />
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

      {/* 설계변경 이력 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>설계변경 이력</CardTitle>
          <Dialog open={changeDialogOpen} onOpenChange={setChangeDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-4 h-4 mr-1" />설계변경 등록</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>설계변경 등록</DialogTitle></DialogHeader>
              <form onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                changeMutation.mutate({
                  title: fd.get("title"), description: fd.get("description"),
                  reason: fd.get("reason") || null, impactArea: fd.get("impactArea") || null, status: "REQUESTED",
                });
              }} className="space-y-4">
                <div className="space-y-2"><Label>제목</Label><Input name="title" required /></div>
                <div className="space-y-2"><Label>설명</Label><Textarea name="description" required /></div>
                <div className="space-y-2"><Label>변경 사유</Label><Input name="reason" /></div>
                <div className="space-y-2"><Label>영향 범위</Label><Input name="impactArea" placeholder="예: 1층 거실, 외부 마감" /></div>
                <Button type="submit" disabled={changeMutation.isPending}>등록</Button>
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
                <div key={dc.id} className="p-3 rounded-lg border cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => setSelectedChange(dc)}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{dc.title}</span>
                    <Badge variant="outline" className={getDesignChangeStatusColor(dc.status)}>{getDesignChangeStatusLabel(dc.status)}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{dc.description}</p>
                  {dc.impactArea && <p className="text-xs text-muted-foreground mt-0.5">영향 범위: {dc.impactArea}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedChange && (
        <Dialog open onOpenChange={() => setSelectedChange(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>{selectedChange.title}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Badge variant="outline" className={getDesignChangeStatusColor(selectedChange.status)}>{getDesignChangeStatusLabel(selectedChange.status)}</Badge>
              <p className="text-sm">{selectedChange.description}</p>
              {selectedChange.reason && <p className="text-sm"><strong>사유:</strong> {selectedChange.reason}</p>}
              {selectedChange.impactArea && <p className="text-sm"><strong>영향 범위:</strong> {selectedChange.impactArea}</p>}
              <div className="flex items-center gap-2">
                <Label className="text-xs">상태 변경:</Label>
                <select value={selectedChange.status}
                  onChange={(e) => { changeStatusMutation.mutate({ id: selectedChange.id, status: e.target.value }); setSelectedChange({ ...selectedChange, status: e.target.value as any }); }}
                  className="rounded-md border border-input bg-background px-2 py-1 text-xs">
                  <option value="REQUESTED">요청</option><option value="REVIEWING">검토중</option>
                  <option value="APPROVED">승인</option><option value="REJECTED">반려</option><option value="APPLIED">적용완료</option>
                </select>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* 도면 관리 */}
      <Card>
        <CardHeader><CardTitle>도면 관리</CardTitle></CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">도면은 파일 탭에서 Google Drive 링크로 등록합니다. 카테고리를 "도면"으로 선택하면 여기에 표시됩니다.</p>
          {!drawingFiles.length ? (
            <p className="text-sm text-muted-foreground text-center py-4">등록된 도면이 없습니다</p>
          ) : (
            <div className="space-y-2">
              {drawingFiles.map((f) => (
                <div key={f.id} className="flex items-center gap-3 p-3 rounded-lg border">
                  <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{f.title}</span>
                      {f.version && <Badge variant="default" className="text-xs">{f.version}</Badge>}
                    </div>
                    {f.description && <p className="text-xs text-muted-foreground mt-0.5">{f.description}</p>}
                  </div>
                  <a href={f.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8"><ExternalLink className="w-4 h-4" /></Button>
                  </a>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 건축주 요청사항 (설계 단계) */}
      <RequestsSection projectId={projectId} phase="DESIGN" />
    </div>
  );
}

// ─── Shared Requests Section ─────────────────────────────────
function RequestsSection({ projectId, phase }: { projectId: string; phase: string }) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedReq, setExpandedReq] = useState<string | null>(null);

  const { data: allRequests } = useQuery<ClientRequest[]>({ queryKey: [`/api/projects/${projectId}/requests`] });
  const requests = allRequests?.filter((r) => r.phase === phase) ?? [];
  const { data: comments } = useQuery<Comment[]>({
    queryKey: [`/api/requests/${expandedReq}/comments`],
    enabled: !!expandedReq,
  });

  const requestMutation = useMutation({
    mutationFn: async (data: any) => { await apiRequest("POST", `/api/projects/${projectId}/requests`, data); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/requests`] }); toast({ title: "요청사항이 등록되었습니다" }); setDialogOpen(false); },
  });

  const updateRequestMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => { await apiRequest("PATCH", `/api/requests/${id}`, data); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/requests`] }); },
  });

  const commentMutation = useMutation({
    mutationFn: async ({ requestId, content }: { requestId: string; content: string }) => {
      await apiRequest("POST", `/api/requests/${requestId}/comments`, { content });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/requests/${expandedReq}/comments`] }); },
  });

  const resolved = requests.filter((r) => r.status === "RESOLVED").length;
  const phaseLabel = phase === "DESIGN" ? "설계" : phase === "CONSTRUCTION" ? "시공" : getPhaseLabel(phase);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" /> 건축주 요청사항 ({phaseLabel}) <span className="text-sm font-normal text-muted-foreground">{resolved}/{requests.length} 해결</span>
        </CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" />요청 등록</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>요청사항 등록 ({phaseLabel} 단계)</DialogTitle></DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault(); const fd = new FormData(e.currentTarget);
              requestMutation.mutate({
                phase, title: fd.get("title"), content: fd.get("content"),
                category: fd.get("category"), priority: fd.get("priority"), status: "NEW",
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
              <Button type="submit" disabled={requestMutation.isPending}>등록</Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {!requests.length ? (
          <p className="text-sm text-muted-foreground text-center py-4">등록된 요청사항이 없습니다</p>
        ) : (
          <div className="space-y-2">
            {requests.map((req) => (
              <div key={req.id} className="p-3 rounded-lg border">
                <div className="cursor-pointer" onClick={() => setExpandedReq(expandedReq === req.id ? null : req.id)}>
                  <div className="flex items-center gap-2 flex-wrap">
                    {expandedReq === req.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    <span className="text-sm font-medium">{req.title}</span>
                    <Badge variant="outline" className={getRequestStatusColor(req.status)}>{getRequestStatusLabel(req.status)}</Badge>
                    <Badge variant="outline" className="text-xs">{getRequestPriorityLabel(req.priority)}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1 ml-6">{req.content}</p>
                </div>
                {expandedReq === req.id && (
                  <div className="mt-3 pt-3 border-t space-y-3 ml-6">
                    <p className="text-sm">{req.content}</p>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">상태:</Label>
                      <select value={req.status} onChange={(e) => updateRequestMutation.mutate({ id: req.id, data: { status: e.target.value } })}
                        className="rounded-md border border-input bg-background px-2 py-1 text-xs">
                        <option value="NEW">신규</option><option value="REVIEWING">검토중</option><option value="IN_PROGRESS">진행중</option>
                        <option value="RESOLVED">해결</option><option value="ON_HOLD">보류</option><option value="REJECTED">반려</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-semibold">댓글</p>
                      {comments?.map((c) => (
                        <div key={c.id} className="p-2 bg-muted/50 rounded text-xs">{c.content}</div>
                      ))}
                      <form onSubmit={(e) => {
                        e.preventDefault(); const fd = new FormData(e.currentTarget);
                        const content = fd.get("comment") as string;
                        if (content) { commentMutation.mutate({ requestId: req.id, content }); e.currentTarget.reset(); }
                      }} className="flex gap-2">
                        <Input name="comment" placeholder="댓글 입력..." className="h-8 text-xs" />
                        <Button type="submit" size="sm" className="h-8">등록</Button>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Construction Tab ────────────────────────────────────────
function ConstructionTab({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [inspDialogOpen, setInspDialogOpen] = useState(false);
  const [defectDialogOpen, setDefectDialogOpen] = useState(false);
  const [checkDialogOpen, setCheckDialogOpen] = useState(false);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [expandedInsp, setExpandedInsp] = useState<string | null>(null);
  const [expandedDefect, setExpandedDefect] = useState<string | null>(null);
  const [localProgress, setLocalProgress] = useState<Record<string, number>>({});
  const [editTask, setEditTask] = useState<ConstructionTask | null>(null);

  const { data: tasks } = useQuery<ConstructionTask[]>({ queryKey: [`/api/projects/${projectId}/construction-tasks`] });
  const { data: inspections } = useQuery<Inspection[]>({ queryKey: [`/api/projects/${projectId}/inspections`] });
  const { data: defects } = useQuery<Defect[]>({ queryKey: [`/api/projects/${projectId}/defects`] });
  const { data: designChecks } = useQuery<DesignCheck[]>({ queryKey: [`/api/projects/${projectId}/design-checks`] });

  const getProgress = (task: ConstructionTask) => localProgress[task.id] ?? task.progress;
  const avgProgress = tasks?.length ? Math.round(tasks.reduce((sum, t) => sum + getProgress(t), 0) / tasks.length) : 0;
  const statusCounts = {
    NOT_STARTED: tasks?.filter((t) => t.status === "NOT_STARTED").length ?? 0,
    IN_PROGRESS: tasks?.filter((t) => t.status === "IN_PROGRESS").length ?? 0,
    COMPLETED: tasks?.filter((t) => t.status === "COMPLETED").length ?? 0,
    DELAYED: tasks?.filter((t) => t.status === "DELAYED").length ?? 0,
  };

  const taskMutation = useMutation({
    mutationFn: async (data: any) => { await apiRequest("POST", `/api/projects/${projectId}/construction-tasks`, data); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/construction-tasks`] }); toast({ title: "공정이 추가되었습니다" }); setTaskDialogOpen(false); },
  });

  const bulkTaskMutation = useMutation({
    mutationFn: async (tasksData: any[]) => { await apiRequest("POST", `/api/projects/${projectId}/construction-tasks/bulk`, { tasks: tasksData }); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/construction-tasks`] }); toast({ title: "공정이 일괄 추가되었습니다" }); setBulkDialogOpen(false); },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => { await apiRequest("PATCH", `/api/construction-tasks/${id}`, data); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/construction-tasks`] }); },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/construction-tasks/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/construction-tasks`] }); toast({ title: "공정이 삭제되었습니다" }); },
  });

  const reorderMutation = useMutation({
    mutationFn: async (orderedIds: string[]) => { await apiRequest("PATCH", `/api/projects/${projectId}/construction-tasks/reorder`, { orderedIds }); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/construction-tasks`] }); },
  });

  const moveTask = (taskId: string, direction: "up" | "down") => {
    const sorted = [...sortedTasks];
    const idx = sorted.findIndex((t) => t.id === taskId);
    if (direction === "up" && idx > 0) {
      [sorted[idx], sorted[idx - 1]] = [sorted[idx - 1], sorted[idx]];
    } else if (direction === "down" && idx < sorted.length - 1) {
      [sorted[idx], sorted[idx + 1]] = [sorted[idx + 1], sorted[idx]];
    } else return;
    reorderMutation.mutate(sorted.map((t) => t.id));
  };

  const checkMutation = useMutation({
    mutationFn: async (data: any) => { await apiRequest("POST", `/api/projects/${projectId}/design-checks`, data); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/design-checks`] }); toast({ title: "체크리스트 항목이 추가되었습니다" }); setCheckDialogOpen(false); },
  });

  const toggleCheckMutation = useMutation({
    mutationFn: async ({ id, isCompleted }: { id: string; isCompleted: number }) => {
      await apiRequest("PATCH", `/api/design-checks/${id}`, { isCompleted, completedAt: isCompleted ? new Date().toISOString() : null });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/design-checks`] }); },
  });

  const inspMutation = useMutation({
    mutationFn: async (data: any) => { await apiRequest("POST", `/api/projects/${projectId}/inspections`, data); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/inspections`] }); toast({ title: "검수가 추가되었습니다" }); setInspDialogOpen(false); },
  });

  const updateInspMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => { await apiRequest("PATCH", `/api/inspections/${id}`, data); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/inspections`] }); },
  });

  const defectMutation = useMutation({
    mutationFn: async (data: any) => { await apiRequest("POST", `/api/projects/${projectId}/defects`, data); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/defects`] }); toast({ title: "하자가 등록되었습니다" }); setDefectDialogOpen(false); },
  });

  const updateDefectMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => { await apiRequest("PATCH", `/api/defects/${id}`, data); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/defects`] }); },
  });

  const sortedTasks = tasks ? [...tasks].sort((a, b) => a.sortOrder - b.sortOrder) : [];
  const pendingDesignChecks = designChecks?.filter((c) => c.isCompleted === 0) ?? [];
  const allChecks = designChecks ?? [];

  // Bulk add handler
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const handleBulkAdd = () => {
    const tasksData = Array.from(bulkSelected).map((cat, i) => ({
      title: cat, category: cat, status: "NOT_STARTED", progress: 0,
      sortOrder: (tasks?.length ?? 0) + i + 1,
    }));
    bulkTaskMutation.mutate(tasksData);
  };

  return (
    <div className="space-y-6" data-testid="construction-tab">
      {/* 전체 공정률 */}
      <Card>
        <CardHeader><CardTitle>전체 공정률: {avgProgress}%</CardTitle></CardHeader>
        <CardContent>
          <div className="w-full bg-muted rounded-full h-4 mb-3">
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

      {/* 시공 체크리스트 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" /> 시공 체크리스트
          </CardTitle>
          <Dialog open={checkDialogOpen} onOpenChange={setCheckDialogOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" />추가</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>체크리스트 항목 추가 (시공)</DialogTitle></DialogHeader>
              <form onSubmit={(e) => {
                e.preventDefault(); const fd = new FormData(e.currentTarget);
                checkMutation.mutate({ category: fd.get("category"), title: fd.get("title"), memo: fd.get("memo") || null });
              }} className="space-y-4">
                <div className="space-y-2"><Label>카테고리</Label>
                  <select name="category" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" defaultValue="ARCHITECTURE">
                    <option value="ARCHITECTURE">건축</option><option value="STRUCTURE">구조</option><option value="MEP">기계/전기</option>
                    <option value="INTERIOR">인테리어</option><option value="LANDSCAPE">조경</option><option value="PERMIT_DOC">인허가 서류</option>
                  </select>
                </div>
                <div className="space-y-2"><Label>항목명</Label><Input name="title" required /></div>
                <div className="space-y-2"><Label>메모</Label><Textarea name="memo" /></div>
                <Button type="submit" disabled={checkMutation.isPending}>추가</Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {allChecks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">체크리스트 항목이 없습니다</p>
          ) : (
            <div className="space-y-1">
              {allChecks.map((item) => (
                <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                  <input type="checkbox" checked={item.isCompleted === 1}
                    onChange={() => toggleCheckMutation.mutate({ id: item.id, isCompleted: item.isCompleted === 1 ? 0 : 1 })}
                    className="w-4 h-4 rounded border-gray-300" />
                  <span className="text-xs font-medium text-muted-foreground">[{getDesignCheckCategoryLabel(item.category)}]</span>
                  <span className={`text-sm flex-1 ${item.isCompleted === 1 ? "line-through text-muted-foreground" : ""}`}>{item.title}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 공정 목록 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><HardHat className="w-5 h-5" /> 공정 목록</CardTitle>
          <div className="flex gap-2">
            <Dialog open={bulkDialogOpen} onOpenChange={(o) => { setBulkDialogOpen(o); if (!o) setBulkSelected(new Set()); }}>
              <DialogTrigger asChild><Button size="sm" variant="outline">일괄 추가</Button></DialogTrigger>
              <DialogContent className="max-h-[70vh] overflow-y-auto">
                <DialogHeader><DialogTitle>공정 일괄 추가</DialogTitle></DialogHeader>
                <p className="text-xs text-muted-foreground mb-3">추가할 공종을 선택하세요</p>
                <div className="space-y-1">
                  {CONSTRUCTION_CATEGORIES.map((c) => (
                    <label key={c.value} className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer">
                      <input type="checkbox" checked={bulkSelected.has(c.value)}
                        onChange={(e) => {
                          const next = new Set(bulkSelected);
                          e.target.checked ? next.add(c.value) : next.delete(c.value);
                          setBulkSelected(next);
                        }} className="w-4 h-4" />
                      <span className="text-sm">{c.label}</span>
                    </label>
                  ))}
                </div>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" size="sm" onClick={() => setBulkSelected(new Set(CONSTRUCTION_CATEGORIES.map((c) => c.value)))}>전체 선택</Button>
                  <Button variant="outline" size="sm" onClick={() => setBulkSelected(new Set())}>전체 해제</Button>
                </div>
                <Button onClick={handleBulkAdd} disabled={bulkSelected.size === 0 || bulkTaskMutation.isPending} className="w-full mt-2">
                  {bulkSelected.size}개 공정 추가
                </Button>
              </DialogContent>
            </Dialog>
            <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" />공정 추가</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>공정 추가</DialogTitle></DialogHeader>
                <form onSubmit={(e) => {
                  e.preventDefault(); const fd = new FormData(e.currentTarget);
                  taskMutation.mutate({
                    title: fd.get("title"), description: fd.get("description") || null,
                    category: fd.get("category"), status: "NOT_STARTED", progress: 0,
                    startDate: fd.get("startDate") || null, endDate: fd.get("endDate") || null,
                    assignee: fd.get("assignee") || null, sortOrder: (tasks?.length ?? 0) + 1,
                  });
                }} className="space-y-4">
                  <div className="space-y-2"><Label>공종</Label>
                    <select name="category" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" defaultValue="기초공사">
                      {CONSTRUCTION_CATEGORIES.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
                    </select>
                  </div>
                  <div className="space-y-2"><Label>공정명</Label><Input name="title" required placeholder="예: 1층 기초 콘크리트 타설" /></div>
                  <div className="space-y-2"><Label>설명</Label><Textarea name="description" /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>시작일</Label><DateInput name="startDate" /></div>
                    <div className="space-y-2"><Label>종료일</Label><DateInput name="endDate" /></div>
                  </div>
                  <div className="space-y-2"><Label>담당</Label><Input name="assignee" /></div>
                  <Button type="submit" disabled={taskMutation.isPending}>추가</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {!sortedTasks.length ? (
            <p className="text-sm text-muted-foreground text-center py-4">등록된 공정이 없습니다</p>
          ) : (
            <div className="space-y-3">
              {sortedTasks.map((task) => (
                <div key={task.id} className="p-3 rounded-lg border">
                  <div className="cursor-pointer" onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}>
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className="text-sm font-medium">{task.title}</span>
                      <Badge variant="outline" className="text-xs">{task.category}</Badge>
                      <Badge variant="outline" className={getTaskStatusColor(task.status)}>{getTaskStatusLabel(task.status)}</Badge>
                      {task.assignee && <span className="text-xs text-muted-foreground">{task.assignee}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-muted rounded-full h-2">
                        <div className={`h-2 rounded-full transition-all ${task.status === "DELAYED" ? "bg-red-500" : "bg-primary"}`} style={{ width: `${getProgress(task)}%` }} />
                      </div>
                      <span className="text-xs font-medium w-10 text-right">{getProgress(task)}%</span>
                    </div>
                    {(task.startDate || task.endDate) && <p className="text-xs text-muted-foreground mt-1">{task.startDate} ~ {task.endDate}</p>}
                  </div>
                  {expandedTask === task.id && (
                    <div className="mt-3 pt-3 border-t space-y-3">
                      <div className="space-y-1">
                        <Label className="text-xs">진행률: {getProgress(task)}%</Label>
                        <input type="range" min="0" max="100" value={getProgress(task)}
                          onChange={(e) => {
                            const v = parseInt(e.target.value);
                            setLocalProgress((prev) => ({ ...prev, [task.id]: v }));
                          }}
                          onMouseUp={(e) => {
                            const v = parseInt((e.target as HTMLInputElement).value);
                            updateTaskMutation.mutate({ id: task.id, data: { progress: v } });
                          }}
                          onTouchEnd={(e) => {
                            const v = parseInt((e.target as HTMLInputElement).value);
                            updateTaskMutation.mutate({ id: task.id, data: { progress: v } });
                          }}
                          className="w-full" />
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs">상태:</Label>
                        <select value={task.status} onChange={(e) => updateTaskMutation.mutate({ id: task.id, data: { status: e.target.value } })}
                          className="rounded-md border border-input bg-background px-2 py-1 text-xs">
                          <option value="NOT_STARTED">미착수</option><option value="IN_PROGRESS">진행중</option>
                          <option value="COMPLETED">완료</option><option value="DELAYED">지연</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-1 pt-1">
                        <span className="text-xs text-muted-foreground mr-1">순서:</span>
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => moveTask(task.id, "up")}
                          disabled={sortedTasks[0]?.id === task.id}><ArrowUp className="w-3 h-3" /></Button>
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => moveTask(task.id, "down")}
                          disabled={sortedTasks[sortedTasks.length - 1]?.id === task.id}><ArrowDown className="w-3 h-3" /></Button>
                        <Button variant="outline" size="icon" className="h-7 w-7 ml-2" onClick={() => setEditTask(task)}>
                          <Pencil className="w-3 h-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 ml-auto text-destructive hover:text-destructive"
                          onClick={() => { if (confirm("이 공정을 삭제하시겠습니까?")) deleteTaskMutation.mutate(task.id); }}>
                          <Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 검수 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><Search className="w-5 h-5" /> 검수</CardTitle>
          <Dialog open={inspDialogOpen} onOpenChange={setInspDialogOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" />검수 추가</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>검수 추가</DialogTitle></DialogHeader>
              <form onSubmit={(e) => {
                e.preventDefault(); const fd = new FormData(e.currentTarget);
                inspMutation.mutate({ title: fd.get("title"), category: fd.get("category"), scheduledDate: fd.get("scheduledDate") || null, inspector: fd.get("inspector") || null, result: "PENDING" });
              }} className="space-y-4">
                <div className="space-y-2"><Label>검수명</Label><Input name="title" required /></div>
                <div className="space-y-2"><Label>분류</Label><Input name="category" required placeholder="예: 구조검사, 방수검사" /></div>
                <div className="space-y-2"><Label>예정일</Label><DateInput name="scheduledDate" /></div>
                <div className="space-y-2"><Label>검사자</Label><Input name="inspector" /></div>
                <Button type="submit" disabled={inspMutation.isPending}>추가</Button>
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
                <div key={insp.id} className="p-3 rounded-lg border">
                  <div className="cursor-pointer" onClick={() => setExpandedInsp(expandedInsp === insp.id ? null : insp.id)}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{insp.title}</span>
                      <Badge variant="outline" className="text-xs">{insp.category}</Badge>
                      <Badge variant="outline" className={getInspectionResultColor(insp.result)}>{getInspectionResultLabel(insp.result)}</Badge>
                    </div>
                    <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                      {insp.scheduledDate && <span>예정: {insp.scheduledDate}</span>}
                      {insp.completedDate && <span>완료: {insp.completedDate}</span>}
                      {insp.inspector && <span>검사자: {insp.inspector}</span>}
                    </div>
                  </div>
                  {expandedInsp === insp.id && (
                    <div className="mt-3 pt-3 border-t space-y-3">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs">결과:</Label>
                        <select value={insp.result} onChange={(e) => updateInspMutation.mutate({ id: insp.id, data: { result: e.target.value } })}
                          className="rounded-md border border-input bg-background px-2 py-1 text-xs">
                          <option value="PENDING">대기</option><option value="PASS">합격</option>
                          <option value="CONDITIONAL_PASS">조건부합격</option><option value="FAIL">불합격</option>
                        </select>
                      </div>
                      <div className="space-y-1"><Label className="text-xs">완료일</Label>
                        <DateInput defaultValue={insp.completedDate || ""} onChange={(e) => updateInspMutation.mutate({ id: insp.id, data: { completedDate: e.target.value || null } })} className="h-8 text-xs" />
                      </div>
                      <div className="space-y-1"><Label className="text-xs">검사 소견</Label>
                        <Textarea defaultValue={insp.findings || ""} onBlur={(e) => updateInspMutation.mutate({ id: insp.id, data: { findings: e.target.value || null } })} className="text-xs min-h-[60px]" />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 하자 관리 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5" /> 하자 관리</CardTitle>
          <Dialog open={defectDialogOpen} onOpenChange={setDefectDialogOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" />하자 등록</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>하자 등록</DialogTitle></DialogHeader>
              <form onSubmit={(e) => {
                e.preventDefault(); const fd = new FormData(e.currentTarget);
                defectMutation.mutate({ title: fd.get("title"), description: fd.get("description"), location: fd.get("location"), severity: fd.get("severity"), status: "OPEN" });
              }} className="space-y-4">
                <div className="space-y-2"><Label>제목</Label><Input name="title" required /></div>
                <div className="space-y-2"><Label>설명</Label><Textarea name="description" required /></div>
                <div className="space-y-2"><Label>위치</Label><Input name="location" required placeholder="예: 1층 거실 남측 벽면" /></div>
                <div className="space-y-2"><Label>심각도</Label>
                  <select name="severity" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" defaultValue="MINOR">
                    <option value="CRITICAL">심각</option><option value="MAJOR">중대</option><option value="MINOR">경미</option><option value="COSMETIC">미관</option>
                  </select>
                </div>
                <Button type="submit" disabled={defectMutation.isPending}>등록</Button>
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
                <div key={defect.id} className="p-3 rounded-lg border">
                  <div className="cursor-pointer" onClick={() => setExpandedDefect(expandedDefect === defect.id ? null : defect.id)}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{defect.title}</span>
                      <Badge variant="outline" className={getDefectSeverityColor(defect.severity)}>{getDefectSeverityLabel(defect.severity)}</Badge>
                      <Badge variant="outline">{getDefectStatusLabel(defect.status)}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">위치: {defect.location}</p>
                    {defect.assignee && <p className="text-xs text-muted-foreground">담당: {defect.assignee}</p>}
                  </div>
                  {expandedDefect === defect.id && (
                    <div className="mt-3 pt-3 border-t space-y-3">
                      <p className="text-sm">{defect.description}</p>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs">상태:</Label>
                        <select value={defect.status} onChange={(e) => updateDefectMutation.mutate({ id: defect.id, data: { status: e.target.value } })}
                          className="rounded-md border border-input bg-background px-2 py-1 text-xs">
                          <option value="OPEN">접수</option><option value="IN_REPAIR">수리중</option><option value="REPAIRED">수리완료</option>
                          <option value="VERIFIED">확인</option><option value="CLOSED">종결</option>
                        </select>
                      </div>
                      <div className="space-y-1"><Label className="text-xs">담당자</Label>
                        <Input defaultValue={defect.assignee || ""} onBlur={(e) => updateDefectMutation.mutate({ id: defect.id, data: { assignee: e.target.value || null } })} className="h-8 text-xs" />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 건축주 요청사항 (시공 단계) */}
      <RequestsSection projectId={projectId} phase="CONSTRUCTION" />

      {/* 공정 수정 다이얼로그 */}
      {editTask && (
        <Dialog open onOpenChange={() => setEditTask(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>공정 수정</DialogTitle></DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault(); const fd = new FormData(e.currentTarget);
              updateTaskMutation.mutate({
                id: editTask.id,
                data: {
                  title: fd.get("title"), description: fd.get("description") || null,
                  category: fd.get("category"), assignee: fd.get("assignee") || null,
                  startDate: fd.get("startDate") || null, endDate: fd.get("endDate") || null,
                },
              });
              setEditTask(null);
              toast({ title: "공정이 수정되었습니다" });
            }} className="space-y-4">
              <div className="space-y-2"><Label>공종</Label>
                <select name="category" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" defaultValue={editTask.category}>
                  {CONSTRUCTION_CATEGORIES.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
                </select>
              </div>
              <div className="space-y-2"><Label>공정명</Label><Input name="title" required defaultValue={editTask.title} /></div>
              <div className="space-y-2"><Label>설명</Label><Textarea name="description" defaultValue={editTask.description || ""} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>시작일</Label><DateInput name="startDate" defaultValue={editTask.startDate || ""} /></div>
                <div className="space-y-2"><Label>종료일</Label><DateInput name="endDate" defaultValue={editTask.endDate || ""} /></div>
              </div>
              <div className="space-y-2"><Label>담당</Label><Input name="assignee" defaultValue={editTask.assignee || ""} /></div>
              <Button type="submit">저장</Button>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ─── Schedule Tab ────────────────────────────────────────────
function ScheduleTab({ projectId, currentPhase }: { projectId: string; currentPhase: string }) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState("");

  const { data: schedules } = useQuery<Schedule[]>({ queryKey: [`/api/projects/${projectId}/schedules`] });
  const { data: dailyLogs } = useQuery<DailyLog[]>({ queryKey: [`/api/projects/${projectId}/daily-logs`] });

  const scheduleMutation = useMutation({
    mutationFn: async (data: any) => { await apiRequest("POST", `/api/projects/${projectId}/schedules`, data); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/schedules`] }); toast({ title: "일정이 추가되었습니다" }); setDialogOpen(false); setSelectedPreset(""); },
  });

  const logMutation = useMutation({
    mutationFn: async (data: any) => { await apiRequest("POST", `/api/projects/${projectId}/daily-logs`, data); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/daily-logs`] }); toast({ title: "작업일지가 추가되었습니다" }); setLogDialogOpen(false); },
  });

  const presetData = selectedPreset ? SCHEDULE_PRESETS.find((p) => p.title === selectedPreset) : null;

  return (
    <div className="space-y-6" data-testid="schedule-tab">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><Calendar className="w-5 h-5" /> 일정</CardTitle>
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setSelectedPreset(""); }}>
            <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" />추가</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>일정 추가</DialogTitle></DialogHeader>
              <div className="space-y-2 mb-4">
                <Label className="text-xs text-muted-foreground">빠른 선택 (프리셋)</Label>
                <select value={selectedPreset} onChange={(e) => setSelectedPreset(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">직접 입력</option>
                  {SCHEDULE_PRESETS.map((p) => (
                    <option key={p.title} value={p.title}>{p.title} ({getCategoryLabel(p.category)})</option>
                  ))}
                </select>
              </div>
              <form onSubmit={(e) => {
                e.preventDefault(); const fd = new FormData(e.currentTarget);
                scheduleMutation.mutate({
                  phase: currentPhase, title: fd.get("title"), date: fd.get("date"),
                  category: fd.get("category"), memo: fd.get("memo") || null,
                  location: fd.get("location") || null, time: fd.get("time") || null,
                });
              }} className="space-y-4">
                <div className="space-y-2"><Label>제목</Label>
                  <Input name="title" required defaultValue={presetData?.title || ""} key={selectedPreset} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>날짜</Label><DateInput name="date" required /></div>
                  <div className="space-y-2"><Label>시간</Label><Input name="time" type="time" /></div>
                </div>
                <div className="space-y-2"><Label>장소</Label><Input name="location" placeholder="예: 현장, 사무실, 강남구청" /></div>
                <div className="space-y-2"><Label>카테고리</Label>
                  <select name="category" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    defaultValue={presetData?.category || "MEETING"} key={`cat-${selectedPreset}`}>
                    <option value="MEETING">회의</option><option value="DEADLINE">마감</option>
                    <option value="INSPECTION">검수</option><option value="CONSTRUCTION">시공</option>
                  </select>
                </div>
                <div className="space-y-2"><Label>메모</Label><Textarea name="memo" /></div>
                <Button type="submit" disabled={scheduleMutation.isPending}>저장</Button>
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
                <div key={s.id} className="flex items-start gap-3 p-3 rounded-lg border">
                  <div className="text-sm text-muted-foreground whitespace-nowrap">
                    <div>{s.date}</div>
                    {(s as any).time && <div className="text-xs">{(s as any).time}</div>}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{s.title}</span>
                      <Badge variant="outline" className={getScheduleCategoryColor(s.category)}>{getCategoryLabel(s.category)}</Badge>
                    </div>
                    {(s as any).location && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />{(s as any).location}
                      </p>
                    )}
                    {s.memo && <p className="text-xs text-muted-foreground mt-0.5">{s.memo}</p>}
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
            <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" />추가</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>작업일지 작성</DialogTitle></DialogHeader>
              <form onSubmit={(e) => {
                e.preventDefault(); const fd = new FormData(e.currentTarget);
                logMutation.mutate({
                  phase: currentPhase, date: fd.get("date"), content: fd.get("content"),
                  weather: fd.get("weather") || null, workers: fd.get("workers") ? parseInt(fd.get("workers") as string) : null,
                });
              }} className="space-y-4">
                <div className="space-y-2"><Label>날짜</Label><DateInput name="date" required /></div>
                <div className="space-y-2"><Label>내용</Label><Textarea name="content" required /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>날씨</Label><Input name="weather" placeholder="맑음" /></div>
                  <div className="space-y-2"><Label>작업인원</Label><Input name="workers" type="number" /></div>
                </div>
                <Button type="submit" disabled={logMutation.isPending}>저장</Button>
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
                <div key={log.id} className="p-3 rounded-lg border">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm font-medium">{log.date}</span>
                    {log.weather && <span className="text-xs text-muted-foreground flex items-center gap-1"><Cloud className="w-3 h-3" />{log.weather}</span>}
                    {log.workers != null && <span className="text-xs text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" />{log.workers}명</span>}
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

// ─── Files Tab ───────────────────────────────────────────────
function FilesTab({ projectId, currentPhase }: { projectId: string; currentPhase: string }) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: files } = useQuery<ProjectFile[]>({ queryKey: [`/api/projects/${projectId}/files`] });

  const mutation = useMutation({
    mutationFn: async (data: any) => { await apiRequest("POST", `/api/projects/${projectId}/files`, data); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/files`] }); toast({ title: "파일이 추가되었습니다" }); setDialogOpen(false); },
  });

  return (
    <div className="space-y-4" data-testid="files-tab">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold flex items-center gap-2"><FileText className="w-5 h-5" /> 파일 목록</h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" />추가</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>파일 추가 (Google Drive 링크)</DialogTitle></DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault(); const fd = new FormData(e.currentTarget);
              mutation.mutate({
                phase: currentPhase, title: fd.get("title"), url: fd.get("url"),
                category: fd.get("category"), version: fd.get("version") || null, description: fd.get("description") || null,
              });
            }} className="space-y-4">
              <div className="space-y-2"><Label>제목</Label><Input name="title" required /></div>
              <div className="space-y-2"><Label>Google Drive URL</Label><Input name="url" type="url" required placeholder="https://drive.google.com/..." /></div>
              <div className="space-y-2"><Label>카테고리</Label>
                <select name="category" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" defaultValue="DOCUMENT">
                  <option value="DRAWING">도면</option><option value="STRUCTURAL">구조</option>
                  <option value="INTERIOR">인테리어</option><option value="DOCUMENT">문서</option><option value="OTHER">기타</option>
                </select>
              </div>
              <div className="space-y-2"><Label>버전</Label><Input name="version" placeholder="v1.0" /></div>
              <div className="space-y-2"><Label>설명</Label><Textarea name="description" /></div>
              <Button type="submit" disabled={mutation.isPending}>저장</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      {!files?.length ? (
        <p className="text-sm text-muted-foreground text-center py-8">등록된 파일이 없습니다</p>
      ) : (
        <div className="space-y-2">
          {files.map((f) => (
            <Card key={f.id}>
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
                <a href={f.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8"><ExternalLink className="w-4 h-4" /></Button>
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Photos Tab (페이즈별 폴더트리) ─────────────────────────
function PhotosTab({ projectId, currentPhase }: { projectId: string; currentPhase: string }) {
  const { toast } = useToast();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [urlDialogOpen, setUrlDialogOpen] = useState(false);
  const [lightbox, setLightbox] = useState<Photo | null>(null);
  const [expandedPhase, setExpandedPhase] = useState<string | null>(currentPhase);
  const [expandedSub, setExpandedSub] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [uploadPhase, setUploadPhase] = useState(currentPhase);
  const [pastedFile, setPastedFile] = useState<File | null>(null);
  const { data: photos } = useQuery<Photo[]>({ queryKey: [`/api/projects/${projectId}/photos`] });

  // Clipboard paste handler
  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          setPastedFile(file);
          setUploadDialogOpen(true);
        }
        break;
      }
    }
  }, []);

  useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  // Upload pasted file
  const uploadPastedFile = async (phase: string, subCategory: string) => {
    if (!pastedFile) return;
    setUploading(true);
    try {
      const uploadData = new FormData();
      uploadData.append("photos", pastedFile);
      uploadData.append("phase", phase);
      if (subCategory) uploadData.append("subCategory", subCategory);
      const { getAuthToken } = await import("@/lib/queryClient");
      const res = await fetch(`/api/projects/${projectId}/photos/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getAuthToken()}` },
        body: uploadData,
      });
      if (!res.ok) throw new Error(await res.text());
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/photos`] });
      toast({ title: "붙여넣기 사진이 업로드되었습니다" });
      setPastedFile(null);
      setUploadDialogOpen(false);
    } catch (err: any) {
      toast({ title: "업로드 실패", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const urlMutation = useMutation({
    mutationFn: async (data: any) => { await apiRequest("POST", `/api/projects/${projectId}/photos`, data); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/photos`] }); toast({ title: "사진이 추가되었습니다" }); setUrlDialogOpen(false); },
  });

  // File upload handler
  const handleFileUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const fileInput = e.currentTarget.querySelector('input[type="file"]') as HTMLInputElement;
    if (!fileInput?.files?.length) { toast({ title: "파일을 선택해주세요", variant: "destructive" }); return; }

    setUploading(true);
    const uploadData = new FormData();
    for (const file of Array.from(fileInput.files)) {
      uploadData.append("photos", file);
    }
    uploadData.append("phase", fd.get("phase") as string);
    uploadData.append("subCategory", fd.get("subCategory") as string);

    try {
      const token = (window as any).__authToken;
      const headers: Record<string, string> = {};
      // Get token from queryClient default options
      const stored = document.cookie.match(/token=([^;]+)/);
      const res = await fetch(`/api/projects/${projectId}/photos/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${(await import("@/lib/queryClient")).getAuthToken()}` },
        body: uploadData,
      });
      if (!res.ok) throw new Error(await res.text());
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/photos`] });
      toast({ title: `${fileInput.files.length}장의 사진이 업로드되었습니다` });
      setUploadDialogOpen(false);
    } catch (err: any) {
      toast({ title: "업로드 실패", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  // ZIP download
  const handleDownloadZip = async () => {
    setDownloading(true);
    try {
      const { getAuthToken } = await import("@/lib/queryClient");
      const res = await fetch(`/api/projects/${projectId}/photos/download-zip`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (!res.ok) throw new Error("다운로드 실패");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `photos.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "ZIP 다운로드가 시작되었습니다" });
    } catch (err: any) {
      toast({ title: "다운로드 실패", description: err.message, variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

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
    <div className="space-y-4" data-testid="photos-tab">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Camera className="w-5 h-5" /> 사진 <span className="text-sm font-normal text-muted-foreground">({totalPhotos}장)</span>
        </h3>
        <div className="flex gap-2">
          {totalPhotos > 0 && (
            <Button size="sm" variant="outline" onClick={handleDownloadZip} disabled={downloading}>
              {downloading ? "다운로드 중..." : "ZIP 다운로드"}
            </Button>
          )}
          <Dialog open={uploadDialogOpen} onOpenChange={(o) => { setUploadDialogOpen(o); if (!o) setPastedFile(null); }}>
            <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" />사진 업로드</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{pastedFile ? "붙여넣기 사진 업로드" : "사진 파일 업로드"}</DialogTitle></DialogHeader>
              {pastedFile ? (
                <div className="space-y-4">
                  <div className="border rounded-lg overflow-hidden max-h-48 flex items-center justify-center bg-muted">
                    <img src={URL.createObjectURL(pastedFile)} alt="미리보기" className="max-h-48 object-contain" />
                  </div>
                  <p className="text-xs text-muted-foreground text-center">클립보드에서 붙여넣은 이미지</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>페이즈</Label>
                      <select id="paste-phase" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={uploadPhase} onChange={(e) => setUploadPhase(e.target.value)}>
                        {phases.map((p) => <option key={p} value={p}>{getPhaseLabel(p)}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2"><Label>세부 단계</Label>
                      <select id="paste-sub" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                        <option value="">선택...</option>
                        {(PHOTO_SUB_CATEGORIES[uploadPhase] || []).map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <Button onClick={() => {
                    const sub = (document.getElementById("paste-sub") as HTMLSelectElement)?.value || "";
                    uploadPastedFile(uploadPhase, sub);
                  }} disabled={uploading} className="w-full">
                    {uploading ? "업로드 중..." : "업로드"}
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleFileUpload} className="space-y-4">
                  <div className="space-y-2">
                    <Label>사진 파일 (여러 장 선택 가능)</Label>
                    <Input type="file" accept="image/*" multiple required className="cursor-pointer" />
                    <p className="text-xs text-muted-foreground">최대 20장, 각 20MB 이하. Ctrl+V로 이미지 붙여넣기도 가능합니다.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>페이즈</Label>
                      <select name="phase" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={uploadPhase} onChange={(e) => setUploadPhase(e.target.value)}>
                        {phases.map((p) => <option key={p} value={p}>{getPhaseLabel(p)}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2"><Label>세부 단계</Label>
                      <select name="subCategory" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                        <option value="">선택...</option>
                        {(PHOTO_SUB_CATEGORIES[uploadPhase] || []).map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <Button type="submit" disabled={uploading} className="w-full">
                    {uploading ? "업로드 중..." : "업로드"}
                  </Button>
                </form>
              )}
            </DialogContent>
          </Dialog>
          <Dialog open={urlDialogOpen} onOpenChange={setUrlDialogOpen}>
            <DialogTrigger asChild><Button size="sm" variant="outline">URL 추가</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>사진 URL 추가</DialogTitle></DialogHeader>
              <form onSubmit={(e) => {
                e.preventDefault(); const fd = new FormData(e.currentTarget);
                urlMutation.mutate({
                  phase: fd.get("phase"), imageUrl: fd.get("imageUrl"), thumbnailUrl: fd.get("imageUrl"),
                  description: fd.get("description") || null, tags: fd.get("tags") || null,
                  takenAt: fd.get("takenAt") || new Date().toISOString().split("T")[0],
                  subCategory: fd.get("subCategory") || null,
                });
              }} className="space-y-4">
                <div className="space-y-2"><Label>이미지 URL</Label><Input name="imageUrl" type="url" required /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>페이즈</Label>
                    <select name="phase" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" defaultValue={currentPhase}>
                      {phases.map((p) => <option key={p} value={p}>{getPhaseLabel(p)}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2"><Label>세부 단계</Label>
                    <select name="subCategory" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                      <option value="">선택...</option>
                      {(PHOTO_SUB_CATEGORIES[currentPhase] || []).map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-2"><Label>설명</Label><Input name="description" /></div>
                <div className="space-y-2"><Label>촬영일</Label><DateInput name="takenAt" /></div>
                <Button type="submit" disabled={urlMutation.isPending}>저장</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Folder tree view */}
      <div className="space-y-2">
        {phases.map((phase) => {
          const count = totalByPhase(phase);
          if (count === 0 && phase !== currentPhase) return null;
          const isExpanded = expandedPhase === phase;
          const subGroups = photosByPhase[phase] || {};

          return (
            <Card key={phase}>
              <CardContent className="py-2">
                <div className="cursor-pointer flex items-center gap-2 py-1"
                  onClick={() => setExpandedPhase(isExpanded ? null : phase)}>
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  <FolderTree className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{getPhaseLabel(phase)}</span>
                  <Badge variant="outline" className="text-xs ml-auto">{count}장</Badge>
                </div>

                {isExpanded && (
                  <div className="ml-6 mt-2 space-y-2">
                    {Object.keys(subGroups).length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">사진이 없습니다</p>
                    ) : (
                      Object.entries(subGroups).map(([sub, subPhotos]) => {
                        const subKey = `${phase}-${sub}`;
                        const isSubExpanded = expandedSub === subKey;
                        return (
                          <div key={subKey}>
                            <div className="cursor-pointer flex items-center gap-2 py-1"
                              onClick={() => setExpandedSub(isSubExpanded ? null : subKey)}>
                              {isSubExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                              <span className="text-xs font-medium">{sub}</span>
                              <span className="text-xs text-muted-foreground">({subPhotos.length})</span>
                            </div>
                            {isSubExpanded && (
                              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 mt-2 ml-4">
                                {subPhotos.map((p) => (
                                  <div key={p.id} className="aspect-square rounded-lg overflow-hidden border cursor-pointer hover:opacity-80 transition-opacity relative group"
                                    onClick={() => setLightbox(p)}>
                                    <img src={p.imageUrl} alt={p.description || ""} className="w-full h-full object-cover" />
                                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      {p.takenAt || "날짜없음"}
                                      {p.description && ` - ${p.description}`}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main ProjectDetail page ─────────────────────────────────
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
            <TabsTrigger value="overview">개요</TabsTrigger>
            <TabsTrigger value="design">설계</TabsTrigger>
            <TabsTrigger value="construction">시공</TabsTrigger>
            <TabsTrigger value="schedule">일정</TabsTrigger>
            <TabsTrigger value="files">파일</TabsTrigger>
            <TabsTrigger value="photos">사진</TabsTrigger>
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
