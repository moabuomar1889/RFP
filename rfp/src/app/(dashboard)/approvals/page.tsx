"use client";

import { useState, useEffect } from "react";
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
    Loader2,
    RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

interface Request {
    id: string;
    request_type: string;
    project_name: string;
    pr_number: string | null;
    project_id: string | null;
    status: string;
    requested_by: string;
    requested_at: string;
    reviewed_by?: string;
    reviewed_at?: string;
    rejection_reason?: string;
}

export default function ApprovalsPage() {
    const [loading, setLoading] = useState(true);
    const [pendingRequests, setPendingRequests] = useState<Request[]>([]);
    const [historyRequests, setHistoryRequests] = useState<Request[]>([]);
    const [rejectReason, setRejectReason] = useState("");
    const [rejectingId, setRejectingId] = useState<string | null>(null);
    const [processingId, setProcessingId] = useState<string | null>(null);

    const fetchRequests = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/requests');
            const data = await res.json();

            if (data.success) {
                setPendingRequests(data.pending || []);
                setHistoryRequests(data.history || []);
            }
        } catch (error) {
            console.error('Error fetching requests:', error);
            toast.error('Failed to load requests');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    const handleApprove = async (id: string) => {
        try {
            setProcessingId(id);
            const res = await fetch(`/api/requests/${id}/approve`, {
                method: 'POST',
            });
            const data = await res.json();

            if (data.success) {
                toast.success('Request approved successfully');
                fetchRequests();
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('Error approving request:', error);
            toast.error('Failed to approve request');
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (id: string) => {
        if (!rejectReason.trim()) return;

        try {
            setProcessingId(id);
            const res = await fetch(`/api/requests/${id}/reject`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason: rejectReason }),
            });
            const data = await res.json();

            if (data.success) {
                toast.success('Request rejected');
                fetchRequests();
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('Error rejecting request:', error);
            toast.error('Failed to reject request');
        } finally {
            setProcessingId(null);
            setRejectingId(null);
            setRejectReason("");
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const getRequestIcon = (type: string) => {
        switch (type) {
            case "new_project":
                return <FolderPlus className="h-5 w-5 text-primary" />;
            case "upgrade_to_pd":
                return <ArrowUpCircle className="h-5 w-5 text-blue-500" />;
            default:
                return <AlertCircle className="h-5 w-5 text-amber-500" />;
        }
    };

    const getRequestBadge = (type: string) => {
        switch (type) {
            case "new_project":
                return <Badge>New Project</Badge>;
            case "upgrade_to_pd":
                return <Badge variant="secondary">Upgrade to PD</Badge>;
            default:
                return <Badge variant="outline">{type}</Badge>;
        }
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
                    <h1 className="text-3xl font-bold tracking-tight">Approvals</h1>
                    <p className="text-muted-foreground">
                        Review and approve project requests
                    </p>
                </div>
                <Button variant="outline" onClick={fetchRequests}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                </Button>
            </div>

            <Tabs defaultValue="pending">
                <TabsList>
                    <TabsTrigger value="pending" className="gap-2">
                        <Clock className="h-4 w-4" />
                        Pending ({pendingRequests.length})
                    </TabsTrigger>
                    <TabsTrigger value="history">History</TabsTrigger>
                </TabsList>

                <TabsContent value="pending" className="space-y-4 mt-6">
                    {pendingRequests.length === 0 ? (
                        <Card>
                            <CardContent className="py-12 text-center">
                                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                                <h3 className="font-semibold text-lg">No Pending Requests</h3>
                                <p className="text-muted-foreground">
                                    All requests have been processed
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        pendingRequests.map((request) => (
                            <Card key={request.id}>
                                <CardHeader>
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-start gap-4">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                                                {getRequestIcon(request.request_type)}
                                            </div>
                                            <div>
                                                <CardTitle className="text-lg">
                                                    {request.project_name}
                                                </CardTitle>
                                                <CardDescription>
                                                    Requested by {request.requested_by} on{" "}
                                                    {formatDate(request.requested_at)}
                                                </CardDescription>
                                            </div>
                                        </div>
                                        {getRequestBadge(request.request_type)}
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {rejectingId === request.id ? (
                                        <div className="space-y-3">
                                            <Input
                                                placeholder="Enter rejection reason..."
                                                value={rejectReason}
                                                onChange={(e) => setRejectReason(e.target.value)}
                                            />
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="destructive"
                                                    onClick={() => handleReject(request.id)}
                                                    disabled={!rejectReason.trim() || processingId === request.id}
                                                >
                                                    {processingId === request.id ? (
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    ) : null}
                                                    Confirm Reject
                                                </Button>
                                                <Button
                                                    variant="outline"
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
                                                onClick={() => handleApprove(request.id)}
                                                disabled={processingId === request.id}
                                            >
                                                {processingId === request.id ? (
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                ) : (
                                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                                )}
                                                Approve
                                            </Button>
                                            <Button
                                                variant="outline"
                                                onClick={() => setRejectingId(request.id)}
                                            >
                                                <XCircle className="mr-2 h-4 w-4" />
                                                Reject
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ))
                    )}
                </TabsContent>

                <TabsContent value="history" className="space-y-4 mt-6">
                    {historyRequests.length === 0 ? (
                        <Card>
                            <CardContent className="py-12 text-center text-muted-foreground">
                                No history yet
                            </CardContent>
                        </Card>
                    ) : (
                        historyRequests.map((request) => (
                            <Card key={request.id} className="opacity-75">
                                <CardHeader>
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-start gap-4">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                                                {request.status === "approved" ? (
                                                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                                                ) : (
                                                    <XCircle className="h-5 w-5 text-red-500" />
                                                )}
                                            </div>
                                            <div>
                                                <CardTitle className="text-lg">
                                                    {request.project_name}
                                                </CardTitle>
                                                <CardDescription>
                                                    {request.status === "approved" ? "Approved" : "Rejected"} by{" "}
                                                    {request.reviewed_by} on{" "}
                                                    {request.reviewed_at ? formatDate(request.reviewed_at) : ""}
                                                </CardDescription>
                                            </div>
                                        </div>
                                        <Badge
                                            variant={
                                                request.status === "approved" ? "default" : "destructive"
                                            }
                                        >
                                            {request.status}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                {request.rejection_reason && (
                                    <CardContent>
                                        <p className="text-sm text-muted-foreground">
                                            <span className="font-medium">Reason:</span>{" "}
                                            {request.rejection_reason}
                                        </p>
                                    </CardContent>
                                )}
                            </Card>
                        ))
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
