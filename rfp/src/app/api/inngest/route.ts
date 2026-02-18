import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest';
import { functions } from '@/server/jobs';

// Allow up to 5 minutes per Inngest step invocation (Vercel Pro)
export const maxDuration = 300;

// Create the Inngest serve handler for Next.js App Router
export const { GET, POST, PUT } = serve({
    client: inngest,
    functions,
});
