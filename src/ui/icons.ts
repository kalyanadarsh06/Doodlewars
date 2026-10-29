const icon = (body: string): string =>
  `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`

export const icons = {
  pen: icon('<path d="M9 31l2.5-8L26 8.5l5.5 5.5L17 28.5z" fill="#ffffff"/><path d="M22.5 12l5.5 5.5M9 31l8-2.5"/>'),
  eraser: icon('<path d="M8 25l12-13 11 10-9 10h-8z" fill="#ffffff"/><path d="M14 18.5l11 10M14 32h18"/>'),
  undo: icon('<path d="M14 9l-6 6 6 6"/><path d="M8.5 15H23a8 8 0 0 1 0 16h-5"/>'),
  trash: icon('<path d="M9 12h22M16 12V8.5h8V12M11.5 12l1.5 20h14l1.5-20" fill="#ffffff"/><path d="M17.5 17v10M22.5 17v10"/>'),
  download: icon('<path d="M20 7v18M12 18l8 8 8-8M9 33h22"/>'),
  redo: icon('<path d="M26 9l6 6-6 6"/><path d="M31.5 15H17a8 8 0 0 0 0 16h5"/>'),
  arrow: icon('<path d="M8 20h24M24 12l8 8-8 8"/>'),
  clock: icon('<circle cx="20" cy="21" r="12" fill="#ffffff"/><path d="M20 14v7l5 3M16 5h8"/>'),
  play: icon('<path d="M13 9l18 11-18 11z" fill="currentColor"/>'),
  wallet: icon('<path d="M8 12h22a4 4 0 0 1 4 4v14a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4h17" fill="#ffffff"/><path d="M34 19h-7a3.5 3.5 0 0 0 0 7h7z" fill="#f9d85e"/>'),
  copy: icon('<rect x="14" y="14" width="18" height="18" rx="3" fill="#ffffff"/><path d="M26 14v-3a3 3 0 0 0-3-3H11a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h3"/>'),
  dice: icon('<rect x="8" y="8" width="24" height="24" rx="5" fill="#ffffff"/><circle cx="14.5" cy="14.5" r="1.2" fill="currentColor"/><circle cx="20" cy="20" r="1.2" fill="currentColor"/><circle cx="25.5" cy="25.5" r="1.2" fill="currentColor"/>'),
  lock: icon('<rect x="9" y="18" width="22" height="15" rx="3" fill="#ffffff"/><path d="M14 18v-4a6 6 0 0 1 12 0v4"/>'),
  check: icon('<path d="M9 21l7 7 15-16"/>'),
  trophy: icon('<path d="M13 8h14v8a7 7 0 0 1-14 0z" fill="#f9d85e"/><path d="M13 11H8c0 5 2 8 6 8M27 11h5c0 5-2 8-6 8M20 23v5M14 32h12"/>'),
}
