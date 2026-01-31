import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Sign In - RFP System",
    description: "Sign in to access the RFP Project Management System",
};

export default function LoginLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // Login page uses its own layout without the sidebar
    return <>{children}</>;
}
