'use client';

import { useCallback } from 'react';
import { PollResult } from '../types';

export function usePollUtilities() {
  const getPageTitle = useCallback((pagePath: string) => {
    const pathMap: { [key: string]: string } = {
      '/survey-results/holistic-protection': 'Holistic Protection',
      '/survey-results/tiered-framework': 'Tiered Framework',
      '/survey-results/prioritization': 'Prioritization Framework',
      '/survey-results/effectiveness': 'Effectiveness of Current Standards',
      '/survey-results/technical-standards': 'Technical Standards',
      '/survey-results/detailed-findings': 'Detailed Findings',
      '/cew-polls/holistic-protection': 'Holistic Protection',
      '/cew-polls/tiered-framework': 'Tiered Framework',
      '/cew-polls/prioritization': 'Prioritization Framework',
    };
    return pathMap[pagePath] || pagePath;
  }, []);

  const getPollGroup = useCallback((pagePath: string): 'holistic-protection' | 'tiered-framework' | 'prioritization' | null => {
    if (pagePath.includes('holistic-protection')) return 'holistic-protection';
    if (pagePath.includes('tiered-framework')) return 'tiered-framework';
    if (pagePath.includes('prioritization')) return 'prioritization';
    return null;
  }, []);

  const groupPollsByTheme = useCallback((polls: PollResult[]) => {
    const themes = {
      'holistic-protection': {
        name: 'Holistic Protection',
        polls: polls
          .filter(poll => poll.page_path.includes('holistic-protection'))
          .sort((a, b) => a.poll_index - b.poll_index),
      },
      'tiered-framework': {
        name: 'Tiered Framework',
        polls: polls
          .filter(poll => poll.page_path.includes('tiered-framework'))
          .sort((a, b) => a.poll_index - b.poll_index),
      },
      'prioritization': {
        name: 'Prioritization',
        polls: polls
          .filter(poll => poll.page_path.includes('prioritization'))
          .sort((a, b) => a.poll_index - b.poll_index),
        showGraphs: true,
      },
    };
    return themes;
  }, []);

  return {
    getPageTitle,
    getPollGroup,
    groupPollsByTheme,
  };
}
