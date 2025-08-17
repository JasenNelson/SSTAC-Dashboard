'use client';

import { useToast } from './Toast';

export default function ToastDemo() {
  const { showToast } = useToast();

  const showSuccessToast = () => {
    showToast({
      type: 'success',
      title: 'Success!',
      message: 'This is a success notification.',
      duration: 4000
    });
  };

  const showErrorToast = () => {
    showToast({
      type: 'error',
      title: 'Error!',
      message: 'This is an error notification.',
      duration: 6000
    });
  };

  const showWarningToast = () => {
    showToast({
      type: 'warning',
      title: 'Warning!',
      message: 'This is a warning notification.',
      duration: 5000
    });
  };

  const showInfoToast = () => {
    showToast({
      type: 'info',
      title: 'Information',
      message: 'This is an informational notification.',
      duration: 4000
    });
  };

  const showLongToast = () => {
    showToast({
      type: 'info',
      title: 'Long Message',
      message: 'This is a toast notification with a much longer message to demonstrate how the component handles text overflow and wrapping. It should still look good and be readable.',
      duration: 8000
    });
  };

  const showQuickToast = () => {
    showToast({
      type: 'success',
      title: 'Quick!',
      message: 'This toast disappears quickly.',
      duration: 1500
    });
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Toast Notification Demo</h2>
      <p className="text-gray-600 mb-6">
        Click the buttons below to test different types of toast notifications. 
        Each toast will appear in the top-right corner of the screen.
      </p>
      
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={showSuccessToast}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
        >
          Success Toast
        </button>
        
        <button
          onClick={showErrorToast}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
        >
          Error Toast
        </button>
        
        <button
          onClick={showWarningToast}
          className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors"
        >
          Warning Toast
        </button>
        
        <button
          onClick={showInfoToast}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Info Toast
        </button>
        
        <button
          onClick={showLongToast}
          className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
        >
          Long Message Toast
        </button>
        
        <button
          onClick={showQuickToast}
          className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
        >
          Quick Toast
        </button>
      </div>
      
      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Features:</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Different types: Success, Error, Warning, Info</li>
          <li>• Customizable duration (auto-hide)</li>
          <li>• Manual close button</li>
          <li>• Smooth animations</li>
          <li>• Accessible with proper ARIA labels</li>
          <li>• Responsive design</li>
          <li>• Multiple toasts can stack</li>
        </ul>
      </div>
    </div>
  );
}
