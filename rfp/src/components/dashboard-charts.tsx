"use client"

import * as React from "react"
import { Cell, Label, Pie, PieChart } from "recharts"

import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    ChartLegend,
    ChartLegendContent
} from "@/components/ui/chart"

// ─── Project Distribution Chart ─────────────────────────────

const projectChartConfig = {
    count: {
        label: "Projects",
    },
    bidding: {
        label: "Bidding",
        color: "hsl(var(--chart-1))",
    },
    execution: {
        label: "Execution",
        color: "hsl(var(--chart-2))",
    },
} satisfies ChartConfig

export function ProjectDistributionChart({
    biddingCount,
    executionCount
}: {
    biddingCount: number,
    executionCount: number
}) {
    const chartData = React.useMemo(() => [
        { phase: "bidding", count: biddingCount, fill: "var(--color-bidding)" },
        { phase: "execution", count: executionCount, fill: "var(--color-execution)" },
    ], [biddingCount, executionCount])

    const totalProjects = React.useMemo(() => {
        return chartData.reduce((acc, curr) => acc + curr.count, 0)
    }, [chartData])

    return (
        <Card className="flex flex-col">
            <CardHeader className="items-center pb-0">
                <CardTitle>Project Distribution</CardTitle>
                <CardDescription>Bidding vs Execution Phase</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 pb-0">
                <ChartContainer
                    config={projectChartConfig}
                    className="mx-auto aspect-square max-h-[250px]"
                >
                    <PieChart>
                        <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent hideLabel />}
                        />
                        <Pie
                            data={chartData}
                            dataKey="count"
                            nameKey="phase"
                            innerRadius={60}
                            strokeWidth={5}
                        >
                            <Label
                                content={({ viewBox }) => {
                                    if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                                        return (
                                            <text
                                                x={viewBox.cx}
                                                y={viewBox.cy}
                                                textAnchor="middle"
                                                dominantBaseline="middle"
                                            >
                                                <tspan
                                                    x={viewBox.cx}
                                                    y={viewBox.cy}
                                                    className="fill-foreground text-3xl font-bold"
                                                >
                                                    {totalProjects.toLocaleString()}
                                                </tspan>
                                                <tspan
                                                    x={viewBox.cx}
                                                    y={(viewBox.cy || 0) + 24}
                                                    className="fill-muted-foreground text-xs"
                                                >
                                                    Projects
                                                </tspan>
                                            </text>
                                        )
                                    }
                                }}
                            />
                        </Pie>
                        <ChartLegend content={<ChartLegendContent />} className="-translate-y-2 flex-wrap gap-2 [&>*]:basis-1/4 [&>*]:justify-center" />
                    </PieChart>
                </ChartContainer>
            </CardContent>
        </Card>
    )
}

// ─── Compliance Chart ───────────────────────────────────────

const complianceChartConfig = {
    value: {
        label: "Folders",
    },
    compliant: {
        label: "Compliant",
        color: "hsl(var(--chart-2))", // Greenish/Teal usually
    },
    non_compliant: {
        label: "Non-Compliant",
        color: "hsl(var(--destructive))",
    },
} satisfies ChartConfig

export function ComplianceChart({
    compliantCount,
    violationCount
}: {
    compliantCount: number,
    violationCount: number
}) {
    const chartData = React.useMemo(() => [
        { status: "compliant", value: compliantCount, fill: "var(--color-compliant)" },
        { status: "non_compliant", value: violationCount, fill: "var(--color-non_compliant)" },
    ], [compliantCount, violationCount])

    const total = React.useMemo(() => {
        return chartData.reduce((acc, curr) => acc + curr.value, 0)
    }, [chartData])

    const complianceRate = total > 0 ? Math.round((compliantCount / total) * 100) : 0

    return (
        <Card className="flex flex-col">
            <CardHeader className="items-center pb-0">
                <CardTitle>Compliance Overview</CardTitle>
                <CardDescription>Permission Compliance Rate</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 pb-0">
                <ChartContainer
                    config={complianceChartConfig}
                    className="mx-auto aspect-square max-h-[250px]"
                >
                    <PieChart>
                        <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent hideLabel />}
                        />
                        <Pie
                            data={chartData}
                            dataKey="value"
                            nameKey="status"
                            innerRadius={60}
                            strokeWidth={5}
                        >
                            <Label
                                content={({ viewBox }) => {
                                    if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                                        return (
                                            <text
                                                x={viewBox.cx}
                                                y={viewBox.cy}
                                                textAnchor="middle"
                                                dominantBaseline="middle"
                                            >
                                                <tspan
                                                    x={viewBox.cx}
                                                    y={viewBox.cy}
                                                    className="fill-foreground text-3xl font-bold"
                                                >
                                                    {complianceRate}%
                                                </tspan>
                                                <tspan
                                                    x={viewBox.cx}
                                                    y={(viewBox.cy || 0) + 24}
                                                    className="fill-muted-foreground text-xs"
                                                >
                                                    Compliant
                                                </tspan>
                                            </text>
                                        )
                                    }
                                }}
                            />
                        </Pie>
                        <ChartLegend content={<ChartLegendContent />} className="-translate-y-2 flex-wrap gap-2 [&>*]:basis-1/4 [&>*]:justify-center" />
                    </PieChart>
                </ChartContainer>
            </CardContent>
        </Card>
    )
}
