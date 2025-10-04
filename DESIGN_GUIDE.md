# PReviewer Design Style Guide

This document outlines the design patterns, styling conventions, and component guidelines for the PReviewer application.

## Technology Stack

- **Framework**: React 19 with TypeScript
- **Styling**: Tailwind CSS 4 + DaisyUI 5
- **Icons**: Font Awesome
- **Build Tool**: Vite
- **Platform**: Electron (Desktop App)

## Color Scheme & Theming

### Base Theme

- Uses DaisyUI theme system
- Default theme with info/warning/error/success variants
- Supports light/dark mode through DaisyUI

### Semantic Colors

- **Primary Actions**: `btn-success` (green) - Start Review, positive actions
- **Secondary Actions**: `btn-primary` (blue) - Review Uncommitted, alternate actions
- **Destructive Actions**: `btn-error` (red) - Delete, remove actions
- **Warning Actions**: `btn-warning` (yellow/orange) - Stop Review, cancel actions
- **Neutral Actions**: `btn-ghost` - Cancel, close, dismiss
- **Info Alerts**: `alert-info` (blue) - Active worktree, information displays

## Typography

### Font Stack

- System font stack via Tailwind CSS defaults
- Monospace for code: `font-mono` or `<code>` elements

### Font Sizes

- **Headings**:
  - `text-2xl` - Main section titles (Repository & Branches)
  - `text-lg` - Modal titles
  - `font-bold` - All headings
- **Body Text**: Default Tailwind text size
- **Small Text**: `text-sm` - Helper text, metadata
- **Extra Small**: `text-xs` - Inline code, paths, timestamps

## Components

### Buttons

#### Standard Buttons

```tsx
// Primary action
<button className="btn btn-success btn-lg">
  <i className="fas fa-rocket"></i> Start AI Review
</button>

// Secondary action
<button className="btn btn-primary btn-lg">
  <i className="fas fa-file-code"></i> Review Uncommitted
</button>

// Small utility buttons (toolbar)
<button className="btn btn-sm">
  <i className="fas fa-icon"></i>
  Label
</button>

// Destructive action
<button className="btn btn-error btn-sm">
  <i className="fas fa-trash"></i>
  Delete
</button>

// Ghost/Cancel button
<button className="btn btn-ghost">
  <i className="fas fa-times"></i>
  Close
</button>
```

#### Button States

- **Disabled**: Use `btn-disabled` class + `disabled` attribute
- **Loading**: Show spinner with loading text

```tsx
{
	isLoading ? (
		<>
			<span className="loading loading-spinner loading-sm"></span>
			Loading...
		</>
	) : (
		<>
			<i className="fas fa-icon"></i>
			Action
		</>
	);
}
```

### Cards & Containers

#### Card Structure

```tsx
<div className="card bg-base-200 shadow-xl">
	<div className="card-body">
		<h2 className="card-title">Title</h2>
		{/* Content */}
	</div>
</div>
```

#### Alert/Info Boxes

```tsx
<div className="alert alert-info shadow-lg mb-6 w-full">
	<svg>{/* Icon */}</svg>
	<div className="flex-1 min-w-0">
		<h3 className="font-bold mb-2">Title</h3>
		{/* Content */}
	</div>
	<button className="btn btn-sm">Action</button>
</div>
```

### Modals

#### Modal Structure

```tsx
<div className="modal modal-open">
	<div className="modal-box max-w-4xl">
		<h3 className="font-bold text-lg mb-4">Modal Title</h3>

		{/* Content */}

		<div className="modal-action">
			<button className="btn btn-ghost" onClick={onClose}>
				<i className="fas fa-times"></i>
				Close
			</button>
		</div>
	</div>
</div>
```

### Form Elements

#### Input Fields

```tsx
<div className="form-control">
	<label className="label" htmlFor="input-id">
		<span className="label-text font-medium">Label</span>
	</label>
	<input type="text" id="input-id" className="input input-bordered flex-1" placeholder="Placeholder..." aria-describedby="input-help" />
	<div id="input-help" className="label-text-alt text-sm text-gray-500 mt-1">
		Helper text
	</div>
</div>
```

#### Dropdowns/Selects

- Use custom `BranchSelector` component for branch selection
- Use DaisyUI dropdown components for other selects

### Layout Patterns

#### Section Header with Actions

```tsx
<div className="flex justify-between items-center mb-4">
	<h2 className="card-title text-2xl">
		<svg className="h-6 w-6">{/* Icon */}</svg>
		Section Title
	</h2>
	<div className="flex gap-2">
		<button className="btn btn-sm">Action 1</button>
		<button className="btn btn-sm">Action 2</button>
	</div>
</div>
```

#### Two-Column Grid

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
	<div>{/* Column 1 */}</div>
	<div>{/* Column 2 */}</div>
</div>
```

#### Flex Wrap Info Display

```tsx
<div className="flex flex-wrap gap-x-8 gap-y-1 text-sm">
	<div>
		<strong>Label:</strong> Value
	</div>
	<div>
		<strong>Label:</strong> Value
	</div>
	<div className="w-full">{/* Full width item */}</div>
</div>
```

## Icons

### Font Awesome Classes

- **Actions**: `fa-rocket` (start), `fa-stop` (stop), `fa-trash` (delete), `fa-times` (close)
- **Git**: `fa-code-branch` (worktree), `fa-code-compare` (diff), `fa-git-alt` (git)
- **Files**: `fa-file-code` (code), `fa-folder-open` (browse), `fa-calculator` (calculate)
- **UI**: `fa-cog` (settings), `fa-refresh` (refresh), `fa-info-circle` (info)

### Icon Usage

- Always pair icons with text labels on buttons
- Use `className="h-6 w-6"` for section header icons
- Font Awesome icons automatically size with button text

## Spacing & Sizing

### Margins

- Section spacing: `mb-6` between major sections
- Element spacing: `mb-4` within sections
- Small gaps: `gap-2` for button groups, `gap-4` for form elements

### Padding

- Card body: Use DaisyUI `card-body` (handles padding automatically)
- Custom padding: `p-4` for compact cards, `px-4 py-6` for page containers

### Container Widths

- Main container: `max-w-7xl mx-auto`
- Modal: `max-w-4xl` for large modals, `max-w-2xl` for medium
- Full width: `w-full` for elements that should stretch

## Responsive Design

### Breakpoints (Tailwind defaults)

- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px

### Patterns

```tsx
// Responsive grid
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">

// Responsive text
<div className="text-sm md:text-base">

// Show/hide on mobile
<div className="hidden md:block">
```

## Accessibility

### ARIA Labels

- Always provide `aria-label` for icon-only buttons
- Use `aria-describedby` for input help text
- Use `role="main"` for main content area

### Keyboard Navigation

- All interactive elements must be keyboard accessible
- Maintain logical tab order
- Modal focus management (trap focus when open)

### Screen Readers

- Use semantic HTML (`<main>`, `<nav>`, `<button>`)
- Provide text alternatives for icons
- Use `aria-live="polite"` for dynamic content

## State Handling

### Loading States

```tsx
{isLoading ? (
  <div className="flex justify-center py-8">
    <span className="loading loading-spinner loading-lg"></span>
  </div>
) : (
  // Content
)}
```

### Empty States

```tsx
<div className="alert alert-info">
	<svg>{/* Icon */}</svg>
	<span>No items found.</span>
</div>
```

### Error States

```tsx
<div className="alert alert-error">
	<svg>{/* Warning icon */}</svg>
	<div>
		<h3 className="font-bold">Error Title</h3>
		<div className="text-sm">Error description</div>
	</div>
</div>
```

## Code Formatting

### File Paths

```tsx
<code className="text-xs break-all">{filePath}</code>
```

### Inline Code

```tsx
<code className="text-xs">value</code>
```

### Code Blocks (in markdown output)

- Use triple backticks with language identifier
- Syntax highlighting handled by `marked` library

## Animation & Transitions

### DaisyUI Loading Spinners

- `loading-spinner loading-sm` - Small buttons
- `loading-spinner loading-md` - Medium elements
- `loading-spinner loading-lg` - Large loading states

### Custom Transitions

- Avoid custom animations unless necessary
- Rely on DaisyUI's built-in transitions

## Best Practices

### Component Organization

1. Import statements (React, types, components, utils)
2. Interface/type definitions
3. Component function
4. Helper functions at bottom
5. Export statement

### Styling Approach

- Use Tailwind utility classes directly in JSX
- Avoid inline styles unless absolutely necessary
- Use DaisyUI components for consistency
- Keep class names readable with proper line breaks

### Conditional Classes

```tsx
// Use template literals for conditional classes
className={`btn btn-sm ${isDisabled ? 'btn-disabled' : ''}`}

// For complex conditions, extract to variable
const buttonClasses = `btn btn-lg ${
  reviewInProgress ? 'btn-warning' : 'btn-success'
}`;
```

### Consistency Checklist

- [ ] All buttons have icons + text
- [ ] All buttons use consistent sizing (`btn-sm` for toolbars, `btn-lg` for primary actions)
- [ ] Modal close buttons use `btn-ghost` with close icon
- [ ] Loading states show spinner + text
- [ ] Disabled states use both class and attribute
- [ ] Form inputs have labels and help text
- [ ] Interactive elements have proper ARIA labels

## File Structure

```
src/
├── components/
│   ├── layout/          # Navbar, Footer
│   ├── repository/      # Repository section components
│   ├── review/          # Review section components
│   └── config/          # Configuration components
├── store/               # Zustand state stores
├── utils/               # Utility functions
├── types.ts            # TypeScript type definitions
└── App.tsx             # Main application component
```

## Review Process

Before committing UI changes:

1. Run `npm run check` (lint, format, type check)
2. Verify button consistency
3. Test responsive behavior (resize window)
4. Check keyboard navigation
5. Verify loading/error states work correctly
6. Ensure ARIA labels are present
