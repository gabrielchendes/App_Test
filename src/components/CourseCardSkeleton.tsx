import { memo } from 'react';
import { cn } from '../lib/utils';

interface CourseCardSkeletonProps {
  showTitle?: boolean;
}

export const CourseCardSkeleton = memo(({ showTitle = true }: CourseCardSkeletonProps) => {
  return (
    <div
      className={cn(
        "relative flex-shrink-0 w-[140px] sm:w-[190px] rounded-2xl overflow-hidden shadow-xl bg-zinc-950 flex flex-col p-[1.5px] snap-start"
      )}
    >
      {/* Precision subtle border shimmer */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none rounded-2xl">
        <div className="absolute inset-0 bg-white/[0.04] animate-pulse" />
      </div>

      {/* Main Container */}
      <div className="relative z-10 flex flex-col flex-grow bg-zinc-950 rounded-[14.5px] overflow-hidden">
        {/* Cover Skeleton */}
        <div className="relative aspect-[3/4] w-full bg-zinc-900 overflow-hidden flex items-center justify-center">
          <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/[0.03] to-white/0 animate-pulse" />
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-white/[0.05] flex items-center justify-center animate-pulse" />
        </div>

        {/* Info & CTA Skeleton matching ProductCard */}
        <div className={cn(
          "p-2.5 sm:p-4 flex flex-col items-center justify-between text-center gap-2 flex-grow relative bg-zinc-950 z-20",
          showTitle ? "min-h-[90px] sm:min-h-[105px]" : "min-h-[55px] sm:min-h-[65px]"
        )}>
          {showTitle && (
            <div className="flex-1 flex flex-col items-center justify-center w-full gap-1.5 py-1">
              <div className="h-2.5 sm:h-3 w-4/5 rounded-full bg-white/[0.08] animate-pulse" />
              <div className="h-2 sm:h-2.5 w-3/5 rounded-full bg-white/[0.04] animate-pulse" />
            </div>
          )}

          {/* Progress skeleton bar */}
          <div className="w-full h-1 bg-white/[0.06] rounded-full overflow-hidden">
            <div className="w-1/3 h-full bg-white/[0.12] rounded-full animate-pulse" />
          </div>

          {/* Button skeleton */}
          <div className="w-full h-6 sm:h-7.5 rounded-lg bg-white/[0.07] animate-pulse" />
        </div>
      </div>
    </div>
  );
});

CourseCardSkeleton.displayName = 'CourseCardSkeleton';
