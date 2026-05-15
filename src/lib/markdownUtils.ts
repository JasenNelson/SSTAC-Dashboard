import fs from 'fs';
import path from 'path';

export async function getMarkdownContent(filename: string): Promise<string> {
  // Directly targeting the requested directory per execution directives
  const dirPath = 'C:\\Projects\\SSTAC-Dashboard\\matrix_research\\markdown';
  const filePath = path.join(dirPath, filename);
  
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8');
    }
  } catch (err) {
    console.error(`Error reading from absolute path ${filePath}`, err);
  }

  // Fallback to process.cwd() just in case the app is run from a different root
  const fallbackPath = path.join(process.cwd(), 'matrix_research', 'markdown', filename);
  try {
    return fs.readFileSync(fallbackPath, 'utf8');
  } catch (error) {
    console.error(`Failed to read markdown file: ${filename}`, error);
    return `Error: Could not load the mathematical derivation for ${filename}.`;
  }
}
