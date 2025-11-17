import Link from 'next/link';

export function HeaderBrand() {
  return (
    <div className="flex items-center">
      <Link
        href="/dashboard"
        className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
      >
        <div className="text-center">
          <div className="leading-tight">SSTAC & TWG</div>
          <div className="text-sm sm:text-lg leading-tight">Dashboard</div>
        </div>
      </Link>
    </div>
  );
}

