import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { User, Plus, Shield, Lock, Trash2 } from "lucide-react";
import type { User as UserType } from "@shared/schema";

type SafeUser = Omit<UserType, "password">;

function getRoleLabel(role: string) {
  const map: Record<string, string> = {
    SUPER_ADMIN: "최고관리자", PM: "프로젝트매니저", MEMBER: "팀원", CLIENT: "건축주",
  };
  return map[role] ?? role;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SafeUser | null>(null);
  const isAdmin = user?.role === "SUPER_ADMIN";
  const isPM = user?.role === "PM" || isAdmin;

  const { data: users } = useQuery<SafeUser[]>({
    queryKey: ["/api/users"],
    enabled: isAdmin,
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/users", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "사용자가 추가되었습니다" });
      setDialogOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "오류", description: err.message, variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "사용자가 삭제되었습니다" });
      setDeleteTarget(null);
    },
    onError: (err: any) => {
      toast({ title: "오류", description: err.message, variant: "destructive" });
      setDeleteTarget(null);
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      await apiRequest("PATCH", "/api/auth/change-password", data);
    },
    onSuccess: () => {
      toast({ title: "비밀번호가 변경되었습니다" });
    },
    onError: (err: any) => {
      toast({ title: "오류", description: err.message, variant: "destructive" });
    },
  });

  return (
    <AppLayout>
      <div className="space-y-6" data-testid="settings-page">
        <h1 className="text-2xl font-bold">설정</h1>

        {/* Profile */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" /> 내 프로필
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">이름</Label>
                <p className="text-sm font-medium">{user?.name}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">아이디</Label>
                <p className="text-sm font-medium">{user?.email}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">역할</Label>
                <Badge variant="outline">{getRoleLabel(user?.role ?? "")}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Password Change */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" /> 비밀번호 변경
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const currentPassword = fd.get("currentPassword") as string;
                const newPassword = fd.get("newPassword") as string;
                const confirmPassword = fd.get("confirmPassword") as string;
                if (newPassword !== confirmPassword) {
                  toast({ title: "오류", description: "새 비밀번호가 일치하지 않습니다", variant: "destructive" });
                  return;
                }
                changePasswordMutation.mutate({ currentPassword, newPassword });
                e.currentTarget.reset();
              }}
              className="space-y-4 max-w-md"
              data-testid="change-password-form"
            >
              <div className="space-y-2">
                <Label htmlFor="cp-current">현재 비밀번호</Label>
                <Input id="cp-current" name="currentPassword" type="password" required data-testid="current-password-input" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cp-new">새 비밀번호</Label>
                <Input id="cp-new" name="newPassword" type="password" required data-testid="new-password-input" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cp-confirm">새 비밀번호 확인</Label>
                <Input id="cp-confirm" name="confirmPassword" type="password" required data-testid="confirm-password-input" />
              </div>
              <Button type="submit" disabled={changePasswordMutation.isPending} data-testid="change-password-submit">
                비밀번호 변경
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* User management (Admin only) */}
        {isAdmin && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" /> 사용자 관리
              </CardTitle>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="add-user-button"><Plus className="w-4 h-4 mr-1" />추가</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>사용자 추가</DialogTitle></DialogHeader>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      createUserMutation.mutate({
                        email: fd.get("email"),
                        password: fd.get("password"),
                        name: fd.get("name"),
                        role: fd.get("role"),
                      });
                    }}
                    className="space-y-4"
                    data-testid="add-user-form"
                  >
                    <div className="space-y-2">
                      <Label htmlFor="u-name">이름</Label>
                      <Input id="u-name" name="name" required data-testid="user-name-input" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="u-email">아이디</Label>
                      <Input id="u-email" name="email" type="text" required placeholder="영문, 숫자 조합" data-testid="user-email-input" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="u-password">비밀번호</Label>
                      <Input id="u-password" name="password" type="password" required data-testid="user-password-input" />
                    </div>
                    <div className="space-y-2">
                      <Label>역할</Label>
                      <select name="role" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" defaultValue="MEMBER" data-testid="user-role-select">
                        {user?.role === "SUPER_ADMIN" && <option value="SUPER_ADMIN">최고관리자</option>}
                        <option value="PM">프로젝트매니저</option>
                        <option value="MEMBER">팀원</option>
                        <option value="CLIENT">건축주</option>
                      </select>
                    </div>
                    <Button type="submit" disabled={createUserMutation.isPending} data-testid="user-submit">추가</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {!users?.length ? (
                <p className="text-sm text-muted-foreground text-center py-4">사용자가 없습니다</p>
              ) : (
                <div className="space-y-2">
                  {users.map((u) => (
                    <div key={u.id} className="flex items-center gap-3 p-3 rounded-lg border" data-testid={`user-${u.id}`}>
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-medium">
                        {u.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{u.name}</p>
                        <p className="text-xs text-muted-foreground">@{u.email}</p>
                      </div>
                      <Badge variant="outline">{getRoleLabel(u.role)}</Badge>
                      {u.id !== user?.id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(u)}
                          data-testid={`delete-user-${u.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Delete confirmation dialog */}
        <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>사용자 삭제</DialogTitle>
            </DialogHeader>
            <p className="text-sm" data-testid="delete-user-confirm-text">
              <strong>{deleteTarget?.name}</strong> ({deleteTarget?.email}) 사용자를 삭제하시겠습니까?
              이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setDeleteTarget(null)} data-testid="delete-user-cancel">
                취소
              </Button>
              <Button
                variant="destructive"
                disabled={deleteUserMutation.isPending}
                onClick={() => deleteTarget && deleteUserMutation.mutate(deleteTarget.id)}
                data-testid="delete-user-confirm"
              >
                삭제
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
