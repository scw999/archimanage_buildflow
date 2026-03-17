import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/app-layout";
import { PhaseProgress, getPhaseLabel, getPhaseColor } from "@/components/phase-progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, MapPin, Search, FolderKanban } from "lucide-react";
import type { Project } from "@shared/schema";
import { ProjectPhase, ProjectStatus } from "@shared/schema";

export default function ProjectsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "SUPER_ADMIN";
  const [search, setSearch] = useState("");
  const [phaseFilter, setPhaseFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newPhase, setNewPhase] = useState<string>("DESIGN");

  const { data: projects, isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, string>) => {
      const res = await apiRequest("POST", "/api/projects", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setDialogOpen(false);
      toast({ title: "프로젝트가 생성되었습니다" });
    },
    onError: (err: Error) => {
      toast({ title: "오류", description: err.message, variant: "destructive" });
    },
  });

  const filtered = projects?.filter((p) => {
    const matchSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.clientName?.toLowerCase().includes(search.toLowerCase()) ||
      p.address?.toLowerCase().includes(search.toLowerCase());
    const matchPhase = phaseFilter === "ALL" || p.currentPhase === phaseFilter;
    const matchStatus = statusFilter === "ALL" || p.status === statusFilter;
    return matchSearch && matchPhase && matchStatus;
  }) ?? [];

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createMutation.mutate({
      name: formData.get("name") as string,
      description: formData.get("description") as string,
      clientName: formData.get("clientName") as string,
      address: formData.get("address") as string,
      currentPhase: newPhase,
      status: "ACTIVE",
    });
  };

  const phaseLabels: Record<string, string> = {
    DESIGN: "설계",
    PERMIT: "인허가",
    CONSTRUCTION: "시공",
    COMPLETION: "준공",
    PORTFOLIO: "포트폴리오",
  };

  const statusLabels: Record<string, string> = {
    ACTIVE: "진행중",
    COMPLETED: "완료",
    ON_HOLD: "보류",
  };

  return (
    <AppLayout>
      <div className="space-y-6" data-testid="projects-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">프로젝트</h1>
            <p className="text-muted-foreground text-sm">
              전체 프로젝트를 관리하고 새 프로젝트를 생성합니다
            </p>
          </div>
          {isAdmin && <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="new-project-button">
                <Plus className="w-4 h-4 mr-2" />
                새 프로젝트
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>새 프로젝트 생성</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">프로젝트명 *</Label>
                  <Input id="name" name="name" required placeholder="예: 강남 주택 신축" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientName">건축주명</Label>
                  <Input id="clientName" name="clientName" placeholder="건축주 이름" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">주소</Label>
                  <Input id="address" name="address" placeholder="프로젝트 위치" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currentPhase">시작 단계</Label>
                  <Select value={newPhase} onValueChange={setNewPhase}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ProjectPhase.map((phase) => (
                        <SelectItem key={phase} value={phase}>
                          {phaseLabels[phase]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">설명</Label>
                  <Textarea id="description" name="description" placeholder="프로젝트 설명" rows={3} />
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  생성
                </Button>
              </form>
            </DialogContent>
          </Dialog>}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="프로젝트명, 건축주, 주소로 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={phaseFilter} onValueChange={setPhaseFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="단계" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">전체 단계</SelectItem>
              {ProjectPhase.map((phase) => (
                <SelectItem key={phase} value={phase}>
                  {phaseLabels[phase]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="상태" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">전체 상태</SelectItem>
              {ProjectStatus.map((status) => (
                <SelectItem key={status} value={status}>
                  {statusLabels[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Results count */}
        <div className="text-sm text-muted-foreground">
          {isLoading ? "로딩 중..." : `${filtered.length}개 프로젝트`}
        </div>

        {/* Projects Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="pt-6 space-y-3">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-8 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FolderKanban className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">
                {search || phaseFilter !== "ALL" || statusFilter !== "ALL"
                  ? "검색 조건에 맞는 프로젝트가 없습니다"
                  : "아직 프로젝트가 없습니다"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((project) => (
              <Card
                key={project.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => setLocation(`/projects/${project.id}`)}
                data-testid={`project-card-${project.id}`}
              >
                {project.coverImageUrl && (
                  <div className="h-36 overflow-hidden rounded-t-lg">
                    <img src={project.coverImageUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{project.name}</CardTitle>
                    <Badge
                      variant={project.status === "ACTIVE" ? "default" : "secondary"}
                      className="text-xs shrink-0"
                    >
                      {statusLabels[project.status] ?? project.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {project.address && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
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
    </AppLayout>
  );
}
