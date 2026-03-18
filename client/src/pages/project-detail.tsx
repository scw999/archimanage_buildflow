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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { DateInput } from "@/components/date-input";
import { apiRequest, queryClient, getAuthToken } from "@/lib/queryClient";

const API_BASE = import.meta.env.VITE_API_URL || "";

// Reusable drag & drop + paste + click file upload zone (images + files)
function FileDropZone({ projectId, phase, subCategory, onUploaded, existingUrls = [], acceptImages = true, acceptFiles = true, children }: {
  projectId: string; phase: string; subCategory: string;
  onUploaded: (urls: string[]) => void; existingUrls?: string[];
  acceptImages?: boolean; acceptFiles?: boolean;
  children?: React.ReactNode;
}) {
  const { toast } = useToast();
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const uploadFiles = async (fileList: File[]) => {
    const files = fileList.slice(0, 10);
    if (!files.length) return;
    setUploading(true);
    try {
      const fd = new FormData();
      for (const f of files) fd.append("photos", f);
      fd.append("phase", phase);
      fd.append("subCategory", subCategory);
      const res = await fetch(`${API_BASE}/api/projects/${projectId}/photos/upload`, {
        method: "POST", headers: { Authorization: `Bearer ${getAuthToken()}` }, body: fd,
      });
      if (!res.ok) throw new Error("업로드 실패");
      const uploaded = await res.json();
      const urls = uploaded.map((p: any) => p.imageUrl);
      onUploaded([...existingUrls, ...urls]);
      toast({ title: `${files.length}개 첨부되었습니다` });
    } catch { toast({ title: "업로드 실패", variant: "destructive" }); }
    finally { setUploading(false); }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) uploadFiles(files);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/") || (acceptFiles && item.kind === "file")) {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length) { e.preventDefault(); uploadFiles(files); }
  };

  const isImage = (url: string) => /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?|$)/i.test(url);
  const getFileName = (url: string) => decodeURIComponent(url.split("/").pop() || "파일");

  const acceptStr = acceptImages && acceptFiles ? "*" : acceptImages ? "image/*" : "*";

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onPaste={handlePaste}
      className={`relative rounded-lg border-2 border-dashed p-3 transition-colors ${dragging ? "border-primary bg-primary/5" : "border-muted"}`}
    >
      {children}
      {existingUrls.length > 0 && (
        <div className="grid grid-cols-4 gap-1.5 mt-2">
          {existingUrls.map((url, i) => (
            isImage(url) ? (
              <div key={i} className="aspect-square rounded overflow-hidden border">
                <img src={url} alt="" className="w-full h-full object-cover" />
              </div>
            ) : (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                className="flex flex-col items-center justify-center p-2 rounded border bg-muted/30 hover:bg-muted/60 text-center gap-1">
                <FileText className="w-5 h-5 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground line-clamp-2 break-all">{getFileName(url)}</span>
              </a>
            )
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 mt-1.5">
        <label className="text-xs text-primary cursor-pointer hover:underline">
          {uploading ? "업로드 중..." : (acceptFiles ? "사진/파일 첨부" : "사진 첨부")}
          <input type="file" accept={acceptStr} multiple className="hidden" disabled={uploading}
            onChange={(e) => { if (e.target.files) uploadFiles(Array.from(e.target.files)); e.target.value = ""; }} />
        </label>
        <span className="text-xs text-muted-foreground">드래그, Ctrl+V 가능</span>
      </div>
      {dragging && (
        <div className="absolute inset-0 rounded-lg bg-primary/10 flex items-center justify-center pointer-events-none z-10">
          <p className="text-sm font-medium text-primary">여기에 파일을 놓으세요</p>
        </div>
      )}
    </div>
  );
}

// Backward compat alias
const ImageDropZone = FileDropZone;

// ─── Reusable Attachment Display ────────────────────────────
const isImageUrl = (url: string) => /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?|$)/i.test(url);
const getFileNameFromUrl = (url: string) => {
  try { return decodeURIComponent(url.split("/").pop()?.split("?")[0] || "파일"); }
  catch { return "파일"; }
};

function AttachmentDisplay({ urls, onRemove, compact = false }: {
  urls: string[]; onRemove?: (idx: number) => void; compact?: boolean;
}) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  if (!urls.length) return null;
  const gridCls = compact ? "grid grid-cols-4 sm:grid-cols-6 gap-1.5" : "grid grid-cols-2 sm:grid-cols-3 gap-2";
  const sizeCls = compact ? "w-16 h-16" : "aspect-square";
  return (
    <>
      <div className={gridCls}>
        {urls.map((url, i) =>
          isImageUrl(url) ? (
            <div key={i} className={`${sizeCls} rounded overflow-hidden border cursor-pointer hover:opacity-80 transition-opacity relative group`}
              onClick={() => setLightboxUrl(url)}>
              <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
              {onRemove && (
                <button className="absolute top-0 right-0 bg-black/60 text-white rounded-bl w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 text-[10px]"
                  onClick={(e) => { e.stopPropagation(); onRemove(i); }}>×</button>
              )}
            </div>
          ) : (
            <a key={i} href={url} target="_blank" rel="noopener noreferrer" download
              className={`${sizeCls} flex flex-col items-center justify-center p-1 rounded border bg-muted/30 hover:bg-muted/60 text-center gap-0.5 relative group`}>
              <Download className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[9px] text-muted-foreground line-clamp-2 break-all leading-tight">{getFileNameFromUrl(url)}</span>
              {onRemove && (
                <button className="absolute top-0 right-0 bg-black/60 text-white rounded-bl w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 text-[10px]"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(i); }}>×</button>
              )}
            </a>
          )
        )}
      </div>
      {lightboxUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setLightboxUrl(null)}>
          <div className="relative max-w-4xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="absolute -top-10 right-0 text-white hover:text-white/80" onClick={() => setLightboxUrl(null)}>
              <X className="w-6 h-6" />
            </Button>
            <img src={lightboxUrl} alt="" className="max-w-full max-h-[85vh] object-contain rounded-lg" />
          </div>
        </div>
      )}
    </>
  );
}

// ─── Construction Category Priority (for sensible insertion order) ────
const CONSTRUCTION_CATEGORY_PRIORITY: Record<string, number> = {
  "가설공사": 10,
  "토공사": 20,
  "기초공사": 30,
  "철근콘크리트공사": 40,
  "철골공사": 45,
  "조적공사": 50,
  "방수공사": 60,
  "석공사": 65,
  "타일공사": 70,
  "목공사": 75,
  "금속공사": 78,
  "창호공사": 80,
  "도장공사": 85,
  "수장공사": 87,
  "단열공사": 90,
  "지붕공사": 95,
  "전기공사": 100,
  "설비공사": 110,
  "소방공사": 115,
  "통신공사": 118,
  "승강기공사": 120,
  "조경공사": 130,
  "외부마감": 140,
  "준공청소": 150,
  "기타": 999,
};
import {
  Plus, Calendar, FileText, Camera,
  MapPin, User, ExternalLink, Download, X,
  Cloud, Users, CheckCircle2, ClipboardList,
  HardHat, AlertTriangle, Search, MessageSquare,
  FolderTree, ChevronDown, ChevronRight, Building2, Ruler, Layers, Trash2,
  GripVertical, Pencil, ArrowUpDown, Image as ImageIcon, Clock
} from "lucide-react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type {
  Project, Schedule, DailyLog, File as ProjectFile, Photo,
  DesignChange, DesignCheck, ConstructionTask, Inspection, Defect,
  ClientRequest, Comment,
} from "@shared/schema";
import { ConstructionCheckCategory } from "@shared/schema";

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

function isImageLikeUrl(url: string) {
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(url) || url.includes("/api/photos/file/") || url.includes("/uploads/photos/");
}

function extractGoogleDriveFileId(url: string) {
  const patterns = [
    /\/file\/d\/([^/]+)/,
    /[?&]id=([^&]+)/,
  ];
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
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {attachments.map((url, i) => {
          const isImage = isImageLikeUrl(url);
          const fileName = decodeURIComponent(url.split("/").pop()?.split("?")[0] || "파일");
          return isImage ? (
            <button
              key={`${url}-${i}`}
              type="button"
              className="aspect-[4/3] rounded-lg overflow-hidden border hover:opacity-90 transition-opacity"
              onClick={() => setLightboxUrl(url)}
            >
              <img src={url} alt="attachment" className="w-full h-full object-cover" />
            </button>
          ) : (
            <a
              key={`${url}-${i}`}
              href={getDownloadableUrl(url)}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border p-3 flex items-center gap-2 hover:bg-muted/40 transition-colors"
            >
              <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground line-clamp-2 break-all">{fileName}</span>
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
function ProjectMembersCard({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const { data: members } = useQuery<any[]>({ queryKey: [`/api/projects/${projectId}/members`] });
  const { data: users } = useQuery<any[]>({ queryKey: ["/api/users"] });

  const addMemberMutation = useMutation({
    mutationFn: async (data: any) => { await apiRequest("POST", `/api/projects/${projectId}/members`, data); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/members`] }); toast({ title: "멤버가 추가되었습니다" }); setAddOpen(false); },
    onError: (err: any) => { toast({ title: "오류", description: err.message, variant: "destructive" }); },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/projects/${projectId}/members`, { id }); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/members`] }); toast({ title: "멤버가 제거되었습니다" }); },
  });

  const memberUserIds = members?.map((m) => m.userId) ?? [];
  const availableUsers = users?.filter((u) => !memberUserIds.includes(u.id)) ?? [];

  const getMemberRoleLabel = (role: string) => {
    const map: Record<string, string> = { PM: "매니저", MEMBER: "팀원", CLIENT: "건축주" };
    return map[role] ?? role;
  };

  const getUserName = (userId: string) => {
    const u = users?.find((u) => u.id === userId);
    return u ? `${u.name} (${u.email})` : userId;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5" /> 프로젝트 멤버</CardTitle>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" />멤버 추가</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>프로젝트 멤버 추가</DialogTitle></DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              addMemberMutation.mutate({ userId: fd.get("userId"), role: fd.get("role") });
            }} className="space-y-4">
              <div className="space-y-2">
                <Label>사용자</Label>
                <select name="userId" required className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">선택...</option>
                  {availableUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.email}) - {u.role === "CLIENT" ? "건축주" : u.role === "PM" ? "매니저" : "팀원"}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>프로젝트 역할</Label>
                <select name="role" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" defaultValue="MEMBER">
                  <option value="PM">매니저 (편집 권한)</option>
                  <option value="MEMBER">팀원 (편집 권한)</option>
                  <option value="CLIENT">건축주 (조회 권한)</option>
                </select>
              </div>
              <Button type="submit" disabled={addMemberMutation.isPending} className="w-full">추가</Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {!members?.length ? (
          <p className="text-sm text-muted-foreground text-center py-4">등록된 멤버가 없습니다. 멤버를 추가하면 해당 프로젝트에 접근할 수 있습니다.</p>
        ) : (
          <div className="space-y-2">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg border">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-medium">
                  {getUserName(m.userId).charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{getUserName(m.userId)}</p>
                </div>
                <Badge variant="outline">{getMemberRoleLabel(m.role)}</Badge>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => { if (confirm("이 멤버를 제거하시겠습니까?")) removeMemberMutation.mutate(m.id); }}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

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
          {/* 대표 사진 */}
          <div>
            {project.coverImageUrl ? (
              <div className="relative rounded-lg overflow-hidden border mb-3">
                <img src={project.coverImageUrl} alt="대표 사진" className="w-full max-h-72 object-contain bg-muted/30" />
                <div className="absolute bottom-2 right-2">
                  <label className="bg-black/60 text-white text-xs px-2 py-1 rounded cursor-pointer hover:bg-black/80">
                    변경
                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const fd = new FormData();
                      fd.append("photos", file);
                      fd.append("phase", project.currentPhase);
                      fd.append("subCategory", "대표사진");
                      const res = await fetch(`${API_BASE}/api/projects/${project.id}/photos/upload`, {
                        method: "POST", headers: { Authorization: `Bearer ${getAuthToken()}` }, body: fd,
                      });
                      if (res.ok) {
                        const [photo] = await res.json();
                        updateMutation.mutate({ coverImageUrl: photo.imageUrl });
                      }
                      e.target.value = "";
                    }} />
                  </label>
                </div>
              </div>
            ) : (
              <label className="flex items-center justify-center h-32 rounded-lg border-2 border-dashed border-muted cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors mb-3">
                <div className="text-center">
                  <Camera className="w-6 h-6 mx-auto text-muted-foreground mb-1" />
                  <p className="text-xs text-muted-foreground">대표 사진 등록</p>
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const fd = new FormData();
                  fd.append("photos", file);
                  fd.append("phase", project.currentPhase);
                  fd.append("subCategory", "대표사진");
                  const res = await fetch(`${API_BASE}/api/projects/${project.id}/photos/upload`, {
                    method: "POST", headers: { Authorization: `Bearer ${getAuthToken()}` }, body: fd,
                  });
                  if (res.ok) {
                    const [photo] = await res.json();
                    updateMutation.mutate({ coverImageUrl: photo.imageUrl });
                  }
                  e.target.value = "";
                }} />
              </label>
            )}
          </div>
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

      {/* 프로젝트 멤버 */}
      <ProjectMembersCard projectId={project.id} />

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
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>현재 진행 단계</CardTitle>
          <select
            value={project.currentPhase}
            onChange={(e) => updateMutation.mutate({ currentPhase: e.target.value })}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium"
          >
            <option value="DESIGN">설계</option>
            <option value="PERMIT">인허가</option>
            <option value="CONSTRUCTION">시공</option>
            <option value="COMPLETION">준공</option>
            <option value="PORTFOLIO">포트폴리오</option>
          </select>
        </CardHeader>
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
              const bf = parseInt(fd.get("basementFloors") as string) || 0;
              const af = parseInt(fd.get("aboveFloors") as string) || 0;
              const floorsText = [bf > 0 ? `지하${bf}층` : "", af > 0 ? `지상${af}층` : ""].filter(Boolean).join(" / ") || null;
              updateMutation.mutate({
                description: fd.get("description") || null,
                clientName: fd.get("clientName") || null,
                address: fd.get("address") || null,
                buildingArea: fd.get("buildingArea") || null,
                totalFloorArea: fd.get("totalFloorArea") || null,
                buildingCoverage: fd.get("buildingCoverage") || null,
                floorAreaRatio: fd.get("floorAreaRatio") || null,
                floors: floorsText,
                basementFloors: bf,
                aboveFloors: af,
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
                <Label>지하 층수</Label>
                <select name="basementFloors" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" defaultValue={p.basementFloors ?? 0}>
                  {[0,1,2,3,4,5].map((n) => <option key={n} value={n}>{n === 0 ? "없음" : `지하 ${n}층`}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>지상 층수</Label>
                <select name="aboveFloors" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" defaultValue={p.aboveFloors ?? 0}>
                  {[0,1,2,3,4,5,6,7,8,9,10,15,20].map((n) => <option key={n} value={n}>{n === 0 ? "없음" : `지상 ${n}층`}</option>)}
                </select>
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
function DesignTab({ projectId, project }: { projectId: string; project: Project }) {
  const { toast } = useToast();
  const [checkDialogOpen, setCheckDialogOpen] = useState(false);
  const [changeDialogOpen, setChangeDialogOpen] = useState(false);
  // selectedChange removed - edit/delete now inline via pencil icon
  const [showAllFloors, setShowAllFloors] = useState(false);
  const [designLightbox, setDesignLightbox] = useState<string | null>(null);
  const [editingCheck, setEditingCheck] = useState<DesignCheck | null>(null);

  const { data: allDesignChecks } = useQuery<DesignCheck[]>({ queryKey: [`/api/projects/${projectId}/design-checks`] });
  const designChecks = allDesignChecks?.filter((c) => (c as any).phase === "DESIGN" || !(c as any).phase) ?? [];
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
    mutationFn: async ({ id, ...data }: { id: string; [key: string]: any }) => {
      const patchData = { ...data };
      if ('isCompleted' in patchData) patchData.completedAt = patchData.isCompleted ? new Date().toISOString() : null;
      await apiRequest("PATCH", `/api/design-checks/${id}`, patchData);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/design-checks`] }); },
  });

  const updateCheckMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => { await apiRequest("PATCH", `/api/design-checks/${id}`, data); },
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

  const updateChangeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => { await apiRequest("PATCH", `/api/design-changes/${id}`, data); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/design-changes`] }); },
  });

  const deleteChangeMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/design-changes/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/design-changes`] }); toast({ title: "설계변경이 삭제되었습니다" }); setSelectedChange(null); },
  });

  const [editingChange, setEditingChange] = useState<DesignChange | null>(null);

  const completedCount = designChecks?.filter((c) => c.isCompleted === 1).length ?? 0;
  const totalCount = designChecks?.length ?? 0;

  const categories = ["ARCHITECTURE", "STRUCTURE", "MEP", "INTERIOR", "LANDSCAPE", "PERMIT_DOC"];
  const grouped: Record<string, DesignCheck[]> = {};
  categories.forEach((cat) => {
    const items = designChecks?.filter((c) => c.category === cat) ?? [];
    if (items.length > 0) grouped[cat] = items;
  });

  const { data: photos } = useQuery<Photo[]>({ queryKey: [`/api/projects/${projectId}/photos`] });

  // Floor plan slots based on project floor count
  const pp = project as any;
  const basementFloors = pp.basementFloors ?? 0;
  const aboveFloors = pp.aboveFloors ?? 0;
  const floorSlots: string[] = [];
  for (let i = basementFloors; i >= 1; i--) floorSlots.push(`평면도-지하${i}층`);
  for (let i = 1; i <= aboveFloors; i++) floorSlots.push(`평면도-${i}층`);
  if (aboveFloors > 0) floorSlots.push("평면도-옥상");
  if (floorSlots.length === 0) floorSlots.push("평면도-1층"); // default at least 1

  const elevationSlots = ["입면도-정면", "입면도-우측", "입면도-좌측", "입면도-배면", "입면도-대표"];

  const getSlotPhotos = (sub: string) => photos?.filter((p) => p.phase === "DESIGN" && (p as any).subCategory === sub) ?? [];
  const visibleFloorSlots = showAllFloors ? floorSlots : floorSlots.slice(0, 5);

  return (
    <div className="space-y-6" data-testid="design-tab">
      {/* 평면도 (Floor Plans) */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Layers className="w-5 h-5" /> 평면도</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {visibleFloorSlots.map((slot) => {
              const slotPhotos = getSlotPhotos(slot);
              const label = slot.replace("평면도-", "");
              return (
                <div key={slot} className="space-y-2">
                  <p className="text-sm font-semibold">{label}</p>
                  {slotPhotos.length > 0 ? (
                    <div className="space-y-2">
                      {slotPhotos.map((p) => (
                        <button key={p.id} type="button" className="w-full aspect-[4/3] rounded-lg overflow-hidden border hover:opacity-90 transition-opacity"
                          onClick={() => setDesignLightbox(p.imageUrl)}>
                          <img src={p.imageUrl} alt={label} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="aspect-[4/3] rounded-lg border-2 border-dashed border-muted flex items-center justify-center">
                      <ImageIcon className="w-10 h-10 text-muted-foreground/30" />
                    </div>
                  )}
                  <FileDropZone projectId={projectId} phase="DESIGN" subCategory={slot} acceptFiles
                    existingUrls={[]} onUploaded={() => queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/photos`] })}>
                    <span className="text-xs text-muted-foreground">사진/파일 추가</span>
                  </FileDropZone>
                </div>
              );
            })}
          </div>
          {floorSlots.length > 5 && (
            <Button variant="ghost" size="sm" className="w-full mt-2 text-xs"
              onClick={() => setShowAllFloors(!showAllFloors)}>
              {showAllFloors ? "접기" : `나머지 ${floorSlots.length - 5}개 층 보기`}
              {showAllFloors ? <ChevronDown className="w-3 h-3 ml-1" /> : <ChevronRight className="w-3 h-3 ml-1" />}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* 입면도 (Elevations) */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="w-5 h-5" /> 입면도</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {elevationSlots.map((slot) => {
              const slotPhotos = getSlotPhotos(slot);
              const label = slot.replace("입면도-", "");
              return (
                <div key={slot} className="space-y-2">
                  <p className="text-sm font-semibold">{label}</p>
                  {slotPhotos.length > 0 ? (
                    <div className="space-y-2">
                      {slotPhotos.map((p) => (
                        <button key={p.id} type="button" className="w-full aspect-[4/3] rounded-lg overflow-hidden border hover:opacity-90 transition-opacity"
                          onClick={() => setDesignLightbox(p.imageUrl)}>
                          <img src={p.imageUrl} alt={label} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="aspect-[4/3] rounded-lg border-2 border-dashed border-muted flex items-center justify-center">
                      <ImageIcon className="w-10 h-10 text-muted-foreground/30" />
                    </div>
                  )}
                  <FileDropZone projectId={projectId} phase="DESIGN" subCategory={slot} acceptFiles
                    existingUrls={[]} onUploaded={() => queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/photos`] })}>
                    <span className="text-xs text-muted-foreground">사진/파일 추가</span>
                  </FileDropZone>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

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
                checkMutation.mutate({
                  phase: "DESIGN", category: fd.get("category"), title: fd.get("title"),
                  memo: fd.get("memo") || null,
                  linkedToConstruction: fd.get("linkedToConstruction") ? 1 : 0,
                });
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
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" name="linkedToConstruction" value="1" className="w-4 h-4" />
                  <span className="text-sm">시공 단계 체크리스트에도 자동 생성</span>
                </label>
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
                  <div className="space-y-2">
                    {items.map((item) => {
                      const itemAttachments: string[] = (item as any).attachments ? JSON.parse((item as any).attachments) : [];
                      const isCompleted = item.isCompleted === 1;
                      return (
                      <div key={item.id} className="p-3 rounded-lg border hover:bg-muted/30">
                        <div className="flex items-start gap-3">
                          <input type="checkbox" checked={isCompleted}
                            onChange={() => toggleCheckMutation.mutate({ id: item.id, isCompleted: isCompleted ? 0 : 1 })}
                            className="w-4 h-4 rounded border-gray-300 mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-medium ${isCompleted ? "line-through text-muted-foreground" : ""}`}>{item.title}</span>
                              {(item as any).linkedToConstruction === 1 && <Badge variant="outline" className="text-xs px-1.5">시공연동</Badge>}
                              {itemAttachments.length > 0 && <span className="text-xs text-muted-foreground"><Camera className="w-3 h-3 inline" /> {itemAttachments.length}</span>}
                              <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto shrink-0" onClick={() => setEditingCheck(item)}>
                                <Pencil className="w-3 h-3" />
                              </Button>
                            </div>
                            {/* 완료되지 않은 항목만 상세내용 표시 */}
                            {!isCompleted && (
                              <>
                                {item.memo && <p className="text-sm text-muted-foreground mt-1">{item.memo}</p>}
                                {itemAttachments.length > 0 && (
                                  <div className="mt-2">
                                    <AttachmentPreviewGrid attachments={itemAttachments} />
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      );
                    })}
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
              {designChanges.map((dc) => {
                const dcAttachments: string[] = (dc as any).attachments ? JSON.parse((dc as any).attachments) : [];
                return (
                <div key={dc.id} className="p-3 rounded-lg border">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{dc.title}</span>
                        <Badge variant="outline" className={getDesignChangeStatusColor(dc.status)}>{getDesignChangeStatusLabel(dc.status)}</Badge>
                        {dcAttachments.length > 0 && <span className="text-xs text-muted-foreground"><Camera className="w-3 h-3 inline" /> {dcAttachments.length}</span>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{dc.description}</p>
                      {dc.impactArea && <p className="text-xs text-muted-foreground mt-0.5">영향 범위: {dc.impactArea}</p>}
                      {dc.reason && <p className="text-xs text-muted-foreground mt-0.5">사유: {dc.reason}</p>}
                      {dcAttachments.length > 0 && (
                        <div className="mt-2"><AttachmentPreviewGrid attachments={dcAttachments} /></div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <select value={dc.status}
                        onChange={(e) => { changeStatusMutation.mutate({ id: dc.id, status: e.target.value }); }}
                        className="rounded-md border border-input bg-background px-1.5 py-0.5 text-xs h-7">
                        <option value="REQUESTED">요청</option><option value="REVIEWING">검토중</option>
                        <option value="APPROVED">승인</option><option value="REJECTED">반려</option><option value="APPLIED">적용완료</option>
                      </select>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingChange(dc)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => { if (confirm("이 설계변경을 삭제하시겠습니까?")) deleteChangeMutation.mutate(dc.id); }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* selectedChange dialog removed - edit/delete now inline via pencil icon */}

      {/* 설계변경 수정 다이얼로그 */}
      {editingChange && (() => {
        const ecAttachments: string[] = (editingChange as any).attachments ? JSON.parse((editingChange as any).attachments) : [];
        return (
        <Dialog open onOpenChange={() => setEditingChange(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>설계변경 수정</DialogTitle></DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault(); const fd = new FormData(e.currentTarget);
              updateChangeMutation.mutate({
                id: editingChange.id,
                data: {
                  title: fd.get("title"), description: fd.get("description"),
                  reason: fd.get("reason") || null, impactArea: fd.get("impactArea") || null,
                },
              });
              setEditingChange(null);
              toast({ title: "설계변경이 수정되었습니다" });
            }} className="space-y-4">
              <div className="space-y-2"><Label>제목</Label><Input name="title" required defaultValue={editingChange.title} /></div>
              <div className="space-y-2"><Label>설명</Label><Textarea name="description" required defaultValue={editingChange.description} /></div>
              <div className="space-y-2"><Label>변경 사유</Label><Input name="reason" defaultValue={editingChange.reason || ""} /></div>
              <div className="space-y-2"><Label>영향 범위</Label><Input name="impactArea" defaultValue={editingChange.impactArea || ""} /></div>
              <div className="space-y-2">
                <Label>첨부파일</Label>
                {ecAttachments.length > 0 && (
                  <AttachmentDisplay urls={ecAttachments} onRemove={(idx) => {
                    const next = ecAttachments.filter((_, i) => i !== idx);
                    updateChangeMutation.mutate({ id: editingChange.id, data: { attachments: JSON.stringify(next) } });
                  }} compact />
                )}
                <FileDropZone projectId={projectId} phase="DESIGN" subCategory="설계변경첨부" acceptFiles
                  existingUrls={[]}
                  onUploaded={(urls) => updateChangeMutation.mutate({ id: editingChange.id, data: { attachments: JSON.stringify([...ecAttachments, ...urls]) } })} />
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="flex-1">저장</Button>
                <Button type="button" variant="destructive" onClick={() => { if (confirm("이 설계변경을 삭제하시겠습니까?")) { deleteChangeMutation.mutate(editingChange.id); setEditingChange(null); } }}>삭제</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        );
      })()}

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

      {/* 체크리스트 수정 다이얼로그 */}
      {editingCheck && (() => {
        const ecAttachments: string[] = (editingCheck as any).attachments ? JSON.parse((editingCheck as any).attachments) : [];
        return (
        <Dialog open onOpenChange={() => setEditingCheck(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>체크리스트 항목 수정</DialogTitle></DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault(); const fd = new FormData(e.currentTarget);
              toggleCheckMutation.mutate({ id: editingCheck.id, title: fd.get("title") as string, memo: fd.get("memo") as string || null });
              setEditingCheck(null);
            }} className="space-y-4">
              <div className="space-y-2"><Label>항목명</Label><Input name="title" required defaultValue={editingCheck.title} /></div>
              <div className="space-y-2"><Label>메모</Label><Textarea name="memo" defaultValue={editingCheck.memo || ""} /></div>
              <div className="space-y-2">
                <Label>첨부파일</Label>
                {ecAttachments.length > 0 && (
                  <AttachmentDisplay urls={ecAttachments} onRemove={(idx) => {
                    const next = ecAttachments.filter((_, i) => i !== idx);
                    toggleCheckMutation.mutate({ id: editingCheck.id, attachments: JSON.stringify(next) });
                  }} compact />
                )}
                <FileDropZone projectId={projectId} phase="DESIGN" subCategory="체크리스트첨부" acceptFiles
                  existingUrls={[]}
                  onUploaded={(urls) => toggleCheckMutation.mutate({ id: editingCheck.id, attachments: JSON.stringify([...ecAttachments, ...urls]) })} />
              </div>
              <Button type="submit" className="w-full">저장</Button>
            </form>
          </DialogContent>
        </Dialog>
        );
      })()}

      {/* 건축주 요청사항 (설계 단계) */}
      <RequestsSection projectId={projectId} phase="DESIGN" />

      {/* 설계 도면 라이트박스 */}
      {designLightbox && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setDesignLightbox(null)}>
          <div className="relative max-w-5xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="absolute -top-10 right-0 text-white hover:text-white/80" onClick={() => setDesignLightbox(null)}>
              <X className="w-6 h-6" />
            </Button>
            <img src={designLightbox} alt="" className="max-w-full max-h-[85vh] object-contain rounded-lg" />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Shared Requests Section ─────────────────────────────────
function RequestsSection({ projectId, phase }: { projectId: string; phase: string }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedReq, setExpandedReq] = useState<string | null>(null);
  const [editingReq, setEditingReq] = useState<ClientRequest | null>(null);
  const [newReqAttachments, setNewReqAttachments] = useState<string[]>([]);
  const isAdmin = user?.role === "SUPER_ADMIN";
  const isPM = user?.role === "PM" || isAdmin;

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

  const deleteRequestMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/requests/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/requests`] }); toast({ title: "요청사항이 삭제되었습니다" }); setExpandedReq(null); },
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
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setNewReqAttachments([]); }}>
          <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" />요청 등록</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>요청사항 등록 ({phaseLabel} 단계)</DialogTitle></DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault(); const fd = new FormData(e.currentTarget);
              requestMutation.mutate({
                phase, title: fd.get("title"), content: fd.get("content"),
                category: fd.get("category"), priority: fd.get("priority"), status: "NEW",
                attachments: newReqAttachments.length ? JSON.stringify(newReqAttachments) : null,
              });
              setNewReqAttachments([]);
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
              <div className="space-y-2">
                <Label>사진 첨부</Label>
                <FileDropZone projectId={projectId} phase={phase} subCategory="요청첨부" acceptFiles
                  existingUrls={newReqAttachments} onUploaded={setNewReqAttachments} />
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
            {requests.map((req) => {
              const attachments: string[] = (req as any).attachments ? JSON.parse((req as any).attachments) : [];
              return (
                <div key={req.id} className="p-3 rounded-lg border">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{req.title}</span>
                        <Badge variant="outline" className={getRequestStatusColor(req.status)}>{getRequestStatusLabel(req.status)}</Badge>
                        <Badge variant="outline" className="text-xs">{getRequestPriorityLabel(req.priority)}</Badge>
                        {attachments.length > 0 && <span className="text-xs text-muted-foreground"><Camera className="w-3 h-3 inline" /> {attachments.length}</span>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{req.content}</p>
                      {attachments.length > 0 && (
                        <div className="mt-2"><AttachmentPreviewGrid attachments={attachments} /></div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {isPM && (
                        <select value={req.status} onChange={(e) => updateRequestMutation.mutate({ id: req.id, data: { status: e.target.value } })}
                          className="rounded-md border border-input bg-background px-1.5 py-0.5 text-xs h-7">
                          <option value="NEW">신규</option><option value="REVIEWING">검토중</option><option value="IN_PROGRESS">진행중</option>
                          <option value="RESOLVED">해결</option><option value="ON_HOLD">보류</option><option value="REJECTED">반려</option>
                        </select>
                      )}
                      {(isPM || req.createdBy === user?.id) && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingReq(req)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {(isAdmin || req.createdBy === user?.id) && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => { if (confirm("이 요청사항을 삭제하시겠습니까?")) deleteRequestMutation.mutate(req.id); }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {/* 댓글 토글 */}
                  <div className="mt-2">
                    <button className="text-xs text-primary hover:underline flex items-center gap-1"
                      onClick={() => setExpandedReq(expandedReq === req.id ? null : req.id)}>
                      <MessageSquare className="w-3 h-3" />
                      댓글 {expandedReq === req.id ? "접기" : "보기"}
                    </button>
                    {expandedReq === req.id && (
                      <div className="mt-2 space-y-2">
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
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
      {/* 요청사항 수정 다이얼로그 */}
      {editingReq && (() => {
        const erAttachments: string[] = (editingReq as any).attachments ? JSON.parse((editingReq as any).attachments) : [];
        return (
        <Dialog open onOpenChange={() => setEditingReq(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>요청사항 수정</DialogTitle></DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault(); const fd = new FormData(e.currentTarget);
              updateRequestMutation.mutate({
                id: editingReq.id,
                data: {
                  title: fd.get("title"),
                  content: fd.get("content"),
                  category: fd.get("category"),
                  priority: fd.get("priority"),
                },
              });
              setEditingReq(null);
            }} className="space-y-4">
              <div className="space-y-2"><Label>제목</Label><Input name="title" defaultValue={editingReq.title} required /></div>
              <div className="space-y-2"><Label>내용</Label><Textarea name="content" defaultValue={editingReq.content} required /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>분류</Label>
                  <select name="category" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" defaultValue={editingReq.category}>
                    <option value="DESIGN_CHANGE">설계변경</option><option value="MATERIAL_CHANGE">자재변경</option>
                    <option value="ADDITIONAL_WORK">추가공사</option><option value="SCHEDULE_CHANGE">일정변경</option><option value="OTHER">기타</option>
                  </select>
                </div>
                <div className="space-y-2"><Label>우선순위</Label>
                  <select name="priority" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" defaultValue={editingReq.priority}>
                    <option value="URGENT">긴급</option><option value="HIGH">높음</option>
                    <option value="NORMAL">보통</option><option value="LOW">낮음</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>첨부파일</Label>
                {erAttachments.length > 0 && (
                  <AttachmentDisplay urls={erAttachments} onRemove={(idx) => {
                    const next = erAttachments.filter((_, i) => i !== idx);
                    updateRequestMutation.mutate({ id: editingReq.id, data: { attachments: JSON.stringify(next) } });
                  }} compact />
                )}
                <FileDropZone projectId={projectId} phase={phase} subCategory="요청첨부" acceptFiles
                  existingUrls={[]}
                  onUploaded={(urls) => updateRequestMutation.mutate({ id: editingReq.id, data: { attachments: JSON.stringify([...erAttachments, ...urls]) } })} />
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="flex-1">저장</Button>
                <Button type="button" variant="destructive" onClick={() => { if (confirm("이 요청사항을 삭제하시겠습니까?")) { deleteRequestMutation.mutate(editingReq.id); setEditingReq(null); } }}>삭제</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        );
      })()}
    </Card>
  );
}

// ─── Sortable Task Item ──────────────────────────────────────
function SortableTaskItem({ task, isExpanded, onToggle, progress, onProgressChange, onProgressCommit, onStatusChange, onEdit, onDelete, onUpdateTask, photos, projectId, reorderMode }: {
  task: ConstructionTask; isExpanded: boolean; onToggle: () => void;
  progress: number; onProgressChange: (v: number) => void; onProgressCommit: (v: number) => void;
  onStatusChange: (s: string) => void; onEdit: () => void; onDelete: () => void;
  onUpdateTask: (data: any) => void; photos: Photo[]; projectId: string; reorderMode: boolean;
}) {
  const { toast } = useToast();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, disabled: !reorderMode });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  const t = task as any;
  const checklistItems: string[] = t.checklist ? JSON.parse(t.checklist) : [];
  const taskPhotos = photos.filter((p) => (p as any).subCategory === task.category || (p as any).subCategory === task.title);
  const [uploading, setUploading] = useState(false);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    try {
      const fd = new FormData();
      for (const f of Array.from(files)) fd.append("photos", f);
      fd.append("phase", "CONSTRUCTION");
      fd.append("subCategory", task.category);
      const res = await fetch(`${API_BASE}/api/projects/${projectId}/photos/upload`, {
        method: "POST", headers: { Authorization: `Bearer ${getAuthToken()}` }, body: fd,
      });
      if (!res.ok) throw new Error("업로드 실패");
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/photos`] });
      toast({ title: "사진이 업로드되었습니다" });
    } catch { toast({ title: "업로드 실패", variant: "destructive" }); }
    finally { setUploading(false); e.target.value = ""; }
  };

  return (
    <div ref={setNodeRef} style={style} className="p-3 rounded-lg border bg-background">
      <div className="flex items-start gap-2">
        {reorderMode && (
          <button {...attributes} {...listeners} className="mt-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none">
            <GripVertical className="w-4 h-4" />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="text-sm font-medium">{task.title}</span>
              <Badge variant="outline" className="text-xs">{task.category}</Badge>
              <Badge variant="outline" className={getTaskStatusColor(task.status)}>{getTaskStatusLabel(task.status)}</Badge>
              {task.assignee && <span className="text-xs text-muted-foreground">{task.assignee}</span>}
              {taskPhotos.length > 0 && <span className="text-xs text-muted-foreground"><Camera className="w-3 h-3 inline" /> {taskPhotos.length}</span>}
              <div className="ml-auto flex items-center gap-1 shrink-0">
                <Button variant="outline" size="sm" className="h-6 text-xs px-2" onClick={onToggle}>
                  {isExpanded ? <ChevronDown className="w-3 h-3 mr-1" /> : <ChevronRight className="w-3 h-3 mr-1" />}
                  {isExpanded ? "접기" : "상세"}
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onEdit}>
                  <Pencil className="w-3 h-3" />
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-muted rounded-full h-2">
                <div className={`h-2 rounded-full transition-all ${task.status === "DELAYED" ? "bg-red-500" : "bg-primary"}`} style={{ width: `${progress}%` }} />
              </div>
              <span className="text-xs font-medium w-10 text-right">{progress}%</span>
            </div>
            {(task.startDate || task.endDate) && <p className="text-xs text-muted-foreground mt-1">{task.startDate} ~ {task.endDate}</p>}
            {/* 축소 상태에서도 메모, 체크리스트, 사진 표시 */}
            {!isExpanded && (
              <>
                {t.memo && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.memo}</p>}
                {checklistItems.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    <ClipboardList className="w-3 h-3 inline mr-1" />체크리스트 {checklistItems.length}개
                  </p>
                )}
                {taskPhotos.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 mt-2">
                    {taskPhotos.slice(0, 15).map((ph) => (
                      <div key={ph.id} className="aspect-square rounded-lg overflow-hidden border">
                        <img src={ph.imageUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                    ))}
                    {taskPhotos.length > 15 && <div className="aspect-square rounded-lg border flex items-center justify-center text-sm font-medium text-muted-foreground">+{taskPhotos.length - 15}</div>}
                  </div>
                )}
              </>
            )}
          </div>
          {isExpanded && (
            <div className="mt-3 pt-3 border-t space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">진행률: {progress}%</Label>
                <input type="range" min="0" max="100" value={progress}
                  onChange={(e) => onProgressChange(parseInt(e.target.value))}
                  onMouseUp={(e) => onProgressCommit(parseInt((e.target as HTMLInputElement).value))}
                  onTouchEnd={(e) => onProgressCommit(parseInt((e.target as HTMLInputElement).value))}
                  className="w-full" />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs">상태:</Label>
                <select value={task.status} onChange={(e) => onStatusChange(e.target.value)}
                  className="rounded-md border border-input bg-background px-2 py-1 text-xs">
                  <option value="NOT_STARTED">미착수</option><option value="IN_PROGRESS">진행중</option>
                  <option value="COMPLETED">완료</option><option value="DELAYED">지연</option>
                </select>
                <Button variant="ghost" size="sm" className="h-7 ml-auto text-xs text-destructive hover:text-destructive" onClick={onDelete}>
                  <Trash2 className="w-3 h-3 mr-1" />삭제</Button>
              </div>

              {/* 메모 */}
              <div className="space-y-1">
                <Label className="text-xs">메모</Label>
                <Textarea defaultValue={t.memo || ""} placeholder="공정 관련 메모..."
                  onBlur={(e) => onUpdateTask({ memo: e.target.value || null })}
                  className="text-xs min-h-[50px]" />
              </div>

              {/* 체크리스트 */}
              <div className="space-y-1">
                <Label className="text-xs">체크리스트</Label>
                <div className="space-y-1">
                  {checklistItems.map((item: string, idx: number) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input type="checkbox" className="w-3.5 h-3.5" />
                      <span className="text-xs flex-1">{item}</span>
                      <button className="text-xs text-muted-foreground hover:text-destructive" onClick={() => {
                        const next = checklistItems.filter((_: string, i: number) => i !== idx);
                        onUpdateTask({ checklist: JSON.stringify(next) });
                      }}><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
                <form onSubmit={(e) => {
                  e.preventDefault(); const fd = new FormData(e.currentTarget);
                  const item = (fd.get("item") as string)?.trim();
                  if (!item) return;
                  const next = [...checklistItems, item];
                  onUpdateTask({ checklist: JSON.stringify(next) });
                  e.currentTarget.reset();
                }} className="flex gap-1">
                  <Input name="item" placeholder="항목 추가..." className="h-7 text-xs" />
                  <Button type="submit" size="sm" className="h-7 text-xs px-2">추가</Button>
                </form>
              </div>

              {/* 사진 */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label className="text-xs">사진 ({taskPhotos.length})</Label>
                  <label className="text-xs text-primary cursor-pointer hover:underline">
                    {uploading ? "업로드 중..." : "사진 추가"}
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} disabled={uploading} />
                  </label>
                </div>
                {taskPhotos.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {taskPhotos.map((ph) => (
                      <div key={ph.id} className="aspect-[4/3] rounded-lg overflow-hidden border">
                        <img src={ph.imageUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Construction Tab ────────────────────────────────────────
function ConstructionTab({ projectId, project }: { projectId: string; project: Project }) {
  const { toast } = useToast();
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [inspDialogOpen, setInspDialogOpen] = useState(false);
  const [defectDialogOpen, setDefectDialogOpen] = useState(false);
  const [checkDialogOpen, setCheckDialogOpen] = useState(false);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  // expandedInsp/expandedDefect removed - edit/delete via pencil icon
  const [localProgress, setLocalProgress] = useState<Record<string, number>>({});
  const [editTask, setEditTask] = useState<ConstructionTask | null>(null);
  const [reorderMode, setReorderMode] = useState(false);

  const { data: tasks } = useQuery<ConstructionTask[]>({ queryKey: [`/api/projects/${projectId}/construction-tasks`] });
  const { data: inspections } = useQuery<Inspection[]>({ queryKey: [`/api/projects/${projectId}/inspections`] });
  const { data: defects } = useQuery<Defect[]>({ queryKey: [`/api/projects/${projectId}/defects`] });
  const { data: designChecks } = useQuery<DesignCheck[]>({ queryKey: [`/api/projects/${projectId}/design-checks`] });
  const { data: allPhotos } = useQuery<Photo[]>({ queryKey: [`/api/projects/${projectId}/photos`] });
  const constructionPhotos = allPhotos?.filter((ph) => ph.phase === "CONSTRUCTION") ?? [];

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

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  // Optimistic reorder with local state
  const [optimisticTasks, setOptimisticTasks] = useState<ConstructionTask[] | null>(null);

  const handleDragEnd = (event: DragEndEvent) => {
    if (!reorderMode) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const source = optimisticTasks || sortedTasks;
    const oldIdx = source.findIndex((t) => t.id === active.id);
    const newIdx = source.findIndex((t) => t.id === over.id);
    const reordered = arrayMove(source, oldIdx, newIdx);
    setOptimisticTasks(reordered);
    reorderMutation.mutate(reordered.map((t) => t.id), {
      onSettled: () => setOptimisticTasks(null),
    });
  };

  const checkMutation = useMutation({
    mutationFn: async (data: any) => { await apiRequest("POST", `/api/projects/${projectId}/design-checks`, data); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/design-checks`] }); toast({ title: "체크리스트 항목이 추가되었습니다" }); setCheckDialogOpen(false); },
  });

  const toggleCheckMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; [key: string]: any }) => {
      const patchData = { ...data };
      if ('isCompleted' in patchData) patchData.completedAt = patchData.isCompleted ? new Date().toISOString() : null;
      await apiRequest("PATCH", `/api/design-checks/${id}`, patchData);
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

  const deleteDefectMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/defects/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/defects`] }); toast({ title: "하자가 삭제되었습니다" }); },
  });

  const [editingDefect, setEditingDefect] = useState<Defect | null>(null);
  const [editingCheck, setEditingCheck] = useState<DesignCheck | null>(null);
  const [editingInsp, setEditingInsp] = useState<Inspection | null>(null);

  const deleteInspMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/inspections/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/inspections`] }); toast({ title: "검수가 삭제되었습니다" }); },
  });

  const sortedTasks = tasks ? [...tasks].sort((a, b) => a.sortOrder - b.sortOrder) : [];
  const constructionChecks = designChecks?.filter((c) => (c as any).phase === "CONSTRUCTION") ?? [];
  const linkedDesignChecks = designChecks?.filter((c) => ((c as any).phase === "DESIGN" || !(c as any).phase) && (c as any).linkedToConstruction === 1) ?? [];

  // Floor info from project
  const p = project as any;
  const basementFloors = p.basementFloors ?? 0;
  const aboveFloors = p.aboveFloors ?? 0;
  const floorLabels: string[] = [];
  for (let i = basementFloors; i >= 1; i--) floorLabels.push(`지하${i}층`);
  for (let i = 1; i <= aboveFloors; i++) floorLabels.push(`${i}층`);
  if (aboveFloors > 0) floorLabels.push("옥상");

  // Bulk add handler - generates proper task names
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const handleBulkAdd = () => {
    const tasksData: any[] = [];
    let order = tasks?.length ?? 0;
    const cats = Array.from(bulkSelected);
    // Sort to match CONSTRUCTION_CATEGORIES order
    const catOrder = CONSTRUCTION_CATEGORIES.map((c) => c.value);
    cats.sort((a, b) => catOrder.indexOf(a) - catOrder.indexOf(b));

    for (const cat of cats) {
      // 골조 관련은 층별로 생성
      if (cat === "철근콘크리트공사" && floorLabels.length > 0) {
        for (const floor of floorLabels) {
          order++;
          tasksData.push({ title: `${cat} - ${floor}`, category: cat, status: "NOT_STARTED", progress: 0, sortOrder: order });
        }
      } else {
        order++;
        // 공정명을 카테고리와 다르게 구체적으로 생성
        const titleMap: Record<string, string> = {
          "가설공사": "가설 울타리 및 임시시설",
          "토공사": "터파기 및 되메우기",
          "기초공사": "기초 콘크리트 타설",
          "철골공사": "철골 구조물 설치",
          "조적공사": "벽체 조적",
          "방수공사": "방수층 시공",
          "석공사": "석재 마감",
          "타일공사": "타일 시공",
          "목공사": "목재 시공",
          "금속공사": "금속 시공",
          "창호공사": "창호 설치",
          "도장공사": "도장 마감",
          "수장공사": "도배 및 바닥재 시공",
          "단열공사": "단열재 시공",
          "지붕공사": "지붕 마감",
          "전기공사": "전기 배선 및 설비",
          "설비공사": "급배수/난방 배관",
          "소방공사": "소방 설비 설치",
          "통신공사": "통신 배선",
          "승강기공사": "승강기 설치",
          "조경공사": "조경 식재",
          "외부마감": "외부 마감재 시공",
          "준공청소": "최종 청소 및 정리",
        };
        tasksData.push({ title: titleMap[cat] || cat, category: cat, status: "NOT_STARTED", progress: 0, sortOrder: order });
      }
    }
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
            <span className="text-sm font-normal text-muted-foreground">
              {constructionChecks.filter((c) => c.isCompleted === 1).length}/{constructionChecks.length + linkedDesignChecks.length}
            </span>
          </CardTitle>
          <Dialog open={checkDialogOpen} onOpenChange={setCheckDialogOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" />추가</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>시공 체크리스트 항목 추가</DialogTitle></DialogHeader>
              <form onSubmit={(e) => {
                e.preventDefault(); const fd = new FormData(e.currentTarget);
                checkMutation.mutate({ phase: "CONSTRUCTION", category: fd.get("category"), title: fd.get("title"), memo: fd.get("memo") || null });
              }} className="space-y-4">
                <div className="space-y-2"><Label>공종 카테고리</Label>
                  <select name="category" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" defaultValue="기초">
                    {ConstructionCheckCategory.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-2"><Label>항목명</Label><Input name="title" required /></div>
                <div className="space-y-2"><Label>메모</Label><Textarea name="memo" /></div>
                <Button type="submit" disabled={checkMutation.isPending}>추가</Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 설계에서 연동된 항목 */}
          {linkedDesignChecks.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-orange-600 mb-2">설계 연동 항목</h4>
              <div className="space-y-2">
                {linkedDesignChecks.map((item) => (
                  <div key={item.id} className="p-3 rounded-lg border border-orange-200 dark:border-orange-900/30 bg-orange-50/50 dark:bg-orange-900/10">
                    <div className="flex items-start gap-3">
                      <input type="checkbox" checked={item.isCompleted === 1}
                        onChange={() => toggleCheckMutation.mutate({ id: item.id, isCompleted: item.isCompleted === 1 ? 0 : 1 })}
                        className="w-4 h-4 rounded border-gray-300 mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs px-1.5">{getDesignCheckCategoryLabel(item.category)}</Badge>
                          <span className={`text-sm font-medium ${item.isCompleted === 1 ? "line-through text-muted-foreground" : ""}`}>{item.title}</span>
                        </div>
                        {item.memo && <p className="text-sm text-muted-foreground mt-1">{item.memo}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 시공 전용 항목 */}
          {constructionChecks.length === 0 && linkedDesignChecks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">체크리스트 항목이 없습니다</p>
          ) : constructionChecks.length > 0 && (
            <div>
              {linkedDesignChecks.length > 0 && <h4 className="text-xs font-semibold text-muted-foreground mb-2">시공 항목</h4>}
              <div className="space-y-2">
                {constructionChecks.map((item) => {
                  const cAttachments: string[] = (item as any).attachments ? JSON.parse((item as any).attachments) : [];
                  const isCompleted = item.isCompleted === 1;
                  return (
                  <div key={item.id} className="p-3 rounded-lg border hover:bg-muted/30">
                    <div className="flex items-start gap-3">
                      <input type="checkbox" checked={isCompleted}
                        onChange={() => toggleCheckMutation.mutate({ id: item.id, isCompleted: isCompleted ? 0 : 1 })}
                        className="w-4 h-4 rounded border-gray-300 mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs px-1.5">{item.category}</Badge>
                          <span className={`text-sm font-medium ${isCompleted ? "line-through text-muted-foreground" : ""}`}>{item.title}</span>
                          {cAttachments.length > 0 && <span className="text-xs text-muted-foreground"><Camera className="w-3 h-3 inline" /> {cAttachments.length}</span>}
                          <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto shrink-0" onClick={() => setEditingCheck(item)}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                        </div>
                        {/* 완료되지 않은 항목만 상세내용 표시 */}
                        {!isCompleted && (
                          <>
                            {item.memo && <p className="text-sm text-muted-foreground mt-1">{item.memo}</p>}
                            {cAttachments.length > 0 && (
                              <div className="mt-2">
                                <AttachmentPreviewGrid attachments={cAttachments} />
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 공정 목록 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><HardHat className="w-5 h-5" /> 공정 목록</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant={reorderMode ? "default" : "outline"}
              onClick={() => setReorderMode(!reorderMode)}>
              <ArrowUpDown className="w-4 h-4 mr-1" />
              {reorderMode ? "순서변경 완료" : "순서 변경"}
            </Button>
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
                  const category = fd.get("category") as string;
                  // Calculate sort order: insert after the last task with the same category
                  const existing = sortedTasks;
                  let insertOrder = (tasks?.length ?? 0) + 1;
                  // First try: find last task with the same category
                  let foundSameCategory = false;
                  for (let i = existing.length - 1; i >= 0; i--) {
                    if (existing[i].category === category) {
                      insertOrder = existing[i].sortOrder + 1;
                      foundSameCategory = true;
                      break;
                    }
                  }
                  // Fallback: if no same category exists, insert by priority order
                  if (!foundSameCategory) {
                    const catPriority = CONSTRUCTION_CATEGORY_PRIORITY[category] ?? 500;
                    for (let i = 0; i < existing.length; i++) {
                      const existingPriority = CONSTRUCTION_CATEGORY_PRIORITY[existing[i].category] ?? 500;
                      if (existingPriority > catPriority) {
                        insertOrder = existing[i].sortOrder;
                        break;
                      }
                    }
                  }
                  taskMutation.mutate({
                    title: fd.get("title"), description: fd.get("description") || null,
                    category, status: "NOT_STARTED", progress: 0,
                    startDate: fd.get("startDate") || null, endDate: fd.get("endDate") || null,
                    assignee: fd.get("assignee") || null, sortOrder: insertOrder,
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
          {reorderMode && (
            <div className="mb-3 p-2 rounded-lg bg-primary/10 border border-primary/30 text-sm text-primary flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4" />
              순서 변경 모드: 왼쪽 핸들을 드래그하여 순서를 변경하세요
            </div>
          )}
          {!sortedTasks.length ? (
            <p className="text-sm text-muted-foreground text-center py-4">등록된 공정이 없습니다</p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={(optimisticTasks || sortedTasks).map((t) => t.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {(optimisticTasks || sortedTasks).map((task) => (
                    <SortableTaskItem key={task.id} task={task}
                      isExpanded={expandedTask === task.id}
                      onToggle={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
                      progress={getProgress(task)}
                      onProgressChange={(v) => setLocalProgress((prev) => ({ ...prev, [task.id]: v }))}
                      onProgressCommit={(v) => updateTaskMutation.mutate({ id: task.id, data: { progress: v } })}
                      onStatusChange={(s) => updateTaskMutation.mutate({ id: task.id, data: { status: s } })}
                      onEdit={() => { setEditTask(task); setExpandedTask(task.id); }}
                      onDelete={() => { if (confirm("이 공정을 삭제하시겠습니까?")) deleteTaskMutation.mutate(task.id); }}
                      onUpdateTask={(data) => updateTaskMutation.mutate({ id: task.id, data })}
                      photos={constructionPhotos}
                      projectId={projectId}
                      reorderMode={reorderMode}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
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
              {inspections.map((insp) => {
                const inspAttachments: string[] = (insp as any).attachments ? JSON.parse((insp as any).attachments) : [];
                return (
                <div key={insp.id} className="p-3 rounded-lg border">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{insp.title}</span>
                        <Badge variant="outline" className="text-xs">{insp.category}</Badge>
                        <Badge variant="outline" className={getInspectionResultColor(insp.result)}>{getInspectionResultLabel(insp.result)}</Badge>
                        {inspAttachments.length > 0 && <span className="text-xs text-muted-foreground"><Camera className="w-3 h-3 inline" /> {inspAttachments.length}</span>}
                      </div>
                      <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                        {insp.scheduledDate && <span>예정: {insp.scheduledDate}</span>}
                        {insp.completedDate && <span>완료: {insp.completedDate}</span>}
                        {insp.inspector && <span>검사자: {insp.inspector}</span>}
                      </div>
                      {insp.findings && <p className="text-xs text-muted-foreground mt-1">소견: {insp.findings}</p>}
                      {inspAttachments.length > 0 && (
                        <div className="mt-2"><AttachmentPreviewGrid attachments={inspAttachments} /></div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <select value={insp.result} onChange={(e) => updateInspMutation.mutate({ id: insp.id, data: { result: e.target.value } })}
                        className="rounded-md border border-input bg-background px-1.5 py-0.5 text-xs h-7">
                        <option value="PENDING">대기</option><option value="PASS">합격</option>
                        <option value="CONDITIONAL_PASS">조건부합격</option><option value="FAIL">불합격</option>
                      </select>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingInsp(insp)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => { if (confirm("이 검수를 삭제하시겠습니까?")) deleteInspMutation.mutate(insp.id); }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
                );
              })}
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
              {defects.map((defect) => {
                const defAttachments: string[] = (defect as any).attachments ? JSON.parse((defect as any).attachments) : [];
                return (
                <div key={defect.id} className="p-3 rounded-lg border">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{defect.title}</span>
                        <Badge variant="outline" className={getDefectSeverityColor(defect.severity)}>{getDefectSeverityLabel(defect.severity)}</Badge>
                        <Badge variant="outline">{getDefectStatusLabel(defect.status)}</Badge>
                        {defAttachments.length > 0 && <span className="text-xs text-muted-foreground"><Camera className="w-3 h-3 inline" /> {defAttachments.length}</span>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">위치: {defect.location}</p>
                      {defect.description && <p className="text-xs text-muted-foreground mt-0.5">{defect.description}</p>}
                      {defect.assignee && <p className="text-xs text-muted-foreground">담당: {defect.assignee}</p>}
                      {defAttachments.length > 0 && (
                        <div className="mt-2"><AttachmentPreviewGrid attachments={defAttachments} /></div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <select value={defect.status} onChange={(e) => updateDefectMutation.mutate({ id: defect.id, data: { status: e.target.value } })}
                        className="rounded-md border border-input bg-background px-1.5 py-0.5 text-xs h-7">
                        <option value="OPEN">접수</option><option value="IN_REPAIR">수리중</option><option value="REPAIRED">수리완료</option>
                        <option value="VERIFIED">확인</option><option value="CLOSED">종결</option>
                      </select>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingDefect(defect)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => { if (confirm("이 하자를 삭제하시겠습니까?")) deleteDefectMutation.mutate(defect.id); }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 하자 수정 다이얼로그 */}
      {editingDefect && (() => {
        const edAttachments: string[] = (editingDefect as any).attachments ? JSON.parse((editingDefect as any).attachments) : [];
        return (
        <Dialog open onOpenChange={() => setEditingDefect(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>하자 수정</DialogTitle></DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault(); const fd = new FormData(e.currentTarget);
              updateDefectMutation.mutate({
                id: editingDefect.id,
                data: {
                  title: fd.get("title"), description: fd.get("description"),
                  location: fd.get("location"), severity: fd.get("severity"),
                  assignee: fd.get("assignee") || null,
                },
              });
              setEditingDefect(null);
              toast({ title: "하자가 수정되었습니다" });
            }} className="space-y-4">
              <div className="space-y-2"><Label>제목</Label><Input name="title" required defaultValue={editingDefect.title} /></div>
              <div className="space-y-2"><Label>설명</Label><Textarea name="description" required defaultValue={editingDefect.description} /></div>
              <div className="space-y-2"><Label>위치</Label><Input name="location" required defaultValue={editingDefect.location} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>심각도</Label>
                  <select name="severity" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" defaultValue={editingDefect.severity}>
                    <option value="CRITICAL">심각</option><option value="MAJOR">중대</option><option value="MINOR">경미</option><option value="COSMETIC">미관</option>
                  </select>
                </div>
                <div className="space-y-2"><Label>담당자</Label><Input name="assignee" defaultValue={editingDefect.assignee || ""} /></div>
              </div>
              <div className="space-y-2">
                <Label>첨부파일</Label>
                {edAttachments.length > 0 && <AttachmentPreviewGrid attachments={edAttachments} />}
                <FileDropZone projectId={projectId} phase="CONSTRUCTION" subCategory="하자첨부" acceptFiles
                  existingUrls={[]}
                  onUploaded={(urls) => updateDefectMutation.mutate({ id: editingDefect.id, data: { attachments: JSON.stringify([...edAttachments, ...urls]) } })} />
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="flex-1">저장</Button>
                <Button type="button" variant="destructive" onClick={() => { if (confirm("이 하자를 삭제하시겠습니까?")) { deleteDefectMutation.mutate(editingDefect.id); setEditingDefect(null); } }}>삭제</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        );
      })()}

      {/* 건축주 요청사항 (시공 단계) */}
      <RequestsSection projectId={projectId} phase="CONSTRUCTION" />

      {/* 시공 체크리스트 수정 다이얼로그 */}
      {editingCheck && (() => {
        const ckAttachments: string[] = (editingCheck as any).attachments ? JSON.parse((editingCheck as any).attachments) : [];
        return (
        <Dialog open onOpenChange={() => setEditingCheck(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>체크리스트 항목 수정</DialogTitle></DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault(); const fd = new FormData(e.currentTarget);
              toggleCheckMutation.mutate({ id: editingCheck.id, title: fd.get("title") as string, memo: fd.get("memo") as string || null });
              setEditingCheck(null);
            }} className="space-y-4">
              <div className="space-y-2"><Label>항목명</Label><Input name="title" required defaultValue={editingCheck.title} /></div>
              <div className="space-y-2"><Label>메모</Label><Textarea name="memo" defaultValue={editingCheck.memo || ""} /></div>
              <div className="space-y-2">
                <Label>첨부파일</Label>
                {ckAttachments.length > 0 && (
                  <AttachmentDisplay urls={ckAttachments} onRemove={(idx) => {
                    const next = ckAttachments.filter((_, i) => i !== idx);
                    toggleCheckMutation.mutate({ id: editingCheck.id, attachments: JSON.stringify(next) });
                  }} compact />
                )}
                <FileDropZone projectId={projectId} phase="CONSTRUCTION" subCategory="체크리스트첨부" acceptFiles
                  existingUrls={[]}
                  onUploaded={(urls) => toggleCheckMutation.mutate({ id: editingCheck.id, attachments: JSON.stringify([...ckAttachments, ...urls]) })} />
              </div>
              <Button type="submit" className="w-full">저장</Button>
            </form>
          </DialogContent>
        </Dialog>
        );
      })()}

      {/* 검수 수정 다이얼로그 */}
      {editingInsp && (() => {
        const inspAttachments: string[] = (editingInsp as any).attachments ? JSON.parse((editingInsp as any).attachments) : [];
        return (
        <Dialog open onOpenChange={() => setEditingInsp(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>검수 수정</DialogTitle></DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault(); const fd = new FormData(e.currentTarget);
              updateInspMutation.mutate({
                id: editingInsp.id,
                data: {
                  title: fd.get("title"), category: fd.get("category"),
                  scheduledDate: fd.get("scheduledDate") || null,
                  completedDate: fd.get("completedDate") || null,
                  inspector: fd.get("inspector") || null,
                  result: fd.get("result"),
                  findings: fd.get("findings") || null,
                },
              });
              setEditingInsp(null);
              toast({ title: "검수가 수정되었습니다" });
            }} className="space-y-4">
              <div className="space-y-2"><Label>검수명</Label><Input name="title" required defaultValue={editingInsp.title} /></div>
              <div className="space-y-2"><Label>분류</Label><Input name="category" required defaultValue={editingInsp.category} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>예정일</Label><DateInput name="scheduledDate" defaultValue={editingInsp.scheduledDate || ""} /></div>
                <div className="space-y-2"><Label>완료일</Label><DateInput name="completedDate" defaultValue={editingInsp.completedDate || ""} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>결과</Label>
                  <select name="result" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" defaultValue={editingInsp.result}>
                    <option value="PENDING">대기</option><option value="PASS">합격</option>
                    <option value="CONDITIONAL_PASS">조건부합격</option><option value="FAIL">불합격</option>
                  </select>
                </div>
                <div className="space-y-2"><Label>검사자</Label><Input name="inspector" defaultValue={editingInsp.inspector || ""} /></div>
              </div>
              <div className="space-y-2"><Label>검사 소견</Label><Textarea name="findings" defaultValue={editingInsp.findings || ""} /></div>
              <div className="space-y-2">
                <Label>첨부파일</Label>
                {inspAttachments.length > 0 && (
                  <AttachmentDisplay urls={inspAttachments} onRemove={(idx) => {
                    const next = inspAttachments.filter((_, i) => i !== idx);
                    updateInspMutation.mutate({ id: editingInsp.id, data: { attachments: JSON.stringify(next) } });
                  }} compact />
                )}
                <FileDropZone projectId={projectId} phase="CONSTRUCTION" subCategory="검수첨부" acceptFiles
                  existingUrls={[]}
                  onUploaded={(urls) => updateInspMutation.mutate({ id: editingInsp.id, data: { attachments: JSON.stringify([...inspAttachments, ...urls]) } })} />
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="flex-1">저장</Button>
                <Button type="button" variant="destructive" onClick={() => { if (confirm("이 검수를 삭제하시겠습니까?")) { deleteInspMutation.mutate(editingInsp.id); setEditingInsp(null); } }}>삭제</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        );
      })()}

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
              <div className="flex gap-2">
                <Button type="submit" className="flex-1">저장</Button>
                <Button type="button" variant="destructive" onClick={() => { if (confirm("이 공정을 삭제하시겠습니까?")) { deleteTaskMutation.mutate(editTask.id); setEditTask(null); } }}>삭제</Button>
              </div>
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
  const [newSchedAttachments, setNewSchedAttachments] = useState<string[]>([]);
  const [newLogAttachments, setNewLogAttachments] = useState<string[]>([]);
  // expandedSchedule/expandedLog removed - edit via pencil icon
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timeValue, setTimeValue] = useState({ hour: "09", minute: "00", ampm: "오전" });

  const { data: schedules } = useQuery<Schedule[]>({ queryKey: [`/api/projects/${projectId}/schedules`] });
  const { data: dailyLogs } = useQuery<DailyLog[]>({ queryKey: [`/api/projects/${projectId}/daily-logs`] });

  const scheduleMutation = useMutation({
    mutationFn: async (data: any) => { await apiRequest("POST", `/api/projects/${projectId}/schedules`, data); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/schedules`] }); toast({ title: "일정이 추가되었습니다" }); setDialogOpen(false); setSelectedPreset(""); setNewSchedAttachments([]); },
  });

  const updateScheduleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => { await apiRequest("PATCH", `/api/schedules/${id}`, data); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/schedules`] }); },
  });

  const logMutation = useMutation({
    mutationFn: async (data: any) => { await apiRequest("POST", `/api/projects/${projectId}/daily-logs`, data); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/daily-logs`] }); toast({ title: "작업일지가 추가되었습니다" }); setLogDialogOpen(false); setNewLogAttachments([]); },
  });

  const updateLogMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => { await apiRequest("PATCH", `/api/daily-logs/${id}`, data); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/daily-logs`] }); },
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/schedules/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/schedules`] }); toast({ title: "일정이 삭제되었습니다" }); setEditingSchedule(null); },
  });

  const deleteLogMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/daily-logs/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/daily-logs`] }); toast({ title: "작업일지가 삭제되었습니다" }); },
  });

  const [editingLog, setEditingLog] = useState<DailyLog | null>(null);
  const [editSchedAttachments, setEditSchedAttachments] = useState<string[]>([]);

  const presetData = selectedPreset ? SCHEDULE_PRESETS.find((p) => p.title === selectedPreset) : null;

  return (
    <div className="space-y-6" data-testid="schedule-tab">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><Calendar className="w-5 h-5" /> 일정</CardTitle>
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setSelectedPreset(""); setNewSchedAttachments([]); } }}>
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
                  attachments: newSchedAttachments.length ? JSON.stringify(newSchedAttachments) : null,
                });
              }} className="space-y-4">
                <div className="space-y-2"><Label>제목</Label>
                  <Input name="title" required defaultValue={presetData?.title || ""} key={selectedPreset} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>날짜</Label><DateInput name="date" required /></div>
                  <div className="space-y-2">
                    <Label>시간</Label>
                    <div className="relative">
                      <Input name="time" type="time" className="pl-9" />
                      <button type="button" className="absolute left-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted/60"
                        onClick={() => setShowTimePicker(true)}>
                        <Clock className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
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
                <div className="space-y-2">
                  <Label>첨부파일</Label>
                  <FileDropZone projectId={projectId} phase={currentPhase} subCategory="일정첨부" acceptFiles
                    existingUrls={newSchedAttachments} onUploaded={setNewSchedAttachments} />
                </div>
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
              {schedules.sort((a, b) => a.date.localeCompare(b.date)).map((s) => {
                const sAttachments: string[] = (s as any).attachments ? JSON.parse((s as any).attachments) : [];
                return (
                <div key={s.id} className="p-3 rounded-lg border">
                  <div className="flex items-start gap-3">
                    <div className="text-sm text-muted-foreground whitespace-nowrap">
                      <div>{s.date}</div>
                      {(s as any).time && <div className="text-xs">{(s as any).time}</div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{s.title}</span>
                        <Badge variant="outline" className={getScheduleCategoryColor(s.category)}>{getCategoryLabel(s.category)}</Badge>
                        {sAttachments.length > 0 && <span className="text-xs text-muted-foreground"><Camera className="w-3 h-3 inline" /> {sAttachments.length}</span>}
                      </div>
                      {(s as any).location && (
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />{(s as any).location}
                        </p>
                      )}
                      {s.memo && <p className="text-xs text-muted-foreground mt-0.5">{s.memo}</p>}
                      {sAttachments.length > 0 && (
                        <div className="mt-2"><AttachmentPreviewGrid attachments={sAttachments} /></div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingSchedule(s)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => { if (confirm("이 일정을 삭제하시겠습니까?")) deleteScheduleMutation.mutate(s.id); }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>작업일지</CardTitle>
          <Dialog open={logDialogOpen} onOpenChange={(o) => { setLogDialogOpen(o); if (!o) setNewLogAttachments([]); }}>
            <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" />추가</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>작업일지 작성</DialogTitle></DialogHeader>
              <form onSubmit={(e) => {
                e.preventDefault(); const fd = new FormData(e.currentTarget);
                logMutation.mutate({
                  phase: currentPhase, date: fd.get("date"), content: fd.get("content"),
                  weather: fd.get("weather") || null, workers: fd.get("workers") ? parseInt(fd.get("workers") as string) : null,
                  attachments: newLogAttachments.length ? JSON.stringify(newLogAttachments) : null,
                });
              }} className="space-y-4">
                <div className="space-y-2"><Label>날짜</Label><DateInput name="date" required /></div>
                <div className="space-y-2"><Label>내용</Label><Textarea name="content" required /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>날씨</Label><Input name="weather" placeholder="맑음" /></div>
                  <div className="space-y-2"><Label>작업인원</Label><Input name="workers" type="number" /></div>
                </div>
                <div className="space-y-2">
                  <Label>첨부파일</Label>
                  <FileDropZone projectId={projectId} phase={currentPhase} subCategory="일지첨부" acceptFiles
                    existingUrls={newLogAttachments} onUploaded={setNewLogAttachments} />
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
              {dailyLogs.sort((a, b) => b.date.localeCompare(a.date)).map((log) => {
                const logAttachments: string[] = (log as any).attachments ? JSON.parse((log as any).attachments) : [];
                return (
                <div key={log.id} className="p-3 rounded-lg border">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-sm font-medium">{log.date}</span>
                        {log.weather && <span className="text-xs text-muted-foreground flex items-center gap-1"><Cloud className="w-3 h-3" />{log.weather}</span>}
                        {log.workers != null && <span className="text-xs text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" />{log.workers}명</span>}
                        {logAttachments.length > 0 && <span className="text-xs text-muted-foreground"><Camera className="w-3 h-3 inline" /> {logAttachments.length}</span>}
                      </div>
                      <p className="text-sm">{log.content}</p>
                      {logAttachments.length > 0 && (
                        <div className="mt-2"><AttachmentPreviewGrid attachments={logAttachments} /></div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingLog(log)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => { if (confirm("이 작업일지를 삭제하시겠습니까?")) deleteLogMutation.mutate(log.id); }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 일정 수정 다이얼로그 */}
      {editingSchedule && (() => {
        const esAttachments: string[] = (editingSchedule as any).attachments ? JSON.parse((editingSchedule as any).attachments) : [];
        return (
        <Dialog open onOpenChange={() => setEditingSchedule(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>일정 수정</DialogTitle></DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault(); const fd = new FormData(e.currentTarget);
              updateScheduleMutation.mutate({
                id: editingSchedule.id,
                data: {
                  title: fd.get("title"), date: fd.get("date"),
                  category: fd.get("category"), memo: fd.get("memo") || null,
                  location: fd.get("location") || null, time: fd.get("time") || null,
                  attachments: editSchedAttachments.length ? JSON.stringify(editSchedAttachments) : (editingSchedule as any).attachments,
                },
              });
              setEditingSchedule(null); setEditSchedAttachments([]);
            }} className="space-y-4">
              <div className="space-y-2"><Label>제목</Label><Input name="title" required defaultValue={editingSchedule.title} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>날짜</Label><DateInput name="date" required defaultValue={editingSchedule.date} /></div>
                <div className="space-y-2">
                  <Label>시간</Label>
                  <div className="relative">
                    <Input name="time" type="time" className="pl-9" defaultValue={(editingSchedule as any).time || ""} />
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
              </div>
              <div className="space-y-2"><Label>장소</Label><Input name="location" defaultValue={(editingSchedule as any).location || ""} /></div>
              <div className="space-y-2"><Label>카테고리</Label>
                <select name="category" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" defaultValue={editingSchedule.category}>
                  <option value="MEETING">회의</option><option value="DEADLINE">마감</option>
                  <option value="INSPECTION">검수</option><option value="CONSTRUCTION">시공</option>
                </select>
              </div>
              <div className="space-y-2"><Label>메모</Label><Textarea name="memo" defaultValue={editingSchedule.memo || ""} /></div>
              <div className="space-y-2">
                <Label>첨부파일</Label>
                {esAttachments.length > 0 && <AttachmentPreviewGrid attachments={esAttachments} />}
                <FileDropZone projectId={projectId} phase={currentPhase} subCategory="일정첨부" acceptFiles
                  existingUrls={editSchedAttachments}
                  onUploaded={(urls) => {
                    setEditSchedAttachments(urls);
                    updateScheduleMutation.mutate({ id: editingSchedule.id, data: { attachments: JSON.stringify([...esAttachments, ...urls]) } });
                  }} />
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="flex-1">저장</Button>
                <Button type="button" variant="destructive" onClick={() => { if (confirm("이 일정을 삭제하시겠습니까?")) deleteScheduleMutation.mutate(editingSchedule.id); }}>삭제</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        );
      })()}

      {/* 시간 선택 모달 */}
      {showTimePicker && (
        <Dialog open onOpenChange={() => setShowTimePicker(false)}>
          <DialogContent className="max-w-xs">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Clock className="w-5 h-5" /> 시간 선택</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-2">
                <select value={timeValue.ampm} onChange={(e) => setTimeValue(prev => ({ ...prev, ampm: e.target.value }))}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm font-medium">
                  <option value="오전">오전</option><option value="오후">오후</option>
                </select>
                <select value={timeValue.hour} onChange={(e) => setTimeValue(prev => ({ ...prev, hour: e.target.value }))}
                  className="rounded-md border border-input bg-background px-3 py-2 text-lg font-medium w-16 text-center">
                  {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
                <span className="text-lg font-bold">:</span>
                <select value={timeValue.minute} onChange={(e) => setTimeValue(prev => ({ ...prev, minute: e.target.value }))}
                  className="rounded-md border border-input bg-background px-3 py-2 text-lg font-medium w-16 text-center">
                  {["00", "10", "15", "20", "30", "40", "45", "50"].map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <Button className="w-full" onClick={() => {
                let h = parseInt(timeValue.hour);
                if (timeValue.ampm === "오후" && h !== 12) h += 12;
                if (timeValue.ampm === "오전" && h === 12) h = 0;
                const timeStr = `${String(h).padStart(2, "0")}:${timeValue.minute}`;
                const input = document.querySelector('input[name="time"]') as HTMLInputElement;
                if (input) { const nativeSet = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set; nativeSet?.call(input, timeStr); input.dispatchEvent(new Event('input', { bubbles: true })); }
                setShowTimePicker(false);
              }}>확인</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* 작업일지 수정 다이얼로그 */}
      {editingLog && (() => {
        const elAttachments: string[] = (editingLog as any).attachments ? JSON.parse((editingLog as any).attachments) : [];
        return (
        <Dialog open onOpenChange={() => setEditingLog(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>작업일지 수정</DialogTitle></DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault(); const fd = new FormData(e.currentTarget);
              updateLogMutation.mutate({
                id: editingLog.id,
                data: {
                  date: fd.get("date"), content: fd.get("content"),
                  weather: fd.get("weather") || null,
                  workers: fd.get("workers") ? parseInt(fd.get("workers") as string) : null,
                },
              });
              setEditingLog(null);
              toast({ title: "작업일지가 수정되었습니다" });
            }} className="space-y-4">
              <div className="space-y-2"><Label>날짜</Label><DateInput name="date" required defaultValue={editingLog.date} /></div>
              <div className="space-y-2"><Label>내용</Label><Textarea name="content" required defaultValue={editingLog.content} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>날씨</Label><Input name="weather" defaultValue={editingLog.weather || ""} /></div>
                <div className="space-y-2"><Label>작업인원</Label><Input name="workers" type="number" defaultValue={editingLog.workers ?? ""} /></div>
              </div>
              <div className="space-y-2">
                <Label>첨부파일</Label>
                {elAttachments.length > 0 && <AttachmentPreviewGrid attachments={elAttachments} />}
                <FileDropZone projectId={projectId} phase={currentPhase} subCategory="일지첨부" acceptFiles
                  existingUrls={[]}
                  onUploaded={(urls) => updateLogMutation.mutate({ id: editingLog.id, data: { attachments: JSON.stringify([...elAttachments, ...urls]) } })} />
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="flex-1">저장</Button>
                <Button type="button" variant="destructive" onClick={() => { if (confirm("이 작업일지를 삭제하시겠습니까?")) deleteLogMutation.mutate(editingLog.id); setEditingLog(null); }}>삭제</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        );
      })()}
    </div>
  );
}

// ─── Files Tab ───────────────────────────────────────────────
function FilesTab({ projectId, currentPhase }: { projectId: string; currentPhase: string }) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFile, setEditingFile] = useState<ProjectFile | null>(null);
  const { data: files } = useQuery<ProjectFile[]>({ queryKey: [`/api/projects/${projectId}/files`] });

  const mutation = useMutation({
    mutationFn: async (data: any) => { await apiRequest("POST", `/api/projects/${projectId}/files`, data); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/files`] }); toast({ title: "파일이 추가되었습니다" }); setDialogOpen(false); },
  });

  const updateFileMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => { await apiRequest("PATCH", `/api/files/${id}`, data); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/files`] }); toast({ title: "파일이 수정되었습니다" }); setEditingFile(null); },
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/files/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/files`] }); toast({ title: "파일이 삭제되었습니다" }); },
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
                <div className="shrink-0 flex items-center gap-1">
                  <a href={f.url} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="icon" className="h-8 w-8"><ExternalLink className="w-4 h-4" /></Button>
                  </a>
                  <a href={getDownloadableUrl(f.url)} download target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="icon" className="h-8 w-8"><Download className="w-4 h-4" /></Button>
                  </a>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingFile(f)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => { if (confirm("이 파일을 삭제하시겠습니까?")) deleteFileMutation.mutate(f.id); }}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 파일 수정 다이얼로그 */}
      {editingFile && (
        <Dialog open onOpenChange={() => setEditingFile(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>파일 수정</DialogTitle></DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault(); const fd = new FormData(e.currentTarget);
              updateFileMutation.mutate({
                id: editingFile.id,
                data: {
                  title: fd.get("title"), url: fd.get("url"),
                  category: fd.get("category"), version: fd.get("version") || null,
                  description: fd.get("description") || null,
                },
              });
            }} className="space-y-4">
              <div className="space-y-2"><Label>제목</Label><Input name="title" required defaultValue={editingFile.title} /></div>
              <div className="space-y-2"><Label>Google Drive URL</Label><Input name="url" type="url" required defaultValue={editingFile.url} /></div>
              <div className="space-y-2"><Label>카테고리</Label>
                <select name="category" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" defaultValue={editingFile.category}>
                  <option value="DRAWING">도면</option><option value="STRUCTURAL">구조</option>
                  <option value="INTERIOR">인테리어</option><option value="DOCUMENT">문서</option><option value="OTHER">기타</option>
                </select>
              </div>
              <div className="space-y-2"><Label>버전</Label><Input name="version" defaultValue={editingFile.version || ""} /></div>
              <div className="space-y-2"><Label>설명</Label><Textarea name="description" defaultValue={editingFile.description || ""} /></div>
              <div className="flex gap-2">
                <Button type="submit" className="flex-1" disabled={updateFileMutation.isPending}>저장</Button>
                <Button type="button" variant="destructive" onClick={() => { if (confirm("이 파일을 삭제하시겠습니까?")) { deleteFileMutation.mutate(editingFile.id); setEditingFile(null); } }}>삭제</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ─── Photos Tab (페이즈별 폴더트리) ─────────────────────────
function PhotosTab({ projectId, currentPhase, project }: { projectId: string; currentPhase: string; project: Project }) {
  const { toast } = useToast();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [urlDialogOpen, setUrlDialogOpen] = useState(false);
  const [lightbox, setLightbox] = useState<Photo | null>(null);
  const [expandedPhase, setExpandedPhase] = useState<string | null>(currentPhase);
  const [expandedSub, setExpandedSub] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [uploadPhase, setUploadPhase] = useState(currentPhase);
  const [pastedFiles, setPastedFiles] = useState<File[]>([]);
  const { data: photos } = useQuery<Photo[]>({ queryKey: [`/api/projects/${projectId}/photos`] });

  // Clipboard paste handler - accumulate up to 10 images
  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const newFiles: File[] = [];
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) newFiles.push(file);
      }
    }
    if (newFiles.length > 0) {
      setPastedFiles((prev) => {
        const combined = [...prev, ...newFiles].slice(0, 10);
        return combined;
      });
      setUploadDialogOpen(true);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  // Upload pasted files (multiple)
  const uploadPastedFiles = async (phase: string, subCategory: string) => {
    if (!pastedFiles.length) return;
    setUploading(true);
    try {
      const uploadData = new FormData();
      for (const file of pastedFiles) {
        uploadData.append("photos", file);
      }
      uploadData.append("phase", phase);
      if (subCategory) uploadData.append("subCategory", subCategory);
      const res = await fetch(`${API_BASE}/api/projects/${projectId}/photos/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getAuthToken()}` },
        body: uploadData,
      });
      if (!res.ok) throw new Error(await res.text());
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/photos`] });
      toast({ title: `${pastedFiles.length}장의 붙여넣기 사진이 업로드되었습니다` });
      setPastedFiles([]);
      setUploadDialogOpen(false);
    } catch (err: any) {
      toast({ title: "업로드 실패", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const [editPhoto, setEditPhoto] = useState<Photo | null>(null);

  const urlMutation = useMutation({
    mutationFn: async (data: any) => { await apiRequest("POST", `/api/projects/${projectId}/photos`, data); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/photos`] }); toast({ title: "사진이 추가되었습니다" }); setUrlDialogOpen(false); },
  });

  const updatePhotoMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => { await apiRequest("PATCH", `/api/photos/${id}`, data); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/photos`] }); toast({ title: "사진이 수정되었습니다" }); setEditPhoto(null); },
  });

  const deletePhotoMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/photos/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/photos`] }); toast({ title: "사진이 삭제되었습니다" }); setLightbox(null); },
  });

  // File upload handler
  const handleFileUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const fileInput = e.currentTarget.querySelector('input[type="file"]') as HTMLInputElement;
    if (!fileInput?.files?.length) { toast({ title: "파일을 선택해주세요", variant: "destructive" }); return; }
    if (fileInput.files.length > 10) { toast({ title: "최대 10장까지 업로드 가능합니다", variant: "destructive" }); return; }

    setUploading(true);
    const uploadData = new FormData();
    for (const file of Array.from(fileInput.files).slice(0, 10)) {
      uploadData.append("photos", file);
    }
    uploadData.append("phase", fd.get("phase") as string);
    uploadData.append("subCategory", fd.get("subCategory") as string);

    try {
      const res = await fetch(`${API_BASE}/api/projects/${projectId}/photos/upload`, {
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
      const res = await fetch(`${API_BASE}/api/projects/${projectId}/photos/download-zip`, {
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

  const handlePhaseDownloadZip = async (phase: string) => {
    setDownloading(true);
    try {
      const res = await fetch(`${API_BASE}/api/projects/${projectId}/photos/download-zip/${phase}`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (!res.ok) throw new Error("다운로드 실패");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const phaseLabels: Record<string, string> = { DESIGN: "설계", PERMIT: "인허가", CONSTRUCTION: "시공", COMPLETION: "준공", PORTFOLIO: "포트폴리오" };
      a.download = `photos_${phaseLabels[phase] || phase}.zip`;
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

  // Dynamic sub-categories based on floor count
  const pp = project as any;
  const bf = pp.basementFloors ?? 0;
  const af = pp.aboveFloors ?? 0;
  const floorSubs: string[] = [];
  for (let i = bf; i >= 1; i--) floorSubs.push(`골조공사-지하${i}층`);
  for (let i = 1; i <= af; i++) floorSubs.push(`골조공사-${i}층`);
  if (af > 0) floorSubs.push("골조공사-옥상");

  const dynamicConstructionSubs = [
    "가설공사", "토공사", "기초공사",
    ...(floorSubs.length > 0 ? floorSubs : ["골조공사"]),
    "방수공사", "전기공사", "설비공사", "창호공사",
    "외부마감", "내부마감", "타일공사", "도장공사",
    "목공사", "조경공사", "전경", "기타",
  ];

  const getSubCategories = (phase: string) => {
    if (phase === "CONSTRUCTION") return dynamicConstructionSubs;
    return PHOTO_SUB_CATEGORIES[phase] || [];
  };

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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" disabled={downloading}>
                  <Download className="w-4 h-4 mr-1" />
                  {downloading ? "다운로드 중..." : "ZIP 다운로드"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleDownloadZip}>
                  전체 다운로드 ({totalPhotos}장)
                </DropdownMenuItem>
                {totalByPhase("DESIGN") > 0 && (
                  <DropdownMenuItem onClick={() => handlePhaseDownloadZip("DESIGN")}>
                    설계 ({totalByPhase("DESIGN")}장)
                  </DropdownMenuItem>
                )}
                {totalByPhase("PERMIT") > 0 && (
                  <DropdownMenuItem onClick={() => handlePhaseDownloadZip("PERMIT")}>
                    인허가 ({totalByPhase("PERMIT")}장)
                  </DropdownMenuItem>
                )}
                {totalByPhase("CONSTRUCTION") > 0 && (
                  <DropdownMenuItem onClick={() => handlePhaseDownloadZip("CONSTRUCTION")}>
                    시공 ({totalByPhase("CONSTRUCTION")}장)
                  </DropdownMenuItem>
                )}
                {totalByPhase("COMPLETION") > 0 && (
                  <DropdownMenuItem onClick={() => handlePhaseDownloadZip("COMPLETION")}>
                    준공 ({totalByPhase("COMPLETION")}장)
                  </DropdownMenuItem>
                )}
                {totalByPhase("PORTFOLIO") > 0 && (
                  <DropdownMenuItem onClick={() => handlePhaseDownloadZip("PORTFOLIO")}>
                    포트폴리오 ({totalByPhase("PORTFOLIO")}장)
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Dialog open={uploadDialogOpen} onOpenChange={(o) => { setUploadDialogOpen(o); if (!o) setPastedFiles([]); }}>
            <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" />사진 업로드</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{pastedFiles.length > 0 ? `붙여넣기 사진 업로드 (${pastedFiles.length}/10)` : "사진 파일 업로드"}</DialogTitle></DialogHeader>
              {pastedFiles.length > 0 ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                    {pastedFiles.map((file, idx) => (
                      <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border bg-muted group">
                        <img src={URL.createObjectURL(file)} alt={`미리보기 ${idx + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => setPastedFiles((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground text-center">Ctrl+V로 이미지를 더 붙여넣을 수 있습니다 (최대 10장)</p>
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
                        {getSubCategories(uploadPhase).map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <Button onClick={() => {
                    const sub = (document.getElementById("paste-sub") as HTMLSelectElement)?.value || "";
                    uploadPastedFiles(uploadPhase, sub);
                  }} disabled={uploading} className="w-full">
                    {uploading ? "업로드 중..." : `${pastedFiles.length}장 업로드`}
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleFileUpload} className="space-y-4">
                  <div className="space-y-2">
                    <Label>사진 파일 (여러 장 선택 가능)</Label>
                    <Input type="file" accept="image/*" multiple required className="cursor-pointer" />
                    <p className="text-sm text-muted-foreground">최대 10장, 각 20MB 이하. Ctrl+V로 이미지 붙여넣기도 가능합니다.</p>
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
                        {getSubCategories(uploadPhase).map((s) => <option key={s} value={s}>{s}</option>)}
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
                      {getSubCategories(currentPhase).map((s) => <option key={s} value={s}>{s}</option>)}
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
            <div className="absolute -top-10 right-0 flex items-center gap-1">
              <Button variant="ghost" size="icon" className="text-white hover:text-white/80"
                onClick={() => { setEditPhoto(lightbox); setLightbox(null); }}>
                <Pencil className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-300"
                onClick={() => { if (confirm("이 사진을 삭제하시겠습니까?")) deletePhotoMutation.mutate(lightbox.id); }}>
                <Trash2 className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="icon" className="text-white hover:text-white/80" onClick={() => setLightbox(null)}>
                <X className="w-6 h-6" />
              </Button>
            </div>
            <img src={lightbox.imageUrl} alt={lightbox.description || ""} className="max-w-full max-h-[80vh] object-contain rounded-lg" />
            <div className="text-white text-sm text-center mt-3">
              {lightbox.takenAt && <span>{lightbox.takenAt}</span>}
              {lightbox.description && <span> - {lightbox.description}</span>}
              {(lightbox as any).subCategory && <span className="ml-2 text-white/60">[{(lightbox as any).subCategory}]</span>}
            </div>
          </div>
        </div>
      )}

      {/* 사진 수정 다이얼로그 */}
      {editPhoto && (
        <Dialog open onOpenChange={() => setEditPhoto(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>사진 정보 수정</DialogTitle></DialogHeader>
            <div className="mb-3 border rounded-lg overflow-hidden max-h-32 flex items-center justify-center bg-muted">
              <img src={editPhoto.imageUrl} alt="" className="max-h-32 object-contain" />
            </div>
            <form onSubmit={(e) => {
              e.preventDefault(); const fd = new FormData(e.currentTarget);
              updatePhotoMutation.mutate({
                id: editPhoto.id,
                data: {
                  description: fd.get("description") || null,
                  tags: fd.get("tags") || null,
                  takenAt: fd.get("takenAt") || null,
                  phase: fd.get("phase"),
                  subCategory: fd.get("subCategory") || null,
                },
              });
            }} className="space-y-4">
              <div className="space-y-2"><Label>설명</Label><Input name="description" defaultValue={editPhoto.description || ""} /></div>
              <div className="space-y-2"><Label>태그 (쉼표 구분)</Label><Input name="tags" defaultValue={editPhoto.tags || ""} /></div>
              <div className="space-y-2"><Label>촬영일</Label><DateInput name="takenAt" defaultValue={editPhoto.takenAt || ""} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>페이즈</Label>
                  <select name="phase" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" defaultValue={editPhoto.phase}>
                    {phases.map((p) => <option key={p} value={p}>{getPhaseLabel(p)}</option>)}
                  </select>
                </div>
                <div className="space-y-2"><Label>세부 단계</Label>
                  <select name="subCategory" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" defaultValue={(editPhoto as any).subCategory || ""}>
                    <option value="">선택...</option>
                    {getSubCategories(editPhoto.phase).map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={updatePhotoMutation.isPending} className="flex-1">저장</Button>
                <Button type="button" variant="destructive"
                  onClick={() => { if (confirm("이 사진을 삭제하시겠습니까?")) { deletePhotoMutation.mutate(editPhoto.id); setEditPhoto(null); } }}>
                  삭제
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
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
          <TabsContent value="design"><DesignTab projectId={project.id} project={project} /></TabsContent>
          <TabsContent value="construction"><ConstructionTab projectId={project.id} project={project} /></TabsContent>
          <TabsContent value="schedule"><ScheduleTab projectId={project.id} currentPhase={project.currentPhase} /></TabsContent>
          <TabsContent value="files"><FilesTab projectId={project.id} currentPhase={project.currentPhase} /></TabsContent>
          <TabsContent value="photos"><PhotosTab projectId={project.id} currentPhase={project.currentPhase} project={project} /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
