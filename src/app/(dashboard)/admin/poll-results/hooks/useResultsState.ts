import { useState, useCallback } from 'react';

export function useResultsState() {
  // UI state for poll display
  const [expandedPoll, setExpandedPoll] = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'twg' | 'cew'>('all');

  // Panel visibility state
  const [leftPanelVisible, setLeftPanelVisible] = useState(true);
  const [qrCodeExpanded, setQrCodeExpanded] = useState(false);
  const [expandedPollGroup, setExpandedPollGroup] = useState<string | null>(null);

  // Refresh tracking
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Matrix graph visibility state
  const [showMatrixGraphs, setShowMatrixGraphs] = useState<{ [key: string]: boolean }>({});

  // Presentation controls visibility
  const [showPresentationControls, setShowPresentationControls] = useState(true);

  // Toggle matrix graph visibility for a specific question pair
  const toggleMatrixGraph = useCallback((questionPairKey: string) => {
    setShowMatrixGraphs(prev => ({
      ...prev,
      [questionPairKey]: !prev[questionPairKey]
    }));
  }, []);

  return {
    expandedPoll,
    setExpandedPoll,
    expandedGroup,
    setExpandedGroup,
    selectedQuestion,
    setSelectedQuestion,
    filterMode,
    setFilterMode,
    leftPanelVisible,
    setLeftPanelVisible,
    qrCodeExpanded,
    setQrCodeExpanded,
    expandedPollGroup,
    setExpandedPollGroup,
    lastRefresh,
    setLastRefresh,
    showMatrixGraphs,
    showPresentationControls,
    setShowPresentationControls,
    toggleMatrixGraph
  };
}
