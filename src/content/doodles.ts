export interface Doodle {
  title: string
  svg: string
}

const frame = (body: string): string =>
  `<svg viewBox="0 0 160 160" fill="none" stroke="#161616" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`

export const DOODLES: readonly Doodle[] = [
  {
    title: 'Wobbly_Cloud',
    svg: frame(
      '<path d="M38 104c-16 0-22-20-8-28-2-18 18-28 32-18 8-16 34-16 40 2 18-4 30 14 22 28 12 10 4 26-10 26z" fill="#ffffff"/><circle cx="66" cy="86" r="3.5" fill="#161616"/><circle cx="92" cy="86" r="3.5" fill="#161616"/><path d="M72 98c4 4 10 4 14 0"/><path d="M52 122l-4 12M80 124l-4 12M108 122l-4 12" stroke="#6e6cf3"/>',
    ),
  },
  {
    title: 'Melancholy_Sun',
    svg: frame(
      '<circle cx="80" cy="82" r="34" fill="#f9d85e"/><path d="M80 30v-12M80 146v-12M28 82H16M144 82h-12M43 45l-8-8M125 127l-8-8M117 45l8-8M35 127l8-8"/><circle cx="68" cy="76" r="3.5" fill="#161616"/><circle cx="92" cy="76" r="3.5" fill="#161616"/><path d="M68 98c6-6 18-6 24 0"/><path d="M95 82c1 6 4 9 2 13" stroke="#6e6cf3"/>',
    ),
  },
  {
    title: 'Feral_Frog',
    svg: frame(
      '<path d="M30 112c-4-30 18-50 50-50s54 20 50 50c-2 14-24 20-50 20s-48-6-50-20z" fill="#5cc08a"/><circle cx="56" cy="60" r="16" fill="#ffffff"/><circle cx="104" cy="60" r="16" fill="#ffffff"/><circle cx="58" cy="62" r="5" fill="#161616"/><circle cx="102" cy="58" r="5" fill="#161616"/><path d="M54 100c14 12 38 12 52 0"/>',
    ),
  },
  {
    title: 'Haunted_Toast',
    svg: frame(
      '<path d="M42 136V70c-16-4-16-34 8-36 12-14 48-14 60 0 24 2 24 32 8 36v66z" fill="#f1a55a"/><path d="M52 126V74c-10-4-8-24 6-24 10-10 34-10 44 0 14 0 16 20 6 24v52z" fill="#fbe3b8"/><circle cx="70" cy="86" r="3.5" fill="#161616"/><circle cx="92" cy="86" r="3.5" fill="#161616"/><ellipse cx="81" cy="104" rx="6" ry="8" fill="#161616"/>',
    ),
  },
  {
    title: 'Cosmic_Ghost',
    svg: frame(
      '<path d="M40 136V76c0-28 18-46 40-46s40 18 40 46v60l-13-10-13 10-14-10-14 10-13-10z" fill="#ffffff"/><ellipse cx="66" cy="76" rx="6" ry="9" fill="#161616"/><ellipse cx="94" cy="76" rx="6" ry="9" fill="#161616"/><path d="M70 100c6 5 14 5 20 0"/><path d="M128 36l4 8 8 2-8 3-3 8-3-8-8-3 8-2z" stroke-width="3" fill="#f9d85e"/>',
    ),
  },
  {
    title: 'Grumpy_Pickle',
    svg: frame(
      '<path d="M60 136c-22-6-26-40-20-72 6-34 26-46 46-40 24 8 30 40 24 72-6 30-28 46-50 40z" fill="#5cc08a"/><path d="M58 50l4 4M100 60l-3 4M54 104l4 3M100 108l-4 3" stroke-width="4"/><path d="M64 76l12 4M96 76l-12 4"/><circle cx="70" cy="86" r="3.5" fill="#161616"/><circle cx="90" cy="86" r="3.5" fill="#161616"/><path d="M70 106c6-5 14-5 20 0"/>',
    ),
  },
  {
    title: 'Tiny_Comet',
    svg: frame(
      '<path d="M20 42c30 4 52 18 66 36M14 72c26 0 48 8 64 22M34 22c22 10 40 26 50 46" stroke="#f09aae" stroke-width="6"/><circle cx="104" cy="104" r="32" fill="#ee5d57"/><circle cx="94" cy="100" r="3.5" fill="#161616"/><circle cx="114" cy="100" r="3.5" fill="#161616"/><path d="M96 114c5 4 11 4 16 0"/>',
    ),
  },
  {
    title: 'Sleepy_Moon',
    svg: frame(
      '<path d="M104 30c-36-4-66 22-66 54s28 54 62 50c-22-10-34-30-32-54 2-22 14-40 36-50z" fill="#f9d85e"/><path d="M58 78c4 4 10 4 14 0M58 102c6 4 14 4 18-2"/><path d="M112 54h14l-14 16h14M126 84h10l-10 12h10" stroke-width="4"/>',
    ),
  },
]
