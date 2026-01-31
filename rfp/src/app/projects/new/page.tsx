"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FolderPlus, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";

export default function NewProjectPage() {
    const [projectName, setProjectName] = useState("");
    const [nextPrNumber, setNextPrNumber] = useState("PR-035"); // Mock, will be fetched
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);

    // Mock fetch next PR number
    useEffect(() => {
        // In real implementation, fetch from /api/projects/next-pr-number
        setNextPrNumber("PR-035");
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!projectName.trim()) return;

        setIsSubmitting(true);

        // Mock API call - in real implementation:
        // await fetch('/api/requests', {
        //   method: 'POST',
        //   body: JSON.stringify({ requestType: 'new_project', projectName })
        // });

        setTimeout(() => {
            setIsSubmitting(false);
            setIsSubmitted(true);
        }, 1500);
    };

    if (isSubmitted) {
        return (
            <div className="max-w-2xl mx-auto space-y-6">
                <Card className="border-green-500/50">
                    <CardContent className="pt-12 pb-12 text-center">
                        <div className="flex justify-center mb-6">
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
                                <CheckCircle2 className="h-8 w-8 text-green-500" />
                            </div>
                        </div>
                        <h2 className="text-2xl font-bold mb-2">Request Submitted!</h2>
                        <p className="text-muted-foreground mb-6">
                            Your project request has been submitted for approval.
                        </p>
                        <div className="p-4 rounded-lg bg-muted mb-6">
                            <div className="text-sm text-muted-foreground">Project Reference</div>
                            <div className="text-2xl font-bold">{nextPrNumber}</div>
                            <div className="text-lg">{projectName}</div>
                        </div>
                        <p className="text-sm text-muted-foreground mb-6">
                            You will be notified when your request is reviewed by an admin.
                        </p>
                        <div className="flex gap-4 justify-center">
                            <Button variant="outline" asChild>
                                <Link href="/projects">View Projects</Link>
                            </Button>
                            <Button onClick={() => {
                                setIsSubmitted(false);
                                setProjectName("");
                            }}>
                                Submit Another
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* Page Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/projects">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Request New Project</h1>
                    <p className="text-muted-foreground">
                        Submit a project request for admin approval
                    </p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Project Details</CardTitle>
                    <CardDescription>
                        Enter the project name. The system will automatically assign a PR number.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Auto-generated PR Number */}
                        <div className="p-4 rounded-lg bg-muted">
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label className="text-muted-foreground">Auto-Generated PR Number</Label>
                                    <div className="text-2xl font-bold">{nextPrNumber}</div>
                                </div>
                                <Badge variant="outline" className="text-lg px-3 py-1">
                                    Auto
                                </Badge>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="project-name">Project Name *</Label>
                            <Input
                                id="project-name"
                                placeholder="e.g., King Abdullah Financial District"
                                value={projectName}
                                onChange={(e) => setProjectName(e.target.value)}
                                required
                                className="text-lg py-6"
                            />
                            <p className="text-xs text-muted-foreground">
                                Enter a descriptive name for the project
                            </p>
                        </div>

                        {/* Preview */}
                        {projectName && (
                            <div className="p-4 rounded-lg border bg-blue-500/5 border-blue-500/30">
                                <h4 className="font-medium mb-2 text-blue-600 dark:text-blue-400">
                                    Folder Preview
                                </h4>
                                <div className="font-mono text-sm">
                                    PRJ-{nextPrNumber}-{projectName.replace(/\s+/g, '-')}
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">
                                    This folder will be created in the Shared Drive after approval
                                </p>
                            </div>
                        )}

                        {/* What happens next */}
                        <div className="p-4 rounded-lg bg-muted">
                            <h4 className="font-medium mb-2">What happens next?</h4>
                            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                                <li>Your request is submitted to the approval queue</li>
                                <li>An admin reviews and approves/rejects the request</li>
                                <li>If approved, folders are created automatically</li>
                                <li>You get notified and can start using the project</li>
                            </ol>
                        </div>

                        <Button
                            type="submit"
                            className="w-full"
                            disabled={isSubmitting || !projectName.trim()}
                            size="lg"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Submitting...
                                </>
                            ) : (
                                <>
                                    <FolderPlus className="mr-2 h-4 w-4" />
                                    Submit Request
                                </>
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
