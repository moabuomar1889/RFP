"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Users,
  UserX,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface DashboardStats {
  totalProjects: number;
  biddingProjects: number;
  executionProjects: number;
  totalFolders: number;
  totalUsers: number;
  usersWithoutGroups: number;
  totalGroups: number;
  lastSync: string | null;
  violations: number;
  activeJobs: number;
  compliantFolders: number;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    totalProjects: 0,
    biddingProjects: 0,
    executionProjects: 0,
    totalFolders: 0,
    totalUsers: 0,
    usersWithoutGroups: 0,
    totalGroups: 0,
    lastSync: null,
    violations: 0,
    activeJobs: 0,
    compliantFolders: 0,
  });

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/dashboard/stats');
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const [rebuilding, setRebuilding] = useState(false);

  const handleRebuildAll = async () => {
    try {
      setRebuilding(true);
      toast.info('Starting full folder index rebuild from Drive...');

      const res = await fetch('/api/jobs/rebuild-index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}) // Empty body triggers rebuild_all
      });
      const data = await res.json();

      if (data.success) {
        toast.success(`Rebuild job started (ID: ${data.jobId}). Check Jobs page.`);
      } else {
        toast.error(data.error || 'Rebuild failed to start');
      }
    } catch (error) {
      toast.error('Failed to trigger rebuild');
    } finally {
      setRebuilding(false);
    }
  };

  const handleSyncAll = async () => {
    try {
      setSyncing(true);
      toast.info('Syncing users and groups from Google...');

      const res = await fetch('/api/sync-all', { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        toast.success(`Synced ${data.users} users and ${data.groups} groups`);
        fetchStats();
      } else {
        toast.error(data.error || 'Sync failed');
      }
    } catch (error) {
      toast.error('Failed to sync');
    } finally {
      setSyncing(false);
    }
  };

  const handleRefresh = () => {
    fetchStats();
    toast.success('Dashboard refreshed');
  };

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
          <Button variant="outline" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleRebuildAll} disabled={rebuilding}>
            {rebuilding ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileStack className="mr-2 h-4 w-4" />
            )}
            Rebuild All Projects
          </Button>
          <Button variant="outline" onClick={handleSyncAll} disabled={syncing}>
            {syncing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Users className="mr-2 h-4 w-4" />
            )}
            Sync Users & Groups
          </Button>
          <Button>
            <Play className="mr-2 h-4 w-4" />
            Enforce Now
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
              {stats.biddingProjects} bidding, {stats.executionProjects} execution
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalGroups} groups
            </p>
          </CardContent>
        </Card>

        {/* Users Without Groups Warning */}
        <Card className={stats.usersWithoutGroups > 0 ? "border-amber-500/50" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Group Status</CardTitle>
            {stats.usersWithoutGroups > 0 ? (
              <UserX className="h-4 w-4 text-amber-500" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {stats.usersWithoutGroups > 0 ? (
                <>
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  <span className="text-2xl font-bold text-amber-500">
                    {stats.usersWithoutGroups}
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
              {stats.usersWithoutGroups > 0
                ? `${stats.usersWithoutGroups} users without groups`
                : "All users assigned to groups"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Indexed Folders</CardTitle>
            <FileStack className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalFolders}</div>
            <p className="text-xs text-muted-foreground">
              Across all projects
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alert for Users Without Groups */}
      {stats.usersWithoutGroups > 0 && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Attention Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              {stats.usersWithoutGroups} users are not assigned to any group.
              This may prevent them from accessing project folders.
            </p>
            <Link href="/users">
              <Button variant="outline" size="sm">
                <Users className="mr-2 h-4 w-4" />
                Manage Users
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Health & Status Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Compliance Health */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Compliance Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalFolders > 0
                ? Math.round((stats.compliantFolders / stats.totalFolders) * 100)
                : 0}%
            </div>
            <Progress
              value={stats.totalFolders > 0
                ? (stats.compliantFolders / stats.totalFolders) * 100
                : 0}
              className="mt-2 h-2"
            />
            <p className="text-xs text-muted-foreground mt-2">
              {stats.compliantFolders} of {stats.totalFolders} folders compliant
            </p>
          </CardContent>
        </Card>

        {/* Sync Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Sync Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 mb-2">
              {stats.activeJobs > 0 ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              )}
              <span className="text-2xl font-bold">
                {stats.activeJobs > 0 ? 'Syncing' : 'Idle'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.activeJobs} active jobs • Last scan: {stats.lastSync ? new Date(stats.lastSync).toLocaleDateString() : 'Never'}
            </p>
          </CardContent>
        </Card>

        {/* Violations */}
        <Card className={stats.violations > 0 ? "border-amber-500/50" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Non-Compliant Folders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {stats.violations > 0 ? (
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              ) : (
                <Shield className="h-5 w-5 text-green-500" />
              )}
              <span className={`text-2xl font-bold ${stats.violations > 0 ? 'text-amber-500' : 'text-green-500'}`}>
                {stats.violations}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Folders requiring enforcement
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
