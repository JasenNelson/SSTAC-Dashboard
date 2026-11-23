// The R2 guided review workspace spans the available viewport width on desktop
// (no fixed outer cap). The gutter is a margin, not padding, because the panel
// width math measures the workspace border box (getBoundingClientRect). Each
// side is clamp(0px, (container - 1600px) / 2, 1rem), resolved against the
// containing block (so a vertical scrollbar is already excluded): up to a
// 1632px container the workspace is exactly as wide as under the former 1600px
// cap, beyond that it is the container minus 2rem, and it never shrinks as the
// window widens.
export const R2_WORKSPACE_GUTTER_CLASSES = 'lg:mx-[clamp(0px,calc((100%_-_1600px)/2),1rem)]';

// These utility classes apply only to the R2 guided review reading frame.
export const R2_READING_FRAME_CLASSES = 'lg:w-[min(100%,max(42rem,86%))] lg:data-[reader-width=wide]:w-full print:w-full';
