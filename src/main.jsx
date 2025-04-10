import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Add focus management to remove focus from buttons after click
document.addEventListener('click', (e) => {
  if (e.target.tagName === 'BUTTON') {
    // Remove focus from the button after a shorter delay
    setTimeout(() => {
      e.target.blur();
    }, 100); // Faster fade-out delay (adjust if needed)
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
