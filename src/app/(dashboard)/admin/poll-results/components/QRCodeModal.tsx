'use client';

import React from 'react';
import QRCodeDisplay from '@/components/dashboard/QRCodeDisplay';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  expandedPollGroup: string | null;
}

const QRCodeModal: React.FC<QRCodeModalProps> = ({ isOpen, onClose, expandedPollGroup }) => {
  if (!isOpen) return null;

  const getWebAddress = (group: string) => {
    switch (group) {
      case 'holistic-protection':
        return 'bit.ly/SABCS-Holistic';
      case 'tiered-framework':
        return 'bit.ly/SABCS-Tiered';
      case 'prioritization':
        return 'bit.ly/SABCS-Prio';
      default:
        return 'bit.ly/SABCS-Holistic'; // Default fallback
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-xl p-8 max-w-5xl mx-4 relative transform scale-[1.5]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors duration-200"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Expanded content */}
        <div className="flex flex-col items-center space-y-8">
          <h3 className="text-3xl font-bold text-gray-800 dark:text-white text-center">
            Conference Poll Access
          </h3>
          
          <div className="flex flex-col lg:flex-row items-center justify-center space-y-8 lg:space-y-0 lg:space-x-12 w-full">
            {/* Expanded Join at container */}
            <div className="flex flex-col items-center bg-blue-50 dark:bg-blue-900/20 p-6 rounded-xl border-2 border-blue-200 dark:border-blue-800 w-full lg:w-auto lg:min-w-[400px] lg:max-w-[450px]">
              <div className="flex flex-col items-center space-y-4">
                <div className="text-3xl font-bold text-blue-700 dark:text-white" style={{color: '#1d4ed8'}}>
                  Join at:
                </div>
                <div className="text-4xl font-bold text-blue-700 dark:text-white whitespace-nowrap text-center" style={{color: '#1d4ed8'}}>
                  {getWebAddress(expandedPollGroup || 'holistic-protection')}
                </div>
              </div>
              
              <div className="h-6"></div>
              
              <div className="flex flex-col items-center space-y-4">
                <div className="text-3xl font-bold text-blue-700 dark:text-white" style={{color: '#1d4ed8'}}>
                  Password:
                </div>
                <div className="text-5xl font-bold text-blue-700 dark:text-white" style={{color: '#1d4ed8'}}>
                  CEW2025
                </div>
              </div>
            </div>

            {/* Expanded QR Code */}
            <div className="flex items-center justify-center">
              <div className="transform scale-140">
                <QRCodeDisplay 
                  pollGroup={(expandedPollGroup || 'holistic-protection') as 'holistic-protection' | 'tiered-framework' | 'prioritization' | 'wiks'} 
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QRCodeModal;
