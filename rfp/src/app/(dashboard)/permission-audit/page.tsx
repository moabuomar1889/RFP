"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    RefreshCw,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    AlertCircle,
    ChevronDown,
    ChevronRight,
    Download,
    Shield,
    Loader2,
    Folder,
    FolderOpen,
    Lock,
    Users,
    User,
    Info,
} from "lucide-react";
import { toast } from "sonner";
import { ContextMenu } from "@/components/ui/context-menu";

// ─── Types (unchanged) ──────────────────────────────────────
// Backend ComparisonRow — pre-computed by API
interface ComparisonRow {
    type: 'group' | 'user';
    identifier: string;
    expectedRole: string | null;
    expectedRoleRaw: string | null;
    actualRole: string | null;
    actualRoleRaw: string | null;
    status: 'match' | 'missing' | 'extra' | 'mismatch' | 'drive_member';
    tags: string[];
    inherited: boolean;
}

interface PermissionComparison {
    folderPath: string;
    normalizedPath: string;
    driveFolderId: string;
    expectedGroups: { email: string; role: string }[];
    expectedUsers: { email: string; role: string }[];
    actualPermissions: {
        email: string;
        role: string;
        type: string;
        inherited?: boolean;
        classification?: string;
    }[];
    comparisonRows?: ComparisonRow[];
    matchCount?: number;
    extraCount?: number;
    missingCount?: number;
    mismatchCount?: number;
    status: "exact_match" | "compliant" | "non_compliant";
    statusLabel: string;
    discrepancies: string[];
    expectedCount: number;
    directActualCount: number;
    inheritedActualCount: number;
    inheritedNonRemovableCount?: number;
    totalActualCount: number;
    limitedAccessExpected: boolean;
}

interface AuditResult {
    projectId: string;
    projectName: string;
    projectCode: string;
    phase?: string;
    phaseLabel?: string;
    totalFolders: number;
    matchCount: number;
    extraCount: number;
    missingCount: number;
    mismatchCount: number;
    comparisons: PermissionComparison[];
}

interface Project {
    id: string;
    name: string;
    pr_number: string;
}

// ─── Helpers ────────────────────────────────────────────────
const getRoleLabel = (role: string) => {
    const roleMap: Record<string, string> = {
        // Canonical roles
        viewer: "Viewer",
        commenter: "Commenter",
        contributor: "Contributor",
        contentManager: "Content Manager",
        manager: "Manager",
        // API-level roles (backward compat)
        owner: "Owner",
        organizer: "Manager",
        fileOrganizer: "Content Manager",
        writer: "Contributor",
        reader: "Viewer",
    };
    return roleMap[role] || role;
};

const normalizeRole = (role: string) => {
    // Map Drive API roles → canonical roles
    const map: Record<string, string> = {
        reader: "viewer",
        commenter: "commenter",
        writer: "contributor",
        fileOrganizer: "contentManager",
        organizer: "manager",
    };
    return map[role] || role;
};

const getStatusIcon = (status: string, size = "h-4 w-4") => {
    switch (status) {
        case "exact_match":
        case "match":
            return <CheckCircle2 className={`${size} text-green-500`} />;
        case "compliant":
            return <Shield className={`${size} text-blue-500`} />;
        case "non_compliant":
            return <XCircle className={`${size} text-red-500`} />;
        default:
            return null;
    }
};

const getStatusBadge = (status: string) => {
    switch (status) {
        case "exact_match":
            return (
                <Badge className="bg-green-500/10 text-green-600 border-green-500/30">
                    Exact Match
                </Badge>
            );
        case "compliant":
            return (
                <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/30">
                    Compliant
                </Badge>
            );
        case "non_compliant":
            return (
                <Badge className="bg-red-500/10 text-red-600 border-red-500/30">
                    Non-Compliant
                </Badge>
            );
        default:
            return null;
    }
};

// ─── Build tree structure from flat comparisons ─────────────
interface TreeNode {
    id: string;
    name: string;
    path: string;
    comparison: PermissionComparison | null;
    children: TreeNode[];
}

function buildFolderTree(comparisons: PermissionComparison[], phaseLabel?: string): TreeNode[] {
    const roots: TreeNode[] = [];
    const nodeMap = new Map<string, TreeNode>();

    // Sort by path depth
    const sorted = [...comparisons].sort(
        (a, b) => a.normalizedPath.split("/").length - b.normalizedPath.split("/").length
    );

    for (const comp of sorted) {
        const parts = comp.normalizedPath.split("/").filter(Boolean);
        const name = parts[parts.length - 1] || comp.normalizedPath;
        const node: TreeNode = {
            id: comp.normalizedPath,
            name,
            path: comp.normalizedPath,
            comparison: comp,
            children: [],
        };
        nodeMap.set(comp.normalizedPath, node);

        // Find parent
        const parentPath = parts.slice(0, -1).join("/");
        const parent = parentPath ? nodeMap.get(parentPath) : null;
        if (parent) {
            parent.children.push(node);
        } else {
            roots.push(node);
        }
    }

    // Wrap in phase root node if phaseLabel is provided
    if (phaseLabel && roots.length > 0) {
        const phaseRoot: TreeNode = {
            id: `__phase__${phaseLabel}`,
            name: phaseLabel,
            path: `__phase__${phaseLabel}`,
            comparison: null,
            children: roots,
        };
        return [phaseRoot];
    }

    return roots;
}

// ─── Folder Tree Node ───────────────────────────────────────
function AuditTreeNode({
    node,
    selectedPath,
    expandedPaths,
    onSelect,
    onToggleExpand,
    onContextMenu,
    level = 0,
}: {
    node: TreeNode;
    selectedPath: string | null;
    expandedPaths: Set<string>;
    onSelect: (path: string) => void;
    onToggleExpand: (path: string) => void;
    level?: number;
    onContextMenu?: (e: React.MouseEvent, path: string) => void;
}) {
    const isSelected = selectedPath === node.path;
    const isExpanded = expandedPaths.has(node.path);
    const hasChildren = node.children.length > 0;
    const status = node.comparison?.status;

    return (
        <div>
            <div
                className={`flex items-center gap-1 py-1.5 px-2 rounded-md cursor-pointer text-sm transition-colors ${isSelected
                    ? "bg-primary/10 text-primary font-medium"
                    : "hover:bg-muted/50"
                    }`}
                style={{ paddingLeft: `${level * 16 + 8}px` }}
                onClick={() => onSelect(node.path)}
                onContextMenu={(e) => {
                    e.preventDefault();
                    onContextMenu?.(e, node.path);
                }}
            >
                {hasChildren ? (
                    <button
                        className="p-0.5 hover:bg-muted rounded"
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleExpand(node.path);
                        }}
                    >
                        {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                        )}
                    </button>
                ) : (
                    <span className="w-5" />
                )}
                {isExpanded ? (
                    <FolderOpen className="h-4 w-4 text-amber-500 flex-shrink-0" />
                ) : (
                    <Folder className="h-4 w-4 text-amber-500 flex-shrink-0" />
                )}
                <span className="truncate flex-1">{node.name}</span>
                {status && (
                    <span className="flex-shrink-0">
                        {getStatusIcon(status, "h-3.5 w-3.5")}
                    </span>
                )}
                {node.comparison?.limitedAccessExpected && (
                    <Lock className="h-3 w-3 text-amber-500 flex-shrink-0" />
                )}
            </div>
            {isExpanded &&
                node.children.map((child) => (
                    <AuditTreeNode
                        key={child.path}
                        node={child}
                        selectedPath={selectedPath}
                        expandedPaths={expandedPaths}
                        onSelect={onSelect}
                        onToggleExpand={onToggleExpand}
                        onContextMenu={onContextMenu}
                        level={level + 1}
                    />
                ))}
        </div>
    );
}

// ─── Summary Bar ────────────────────────────────────────────
function AuditSummaryBar({ comp }: { comp: PermissionComparison }) {
    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-blue-500" />
                <h3 className="font-semibold text-sm">Folder Summary</h3>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
                {getStatusBadge(comp.status)}
                {comp.limitedAccessExpected && (
                    <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                        <Lock className="h-3 w-3 mr-1" />
                        Limited Access
                    </Badge>
                )}
                <div className="flex gap-4 text-xs text-muted-foreground ml-auto">
                    <span>Expected: <strong className="text-foreground">{comp.expectedCount}</strong></span>
                    <span>Direct: <strong className="text-foreground">{comp.directActualCount}</strong></span>
                    <span>Inherited: <strong className="text-foreground">{comp.inheritedActualCount}</strong></span>
                    <span>Total: <strong className="text-foreground">{comp.totalActualCount}</strong></span>
                </div>
            </div>
        </div>
    );
}

// ─── Comparison Table (Unified Diff) ────────────────────────
interface DiffRow {
    type: "group" | "user";
    email: string;
    expectedRole: string | null;
    actualRole: string | null;
    inherited: boolean;
    diffStatus: "match" | "missing" | "extra" | "role_mismatch" | "mismatch" | "drive_member";
    tags?: string[];
}

// Access-based role ranking for UI fallback comparison
const CANONICAL_RANK_UI: Record<string, number> = {
    viewer: 0, commenter: 1, contributor: 2, contentManager: 3, manager: 4,
    reader: 0, writer: 2, fileOrganizer: 3, organizer: 4,
};
const canonicalRank = (role: string) => CANONICAL_RANK_UI[normalizeRole(role)] ?? 0;

function buildDiffRows(comp: PermissionComparison): DiffRow[] {
    // Prefer pre-computed API rows when available
    if (comp.comparisonRows && comp.comparisonRows.length > 0) {
        return comp.comparisonRows.map(r => ({
            type: r.type,
            email: r.identifier,
            expectedRole: r.expectedRole,  // Already a canonical label from API
            actualRole: r.actualRole,      // Already a canonical label from API
            inherited: r.inherited,
            diffStatus: r.status === 'mismatch' ? 'role_mismatch' : r.status,
            tags: r.tags,
        }));
    }

    // Fallback: client-side derivation (backward compat)
    const rows: DiffRow[] = [];
    const actualMap = new Map<
        string,
        { role: string; type: string; inherited?: boolean; classification?: string }
    >();

    for (const p of comp.actualPermissions) {
        if (p.email) {
            actualMap.set(p.email.toLowerCase(), p);
        }
    }

    for (const g of comp.expectedGroups) {
        const emailLower = g.email.toLowerCase();
        const actual = actualMap.get(emailLower);
        if (actual) {
            const isMatch = canonicalRank(actual.role) <= canonicalRank(g.role);
            const tags: string[] = [];
            if (isMatch && canonicalRank(actual.role) < canonicalRank(g.role)) {
                tags.push('More restrictive');
            }
            rows.push({
                type: "group", email: g.email,
                expectedRole: g.role, actualRole: actual.role,
                inherited: !!actual.inherited,
                diffStatus: isMatch ? "match" : "role_mismatch",
                tags,
            });
            actualMap.delete(emailLower);
        } else {
            rows.push({
                type: "group", email: g.email,
                expectedRole: g.role, actualRole: null,
                inherited: false, diffStatus: "missing",
            });
        }
    }

    for (const u of comp.expectedUsers) {
        const emailLower = u.email.toLowerCase();
        const actual = actualMap.get(emailLower);
        if (actual) {
            const isMatch = canonicalRank(actual.role) <= canonicalRank(u.role);
            const tags: string[] = [];
            if (isMatch && canonicalRank(actual.role) < canonicalRank(u.role)) {
                tags.push('More restrictive');
            }
            rows.push({
                type: "user", email: u.email,
                expectedRole: u.role, actualRole: actual.role,
                inherited: !!actual.inherited,
                diffStatus: isMatch ? "match" : "role_mismatch",
                tags,
            });
            actualMap.delete(emailLower);
        } else {
            rows.push({
                type: "user", email: u.email,
                expectedRole: u.role, actualRole: null,
                inherited: false, diffStatus: "missing",
            });
        }
    }

    for (const [emailKey, perm] of actualMap) {
        const isDriveMember = perm.classification === 'NON_REMOVABLE_DRIVE_MEMBERSHIP';
        rows.push({
            type: perm.type === "group" ? "group" : "user",
            email: emailKey, expectedRole: null, actualRole: perm.role,
            inherited: !!perm.inherited,
            diffStatus: isDriveMember ? "drive_member" : "extra",
        });
    }

    const order = { missing: 0, role_mismatch: 1, extra: 2, match: 3, drive_member: 4 };
    rows.sort((a, b) => (order[a.diffStatus as keyof typeof order] ?? 5) - (order[b.diffStatus as keyof typeof order] ?? 5));

    return rows;
}

function AuditComparisonTable({ comp }: { comp: PermissionComparison }) {
    const rows = buildDiffRows(comp);

    const getRowTint = (status: string) => {
        switch (status) {
            case "missing":
                return "bg-red-500/5";
            case "extra":
                return "bg-yellow-500/5";
            case "role_mismatch":
                return "bg-orange-500/5";
            case "drive_member":
                return "bg-slate-500/5 opacity-60";
            default:
                return "";
        }
    };

    const getDiffBadge = (row: DiffRow) => {
        const status = row.diffStatus;
        const tags = row.tags || [];
        switch (status) {
            case "match":
                return (
                    <span className="flex items-center gap-1">
                        <Badge
                            variant="outline"
                            className="text-xs bg-green-500/10 text-green-600 border-green-500/30"
                        >
                            ✓ Match
                        </Badge>
                        {tags.includes('More restrictive') && (
                            <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-500 border-blue-500/20">
                                ↓ More restrictive
                            </Badge>
                        )}
                    </span>
                );
            case "missing":
                return (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Badge className="text-xs bg-red-500/10 text-red-600 border-red-500/30">
                                    ✗ Missing
                                </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                                Expected in template but not found in Google Drive
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                );
            case "extra":
                return (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Badge className="text-xs bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                                    ⚠ Extra
                                </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                                Found in Google Drive but not defined in template
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                );
            case "role_mismatch":
            case "mismatch":
                return (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Badge className="text-xs bg-orange-500/10 text-orange-600 border-orange-500/30">
                                    ↑ Over-Privileged
                                </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                                Actual role has higher privilege than expected
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                );
            case "drive_member":
                return (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Badge variant="outline" className="text-xs bg-slate-500/10 text-slate-400 border-slate-500/20">
                                    🔒 Drive Member
                                </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                                Shared Drive membership — cannot be removed at folder level
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                );
            default:
                return null;
        }
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-green-500" />
                <h3 className="font-semibold text-sm">Comparison Table</h3>
                <Badge variant="secondary" className="text-xs">
                    Expected vs Actual
                </Badge>
            </div>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[60px]">Type</TableHead>
                        <TableHead>Identifier</TableHead>
                        <TableHead className="w-[110px]">Expected</TableHead>
                        <TableHead className="w-[110px]">Actual</TableHead>
                        <TableHead className="w-[120px]">Status</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((row, i) => (
                        <TableRow key={`${row.email}-${i}`} className={getRowTint(row.diffStatus)}>
                            <TableCell>
                                <Badge variant="outline" className="text-xs">
                                    {row.type === "group" ? (
                                        <><Users className="h-3 w-3 mr-1" />Grp</>
                                    ) : (
                                        <><User className="h-3 w-3 mr-1" />Usr</>
                                    )}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-xs font-mono truncate max-w-[200px]">
                                {row.email}
                                {row.inherited && (
                                    <Badge variant="secondary" className="text-[10px] ml-1.5">
                                        inherited
                                    </Badge>
                                )}
                            </TableCell>
                            <TableCell>
                                {row.expectedRole ? (
                                    <Badge variant="outline" className="text-xs">
                                        {getRoleLabel(row.expectedRole)}
                                    </Badge>
                                ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                )}
                            </TableCell>
                            <TableCell>
                                {row.actualRole ? (
                                    <Badge variant="outline" className="text-xs">
                                        {getRoleLabel(row.actualRole)}
                                    </Badge>
                                ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                )}
                            </TableCell>
                            <TableCell>{getDiffBadge(row)}</TableCell>
                        </TableRow>
                    ))}
                    {rows.length === 0 && (
                        <TableRow>
                            <TableCell
                                colSpan={5}
                                className="text-center text-muted-foreground text-sm py-6"
                            >
                                No permissions defined for this folder
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}

// ─── Discrepancy List ───────────────────────────────────────
function AuditDiscrepancyList({ comp }: { comp: PermissionComparison }) {
    if (comp.discrepancies.length === 0) return null;

    const missing = comp.discrepancies.filter((d) => d.startsWith("Missing"));
    const extra = comp.discrepancies.filter(
        (d) => d.startsWith("Extra") || d.startsWith("Unexpected")
    );
    const roleMismatch = comp.discrepancies.filter(
        (d) => d.includes("mismatch") || d.includes("Mismatch")
    );
    const other = comp.discrepancies.filter(
        (d) =>
            !d.startsWith("Missing") &&
            !d.startsWith("Extra") &&
            !d.startsWith("Unexpected") &&
            !d.includes("mismatch") &&
            !d.includes("Mismatch")
    );

    const renderGroup = (
        title: string,
        items: string[],
        icon: React.ReactNode,
        colorClass: string
    ) => {
        if (items.length === 0) return null;
        return (
            <div>
                <h4 className={`text-xs font-semibold mb-1 flex items-center gap-1.5 ${colorClass}`}>
                    {icon}
                    {title} ({items.length})
                </h4>
                <ul className="space-y-0.5 ml-5">
                    {items.map((d, i) => (
                        <li key={i} className="text-xs text-muted-foreground list-disc">
                            {d}
                        </li>
                    ))}
                </ul>
            </div>
        );
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <h3 className="font-semibold text-sm">Discrepancies</h3>
                <Badge variant="outline" className="text-xs">
                    {comp.discrepancies.length} issues
                </Badge>
            </div>
            <div className="space-y-3 p-3 rounded-lg border bg-muted/20">
                {renderGroup(
                    "Missing",
                    missing,
                    <XCircle className="h-3.5 w-3.5" />,
                    "text-red-600"
                )}
                {renderGroup(
                    "Extra Access",
                    extra,
                    <AlertTriangle className="h-3.5 w-3.5" />,
                    "text-yellow-600"
                )}
                {renderGroup(
                    "Role Mismatches",
                    roleMismatch,
                    <AlertCircle className="h-3.5 w-3.5" />,
                    "text-orange-600"
                )}
                {renderGroup(
                    "Other",
                    other,
                    <Info className="h-3.5 w-3.5" />,
                    "text-muted-foreground"
                )}
            </div>
        </div>
    );
}

// ─── Stats Row ──────────────────────────────────────────────
function StatsRow({ result }: { result: AuditResult }) {
    const stats = [
        {
            label: "Match",
            value: result.matchCount,
            icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
            bg: "bg-green-100 dark:bg-green-900",
        },
        {
            label: "Extra",
            value: result.extraCount,
            icon: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
            bg: "bg-yellow-100 dark:bg-yellow-900",
        },
        {
            label: "Missing",
            value: result.missingCount,
            icon: <XCircle className="h-5 w-5 text-red-500" />,
            bg: "bg-red-100 dark:bg-red-900",
        },
        {
            label: "Mismatch",
            value: result.mismatchCount,
            icon: <AlertCircle className="h-5 w-5 text-orange-500" />,
            bg: "bg-orange-100 dark:bg-orange-900",
        },
    ];

    return (
        <div className="grid grid-cols-4 gap-4">
            {stats.map((s) => (
                <Card key={s.label}>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-full ${s.bg}`}>{s.icon}</div>
                            <div>
                                <p className="text-2xl font-bold">{s.value}</p>
                                <p className="text-sm text-muted-foreground">{s.label}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

// ─── Main Page ──────────────────────────────────────────────
export default function PermissionAuditPage() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string>("");
    const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [enforcing, setEnforcing] = useState(false);

    // Tree state
    const [selectedPath, setSelectedPath] = useState<string | null>(null);
    const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
    const [filter, setFilter] = useState<"all" | "issues">("all");

    // Restore cached audit results on mount
    useEffect(() => {
        try {
            const cached = sessionStorage.getItem('rfp_audit_cache');
            if (cached) {
                const { projectId, result } = JSON.parse(cached);
                if (projectId && result) {
                    setSelectedProjectId(projectId);
                    setAuditResult(result);
                    if (result.comparisons?.length > 0) {
                        const tree = buildFolderTree(result.comparisons, result.phaseLabel);
                        const allPaths = new Set<string>();
                        // Auto-expand phase root and top-level folders
                        function collectPaths(nodes: TreeNode[]) {
                            for (const n of nodes) {
                                allPaths.add(n.path);
                                if (n.children.length > 0) collectPaths(n.children);
                            }
                        }
                        collectPaths(tree);
                        setExpandedPaths(allPaths);
                        setSelectedPath(result.comparisons[0].normalizedPath);
                    }
                }
            }
        } catch {
            // Ignore parse errors
        }
    }, []);

    // Context menu state
    const [contextMenu, setContextMenu] = useState<{
        folderPath: string;
        x: number;
        y: number;
    } | null>(null);

    // Fetch projects
    useEffect(() => {
        const fetchProjects = async () => {
            try {
                const res = await fetch("/api/projects");
                const data = await res.json();
                if (data.success) setProjects(data.projects || []);
            } catch (error) {
                console.error("Error fetching projects:", error);
            }
        };
        fetchProjects();
    }, []);

    // Run audit
    const runAudit = useCallback(async () => {
        if (!selectedProjectId) return;
        setLoading(true);
        setAuditResult(null);
        setSelectedPath(null);
        try {
            const res = await fetch(
                `/api/audit/permissions?projectId=${selectedProjectId}`
            );
            const data = await res.json();
            if (data.success) {
                setAuditResult(data.result);
                // Cache results in sessionStorage for persistence across navigation
                try {
                    sessionStorage.setItem('rfp_audit_cache', JSON.stringify({
                        projectId: selectedProjectId,
                        result: data.result
                    }));
                } catch { /* quota exceeded — ignore */ }
                // Auto-expand and select first
                if (data.result.comparisons.length > 0) {
                    const tree = buildFolderTree(data.result.comparisons, data.result.phaseLabel);
                    const allPaths = new Set<string>();
                    function collectPaths(nodes: TreeNode[]) {
                        for (const n of nodes) {
                            allPaths.add(n.path);
                            if (n.children.length > 0) collectPaths(n.children);
                        }
                    }
                    collectPaths(tree);
                    setExpandedPaths(allPaths);
                    setSelectedPath(data.result.comparisons[0].normalizedPath);
                }
                toast.success(
                    `Audit complete: ${data.result.totalFolders} folders analyzed`
                );
            } else {
                toast.error("Audit failed: " + (data.error || "Unknown error"));
            }
        } catch (error) {
            console.error("Error running audit:", error);
            toast.error("Error running audit");
        } finally {
            setLoading(false);
        }
    }, [selectedProjectId]);

    // Enforce THIS project only (FIX: was sending { all: true })
    const enforceProject = useCallback(async () => {
        if (!selectedProjectId) return;
        setEnforcing(true);
        try {
            const res = await fetch("/api/jobs/enforce-permissions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ projectId: selectedProjectId }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Enforcement job started for selected project");
                window.location.href = "/jobs";
            } else {
                toast.error("Failed: " + (data.error || "Unknown error"));
            }
        } catch (error) {
            console.error("Error enforcing:", error);
            toast.error("Error starting enforcement job");
        } finally {
            setEnforcing(false);
        }
    }, [selectedProjectId]);

    // Enforce ALL projects
    const enforceAllProjects = useCallback(async () => {
        const confirmed = confirm(
            "Enforce permissions for ALL projects? This will create a job for each project."
        );
        if (!confirmed) return;
        setEnforcing(true);
        try {
            const res = await fetch("/api/jobs/enforce-permissions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}), // No projectId = all
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Enforcement jobs started for all projects");
                window.location.href = "/jobs";
            } else {
                toast.error("Failed: " + (data.error || "Unknown error"));
            }
        } catch (error) {
            console.error("Error enforcing all:", error);
            toast.error("Error starting enforcement jobs");
        } finally {
            setEnforcing(false);
        }
    }, []);

    // Enforce single folder
    const enforceSingleFolder = useCallback(async (folderPath: string) => {
        if (!selectedProjectId) return;
        setEnforcing(true);
        try {
            const res = await fetch('/api/jobs/enforce-permissions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: selectedProjectId,
                    metadata: { scope: 'single', targetPath: folderPath }
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`Enforcing: ${folderPath.split('/').pop()}`);
                window.location.href = '/jobs';
            } else {
                toast.error('Failed: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            toast.error('Error starting enforcement job');
        } finally {
            setEnforcing(false);
        }
    }, [selectedProjectId]);

    // Enforce folder + children
    const enforceFolderBranch = useCallback(async (folderPath: string) => {
        if (!selectedProjectId) return;
        setEnforcing(true);
        try {
            const res = await fetch('/api/jobs/enforce-permissions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: selectedProjectId,
                    metadata: { scope: 'branch', targetPath: folderPath }
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`Enforcing: ${folderPath.split('/').pop()} + children`);
                window.location.href = '/jobs';
            } else {
                toast.error('Failed: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            toast.error('Error starting enforcement');
        } finally {
            setEnforcing(false);
        }
    }, [selectedProjectId]);

    // Export
    const exportAudit = async (format: "csv" | "json") => {
        if (!selectedProjectId) return;
        try {
            const res = await fetch(
                `/api/audit/export?projectId=${selectedProjectId}&format=${format}`
            );
            if (format === "json") {
                const data = await res.json();
                const blob = new Blob([JSON.stringify(data, null, 2)], {
                    type: "application/json",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `audit_${auditResult?.projectCode}_${new Date().toISOString().split("T")[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
            } else {
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `audit_${auditResult?.projectCode}_${new Date().toISOString().split("T")[0]}.csv`;
                a.click();
                URL.revokeObjectURL(url);
            }
            toast.success(`Exported as ${format.toUpperCase()}`);
        } catch (error) {
            console.error("Export failed:", error);
            toast.error("Export failed");
        }
    };

    const handleToggleExpand = useCallback((path: string) => {
        setExpandedPaths((prev) => {
            const next = new Set(prev);
            if (next.has(path)) next.delete(path);
            else next.add(path);
            return next;
        });
    }, []);

    // Build tree + filter
    const tree = auditResult ? buildFolderTree(auditResult.comparisons, auditResult.phaseLabel) : [];
    const selectedComp = auditResult?.comparisons.find(
        (c) => c.normalizedPath === selectedPath
    );

    // Filter comparisons for tree
    const filteredComparisons =
        filter === "issues"
            ? auditResult?.comparisons.filter((c) => c.status !== "exact_match") || []
            : auditResult?.comparisons || [];
    const filteredTree = buildFolderTree(filteredComparisons, auditResult?.phaseLabel);

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        Permission Audit
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        Compare template permissions with actual Google Drive permissions
                    </p>
                </div>
                {auditResult && (
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => exportAudit("csv")}
                        >
                            <Download className="h-4 w-4 mr-1" />
                            CSV
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => exportAudit("json")}
                        >
                            <Download className="h-4 w-4 mr-1" />
                            JSON
                        </Button>
                    </div>
                )}
            </div>

            {/* Project Selector + Run Audit */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                        <div className="flex-1">
                            <Select
                                value={selectedProjectId}
                                onValueChange={setSelectedProjectId}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a project to audit" />
                                </SelectTrigger>
                                <SelectContent>
                                    {projects.map((p) => (
                                        <SelectItem key={p.id} value={p.id}>
                                            {p.pr_number} — {p.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button
                            onClick={runAudit}
                            disabled={!selectedProjectId || loading}
                        >
                            {loading ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <RefreshCw className="h-4 w-4 mr-2" />
                            )}
                            Run Audit
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Stats Row */}
            {auditResult && <StatsRow result={auditResult} />}

            {/* Master-Detail Layout */}
            {auditResult && (
                <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
                    {/* LEFT: Folder Tree */}
                    <Card className="h-[calc(100vh-420px)] flex flex-col">
                        <CardHeader className="py-3 px-4 flex-shrink-0">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm">
                                    Folders ({filteredComparisons.length})
                                </CardTitle>
                                <div className="flex gap-1">
                                    <Button
                                        variant={filter === "all" ? "default" : "ghost"}
                                        size="sm"
                                        className="h-6 text-xs px-2"
                                        onClick={() => setFilter("all")}
                                    >
                                        All
                                    </Button>
                                    <Button
                                        variant={filter === "issues" ? "default" : "ghost"}
                                        size="sm"
                                        className="h-6 text-xs px-2"
                                        onClick={() => setFilter("issues")}
                                    >
                                        Issues
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-hidden px-2 pb-2">
                            <ScrollArea className="h-full">
                                {filteredTree.map((node) => (
                                    <AuditTreeNode
                                        key={node.path}
                                        node={node}
                                        selectedPath={selectedPath}
                                        expandedPaths={expandedPaths}
                                        onSelect={setSelectedPath}
                                        onToggleExpand={handleToggleExpand}
                                        onContextMenu={(e, path) => {
                                            e.preventDefault();
                                            setContextMenu({
                                                folderPath: path,
                                                x: e.clientX,
                                                y: e.clientY
                                            });
                                        }}
                                    />
                                ))}
                                {filteredTree.length === 0 && (
                                    <div className="text-center py-8 text-sm text-muted-foreground">
                                        {filter === "issues"
                                            ? "No issues found! All permissions match."
                                            : "No folders to display."}
                                    </div>
                                )}
                            </ScrollArea>
                        </CardContent>
                    </Card>

                    {/* RIGHT: Details Panel */}
                    <div className="h-[calc(100vh-420px)] overflow-hidden">
                        {selectedComp ? (
                            <Card className="h-full flex flex-col">
                                <CardHeader className="py-3 px-4 flex-shrink-0 border-b">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle className="text-lg flex items-center gap-2">
                                                <Folder className="h-5 w-5 text-amber-500" />
                                                {selectedComp.normalizedPath
                                                    .split("/")
                                                    .pop()}
                                            </CardTitle>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {selectedComp.normalizedPath}
                                            </p>
                                        </div>
                                        {getStatusBadge(selectedComp.status)}
                                    </div>
                                </CardHeader>
                                <CardContent className="flex-1 overflow-auto px-4 py-3">
                                    <ScrollArea className="h-full">
                                        <div className="space-y-6 pr-2">
                                            <AuditSummaryBar comp={selectedComp} />
                                            <div className="border-t" />
                                            <AuditComparisonTable comp={selectedComp} />
                                            <div className="border-t" />
                                            <AuditDiscrepancyList comp={selectedComp} />
                                        </div>
                                    </ScrollArea>
                                </CardContent>
                            </Card>
                        ) : (
                            <Card className="h-full flex items-center justify-center">
                                <div className="text-center text-muted-foreground">
                                    <Folder className="h-12 w-12 mx-auto mb-3 opacity-30" />
                                    <p className="font-medium">Select a folder</p>
                                    <p className="text-sm">
                                        Click a folder in the tree to view its audit details
                                    </p>
                                </div>
                            </Card>
                        )}
                    </div>
                </div>
            )}

            {/* Enforcement Footer */}
            {auditResult && (
                <Card>
                    <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">
                                Enforce template permissions on Google Drive
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    onClick={enforceProject}
                                    disabled={!selectedProjectId || enforcing}
                                    className="bg-blue-600 hover:bg-blue-700"
                                >
                                    {enforcing ? (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                        <Shield className="h-4 w-4 mr-2" />
                                    )}
                                    Enforce This Project
                                </Button>
                                <Button
                                    onClick={enforceAllProjects}
                                    disabled={enforcing}
                                    variant="destructive"
                                >
                                    {enforcing ? (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                        <Shield className="h-4 w-4 mr-2" />
                                    )}
                                    Enforce All Projects
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Context Menu */}
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onClose={() => setContextMenu(null)}
                    options={[
                        {
                            label: "Enforce This Folder Only",
                            icon: Shield,
                            onClick: () => enforceSingleFolder(contextMenu.folderPath)
                        },
                        {
                            label: "Enforce Folder + Children",
                            icon: FolderOpen,
                            onClick: () => enforceFolderBranch(contextMenu.folderPath)
                        }
                    ]}
                />
            )}
        </div>
    );
}
