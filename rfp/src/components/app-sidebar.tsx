"use client";

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarProvider,
    SidebarTrigger,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    LayoutDashboard,
    FolderKanban,
    FileStack,
    Users,
    UsersRound,
    Shield,
    ShieldCheck,
    Cog,
    History,
    ClipboardList,
    LogOut,
    AlertTriangle,
    CheckSquare,
    Palette,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

const menuItems = [
    { title: "Dashboard", icon: LayoutDashboard, href: "/" },
    { title: "Approvals", icon: CheckSquare, href: "/approvals" },
    { title: "Projects", icon: FolderKanban, href: "/projects" },
    { title: "Template", icon: FileStack, href: "/template" },
    { title: "Users", icon: Users, href: "/users" },
    { title: "Groups", icon: UsersRound, href: "/groups" },
    { title: "Roles", icon: Shield, href: "/roles" },
    { title: "Jobs", icon: History, href: "/jobs" },
    { title: "Audit Log", icon: ClipboardList, href: "/audit" },
    { title: "Audit Log", icon: ClipboardList, href: "/audit" },
    { title: "Permission Audit", icon: ShieldCheck, href: "/permission-audit" },
    { title: "Settings", icon: Cog, href: "/settings" },
    { title: "Theme", icon: Palette, href: "/settings/theme" },
];

export function AppSidebar({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [user, setUser] = useState<{ email: string } | null>(null);

    useEffect(() => {
        fetch("/api/auth/session")
            .then((res) => res.json())
            .then((data) => {
                if (data.authenticated) {
                    setUser(data.user);
                }
            });
    }, []);

    return (
        <SidebarProvider>
            <div className="flex min-h-screen w-full">
                <Sidebar>
                    <SidebarHeader className="border-b border-border/40 p-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
                                RFP
                            </div>
                            <div>
                                <h2 className="font-semibold">RFP System</h2>
                                <p className="text-xs text-muted-foreground">Project Manager</p>
                            </div>
                        </div>
                    </SidebarHeader>

                    <SidebarContent>
                        {/* Strict Mode Warning */}
                        <div className="mx-3 mt-3 rounded-lg bg-amber-500/10 border border-amber-500/30 p-3">
                            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                                <AlertTriangle className="h-4 w-4" />
                                <span className="text-xs font-medium">Strict Mode Active</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Manual permission changes will be reverted
                            </p>
                        </div>

                        <SidebarGroup className="mt-4">
                            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
                            <SidebarGroupContent>
                                <SidebarMenu>
                                    {menuItems.map((item) => (
                                        <SidebarMenuItem key={item.href}>
                                            <SidebarMenuButton
                                                asChild
                                                isActive={pathname === item.href}
                                            >
                                                <Link href={item.href}>
                                                    <item.icon className="h-4 w-4" />
                                                    <span>{item.title}</span>
                                                </Link>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                    ))}
                                </SidebarMenu>
                            </SidebarGroupContent>
                        </SidebarGroup>
                    </SidebarContent>

                    <SidebarFooter className="border-t border-border/40 p-4">
                        {user ? (
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-8 w-8">
                                        <AvatarFallback>
                                            {user.email.substring(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium">{user.email}</span>
                                        <span className="text-xs text-muted-foreground">Admin</span>
                                    </div>
                                </div>
                                <Button variant="ghost" size="icon" asChild>
                                    <a href="/api/auth/logout">
                                        <LogOut className="h-4 w-4" />
                                    </a>
                                </Button>
                            </div>
                        ) : (
                            <Button asChild className="w-full">
                                <a href="/api/auth/login">Sign in with Google</a>
                            </Button>
                        )}
                    </SidebarFooter>
                </Sidebar>

                <main className="flex-1 overflow-auto">
                    <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6">
                        <SidebarTrigger />
                        <div className="flex-1" />
                    </header>
                    <div className="p-6">{children}</div>
                </main>
            </div>
        </SidebarProvider>
    );
}
