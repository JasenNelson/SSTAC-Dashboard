'use client';

export default function ThemeTest() {
  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
        Theme Test
      </h2>
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
        <p className="text-gray-700 dark:text-gray-300">
          This should change color when you toggle the theme.
        </p>
        <div className="mt-4 p-2 bg-blue-100 dark:bg-blue-900 rounded">
          <p className="text-blue-800 dark:text-blue-200">
            This box should also change color.
          </p>
        </div>
      </div>
    </div>
  );
}
