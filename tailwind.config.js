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
    'form-control'
  ],
  theme: {
    extend: {},
  },
  plugins: [
    require('daisyui'),
  ],
  daisyui: {
    themes: ["light", "dark"],
  },
}
