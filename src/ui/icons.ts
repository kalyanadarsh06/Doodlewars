const icon = (body: string): string =>
  `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`

export const icons = {
  pen: icon('<path d="M9 31l2.5-8L26 8.5l5.5 5.5L17 28.5z" fill="#ffffff"/><path d="M22.5 12l5.5 5.5M9 31l8-2.5"/>'),
  eraser: icon('<path d="M8 25l12-13 11 10-9 10h-8z" fill="#ffffff"/><path d="M14 18.5l11 10M14 32h18"/>'),
  undo: icon('<path d="M14 9l-6 6 6 6"/><path d="M8.5 15H23a8 8 0 0 1 0 16h-5"/>'),
  trash: icon('<path d="M9 12h22M16 12V8.5h8V12M11.5 12l1.5 20h14l1.5-20" fill="#ffffff"/><path d="M17.5 17v10M22.5 17v10"/>'),
  shuffle: icon('<path d="M7 13h6c7 0 8 14 15 14h5M7 27h6c3 0 5-2.5 6.5-5M24 14.5c1.2-1 2.6-1.5 4-1.5h5M29 9l4 4-4 4M29 23l4 4-4 4"/>'),
  download: icon('<path d="M20 7v18M12 18l8 8 8-8M9 33h22"/>'),
  heart: icon('<path d="M20 33S7 25 7 16a6.5 6.5 0 0 1 13-2 6.5 6.5 0 0 1 13 2c0 9-13 17-13 17z" fill="currentColor"/>'),
  arrow: icon('<path d="M8 20h24M24 12l8 8-8 8"/>'),
}
