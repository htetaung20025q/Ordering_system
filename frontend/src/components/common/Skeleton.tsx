import React from 'react';
import clsx from 'clsx';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className, ...props }) => {
  return (
    <div
      className={clsx('animate-pulse rounded-2xl bg-slate-200/80', className)}
      {...props}
    />
  );
};

export const FoodCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white rounded-3xl p-3 space-y-3 border border-slate-100 shadow-sm">
      <Skeleton className="w-full aspect-[4/3] rounded-2xl" />
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-3/4 rounded-md" />
        <Skeleton className="h-3 w-1/2 rounded-md" />
      </div>
      <div className="flex items-center justify-between pt-2">
        <Skeleton className="h-4 w-1/3 rounded-md" />
        <Skeleton className="h-8 w-16 rounded-full" />
      </div>
    </div>
  );
};
