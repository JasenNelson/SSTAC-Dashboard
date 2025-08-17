'use client';

import { useToast } from './Toast';

export default function ToastTest() {
  const { showToast } = useToast();

  const testToast = () => {
    console.log('🧪 Testing toast...');
    try {
      showToast({
        type: 'success',
        title: 'Test Toast',
        message: 'This is a test toast notification.',
        duration: 3000
      });
      console.log('✅ Toast call completed');
    } catch (error) {
      console.error('❌ Toast error:', error);
    }
  };

  return (
    <div className="p-4 border border-gray-300 rounded-lg bg-yellow-50">
      <h3 className="text-lg font-medium text-gray-900 mb-2">Toast System Test</h3>
      <p className="text-sm text-gray-600 mb-3">
        Click the button below to test if the toast notification system is working.
      </p>
      <button
        onClick={testToast}
        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
      >
        Test Toast
      </button>
    </div>
  );
}
