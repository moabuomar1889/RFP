"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Folder, Shield, Loader2, Mail, User, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface UserDetail {
    id: string;
    email: string;
    name: string;
    role?: string;
    department?: string;
    status?: string;
    last_login?: string;
    created_at?: string;
}

interface AccessibleFolder {
    path: string;
    name: string;
    role: string;
    accessVia: string;
}

export default function UserDetailPage() {
    const params = useParams();
    const userId = params.id as string;

    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<UserDetail | null>(null);
    const [folders, setFolders] = useState<AccessibleFolder[]>([]);

    const fetchUserDetails = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/users/${userId}`);
            const data = await res.json();

            if (data.success) {
                setUser(data.user);
                setFolders(data.accessibleFolders || []);
            } else {
                toast.error(data.error || 'User not found');
            }
        } catch (error) {
            console.error('Error fetching user details:', error);
            toast.error('Failed to load user details');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (userId) {
            fetchUserDetails();
        }
    }, [userId]);

    function getRoleBadge(role: string) {
        const colors: Record<string, string> = {
            organizer: "bg-red-500",
            fileOrganizer: "bg-orange-500",
            writer: "bg-blue-500",
            commenter: "bg-cyan-500",
            reader: "bg-gray-500",
        };
        return <Badge className={colors[role] || "bg-gray-500"}>{role}</Badge>;
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!user) {
        return (
            <div className="space-y-6">
                <Link href="/users">
                    <Button variant="outline">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Users
                    </Button>
                </Link>
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                        User not found
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Back Button */}
            <Link href="/users">
                <Button variant="outline">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Users
                </Button>
            </Link>

            {/* User Info Card */}
            <Card>
                <CardHeader>
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                            <Avatar className="h-16 w-16">
                                <AvatarFallback className="text-xl">
                                    {user.name
                                        ?.split(" ")
                                        .map((n) => n[0])
                                        .join("") || "?"}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <CardTitle className="text-2xl">{user.name}</CardTitle>
                                <CardDescription className="flex items-center gap-2 mt-1">
                                    <Mail className="h-4 w-4" />
                                    {user.email}
                                </CardDescription>
                            </div>
                        </div>
                        <Button variant="outline" onClick={fetchUserDetails}>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Refresh
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-4">
                        <div>
                            <p className="text-sm text-muted-foreground">Role</p>
                            <Badge variant={user.role === "Admin" ? "default" : "secondary"}>
                                {user.role || 'User'}
                            </Badge>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Department</p>
                            <p className="font-medium">{user.department || '-'}</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Status</p>
                            <Badge variant="outline" className="text-green-500 border-green-500">
                                {user.status || 'Active'}
                            </Badge>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Last Login</p>
                            <p className="font-medium">
                                {user.last_login ? new Date(user.last_login).toLocaleDateString() : '-'}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Folder Access Card */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-primary" />
                        <CardTitle>Folder Access</CardTitle>
                    </div>
                    <CardDescription>
                        Folders this user has access to based on template permissions
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {folders.length === 0 ? (
                        <div className="py-8 text-center text-muted-foreground">
                            <Folder className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No folder access found for this user.</p>
                            <p className="text-sm mt-2">
                                Access is determined by the template permissions and group memberships.
                            </p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Folder Path</TableHead>
                                    <TableHead>Permission</TableHead>
                                    <TableHead>Access Via</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {folders.map((folder, index) => (
                                    <TableRow key={index}>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Folder className="h-4 w-4 text-muted-foreground" />
                                                <span className="font-medium">{folder.path}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {getRoleBadge(folder.role)}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{folder.accessVia}</Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
