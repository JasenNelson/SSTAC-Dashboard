'use client';

import React, { useEffect, useRef, useState } from 'react';

interface WordCloudData {
  text: string;
  value: number;
}

interface CustomWordCloudProps {
  words: WordCloudData[];
  width?: number;
  height?: number;
  colors?: string[];
  fontFamily?: string;
  fontWeight?: string;
  minSize?: number;
  maxSize?: number;
}

export default function CustomWordCloud({
  words,
  width = 800,
  height = 400,
  colors = ['#1e3a8a', '#1e40af', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd'],
  fontFamily = 'Inter, system-ui, sans-serif',
  fontWeight = 'normal',
  minSize = 12,
  maxSize = 60
}: CustomWordCloudProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Detect dark mode
  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };
    
    checkDarkMode();
    
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!words || words.length === 0) {
      return;
    }
    
    if (!canvasRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    // High-DPI canvas setup for crisp text rendering
    const devicePixelRatio = window.devicePixelRatio || 1;
    const displayWidth = width;
    const displayHeight = height;
    
    // Set actual canvas size in memory (scaled up for high DPI)
    canvas.width = displayWidth * devicePixelRatio;
    canvas.height = displayHeight * devicePixelRatio;
    
    // Scale the canvas back down using CSS
    canvas.style.width = displayWidth + 'px';
    canvas.style.height = displayHeight + 'px';
    
    // Scale the drawing context so everything draws at the correct size
    ctx.scale(devicePixelRatio, devicePixelRatio);
    
    // Enable text rendering optimizations
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Clear canvas with transparent background
    ctx.clearRect(0, 0, displayWidth, displayHeight);

    // Calculate max value for scaling
    const maxValue = Math.max(...words.map(w => w.value));
    const minValue = Math.min(...words.map(w => w.value));
    // Handle case where all words have the same value
    const valueRange = maxValue - minValue;

    // Simple wordcloud layout - place words in a grid pattern
    const centerX = displayWidth / 2;
    const centerY = displayHeight / 2;
    
    // Sort words by value (largest first)
    const sortedWords = [...words].sort((a, b) => b.value - a.value);
    
    // Grid-based layout with spatial hash collision detection for better readability
    const placedWords: Array<{x: number, y: number, width: number, height: number}> = [];
    const gridSize = 20; // Grid cell size for collision detection
    const cellSize = 50; // Size of spatial hash cells (tuned for typical wordcloud sizes)

    // Spatial hash grid: maps cell coordinates to word indices
    const spatialGrid = new Map<string, number[]>();

    // Helper function to get cell coordinates for a position
    const getCellCoords = (x: number, y: number) => {
      return `${Math.floor(x / cellSize)},${Math.floor(y / cellSize)}`;
    };

    // Helper function to get all cells that overlap with a bounding box
    const getCellsForBounds = (x: number, y: number, width: number, height: number, padding: number = 25) => {
      const cells = new Set<string>();
      const minCellX = Math.floor((x - padding) / cellSize);
      const maxCellX = Math.floor((x + width + padding) / cellSize);
      const minCellY = Math.floor((y - padding) / cellSize);
      const maxCellY = Math.floor((y + height + padding) / cellSize);

      for (let cx = minCellX; cx <= maxCellX; cx++) {
        for (let cy = minCellY; cy <= maxCellY; cy++) {
          cells.add(`${cx},${cy}`);
        }
      }
      return cells;
    };

    // Helper function to check if a position collides with existing words (spatial hash optimized)
    const hasCollision = (x: number, y: number, width: number, height: number, padding: number = 25) => {
      const cellsToCheck = getCellsForBounds(x, y, width, height, padding);

      for (const cellKey of cellsToCheck) {
        const wordIndices = spatialGrid.get(cellKey);
        if (wordIndices) {
          for (const idx of wordIndices) {
            const placed = placedWords[idx];
            // Actual collision check only against words in nearby cells
            if (x < placed.x + placed.width + padding &&
                x + width + padding > placed.x &&
                y < placed.y + placed.height + padding &&
                y + height + padding > placed.y) {
              return true;
            }
          }
        }
      }
      return false;
    };

    // Helper function to add a word to the spatial grid
    const addToSpatialGrid = (x: number, y: number, width: number, height: number, wordIndex: number) => {
      const cellsForWord = getCellsForBounds(x, y, width, height, 0);
      for (const cellKey of cellsForWord) {
        if (!spatialGrid.has(cellKey)) {
          spatialGrid.set(cellKey, []);
        }
        spatialGrid.get(cellKey)!.push(wordIndex);
      }
    };
    
    // Helper function to find a good position for a word
    const findPosition = (textWidth: number, textHeight: number) => {
      const padding = 25;
      const maxAttempts = 100;
      
      // Try positions in expanding squares around center
      for (let radius = 0; radius < Math.min(displayWidth, displayHeight) / 2; radius += 20) {
        const positions = [];
        
        // Generate positions in a square pattern around center
        for (let x = centerX - radius; x <= centerX + radius; x += gridSize) {
          for (let y = centerY - radius; y <= centerY + radius; y += gridSize) {
            // Only consider positions on the perimeter of the square
            if (x === centerX - radius || x === centerX + radius || 
                y === centerY - radius || y === centerY + radius) {
              positions.push({ x: x - textWidth / 2, y: y + textHeight / 4 });
            }
          }
        }
        
        // Shuffle positions for variety
        positions.sort(() => Math.random() - 0.5);
        
        for (const pos of positions) {
          if (!hasCollision(pos.x, pos.y, textWidth, textHeight, padding) &&
              pos.x >= 10 && pos.x + textWidth <= displayWidth - 10 &&
              pos.y >= textHeight + 10 && pos.y <= displayHeight - 10) {
            return pos;
          }
        }
      }
      
      // Fallback: place randomly if no good position found
      return {
        x: Math.random() * (displayWidth - textWidth - 20) + 10,
        y: Math.random() * (displayHeight - textHeight - 20) + textHeight + 10
      };
    };
    
    sortedWords.forEach((word, index) => {
      // Calculate font size based on value
      const normalizedValue = valueRange === 0 ? 0.5 : (word.value - minValue) / valueRange;
      const fontSize = minSize + (normalizedValue * (maxSize - minSize));
      
      ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
      const textMetrics = ctx.measureText(word.text);
      const textWidth = textMetrics.width;
      const textHeight = fontSize;

      // Find a good position without collisions
      const position = findPosition(textWidth, textHeight);
      const x = position.x;
      const y = position.y;

      // Store this word's position for collision detection
      const wordIndex = placedWords.length;
      placedWords.push({ x, y, width: textWidth, height: textHeight });

      // Add to spatial grid for O(1) collision lookup instead of O(n)
      addToSpatialGrid(x, y, textWidth, textHeight, wordIndex);

      // Choose color based on word value and theme
      const colorIndex = Math.floor((1 - normalizedValue) * (colors.length - 1));
      
      // Use different color palettes for light and dark modes
      const lightColors = ['#1e3a8a', '#1e40af', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd'];
      const darkColors = ['#dbeafe', '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1e40af'];
      
      const colorPalette = isDarkMode ? darkColors : lightColors;
      ctx.fillStyle = colorPalette[colorIndex];

      // Add very slight rotation for variety (minimal for better readability)
      const rotation = (Math.random() - 0.5) * 0.1;
      
      ctx.save();
      ctx.translate(x + textWidth / 2, y + textHeight / 2);
      ctx.rotate(rotation);
      ctx.fillText(word.text, -textWidth / 2, textHeight / 4);
      ctx.restore();
    });
  }, [words, width, height, colors, fontFamily, fontWeight, minSize, maxSize, isDarkMode]);

  if (!words || words.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <div className="text-4xl mb-2">☁️</div>
          <p>No words to display</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="max-w-full max-h-full"
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}
