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
} from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  // These would come from API calls in production
  const stats = {
    totalProjects: 32,
    biddingProjects: 18,
    executionProjects: 14,
    totalFolders: 1580,
    lastSync: "2 hours ago",
    lastEnforcement: "1 hour ago",
    pendingViolations: 3,
    activeJobs: 1,
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
          <Button variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Permission Status</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {stats.pendingViolations > 0 ? (
                <>
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  <span className="text-2xl font-bold text-amber-500">
                    {stats.pendingViolations}
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
              {stats.pendingViolations > 0
                ? `${stats.pendingViolations} violations detected`
                : "All permissions in sync"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeJobs}</div>
            <p className="text-xs text-muted-foreground">
              Last sync: {stats.lastSync}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Active Job Progress */}
      {stats.activeJobs > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Active Job</CardTitle>
            <CardDescription>Template Sync - All Projects</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>18 / 32 projects</span>
              </div>
              <Progress value={56} />
              <p className="text-xs text-muted-foreground">
                Estimated time remaining: 5 minutes
              </p>
            </div>
          </CardContent>
        </Card>
      )}

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
          <Link href="/jobs">
            <CardHeader>
              <CardTitle className="text-lg">View Jobs</CardTitle>
              <CardDescription>
                Monitor sync jobs and permission enforcement
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
            {[
              {
                action: "Permission violation detected",
                detail: "Unauthorized user added to PRJ-PR-015/RFP/Technical",
                time: "5 minutes ago",
                type: "warning",
              },
              {
                action: "Permission enforced",
                detail: "Reverted unauthorized change on PRJ-PR-015",
                time: "5 minutes ago",
                type: "success",
              },
              {
                action: "Template updated",
                detail: "Added 'Safety Documents' folder to template v12",
                time: "2 hours ago",
                type: "info",
              },
              {
                action: "Sync completed",
                detail: "Template v12 applied to all 32 projects",
                time: "2 hours ago",
                type: "success",
              },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-4">
                <div
                  className={`mt-1 h-2 w-2 rounded-full ${item.type === "warning"
                      ? "bg-amber-500"
                      : item.type === "success"
                        ? "bg-green-500"
                        : "bg-blue-500"
                    }`}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium">{item.action}</p>
                  <p className="text-xs text-muted-foreground">{item.detail}</p>
                </div>
                <span className="text-xs text-muted-foreground">{item.time}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
