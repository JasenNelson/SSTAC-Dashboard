'use client';

import React, { useEffect, useRef } from 'react';

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
  colors = ['#1e40af', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#dbeafe'],
  fontFamily = 'Inter, system-ui, sans-serif',
  fontWeight = 'normal',
  minSize = 12,
  maxSize = 60
}: CustomWordCloudProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    console.log('CustomWordCloud useEffect called with words:', words);
    console.log('CustomWordCloud: Canvas ref:', canvasRef.current);
    
    if (!words || words.length === 0) {
      console.log('CustomWordCloud: No words provided, returning early');
      return;
    }
    
    if (!canvasRef.current) {
      console.log('CustomWordCloud: No canvas ref, returning early');
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.log('CustomWordCloud: No canvas context');
      return;
    }
    
    console.log('CustomWordCloud: Starting to render with', words.length, 'words');

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Clear canvas with white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calculate max value for scaling
    const maxValue = Math.max(...words.map(w => w.value));
    const minValue = Math.min(...words.map(w => w.value));
    // Handle case where all words have the same value
    const valueRange = maxValue - minValue;

    // Simple wordcloud layout - place words in a grid pattern
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // Sort words by value (largest first)
    const sortedWords = [...words].sort((a, b) => b.value - a.value);
    
    // No test word needed - rendering is working!
    
    sortedWords.forEach((word, index) => {
      // Calculate font size based on value
      const normalizedValue = valueRange === 0 ? 0.5 : (word.value - minValue) / valueRange;
      const fontSize = minSize + (normalizedValue * (maxSize - minSize));
      
      ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
      const textMetrics = ctx.measureText(word.text);
      const textWidth = textMetrics.width;
      const textHeight = fontSize;

      // Simple positioning - place words in a circle around center
      const angle = (index * 2 * Math.PI) / sortedWords.length;
      const radius = Math.min(canvas.width, canvas.height) * 0.3;
      
      let x = centerX + Math.cos(angle) * radius - textWidth / 2;
      let y = centerY + Math.sin(angle) * radius + textHeight / 4;
      
      // Ensure it stays within canvas bounds
      x = Math.max(10, Math.min(x, canvas.width - textWidth - 10));
      y = Math.max(textHeight + 10, Math.min(y, canvas.height - 10));

      // Choose color based on word value
      const colorIndex = Math.floor(normalizedValue * (colors.length - 1));
      ctx.fillStyle = colors[colorIndex];

      // Add slight rotation for variety
      const rotation = (Math.random() - 0.5) * 0.5;
      
      ctx.save();
      ctx.translate(x + textWidth / 2, y + textHeight / 2);
      ctx.rotate(rotation);
      ctx.fillText(word.text, -textWidth / 2, textHeight / 4);
      ctx.restore();
    });
  }, [words, width, height, colors, fontFamily, fontWeight, minSize, maxSize]);

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
