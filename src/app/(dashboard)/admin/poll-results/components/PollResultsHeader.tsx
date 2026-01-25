'use client';

import React from 'react';

interface PollResultsHeaderProps {
  lastRefresh: Date;
}

export default function PollResultsHeader({ lastRefresh }: PollResultsHeaderProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
          Live Poll Results Dashboard
        </h1>
        <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center space-x-2">
          <span>Last updated: {lastRefresh.toLocaleTimeString()}</span>
        </div>
      </div>
      <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">
        Combined results from TWG & SSTAC members (via dashboard) and CEW conference
        attendees (live event)
      </p>
    </div>
  );
}
