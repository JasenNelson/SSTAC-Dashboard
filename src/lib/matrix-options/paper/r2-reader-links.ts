import { PHASE2_R2_PAPER_VERSION } from './releases';

/** Reader links from the released R2 input manifest; no document bytes are bundled. */
export const R2_READER_LINKS = Object.freeze({
  releaseIdentity: PHASE2_R2_PAPER_VERSION,
  files: Object.freeze([
    { label: 'Paper source (Markdown)', href: 'https://drive.google.com/file/d/1NSQho8oLLEpUvXr6XsaAggnb77p3qNXh/view?usp=drivesdk', sha256: 'fa356b89f2a80d783a39ef70b8f99b79794c5c5377e3b80567a1b23c624edda2' },
    { label: 'Paper (Word)', href: 'https://docs.google.com/document/d/1xZWc-97mR3Kkb9ctx_y6Ls41cqAS8vdB/edit?usp=drivesdk&ouid=109316814201071314511&rtpof=true&sd=true', sha256: 'bccddd2835e36d3bf9dacb0b4a8fc83afc1583e6fc5aa009c7e5c1d91198ce20' },
    { label: 'Paper (PDF)', href: 'https://drive.google.com/file/d/1Cne14mHEFc16vUIpLQesVOoYfCapJhV-/view?usp=drivesdk', sha256: 'aa70ce0442a3f7631845f28ba8c70a1febce2bec1351f35a8473981fdd786426' },
    { label: 'What changed', href: 'https://drive.google.com/file/d/1-Eh9Oe2vBTsGG75zcDqEAXJ9gOOU-cgf/view?usp=drivesdk', sha256: 'b4ec07e7418e23134e1e7f6a89e68b1fde616fbe0eadddbfc9a08b338b3d956b' },
  ]),
});
