import '@testing-library/jest-dom/vitest'

// jsdom nem implementál URL.createObjectURL / revokeObjectURL-t — stub a teszthez.
if (typeof URL.createObjectURL !== 'function') {
  let n = 0
  Object.defineProperty(URL, 'createObjectURL', {
    writable: true,
    value: () => `blob:fake/${n++}`,
  })
}
if (typeof URL.revokeObjectURL !== 'function') {
  Object.defineProperty(URL, 'revokeObjectURL', {
    writable: true,
    value: () => {},
  })
}
