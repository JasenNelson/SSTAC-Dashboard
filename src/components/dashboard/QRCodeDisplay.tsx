'use client';

import Image from 'next/image';
import { useState } from 'react';

interface QRCodeDisplayProps {
  pollGroup: 'holistic-protection' | 'tiered-framework' | 'prioritization' | 'wiks';
  className?: string;
}

export default function QRCodeDisplay({ pollGroup, className = '' }: QRCodeDisplayProps) {
  const [imageError, setImageError] = useState(false);
  
  // Map poll groups to their corresponding QR code images
  const qrCodeMap = {
    'holistic-protection': '/qr-codes/holistic-QR.png',
    'tiered-framework': '/qr-codes/tiered-QR.png',
    'prioritization': '/qr-codes/prio-QR.png',
    'wiks': '/qr-codes/wiks-QR.png'
  };

  // Use actual QR code images when available
  const actualPath = qrCodeMap[pollGroup as keyof typeof qrCodeMap];
  const qrCodePath = actualPath;

  // If no QR code path is available, don't render anything
  if (!qrCodePath) {
    return null;
  }

  // If image fails to load, show a fallback
  if (imageError) {
    return (
      <div className={`flex flex-col items-center ${className}`}>
        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-md border border-gray-200 dark:border-gray-600">
          <div className="w-[120px] h-[120px] bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center">
            <span className="text-gray-500 dark:text-gray-400 text-sm">QR Code</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-md border border-gray-200 dark:border-gray-600">
        <Image
          src={qrCodePath}
          alt={`QR Code for ${pollGroup.replace('-', ' ')}`}
          width={120}
          height={120}
          className="rounded"
          unoptimized={qrCodePath.endsWith('.svg')}
          onError={() => setImageError(true)}
          priority={true}
        />
      </div>
    </div>
  );
}
