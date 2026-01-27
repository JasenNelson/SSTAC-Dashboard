// src/app/(dashboard)/regulatory-review/[submissionId]/loading.tsx

function SidebarSkeleton() {
  return (
    <div className="w-[280px] bg-white border-r border-gray-200 p-4 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="h-5 w-24 bg-gray-200 rounded" />
        <div className="h-8 w-8 bg-gray-200 rounded" />
      </div>

      {/* Search */}
      <div className="h-10 w-full bg-gray-200 rounded-lg mb-4" />

      {/* Filter Tabs */}
      <div className="flex space-x-2 mb-4">
        <div className="h-8 w-16 bg-gray-200 rounded" />
        <div className="h-8 w-16 bg-gray-200 rounded" />
        <div className="h-8 w-16 bg-gray-200 rounded" />
      </div>

      {/* Assessment Items */}
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="p-3 border border-gray-200 rounded-lg">
            <div className="h-4 w-full bg-gray-200 rounded mb-2" />
            <div className="h-3 w-2/3 bg-gray-200 rounded mb-2" />
            <div className="flex justify-between">
              <div className="h-5 w-16 bg-gray-200 rounded-full" />
              <div className="h-5 w-12 bg-gray-200 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="flex-1 p-6 animate-pulse">
      {/* Table Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="h-6 w-48 bg-gray-200 rounded" />
        <div className="flex space-x-2">
          <div className="h-9 w-24 bg-gray-200 rounded" />
          <div className="h-9 w-24 bg-gray-200 rounded" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {/* Table Header Row */}
        <div className="grid grid-cols-6 gap-4 p-4 border-b border-gray-200 bg-gray-50">
          <div className="h-4 w-20 bg-gray-200 rounded" />
          <div className="h-4 w-32 bg-gray-200 rounded" />
          <div className="h-4 w-24 bg-gray-200 rounded" />
          <div className="h-4 w-16 bg-gray-200 rounded" />
          <div className="h-4 w-20 bg-gray-200 rounded" />
          <div className="h-4 w-16 bg-gray-200 rounded" />
        </div>

        {/* Table Rows */}
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="grid grid-cols-6 gap-4 p-4 border-b border-gray-200">
            <div className="h-4 w-16 bg-gray-200 rounded" />
            <div className="h-4 w-full bg-gray-200 rounded" />
            <div className="h-4 w-20 bg-gray-200 rounded" />
            <div className="h-5 w-16 bg-gray-200 rounded-full" />
            <div className="h-5 w-14 bg-gray-200 rounded-full" />
            <div className="h-4 w-12 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

function PanelSkeleton() {
  return (
    <div className="w-[400px] bg-white border-l border-gray-200 p-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="h-5 w-32 bg-gray-200 rounded" />
        <div className="h-8 w-8 bg-gray-200 rounded" />
      </div>

      {/* Policy Info */}
      <div className="mb-6">
        <div className="h-4 w-20 bg-gray-200 rounded mb-2" />
        <div className="h-5 w-full bg-gray-200 rounded mb-4" />
        <div className="h-4 w-16 bg-gray-200 rounded mb-2" />
        <div className="h-5 w-24 bg-gray-200 rounded" />
      </div>

      {/* Evidence Section */}
      <div className="mb-6">
        <div className="h-4 w-20 bg-gray-200 rounded mb-3" />
        <div className="space-y-2">
          <div className="h-10 w-full bg-gray-200 rounded" />
          <div className="h-10 w-full bg-gray-200 rounded" />
          <div className="h-10 w-full bg-gray-200 rounded" />
        </div>
      </div>

      {/* Notes */}
      <div className="mb-6">
        <div className="h-4 w-12 bg-gray-200 rounded mb-2" />
        <div className="h-24 w-full bg-gray-200 rounded" />
      </div>

      {/* Actions */}
      <div className="flex space-x-3">
        <div className="h-10 flex-1 bg-gray-200 rounded-lg" />
        <div className="h-10 flex-1 bg-gray-200 rounded-lg" />
      </div>
    </div>
  );
}

export default function SubmissionReviewLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb Skeleton */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center py-3">
            <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-4 bg-gray-200 rounded mx-2 animate-pulse" />
            <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-4 bg-gray-200 rounded mx-2 animate-pulse" />
            <div className="h-4 w-28 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
      </div>

      {/* Header Skeleton */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 animate-pulse">
              <div className="p-2 bg-gray-200 rounded-lg">
                <div className="h-6 w-6" />
              </div>
              <div>
                <div className="h-6 w-48 bg-gray-200 rounded mb-2" />
                <div className="h-4 w-64 bg-gray-200 rounded" />
              </div>
            </div>
            <div className="flex items-center space-x-3 animate-pulse">
              <div className="h-6 w-24 bg-gray-200 rounded-full" />
              <div className="h-10 w-32 bg-gray-200 rounded-lg" />
            </div>
          </div>
        </div>
      </div>

      {/* Three Panel Layout Skeleton */}
      <div className="flex h-[calc(100vh-180px)]">
        <SidebarSkeleton />
        <TableSkeleton />
        <PanelSkeleton />
      </div>
    </div>
  );
}
