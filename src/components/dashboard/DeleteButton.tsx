'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Toast';

type DeleteButtonProps = {
  documentId: number;
  documentTitle: string;
};

export default function DeleteButton({ documentId, documentTitle }: DeleteButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const router = useRouter();
  const { showToast } = useToast();

  const handleDelete = async () => {
    if (!showConfirm) {
      setShowConfirm(true);
      return;
    }

    setIsDeleting(true);
    
    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete document');
      }

      console.log('Document deleted successfully');
      showToast({
        type: 'success',
        title: 'Document Deleted!',
        message: `"${documentTitle}" has been removed successfully.`,
        duration: 2000
      });
      router.push('/twg/documents');
      router.refresh();
    } catch (error) {
      console.error('Delete error:', error);
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      showToast({
        type: 'error',
        title: 'Delete Failed',
        message: errorMessage,
        duration: 3000
      });
    } finally {
      setIsDeleting(false);
      setShowConfirm(false);
    }
  };

  const handleCancel = () => {
    setShowConfirm(false);
  };

  if (!showConfirm) {
    return (
      <button
        onClick={handleDelete}
        className="text-sm text-red-600 hover:text-red-800 underline"
      >
        Delete
      </button>
    );
  }

  return (
    <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
      <p className="text-sm text-red-800 mb-3">
        Are you sure you want to delete "{documentTitle}"? This action cannot be undone.
      </p>
      <div className="flex gap-2">
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className={`px-3 py-1 text-sm font-medium text-white rounded-md transition-colors ${
            isDeleting 
              ? 'bg-red-400 cursor-not-allowed' 
              : 'bg-red-600 hover:bg-red-700'
          }`}
        >
          {isDeleting ? 'Deleting...' : 'Yes, Delete'}
        </button>
        <button
          onClick={handleCancel}
          disabled={isDeleting}
          className="px-3 py-1 text-sm font-medium text-gray-600 bg-gray-200 hover:bg-gray-300 rounded-md transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
