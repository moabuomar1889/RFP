'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
    FolderKanban,
    FileStack,
    Shield,
    AlertTriangle,
    CheckCircle2,
    Clock,
    Play,
    RefreshCw,
    Loader2,
} from "lucide-react";
import Link from "next/link";
import { toast } from 'sonner';

interface DashboardStats {
    totalProjects: number;
    biddingCount: number;
    executionCount: number;
    pendingRequests: number;
    indexedFolders: number;
    violations: number;
    activeJobs: number;
    lastScan: string | null;
}

export default function DashboardContent() {
    const pathname = usePathname();
    const [loading, setLoading] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);
    const [stats, setStats] = useState<DashboardStats>({
        totalProjects: 0,
        biddingCount: 0,
        executionCount: 0,
        pendingRequests: 0,
        indexedFolders: 0,
        violations: 0,
        activeJobs: 0,
        lastScan: null,
    });
    const [recentActivity, setRecentActivity] = useState<any[]>([]);
    const [enforcing, setEnforcing] = useState(false);

    const handleEnforceNow = async () => {
        try {
            setEnforcing(true);
            const res = await fetch('/api/enforce', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ triggeredBy: 'admin' }),
            });
            const data = await res.json();

            if (data.success) {
                toast.success('Permission enforcement started');
                // Refresh data after a short delay
                setTimeout(() => fetchData(), 2000);
            } else {
                toast.error(data.error || 'Failed to start enforcement');
            }
        } catch (error) {
            toast.error('Failed to trigger enforcement');
        } finally {
            setEnforcing(false);
        }
    };

    const fetchData = async (showToast = false) => {
        try {
            setLoading(true);
            const timestamp = Date.now();
            const res = await fetch(`/api/dashboard/stats?t=${timestamp}`, {
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });
            const data = await res.json();

            if (data.success) {
                setStats(data.stats);
                if (showToast) {
                    toast.success('Dashboard refreshed');
                }
            }

            // Fetch recent audit logs
            const auditRes = await fetch(`/api/audit?limit=5&t=${timestamp}`, {
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });
            const auditData = await auditRes.json();
            if (auditData.success && Array.isArray(auditData.logs)) {
                setRecentActivity(auditData.logs);
            }
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            if (showToast) {
                toast.error('Failed to load dashboard data');
            }
        } finally {
            setLoading(false);
        }
    };

    // Refresh when navigating to this page (pathname changes) or manually triggered
    useEffect(() => {
        fetchData();
    }, [pathname, refreshKey]);

    // Also refresh on window focus/visibility
    useEffect(() => {
        const handleFocus = () => fetchData();
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                fetchData();
            }
        };

        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    const formatTimeAgo = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 60) return `${diffMins} minutes ago`;
        if (diffHours < 24) return `${diffHours} hours ago`;
        return `${diffDays} days ago`;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                    <p className="text-muted-foreground">
                        Overview of your project management system
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => fetchData(true)}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh
                    </Button>
                    <Button onClick={handleEnforceNow} disabled={enforcing}>
                        {enforcing ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Play className="mr-2 h-4 w-4" />
                        )}
                        {enforcing ? 'Enforcing...' : 'Enforce Now'}
                    </Button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
                        <FolderKanban className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalProjects}</div>
                        <p className="text-xs text-muted-foreground">
                            {stats.biddingCount} bidding, {stats.executionCount} execution
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Indexed Folders</CardTitle>
                        <FileStack className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.indexedFolders}</div>
                        <p className="text-xs text-muted-foreground">
                            Across all projects
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Permission Status</CardTitle>
                        <Shield className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            {stats.violations > 0 ? (
                                <>
                                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                                    <span className="text-2xl font-bold text-amber-500">
                                        {stats.violations}
                                    </span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                                    <span className="text-2xl font-bold text-green-500">OK</span>
                                </>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {stats.violations > 0
                                ? `${stats.violations} violations detected`
                                : "All permissions in sync"}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.pendingRequests}</div>
                        <p className="text-xs text-muted-foreground">
                            {stats.lastScan ? `Last scan: ${formatTimeAgo(stats.lastScan)}` : 'No scan yet'}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Quick Actions */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                    <Link href="/projects/new">
                        <CardHeader>
                            <CardTitle className="text-lg">Create New Project</CardTitle>
                            <CardDescription>
                                Create a new project with the current template
                            </CardDescription>
                        </CardHeader>
                    </Link>
                </Card>

                <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                    <Link href="/template">
                        <CardHeader>
                            <CardTitle className="text-lg">Edit Template</CardTitle>
                            <CardDescription>
                                Modify the folder structure and permissions template
                            </CardDescription>
                        </CardHeader>
                    </Link>
                </Card>

                <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                    <Link href="/approvals">
                        <CardHeader>
                            <CardTitle className="text-lg">
                                View Approvals
                                {stats.pendingRequests > 0 && (
                                    <span className="ml-2 px-2 py-0.5 text-xs bg-amber-500 text-white rounded-full">
                                        {stats.pendingRequests}
                                    </span>
                                )}
                            </CardTitle>
                            <CardDescription>
                                Review pending project requests
                            </CardDescription>
                        </CardHeader>
                    </Link>
                </Card>
            </div>

            {/* Recent Activity */}
            <Card>
                <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                    <CardDescription>Latest actions in the system</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {recentActivity.length > 0 ? (
                            recentActivity.map((item, i) => (
                                <div key={i} className="flex items-start gap-4">
                                    <div
                                        className={`mt-1 h-2 w-2 rounded-full ${item.action?.includes('error') || item.action?.includes('violation')
                                            ? "bg-amber-500"
                                            : item.action?.includes('completed') || item.action?.includes('created')
                                                ? "bg-green-500"
                                                : "bg-blue-500"
                                            }`}
                                    />
                                    <div className="flex-1">
                                        <p className="text-sm font-medium">{item.action}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {item.entity_type}: {item.entity_id}
                                        </p>
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                        {item.created_at ? formatTimeAgo(item.created_at) : ''}
                                    </span>
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-muted-foreground">No recent activity</p>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
