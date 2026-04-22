import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/components/ThemeProvider";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Building2, LayoutDashboard, FolderKanban, Calendar, Settings, LogOut, Moon, Sun } from "lucide-react";

export function AppSidebar() {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { isDark, toggle } = useTheme();

  const isClient = user?.role === "CLIENT";

  const pmNav = [
    { label: "대시보드", icon: LayoutDashboard, path: "/" },
    { label: "프로젝트", icon: FolderKanban, path: "/projects" },
    { label: "설정", icon: Settings, path: "/settings" },
  ];

  const clientNav = [
    { label: "내 프로젝트", icon: FolderKanban, path: "/" },
    { label: "설정", icon: Settings, path: "/settings" },
  ];

  const navItems = isClient ? clientNav : pmNav;

  return (
    <Sidebar data-testid="app-sidebar">
      <SidebarHeader className="p-4">
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => setLocation("/")}
          data-testid="sidebar-logo"
        >
          <Building2 className="w-7 h-7 text-primary" />
          <span className="text-lg font-bold text-foreground">BuildWorking</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    isActive={location === item.path || (item.path !== "/" && location.startsWith(item.path))}
                    onClick={() => setLocation(item.path)}
                    data-testid={`nav-${item.label}`}
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 space-y-3">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={toggle}
          data-testid="theme-toggle"
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          <span>{isDark ? "라이트 모드" : "다크 모드"}</span>
        </Button>
        <div className="flex items-center gap-2 px-2">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-medium">
            {user?.name?.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-muted-foreground truncate">@{user?.email}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={logout}
            data-testid="logout-button"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
