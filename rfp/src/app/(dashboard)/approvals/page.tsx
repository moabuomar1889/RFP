"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    CheckCircle2,
    XCircle,
    Clock,
    FolderPlus,
    ArrowUpCircle,
    AlertCircle,
} from "lucide-react";

// Mock data for pending requests
const mockRequests = [
    {
        id: "1",
        request_type: "new_project",
        project_name: "King Abdullah Financial District",
        pr_number: "PR-035",
        status: "pending",
        requested_by: "ahmad@dtgsa.com",
        requested_at: "2026-01-27T10:00:00Z",
    },
    {
        id: "2",
        request_type: "new_project",
        project_name: "Riyadh Metro Station",
        pr_number: "PR-036",
        status: "pending",
        requested_by: "omar@dtgsa.com",
        requested_at: "2026-01-27T09:30:00Z",
    },
    {
        id: "3",
        request_type: "upgrade_to_pd",
        project_name: "Al Madinah Tower",
        pr_number: "PR-001",
        project_id: "abc123",
        status: "pending",
        requested_by: "ahmed@dtgsa.com",
        requested_at: "2026-01-27T08:00:00Z",
    },
];

const mockHistory = [
    {
        id: "4",
        request_type: "new_project",
        project_name: "Jeddah Waterfront",
        pr_number: "PR-034",
        status: "approved",
        requested_by: "sara@dtgsa.com",
        requested_at: "2026-01-26T14:00:00Z",
        reviewed_by: "mo.abuomar@dtgsa.com",
        reviewed_at: "2026-01-26T15:00:00Z",
    },
    {
        id: "5",
        request_type: "new_project",
        project_name: "Test Project",
        pr_number: "PR-033",
        status: "rejected",
        requested_by: "test@dtgsa.com",
        requested_at: "2026-01-25T10:00:00Z",
        reviewed_by: "mo.abuomar@dtgsa.com",
        reviewed_at: "2026-01-25T11:00:00Z",
        rejection_reason: "Duplicate project name",
    },
];

export default function ApprovalsPage() {
    const [pendingRequests, setPendingRequests] = useState(mockRequests);
    const [historyRequests] = useState(mockHistory);
    const [rejectReason, setRejectReason] = useState("");
    const [rejectingId, setRejectingId] = useState<string | null>(null);

    const handleApprove = async (id: string) => {
        // In real implementation, call API
        setPendingRequests(prev => prev.filter(r => r.id !== id));
        // Show success toast
    };

    const handleReject = async (id: string) => {
        if (!rejectReason.trim()) return;
        // In real implementation, call API
        setPendingRequests(prev => prev.filter(r => r.id !== id));
        setRejectingId(null);
        setRejectReason("");
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Approval Queue</h1>
                <p className="text-muted-foreground">
                    Review and approve project requests
                </p>
            </div>

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-500/10">
                                <Clock className="h-6 w-6 text-amber-500" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold">{pendingRequests.length}</div>
                                <p className="text-sm text-muted-foreground">Pending</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/10">
                                <CheckCircle2 className="h-6 w-6 text-green-500" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold">
                                    {historyRequests.filter(r => r.status === "approved").length}
                                </div>
                                <p className="text-sm text-muted-foreground">Approved (today)</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-500/10">
                                <XCircle className="h-6 w-6 text-red-500" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold">
                                    {historyRequests.filter(r => r.status === "rejected").length}
                                </div>
                                <p className="text-sm text-muted-foreground">Rejected (today)</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="pending">
                <TabsList>
                    <TabsTrigger value="pending" className="gap-2">
                        <Clock className="h-4 w-4" />
                        Pending ({pendingRequests.length})
                    </TabsTrigger>
                    <TabsTrigger value="history">History</TabsTrigger>
                </TabsList>

                <TabsContent value="pending" className="mt-6 space-y-4">
                    {pendingRequests.length === 0 ? (
                        <Card>
                            <CardContent className="py-12 text-center">
                                <CheckCircle2 className="mx-auto h-12 w-12 text-green-500 mb-4" />
                                <p className="text-lg font-medium">All caught up!</p>
                                <p className="text-muted-foreground">No pending requests</p>
                            </CardContent>
                        </Card>
                    ) : (
                        pendingRequests.map((request) => (
                            <Card key={request.id}>
                                <CardContent className="pt-6">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-start gap-4">
                                            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${request.request_type === "new_project"
                                                    ? "bg-blue-500/10"
                                                    : "bg-purple-500/10"
                                                }`}>
                                                {request.request_type === "new_project" ? (
                                                    <FolderPlus className="h-5 w-5 text-blue-500" />
                                                ) : (
                                                    <ArrowUpCircle className="h-5 w-5 text-purple-500" />
                                                )}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium">{request.pr_number}</span>
                                                    <Badge variant={request.request_type === "new_project" ? "default" : "secondary"}>
                                                        {request.request_type === "new_project" ? "New Project" : "Upgrade to PD"}
                                                    </Badge>
                                                </div>
                                                <p className="text-lg font-semibold mt-1">{request.project_name}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    Requested by {request.requested_by} • {formatDate(request.requested_at)}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-2">
                                            {rejectingId === request.id ? (
                                                <div className="flex flex-col gap-2">
                                                    <Input
                                                        placeholder="Rejection reason"
                                                        value={rejectReason}
                                                        onChange={(e) => setRejectReason(e.target.value)}
                                                        className="w-64"
                                                    />
                                                    <div className="flex gap-2">
                                                        <Button
                                                            variant="destructive"
                                                            size="sm"
                                                            onClick={() => handleReject(request.id)}
                                                            disabled={!rejectReason.trim()}
                                                        >
                                                            Confirm Reject
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => {
                                                                setRejectingId(null);
                                                                setRejectReason("");
                                                            }}
                                                        >
                                                            Cancel
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex gap-2">
                                                    <Button
                                                        className="bg-green-600 hover:bg-green-700"
                                                        onClick={() => handleApprove(request.id)}
                                                    >
                                                        <CheckCircle2 className="mr-2 h-4 w-4" />
                                                        Approve
                                                    </Button>
                                                    <Button
                                                        variant="destructive"
                                                        onClick={() => setRejectingId(request.id)}
                                                    >
                                                        <XCircle className="mr-2 h-4 w-4" />
                                                        Reject
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </TabsContent>

                <TabsContent value="history" className="mt-6 space-y-4">
                    {historyRequests.map((request) => (
                        <Card key={request.id} className="opacity-80">
                            <CardContent className="pt-6">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-4">
                                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${request.status === "approved"
                                                ? "bg-green-500/10"
                                                : "bg-red-500/10"
                                            }`}>
                                            {request.status === "approved" ? (
                                                <CheckCircle2 className="h-5 w-5 text-green-500" />
                                            ) : (
                                                <XCircle className="h-5 w-5 text-red-500" />
                                            )}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">{request.pr_number}</span>
                                                <Badge variant={request.status === "approved" ? "default" : "destructive"}>
                                                    {request.status === "approved" ? "Approved" : "Rejected"}
                                                </Badge>
                                            </div>
                                            <p className="text-lg font-semibold mt-1">{request.project_name}</p>
                                            <p className="text-sm text-muted-foreground">
                                                Requested by {request.requested_by} • Reviewed by {request.reviewed_by}
                                            </p>
                                            {request.rejection_reason && (
                                                <div className="mt-2 flex items-center gap-2 text-sm text-red-500">
                                                    <AlertCircle className="h-4 w-4" />
                                                    {request.rejection_reason}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        {formatDate(request.reviewed_at!)}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </TabsContent>
            </Tabs>
        </div>
    );
}
