// src/app/(dashboard)/regulatory-review/loading.tsx

function SkeletonCard() {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 animate-pulse">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="h-5 w-32 bg-gray-200 rounded mb-2" />
          <div className="h-4 w-48 bg-gray-200 rounded" />
        </div>
        <div className="h-6 w-20 bg-gray-200 rounded-full" />
      </div>

      {/* Details */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center">
          <div className="h-4 w-4 bg-gray-200 rounded mr-2" />
          <div className="h-4 w-28 bg-gray-200 rounded" />
        </div>
        <div className="flex items-center">
          <div className="h-4 w-4 bg-gray-200 rounded mr-2" />
          <div className="h-4 w-36 bg-gray-200 rounded" />
        </div>
        <div className="flex items-center">
          <div className="h-4 w-4 bg-gray-200 rounded mr-2" />
          <div className="h-4 w-24 bg-gray-200 rounded" />
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="h-4 w-28 bg-gray-200 rounded" />
          <div className="h-4 w-16 bg-gray-200 rounded" />
        </div>
        <div className="h-2 w-full bg-gray-200 rounded-full" />
        <div className="flex justify-between mt-1">
          <div className="h-3 w-16 bg-gray-200 rounded" />
          <div className="h-3 w-12 bg-gray-200 rounded" />
          <div className="h-3 w-20 bg-gray-200 rounded" />
        </div>
      </div>

      {/* Button */}
      <div className="h-10 w-full bg-gray-200 rounded-lg" />
    </div>
  );
}

export default function RegulatoryReviewLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb Skeleton */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center py-3">
            <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-4 bg-gray-200 rounded mx-2 animate-pulse" />
            <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
      </div>

      {/* Header Skeleton */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gray-200 rounded-lg animate-pulse">
              <div className="h-6 w-6" />
            </div>
            <div>
              <div className="h-6 w-64 bg-gray-200 rounded mb-2 animate-pulse" />
              <div className="h-4 w-80 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      {/* Content Skeleton */}
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Actions Bar Skeleton */}
          <div className="flex items-center justify-between mb-6">
            <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
            <div className="h-10 w-40 bg-gray-200 rounded-lg animate-pulse" />
          </div>

          {/* Cards Grid Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      </div>
    </div>
  );
}
