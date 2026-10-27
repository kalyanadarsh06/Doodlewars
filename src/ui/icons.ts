const icon = (body: string): string =>
  `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`

export const icons = {
  pen: icon('<path d="M9 31l2.5-8L26 8.5l5.5 5.5L17 28.5z" fill="#ffffff"/><path d="M22.5 12l5.5 5.5M9 31l8-2.5"/>'),
  eraser: icon('<path d="M8 25l12-13 11 10-9 10h-8z" fill="#ffffff"/><path d="M14 18.5l11 10M14 32h18"/>'),
  undo: icon('<path d="M14 9l-6 6 6 6"/><path d="M8.5 15H23a8 8 0 0 1 0 16h-5"/>'),
  trash: icon('<path d="M9 12h22M16 12V8.5h8V12M11.5 12l1.5 20h14l1.5-20" fill="#ffffff"/><path d="M17.5 17v10M22.5 17v10"/>'),
  download: icon('<path d="M20 7v18M12 18l8 8 8-8M9 33h22"/>'),
  arrow: icon('<path d="M8 20h24M24 12l8 8-8 8"/>'),
  clock: icon('<circle cx="20" cy="21" r="12" fill="#ffffff"/><path d="M20 14v7l5 3M16 5h8"/>'),
  play: icon('<path d="M13 9l18 11-18 11z" fill="currentColor"/>'),
  lock: icon('<rect x="9" y="18" width="22" height="15" rx="3" fill="#ffffff"/><path d="M14 18v-4a6 6 0 0 1 12 0v4"/>'),
}
