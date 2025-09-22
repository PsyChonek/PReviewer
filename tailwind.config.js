/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./renderer.js",
    "./*.html",
    "./*.js"
  ],
  safelist: [
    'modal',
    'modal-box',
    'modal-backdrop',
    'modal-action',
    'btn',
    'btn-primary',
    'btn-secondary',
    'input',
    'select',
    'textarea',
    'label',
    'form-control',
    'prose',
    'prose-sm',
    'max-w-none',
    'dark:prose-invert'
  ],
  theme: {
    extend: {},
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('daisyui'),
  ],
  daisyui: {
    themes: ["light", "dark"],
  },
}
