import '@testing-library/jest-dom';

// Polyfill window.scrollTo if missing in jsdom
if (typeof window !== 'undefined') {
  window.scrollTo = () => {};
}
