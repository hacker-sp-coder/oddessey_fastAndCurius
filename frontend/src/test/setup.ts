import '@testing-library/jest-dom/vitest';

// Polyfill window.scrollTo if missing in jsdom
if (typeof window !== 'undefined') {
  window.scrollTo = () => {};
}
