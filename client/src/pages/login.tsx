import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Building2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const { login } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      toast({ title: "로그인 실패", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm" data-testid="login-card">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center mb-2">
            <Building2 className="w-10 h-10 text-primary" />
          </div>
          <CardTitle className="text-2xl">BuildFlow</CardTitle>
          <CardDescription>건축 프로젝트 관리 시스템</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" data-testid="login-form">
            <div className="space-y-2">
              <Label htmlFor="email">이메일</Label>
              <Input
                id="email"
                type="email"
                placeholder="이메일을 입력하세요"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="email-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">비밀번호</Label>
              <Input
                id="password"
                type="password"
                placeholder="비밀번호를 입력하세요"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                data-testid="password-input"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading} data-testid="login-button">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              로그인
            </Button>
            <div className="text-xs text-muted-foreground text-center space-y-1">
              <p>관리자: admin@buildflow.com / admin123</p>
              <p>건축주: client@buildflow.com / client123</p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
