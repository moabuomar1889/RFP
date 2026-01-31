"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, RefreshCw, UserPlus, MoreHorizontal } from "lucide-react";

// Mock users data from Admin SDK
const users = [
    {
        id: "1",
        email: "mo.abuomar@dtgsa.com",
        name: "Mo Abu Omar",
        role: "Admin",
        department: "Management",
        status: "active",
        lastLogin: "2024-01-26T12:00:00Z",
    },
    {
        id: "2",
        email: "ahmed.khalil@dtgsa.com",
        name: "Ahmed Khalil",
        role: "Project Manager",
        department: "Projects",
        status: "active",
        lastLogin: "2024-01-26T10:00:00Z",
    },
    {
        id: "3",
        email: "sara.hassan@dtgsa.com",
        name: "Sara Hassan",
        role: "Quantity Surveyor",
        department: "QS",
        status: "active",
        lastLogin: "2024-01-25T15:00:00Z",
    },
    {
        id: "4",
        email: "omar.mansour@dtgsa.com",
        name: "Omar Mansour",
        role: "Technical Lead",
        department: "Engineering",
        status: "active",
        lastLogin: "2024-01-26T08:00:00Z",
    },
];

export default function UsersPage() {
    const [searchQuery, setSearchQuery] = useState("");

    const filteredUsers = users.filter(
        (user) =>
            user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Users</h1>
                    <p className="text-muted-foreground">
                        Google Workspace users in your domain
                    </p>
                </div>
                <Button variant="outline">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Sync from Google
                </Button>
            </div>

            {/* Search */}
            <Card>
                <CardContent className="pt-6">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search users by name or email..."
                            className="pl-9"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Users Table */}
            <Card>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>User</TableHead>
                            <TableHead>Department</TableHead>
                            <TableHead>App Role</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Last Login</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredUsers.map((user) => (
                            <TableRow key={user.id}>
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <Avatar>
                                            <AvatarFallback>
                                                {user.name
                                                    .split(" ")
                                                    .map((n) => n[0])
                                                    .join("")}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="font-medium">{user.name}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {user.email}
                                            </p>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>{user.department}</TableCell>
                                <TableCell>
                                    <Badge
                                        variant={user.role === "Admin" ? "default" : "secondary"}
                                    >
                                        {user.role}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <Badge
                                        variant="outline"
                                        className="text-green-500 border-green-500"
                                    >
                                        Active
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                    {new Date(user.lastLogin).toLocaleDateString()}
                                </TableCell>
                                <TableCell>
                                    <Button variant="ghost" size="icon">
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>
        </div>
    );
}
