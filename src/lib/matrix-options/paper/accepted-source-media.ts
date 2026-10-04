import contract from './contracts/appendix-l-source-media-v0.9.91-run109-001.json';

export interface AppendixLSourceMediaBinding {
  readonly releaseIdentity: 'v0.9.91';
  readonly file: string;
  readonly sha256: string;
  readonly bytes: number;
  readonly width: number;
  readonly height: number;
  readonly alt: string;
  readonly widthAttribute: string;
}

export interface AppendixLSourceMediaContract extends AppendixLSourceMediaBinding {
  readonly schemaVersion: string;
  readonly sourcePath: string;
  readonly sourceHeadingId: string;
  readonly sourceLine: number;
  readonly sourceMediaPath: string;
  readonly marker: string;
  readonly sourceMarkdownLineSha256: string;
}

const SOURCE_MEDIA = contract as AppendixLSourceMediaContract;

function expectedMarkdownLine(): string {
  return `![${SOURCE_MEDIA.alt}](${SOURCE_MEDIA.sourceMediaPath}){width=${SOURCE_MEDIA.widthAttribute}}<!-- ${SOURCE_MEDIA.marker} -->`;
}

export function appendixLSourceMediaContract(): AppendixLSourceMediaContract {
  return SOURCE_MEDIA;
}

export function appendixLSourceMediaMarkdownLine(): string {
  return expectedMarkdownLine();
}

export function assertAppendixLSourceMedia(markdown: string): void {
  const lines = markdown.split('\n');
  const marked = lines.flatMap((line, index) => line.includes('APPENDIX_L_SOURCE_MEDIA') ? [{ line, index }] : []);
  if (SOURCE_MEDIA.schemaVersion !== 'matrix-paper-source-media-v1'
    || SOURCE_MEDIA.releaseIdentity !== 'v0.9.91'
    || SOURCE_MEDIA.sourcePath !== 'presentation:v0.9.91'
    || SOURCE_MEDIA.sourceHeadingId !== 'app-l'
    || SOURCE_MEDIA.sourceLine !== 5076
    || SOURCE_MEDIA.file !== 'APPENDIX-L-SOURCE.png'
    || SOURCE_MEDIA.sourceMediaPath !== 'appendix_l_media/image1.png'
    || marked.length !== 1
    || marked[0].index + 1 !== SOURCE_MEDIA.sourceLine
    || marked[0].line !== expectedMarkdownLine()) {
    throw new Error('Authenticated Appendix L source media binding mismatch');
  }
}
