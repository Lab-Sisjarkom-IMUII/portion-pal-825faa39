import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initPerformanceMonitoring } from "./lib/performanceMonitor";

// Remove Lovable badge and banner if they exist (injected by browser extension or IDE)
const removeLovableElements = () => {
  try {
    // Only run if root element exists (app hasn't loaded yet)
    const root = document.getElementById("root");
    if (!root) return;
    
    // Remove badge by ID (specific Lovable badge)
    const badgeById = document.getElementById("lovable-badge");
    if (badgeById && badgeById.parentNode) {
      badgeById.remove();
    }
    
    // Remove by class or other selectors (badge at bottom - very specific)
    const badges = document.querySelectorAll(
      '[id*="lovable"][id*="badge"], ' +
      'a[href*="lovable.dev"][href*="utm_source"], ' +
      '[class*="lovable"][class*="badge"]'
    );
    badges.forEach((badge) => {
      // Make sure it's not inside our root app
      if (badge.parentNode && !root.contains(badge)) {
        badge.remove();
      }
    });
    
    // Only check for banner if it's outside our root element
    // Look for elements that are direct children of body (not inside #root)
    const bodyChildren = Array.from(document.body.children);
    bodyChildren.forEach((child) => {
      // Skip our root element
      if (child.id === 'root') return;
      
      const text = child.textContent || '';
      // Very specific check: must have both PortionPal AND close button AND be outside root
      if (
        text.includes('PortionPal') && 
        text.includes('Ukur Porsi Sehat') &&
        child.querySelector('button, [class*="close"], [class*="dismiss"], [aria-label*="close"]') &&
        !root.contains(child)
      ) {
        // Additional safety: check if it has Lovable-specific attributes
        const hasLovableLink = child.querySelector('a[href*="lovable.dev"]');
        
        const hasLovableId = child.id?.includes('lovable');
        if (hasLovableLink || hasLovableId) {
          child.remove();
        }
      }
    });
    
    // Monitor for dynamically added elements (only outside root)
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) { // Element node
            const element = node as Element;
            
            // Skip if inside our root
            if (root.contains(element)) return;
            
            // Check for badge (very specific selectors)
            if (
              element.id === "lovable-badge" ||
              (element.id?.includes("lovable") && element.id?.includes("badge")) ||
              (element.tagName === "A" && element.getAttribute("href")?.includes("lovable.dev") && element.getAttribute("href")?.includes("utm_source"))
            ) {
              element.remove();
              return;
            }
            
            // Check for banner (must be outside root and have specific characteristics)
            const text = element.textContent || '';
            if (
              text.includes('PortionPal') && 
              text.includes('Ukur Porsi Sehat') &&
              element.querySelector('button, [class*="close"], [class*="dismiss"]') &&
              (element.querySelector('a[href*="lovable.dev"]') || element.id?.includes('lovable'))
            ) {
              element.remove();
            }
          }
        });
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: false, // Only watch direct children, not deep nesting
    });
    
    // Clean up observer after 10 seconds
    setTimeout(() => {
      observer.disconnect();
    }, 10000);
  } catch (error) {
    // Silently fail - don't break the app
    console.warn('Error removing Lovable elements:', error);
  }
};

// Remove badge and banner immediately and set up observer
removeLovableElements();

// Also try to remove them after DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", removeLovableElements);
} else {
  removeLovableElements();
}

// Initialize performance monitoring
initPerformanceMonitoring();

// PWA Service Worker Registration & Update Notification
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      if (import.meta.env.DEV) {
        console.log('✅ Service Worker registered:', registration.scope);
      }

      // Check for updates every hour
      setInterval(() => {
        registration.update();
      }, 60 * 60 * 1000);

      // Listen for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available
              if (import.meta.env.DEV) {
                console.log('🔄 New version available');
              }
              // Show update notification (optional - can be customized)
              if (confirm('New version available! Reload to update?')) {
                window.location.reload();
              }
            }
          });
        }
      });
    }).catch((error) => {
      if (import.meta.env.DEV) {
        console.warn('⚠️ Service Worker registration failed:', error);
      }
    });
  });
}

// Ensure dark mode is completely removed
document.documentElement.classList.remove('dark');
document.documentElement.removeAttribute('data-theme');
// Clear any theme from localStorage
localStorage.removeItem('theme');

createRoot(document.getElementById("root")!).render(<App />);
