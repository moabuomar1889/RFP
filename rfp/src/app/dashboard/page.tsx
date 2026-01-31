import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { AppSidebar } from '@/components/app-sidebar';
import DashboardContent from './dashboard-content';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
    // Check authentication
    const cookieStore = await cookies();
    const session = cookieStore.get('rfp_session');

    if (!session) {
        redirect('/login');
    }

    return (
        <AppSidebar>
            <DashboardContent />
        </AppSidebar>
    );
}
