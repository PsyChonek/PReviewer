import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

// Simple test component to verify React is working
const TestApp = () => {
  return (
    <div style={{ padding: '20px', background: 'white', color: 'black' }}>
      <h1>React is Working!</h1>
      <p>If you can see this, React and HMR are functioning.</p>
      <button onClick={() => alert('Button works!')}>Test Button</button>
    </div>
  );
};

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element not found');
}

console.log('About to render React app');
const root = createRoot(container);
root.render(<TestApp />);
console.log('React app rendered');