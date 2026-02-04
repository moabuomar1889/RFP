"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Save,
    Shield,
    AlertTriangle,
    CheckCircle2,
    Plus,
    Trash2,
    RefreshCw,
    FlaskConical,
    Lock,
    Info,
    HardDrive,
    Loader2,
} from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
    const [protectedPrincipals, setProtectedPrincipals] = useState([
        "mo.abuomar@dtgsa.com",
        "admins@dtgsa.com",
    ]);
    const [newPrincipal, setNewPrincipal] = useState("");
    const [strictModeEnabled, setStrictModeEnabled] = useState(true);
    const [safeTestMode, setSafeTestMode] = useState(true);
    const [bulkApproved, setBulkApproved] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [scanResults, setScanResults] = useState<any>(null);

    const addPrincipal = () => {
        if (newPrincipal && !protectedPrincipals.includes(newPrincipal)) {
            setProtectedPrincipals([...protectedPrincipals, newPrincipal]);
            setNewPrincipal("");
        }
    };

    const removePrincipal = (email: string) => {
        if (email === "mo.abuomar@dtgsa.com") return;
        setProtectedPrincipals(protectedPrincipals.filter((p) => p !== email));
    };

    const scanDrive = async () => {
        setScanning(true);
        try {
            const response = await fetch("/api/scan/projects", {
                method: "POST",
            });
            const data = await response.json();
            if (data.success) {
                setScanResults(data.results);
                toast.success(data.message);
            } else {
                toast.error(data.error || "Scan failed");
            }
        } catch (error) {
            toast.error("Failed to scan Drive");
        } finally {
            setScanning(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                    <p className="text-muted-foreground">
                        Configure system behavior and security
                    </p>
                </div>
                <Button>
                    <Save className="mr-2 h-4 w-4" />
                    Save Settings
                </Button>
            </div>

            <Tabs defaultValue="safetest">
                <TabsList>
                    <TabsTrigger value="safetest" className="gap-2">
                        <FlaskConical className="h-4 w-4" />
                        Safe Test
                    </TabsTrigger>
                    <TabsTrigger value="security">Security</TabsTrigger>
                    <TabsTrigger value="google">Google Auth</TabsTrigger>
                    <TabsTrigger value="enforcement">Enforcement</TabsTrigger>
                    <TabsTrigger value="advanced">Advanced</TabsTrigger>
                </TabsList>

                {/* NEW: Safe Test Mode Tab */}
                <TabsContent value="safetest" className="space-y-6 mt-6">
                    <Card className="border-blue-500/50">
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                                    <FlaskConical className="h-5 w-5 text-blue-500" />
                                </div>
                                <div>
                                    <CardTitle>Safe Test Mode</CardTitle>
                                    <CardDescription>
                                        Restrict operations to single project until approved
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between p-4 rounded-lg border border-blue-500/30 bg-blue-500/5">
                                <div>
                                    <p className="font-medium">Safe Test Mode Status</p>
                                    <p className="text-sm text-muted-foreground">
                                        When enabled, bulk operations are disabled
                                    </p>
                                </div>
                                <Badge className={safeTestMode ? "bg-blue-500" : "bg-green-500"}>
                                    {safeTestMode ? "ENABLED" : "DISABLED"}
                                </Badge>
                            </div>

                            {safeTestMode && (
                                <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
                                    <div className="flex items-start gap-3">
                                        <Info className="h-5 w-5 text-blue-500 mt-0.5" />
                                        <div className="space-y-2">
                                            <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                                                Restrictions Active:
                                            </p>
                                            <ul className="text-sm text-muted-foreground space-y-1">
                                                <li>• Can only select ONE project at a time</li>
                                                <li>• "Apply to All Projects" button is DISABLED</li>
                                                <li>• "Enforce on All" is DISABLED</li>
                                                <li>• Bulk sync operations blocked</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <Separator />

                            <div>
                                <h4 className="font-medium mb-3">Strict Mode Scope Confirmation</h4>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 p-3 rounded-lg border bg-green-500/5 border-green-500/30">
                                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                                        <span className="text-sm">Only modifies folder/file permissions</span>
                                    </div>
                                    <div className="flex items-center gap-2 p-3 rounded-lg border bg-green-500/5 border-green-500/30">
                                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                                        <span className="text-sm">Does NOT modify Shared Drive membership</span>
                                    </div>
                                    <div className="flex items-center gap-2 p-3 rounded-lg border bg-green-500/5 border-green-500/30">
                                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                                        <span className="text-sm">Protected principals are NEVER removed</span>
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            <div>
                                <h4 className="font-medium mb-3">Testing Steps</h4>
                                <div className="space-y-2 text-sm">
                                    <div className="flex items-center gap-3 p-3 rounded-lg border">
                                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">1</span>
                                        <span>Select a single test project</span>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 rounded-lg border">
                                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">2</span>
                                        <span>Run "Sync Project" on test project only</span>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 rounded-lg border">
                                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">3</span>
                                        <span>Manually add unauthorized permission in Drive</span>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 rounded-lg border">
                                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">4</span>
                                        <span>Click "Enforce on Project" (single project)</span>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 rounded-lg border">
                                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">5</span>
                                        <span>Check Audit Log for reversion entry</span>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 rounded-lg border">
                                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">6</span>
                                        <span>Request admin approval to disable Safe Test Mode</span>
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            {/* Approval Section */}
                            <div className="p-4 rounded-lg border border-amber-500/50 bg-amber-500/5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium flex items-center gap-2">
                                            <Lock className="h-4 w-4" />
                                            Bulk Operations Approval
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            Requires successful test completion and admin approval
                                        </p>
                                    </div>
                                    <Badge variant={bulkApproved ? "default" : "destructive"}>
                                        {bulkApproved ? "APPROVED" : "NOT APPROVED"}
                                    </Badge>
                                </div>
                                {!bulkApproved && (
                                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                                        Complete testing steps above, then request approval from admin to enable bulk operations.
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="security" className="space-y-6 mt-6">
                    {/* Strict Mode */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                                </div>
                                <div>
                                    <CardTitle>Strict Mode</CardTitle>
                                    <CardDescription>
                                        Automatically revert unauthorized permission changes
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between p-4 rounded-lg border">
                                <div>
                                    <p className="font-medium">Enable Strict Mode</p>
                                    <p className="text-sm text-muted-foreground">
                                        Any manual permission changes will be automatically reverted
                                    </p>
                                </div>
                                <Badge variant={strictModeEnabled ? "default" : "secondary"}>
                                    {strictModeEnabled ? "Enabled" : "Disabled"}
                                </Badge>
                            </div>
                            {strictModeEnabled && (
                                <div className="mt-4 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
                                    <p className="text-sm text-amber-600 dark:text-amber-400">
                                        <strong>Warning:</strong> Strict mode is active. Any permissions
                                        added or removed manually in Google Drive will be detected and
                                        reverted to match the template.
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Protected Principals */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                                    <Shield className="h-5 w-5 text-green-500" />
                                </div>
                                <div>
                                    <CardTitle>Protected Principals</CardTitle>
                                    <CardDescription>
                                        These accounts will NEVER have their permissions removed
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                {protectedPrincipals.map((email) => (
                                    <div
                                        key={email}
                                        className="flex items-center justify-between p-3 rounded-lg border"
                                    >
                                        <div className="flex items-center gap-3">
                                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                                            <span className="text-sm font-medium">{email}</span>
                                        </div>
                                        {email !== "mo.abuomar@dtgsa.com" ? (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => removePrincipal(email)}
                                            >
                                                <Trash2 className="h-4 w-4 text-muted-foreground" />
                                            </Button>
                                        ) : (
                                            <Badge variant="secondary">Primary Admin</Badge>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <Separator />
                            <div className="flex gap-2">
                                <Input
                                    placeholder="email@domain.com or group@domain.com"
                                    value={newPrincipal}
                                    onChange={(e) => setNewPrincipal(e.target.value)}
                                />
                                <Button onClick={addPrincipal}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Add user emails or Google Group emails that should always maintain access.
                            </p>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="google" className="space-y-6 mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Google Authentication Status</CardTitle>
                            <CardDescription>
                                OAuth connection status for Google Drive and Admin APIs
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between p-4 rounded-lg border">
                                <div className="flex items-center gap-3">
                                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                                    <div>
                                        <p className="font-medium">Connected</p>
                                        <p className="text-sm text-muted-foreground">
                                            mo.abuomar@dtgsa.com
                                        </p>
                                    </div>
                                </div>
                                <Button variant="outline">
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Reconnect
                                </Button>
                            </div>

                            <div className="space-y-2">
                                <Label>Active Scopes</Label>
                                <div className="flex flex-wrap gap-2">
                                    <Badge variant="outline">drive</Badge>
                                    <Badge variant="outline">admin.directory.user.readonly</Badge>
                                    <Badge variant="outline">admin.directory.group.readonly</Badge>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Shared Drive</Label>
                                <div className="p-3 rounded-lg border">
                                    <p className="font-mono text-sm">1dTLJTMRfRJ-hwYtC6JwLcJ5BXibSjz9W</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="enforcement" className="space-y-6 mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Enforcement Schedule</CardTitle>
                            <CardDescription>
                                Configure when and how permission enforcement runs
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between p-4 rounded-lg border">
                                <div>
                                    <p className="font-medium">After Template Changes</p>
                                    <p className="text-sm text-muted-foreground">
                                        Automatically enforce after applying template updates
                                    </p>
                                </div>
                                <Badge>Enabled</Badge>
                            </div>

                            <div className="flex items-center justify-between p-4 rounded-lg border">
                                <div>
                                    <p className="font-medium">Daily Scheduled Enforcement</p>
                                    <p className="text-sm text-muted-foreground">
                                        Run full enforcement scan at 2:00 AM (off-hours)
                                    </p>
                                </div>
                                <Badge variant="secondary">Disabled</Badge>
                            </div>

                            <div className="flex items-center justify-between p-4 rounded-lg border">
                                <div>
                                    <p className="font-medium">Rate Limiting</p>
                                    <p className="text-sm text-muted-foreground">
                                        300ms delay between API calls to avoid quota issues
                                    </p>
                                </div>
                                <Badge variant="outline">300ms</Badge>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="advanced" className="space-y-6 mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Advanced Settings</CardTitle>
                            <CardDescription>
                                Danger zone - these settings can affect system behavior
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Scan Drive - IMPORTANT: First action for new setup */}
                            <div className="flex items-center justify-between p-4 rounded-lg border border-green-500/50 bg-green-500/5">
                                <div>
                                    <p className="font-medium flex items-center gap-2">
                                        <HardDrive className="h-4 w-4 text-green-500" />
                                        Scan Drive for Existing Projects
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        Import existing project folders from Shared Drive to database
                                    </p>
                                    {scanResults && (
                                        <div className="mt-2 text-xs text-muted-foreground">
                                            Last scan: Found {scanResults.found}, Created {scanResults.created}, Updated {scanResults.updated}
                                            {scanResults.phases && (
                                                <span className="ml-2">
                                                    (Bidding: {scanResults.phases.bidding}, Project Delivery: {scanResults.phases.execution})
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <Button
                                    onClick={scanDrive}
                                    disabled={scanning}
                                    className="bg-green-600 hover:bg-green-700"
                                >
                                    {scanning ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Scanning...
                                        </>
                                    ) : (
                                        <>
                                            <HardDrive className="mr-2 h-4 w-4" />
                                            Scan Drive
                                        </>
                                    )}
                                </Button>
                            </div>

                            <div className="flex items-center justify-between p-4 rounded-lg border border-amber-500/50">
                                <div>
                                    <p className="font-medium">Rebuild Folder Index</p>
                                    <p className="text-sm text-muted-foreground">
                                        Scan all projects and rebuild the folder index from Drive
                                    </p>
                                </div>
                                <Button variant="outline" disabled={safeTestMode}>
                                    {safeTestMode ? "Disabled in Test Mode" : "Rebuild Index"}
                                </Button>
                            </div>

                            <div className="flex items-center justify-between p-4 rounded-lg border border-amber-500/50">
                                <div>
                                    <p className="font-medium">Reconcile Index</p>
                                    <p className="text-sm text-muted-foreground">
                                        Detect folder renames/moves/deletions
                                    </p>
                                </div>
                                <Button variant="outline" disabled={safeTestMode}>
                                    {safeTestMode ? "Disabled in Test Mode" : "Run Reconcile"}
                                </Button>
                            </div>

                            <div className="flex items-center justify-between p-4 rounded-lg border border-red-500/50">
                                <div>
                                    <p className="font-medium text-red-500">Clear All Jobs</p>
                                    <p className="text-sm text-muted-foreground">
                                        Remove all completed and failed job history
                                    </p>
                                </div>
                                <Button variant="destructive">Clear Jobs</Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
