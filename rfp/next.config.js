/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        // Disable static generation for API routes using Prisma
        serverComponentsExternalPackages: ['@prisma/client', '@prisma/engines'],
    },
    // Ensure API routes are always dynamic
    async headers() {
        return [
            {
                source: '/api/:path*',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'no-store, must-revalidate',
                    },
                ],
            },
        ];
    },
};

module.exports = nextConfig;
