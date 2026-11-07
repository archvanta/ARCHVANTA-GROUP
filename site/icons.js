const paths = {
  grid: '<rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1"/><rect x="14" y="3.5" width="6.5" height="6.5" rx="1"/><rect x="3.5" y="14" width="6.5" height="6.5" rx="1"/><rect x="14" y="14" width="6.5" height="6.5" rx="1"/>',
  shield: '<path d="M12 22s7-3.5 7-10V6l-7-3-7 3v6c0 6.5 7 10 7 10Z"/><path d="m9 12 2 2 4-4"/>',
  tasks: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2m6 2V2M9 10h6m-6 5h6"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5zM3 12l9 5 9-5M3 16l9 5 9-5"/>',
  history: '<path d="M3 12a9 9 0 1 0 2.4-6.1L3 8m0-5v5h5m4-1v5l3 2"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  chevron: '<path d="m14 6-6 6 6 6"/>',
  arrow: '<path d="M20 12H4m6-6-6 6 6 6"/>',
  building: '<path d="M4 21h16M6 21V7l7-4v18m0-12h5v12M9 9v1m0 3v1m0 3v1m7-5v1m0 3v1"/>',
  user: '<circle cx="12" cy="8" r="3.2"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>',
  pulse: '<path d="M3 12h4l3-7 4 14 3-7h4"/>',
  check: '<path d="m5 12 5 5L20 7"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  pen: '<path d="m3 21 2-7L16.5 2.5l5 5L10 19zM5 14l5 5m3-13 5 5"/>',
  code: '<path d="m7 6-6 6 6 6m10-12 6 6-6 6m-3-15-4 18"/>',
  cube: '<path d="m12 2 9 5v10l-9 5-9-5V7zM3 7l9 5 9-5m-9 5v10"/>',
  book: '<path d="M12 6c-3-3-6-3-9-2v15c3-1 6-1 9 2 3-3 6-3 9-2V4c-3-1-6-1-9 2Zm0 0v15"/>',
  trend: '<path d="m3 17 6-6 4 4 8-8m-6 0h6v6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>',
};

export function icon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name]}</svg>`;
}
