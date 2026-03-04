import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function MatchDetailSkeleton() {
    return (
        <div className="flex flex-col gap-6 w-full animate-pulse px-4 py-6 md:p-6">
            {/* Header Info */}
            <div className="flex items-center gap-4 px-2">
                <Skeleton className="h-12 w-12 rounded-full" />
                <Skeleton className="h-10 w-[60%] rounded-md" />
            </div>

            {/* Main Card Element */}
            <Card className="rounded-3xl border-0 overflow-hidden min-h-[400px] flex flex-col justify-end p-6 md:p-8 space-y-4">
                <div className="flex justify-between items-center mb-auto">
                    <Skeleton className="h-6 w-24 rounded-full" />
                    <Skeleton className="h-6 w-32 rounded-full" />
                </div>

                <div className="flex flex-col items-center justify-center space-y-4 mt-6 mb-4">
                    <Skeleton className="h-8 w-3/4 rounded-md" />
                    <Skeleton className="h-12 w-48 rounded-md" />
                </div>

                {/* Buttons space */}
                <div className="flex gap-2">
                    <Skeleton className="h-12 flex-1 rounded-xl" />
                    <Skeleton className="h-12 flex-[0.8] rounded-xl" />
                    <Skeleton className="h-12 flex-[1.5] rounded-xl" />
                </div>
                <div className="flex gap-2">
                    <Skeleton className="h-12 flex-1 rounded-xl" />
                    <Skeleton className="h-12 flex-1 rounded-xl" />
                </div>
            </Card>

            {/* Footer additional info space */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-3 space-y-6">
                    <Skeleton className="h-[300px] w-full rounded-3xl" />
                </div>
            </div>
        </div>
    );
}
