"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider, useTheme as useNextTheme } from "next-themes"
import { type ThemeProviderProps as NextValues } from "next-themes"

// Define Theme State Interface
interface ThemeConfig {
    base: string
    accent: string
    radius: string
    font: string
    icon_mode: string
}

const DEFAULT_CONFIG: ThemeConfig = {
    base: 'gray',
    accent: 'amber',
    radius: '0.625rem',
    font: 'inter',
    icon_mode: 'semantic'
}

// Create Context
const ThemeConfigContext = React.createContext<{
    config: ThemeConfig
    setConfig: (config: ThemeConfig) => void
    updateConfig: (key: keyof ThemeConfig, value: string) => void
}>({
    config: DEFAULT_CONFIG,
    setConfig: () => { },
    updateConfig: () => { }
})

export function ThemeProvider({ children, ...props }: NextValues) {
    const [config, setConfigState] = React.useState<ThemeConfig>(DEFAULT_CONFIG)
    const [mounted, setMounted] = React.useState(false)

    // Load from LocalStorage on mount
    React.useEffect(() => {
        setMounted(true)
        try {
            const saved = localStorage.getItem('lyra-theme-config')
            if (saved) {
                setConfigState({ ...DEFAULT_CONFIG, ...JSON.parse(saved) })
            }
        } catch (e) {
            console.error("Failed to load theme config", e)
        }
    }, [])

    // Save to LocalStorage and Apply Attributes when config changes
    React.useEffect(() => {
        if (!mounted) return

        try {
            localStorage.setItem('lyra-theme-config', JSON.stringify(config))

            // Apply Data Attributes to HTML element
            const root = document.documentElement
            root.setAttribute('data-base', config.base)
            root.setAttribute('data-accent', config.accent)
            root.setAttribute('data-radius', config.radius)
            root.setAttribute('data-font', config.font)
            root.setAttribute('data-icon-mode', config.icon_mode)

            // Set font variable manually as a fallback or main driver
            root.style.setProperty('--font-eval', getFontFamily(config.font))

        } catch (e) {
            console.error("Failed to apply theme config", e)
        }
    }, [config, mounted])

    const updateConfig = (key: keyof ThemeConfig, value: string) => {
        setConfigState(prev => ({ ...prev, [key]: value }))
    }

    return (
        <NextThemesProvider {...props}>
            <ThemeConfigContext.Provider value={{ config, setConfig: setConfigState, updateConfig }}>
                {children}
            </ThemeConfigContext.Provider>
        </NextThemesProvider>
    )
}

export const useThemeConfig = () => {
    const context = React.useContext(ThemeConfigContext)
    if (context === undefined) {
        throw new Error("useThemeConfig must be used within a ThemeProvider")
    }
    return context
}

// Helper to map font values to CSS families (matching lyra-theme.css logic implies standard fonts,
// but for cleaner implementation we inline the mapping here or use class names. 
// The Reference page.tsx used inline styles for preview, but real app apps classes.
// However, globals.css line 528: font-family: var(--font-eval, ...). 
// So setting --font-eval is key.
function getFontFamily(font: string): string {
    const map: Record<string, string> = {
        'inter': 'Inter, sans-serif',
        'noto-sans': '"Noto Sans", sans-serif',
        'nunito-sans': '"Nunito Sans", sans-serif',
        'figtree': 'Figtree, sans-serif',
        'roboto': 'Roboto, sans-serif',
        'raleway': 'Raleway, sans-serif',
        'dm-sans': '"DM Sans", sans-serif',
        'public-sans': '"Public Sans", sans-serif',
        'outfit': 'Outfit, sans-serif',
        'jetbrains-mono': '"JetBrains Mono", monospace',
        'tajawal': 'Tajawal, sans-serif',
        'cairo': 'Cairo, sans-serif',
    }
    return map[font] || 'Inter, sans-serif'
}
