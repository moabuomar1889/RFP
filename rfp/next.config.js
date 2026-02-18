/** @type {import('next').NextConfig} */
const nextConfig = {
    // Prisma + Vercel: mark as external so they're not bundled
    serverExternalPackages: ['@prisma/client', '@prisma/engines'],
    typescript: {
        ignoreBuildErrors: true,
    },
    eslint: {
        ignoreDuringBuilds: true,
    },
};

module.exports = nextConfig;
