import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest';
import { functions } from '@/server/jobs';

// Create the Inngest serve handler for Next.js App Router
export const { GET, POST, PUT } = serve({
    client: inngest,
    functions,
});
