"use client"

import React, { useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { useThemeConfig } from "@/components/theme-provider"
import { useTheme } from "next-themes"

// UI Components
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

// Icons
import {
    Palette, ArrowLeft, Moon, Sun, Check, RotateCcw, Type, Circle
} from "lucide-react"

// Theme options
const MODES = [
    { value: "dark", label: "Dark", icon: Moon },
    { value: "light", label: "Light", icon: Sun },
]

const BASE_COLORS = [
    { value: "gray", label: "Gray", color: "oklch(0.55 0.02 265)" },
    { value: "theme-gray", label: "Theme Gray", color: "oklch(0.45 0.025 265)" },
    { value: "zinc", label: "Zinc", color: "oklch(0.55 0.01 286)" },
    { value: "slate", label: "Slate", color: "oklch(0.55 0.03 265)" },
    { value: "neutral", label: "Neutral", color: "oklch(0.55 0 0)" },
    { value: "stone", label: "Stone", color: "oklch(0.55 0.015 56)" },
]

const ACCENT_COLORS = [
    { value: "gray", label: "Gray", color: "oklch(0.55 0 0)", description: "Match base color" },
    { value: "amber", label: "Amber", color: "oklch(0.77 0.16 70)" },
    { value: "blue", label: "Blue", color: "oklch(0.62 0.21 260)" },
    { value: "cyan", label: "Cyan", color: "oklch(0.72 0.16 200)" },
    { value: "emerald", label: "Emerald", color: "oklch(0.70 0.19 160)" },
    { value: "fuchsia", label: "Fuchsia", color: "oklch(0.68 0.25 320)" },
    { value: "green", label: "Green", color: "oklch(0.72 0.22 150)" },
    { value: "indigo", label: "Indigo", color: "oklch(0.59 0.23 277)" },
    { value: "lime", label: "Lime", color: "oklch(0.80 0.22 130)" },
    { value: "orange", label: "Orange", color: "oklch(0.71 0.21 47)" },
    { value: "pink", label: "Pink", color: "oklch(0.70 0.20 350)" },
    { value: "red", label: "Red", color: "oklch(0.64 0.24 25)" },
    { value: "rose", label: "Rose", color: "oklch(0.65 0.25 16)" },
    { value: "violet", label: "Violet", color: "oklch(0.61 0.25 293)" },
]

const ICON_MODES = [
    { value: "semantic", label: "Semantic", description: "Muted icons with accent highlights" },
    { value: "muted", label: "Muted", description: "All icons are subtle" },
    { value: "primary", label: "Primary", description: "Icons use accent color" },
]

const RADII = [
    { value: "0", label: "None", preview: "0" },
    { value: "0.3rem", label: "Small", preview: "4.8px" },
    { value: "0.5rem", label: "Medium", preview: "8px" },
    { value: "0.625rem", label: "Default", preview: "10px" },
    { value: "0.75rem", label: "Large", preview: "12px" },
    { value: "1rem", label: "XL", preview: "16px" },
]

const FONTS = [
    { value: "inter", label: "Inter", sample: "Designers love packing quirky glyphs" },
    { value: "noto-sans", label: "Noto Sans", sample: "Designers love packing quirky glyphs" },
    { value: "nunito-sans", label: "Nunito Sans", sample: "Designers love packing quirky glyphs" },
    { value: "figtree", label: "Figtree", sample: "Designers love packing quirky glyphs" },
    { value: "roboto", label: "Roboto", sample: "Designers love packing quirky glyphs" },
    { value: "raleway", label: "Raleway", sample: "Designers love packing quirky glyphs" },
    { value: "dm-sans", label: "DM Sans", sample: "Designers love packing quirky glyphs" },
    { value: "public-sans", label: "Public Sans", sample: "Designers love packing quirky glyphs" },
    { value: "outfit", label: "Outfit", sample: "Designers love packing quirky glyphs" },
    { value: "jetbrains-mono", label: "JetBrains Mono", sample: "const code = true;" },
    { value: "tajawal", label: "Tajawal", sample: "المصممون يحبون الخطوط العربية" },
    { value: "cairo", label: "Cairo", sample: "المصممون يحبون الخطوط العربية" },
]

export default function ThemeSettingsPage() {
    const { config, updateConfig, setConfig } = useThemeConfig()
    const { theme, setTheme } = useTheme()

    // We use next-themes for mode, and our config for everything else
    const mode = theme || 'system'

    const handleReset = () => {
        setConfig({
            base: 'gray',
            accent: 'amber',
            radius: '0.625rem',
            font: 'inter',
            icon_mode: 'semantic'
        })
        setTheme('dark')
    }

    return (
        <div className="max-w-4xl mx-auto p-4 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between pb-6 border-b">
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Palette className="h-6 w-6 text-primary" />
                        Theme Settings
                    </h1>
                    <p className="text-muted-foreground">
                        Customize the look and feel of your workspace
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleReset}>
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Reset Defaults
                    </Button>
                </div>
            </div>

            <div className="grid gap-6">
                {/* Visual Preview */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card className="bg-background border-2 border-primary/20">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Preview Card</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                <div className="h-2 w-2/3 bg-muted rounded animate-pulse" />
                                <div className="h-2 w-full bg-muted rounded animate-pulse" />
                                <Button size="sm" className="w-full mt-2">Primary Action</Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Mode */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Appearance Mode</CardTitle>
                        <CardDescription>Select your preferred color scheme</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex gap-4">
                            {MODES.map((m) => (
                                <button
                                    key={m.value}
                                    onClick={() => setTheme(m.value)}
                                    className={cn(
                                        "flex-1 flex items-center justify-center gap-2 p-4 rounded-lg border-2 transition-all",
                                        mode === m.value
                                            ? "border-primary bg-primary/10 text-primary"
                                            : "border-muted hover:border-muted-foreground/50"
                                    )}
                                >
                                    <m.icon className="w-5 h-5" />
                                    <span className="font-medium">{m.label}</span>
                                </button>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Base Color */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Base Color</CardTitle>
                        <CardDescription>Neutral tone for backgrounds and interfaces</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                            {BASE_COLORS.map((base) => (
                                <button
                                    key={base.value}
                                    onClick={() => updateConfig('base', base.value)}
                                    className={cn(
                                        "flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all",
                                        config.base === base.value
                                            ? "border-primary bg-accent"
                                            : "border-transparent hover:bg-muted"
                                    )}
                                >
                                    <div
                                        className="w-8 h-8 rounded-full border shadow-sm"
                                        style={{ background: base.color }}
                                    />
                                    <span className="text-xs font-medium">{base.label}</span>
                                </button>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Accent Color */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Accent Color</CardTitle>
                        <CardDescription>Primary color for buttons, links, and highlights</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-4 sm:grid-cols-7 gap-3">
                            {ACCENT_COLORS.map((accent) => (
                                <button
                                    key={accent.value}
                                    onClick={() => updateConfig('accent', accent.value)}
                                    className={cn(
                                        "flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all",
                                        config.accent === accent.value
                                            ? "border-primary bg-primary/10"
                                            : "border-transparent hover:bg-muted"
                                    )}
                                >
                                    <div
                                        className="w-8 h-8 rounded-full shadow-sm"
                                        style={{ background: accent.color }}
                                    />
                                    <span className="text-xs font-medium">{accent.label}</span>
                                </button>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <div className="grid gap-6 md:grid-cols-2">
                    {/* Radius */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Radius</CardTitle>
                            <CardDescription>Corner roundness for cards and buttons</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-3 gap-2">
                                {RADII.map((r) => (
                                    <button
                                        key={r.value}
                                        onClick={() => updateConfig('radius', r.value)}
                                        className={cn(
                                            "flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all",
                                            config.radius === r.value
                                                ? "border-primary bg-primary/5"
                                                : "border-border hover:bg-muted"
                                        )}
                                    >
                                        <div
                                            className="w-8 h-8 border-2 border-primary mb-2"
                                            style={{ borderRadius: r.value }}
                                        />
                                        <span className="text-xs">{r.label}</span>
                                    </button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Icon Mode */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Icon Style</CardTitle>
                            <CardDescription>How icons appear in the interface</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {ICON_MODES.map((mode) => (
                                    <button
                                        key={mode.value}
                                        onClick={() => updateConfig('icon_mode', mode.value)}
                                        className={cn(
                                            "w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left",
                                            config.icon_mode === mode.value
                                                ? "border-primary bg-primary/5"
                                                : "border-border hover:bg-muted"
                                        )}
                                    >
                                        <Circle className={cn(
                                            "w-4 h-4",
                                            mode.value === 'primary' && "text-primary fill-primary",
                                            mode.value === 'muted' && "text-muted-foreground",
                                            mode.value === 'semantic' && config.icon_mode === mode.value && "text-primary"
                                        )} />
                                        <div>
                                            <div className="text-sm font-medium">{mode.label}</div>
                                            <div className="text-[10px] text-muted-foreground">{mode.description}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Font */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Typography</CardTitle>
                        <CardDescription>Select the font family for the application</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {FONTS.map((font) => (
                                <button
                                    key={font.value}
                                    onClick={() => updateConfig('font', font.value)}
                                    className={cn(
                                        "flex flex-col items-start p-4 rounded-lg border-2 transition-all text-left",
                                        config.font === font.value
                                            ? "border-primary bg-primary/5"
                                            : "border-border hover:bg-muted"
                                    )}
                                >
                                    <span className="text-xs font-medium text-muted-foreground uppercase mb-2">{font.label}</span>
                                    <span style={{
                                        fontFamily: font.value === 'inter' ? 'Inter' : font.value
                                    }} className="text-lg">
                                        {font.sample}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
