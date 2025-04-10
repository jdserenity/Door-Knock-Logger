import React, { useRef, useEffect, useState } from 'react';
import { useDrag } from '@use-gesture/react';
import { animated, useSpring } from '@react-spring/web';

// Helper function to format elapsed time
function formatElapsedTime(seconds) {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (remainingSeconds === 0) {
    return `${minutes}m`;
  }
  return `${minutes}m ${remainingSeconds}s`;
}

function LogItem({ log, previousTimestamp, onDelete }) {
  const [{ x }, api] = useSpring(() => ({ x: 0 }));
  const itemRef = useRef(null);
  const [itemWidth, setItemWidth] = useState(0);
  const windowWidth = window.innerWidth;
  
  // Measure item width on mount and resize
  useEffect(() => {
    const measureWidth = () => {
      if (itemRef.current) {
        setItemWidth(itemRef.current.offsetWidth);
      }
    };
    
    measureWidth();
    window.addEventListener('resize', measureWidth);
    return () => window.removeEventListener('resize', measureWidth);
  }, []);
  
  // Calculate threshold as 50% of item width
  const threshold = itemWidth * -0.5; // Negative because we're swiping left

  const bind = useDrag(({ down, movement: [mx], cancel, last }) => {
    // If released and dragged past 50% threshold
    if (last && mx < threshold) {
      console.log(`Threshold passed (${mx}px < ${threshold}px), triggering delete for ${log.timestamp}`);
      // Animate off-screen
      api.start({ 
        x: -windowWidth, 
        config: { tension: 200, friction: 30 }, 
        onRest: () => onDelete(log.timestamp)
      });
    }
    // If released but not past threshold, spring back
    else if (last) {
      console.log(`Threshold not met (${mx}px > ${threshold}px), returning to position`);
      api.start({ x: 0, config: { tension: 500, friction: 40 } });
    }
    // While actively dragging
    else {
      // Only allow left dragging (negative values)
      const dragX = Math.min(mx, 0); 
      api.start({ x: dragX, immediate: true });
    }
  }, {
    axis: 'x',
    filterTaps: true, 
    preventScroll: true,
  });
  
  // Calculate time display (elapsed or initial time)
  let timeDisplay = '--'; // Default
  if (previousTimestamp) {
    const current = new Date(log.timestamp);
    const previous = new Date(previousTimestamp);
    const diffSeconds = Math.round((current - previous) / 1000);
    if (!isNaN(diffSeconds) && diffSeconds >= 0) {
      timeDisplay = formatElapsedTime(diffSeconds); // No more "+"
    }
  } else {
    // For the first item, show its timestamp
    timeDisplay = new Date(log.timestamp).toLocaleTimeString([], { hour: 'numeric', minute:'2-digit' });
  }
  
  // Format status for display
  const formattedStatus = log.status.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <animated.div
      ref={itemRef}
      {...bind()} 
      style={{ x, touchAction: 'pan-y' }} 
      className="relative py-4 border-t border-gray-800 bg-gray-900 cursor-grab overflow-hidden"
    >
      <animated.div 
        className="absolute inset-0 bg-red-600 flex items-center justify-end pr-6 text-white font-bold z-0"
        style={{ 
          opacity: x.to(val => {
            // Calculate opacity based on percentage of threshold reached
            return Math.max(0, Math.min(1, Math.abs(val / threshold)));
          }),
          // Show full background when dragged enough
          transform: x.to(val => `translateX(${Math.max(0, -val)}px)`)
        }}
        aria-hidden="true"
      >
        Delete
      </animated.div> 
      
      <animated.div className="relative z-10 bg-gray-900 px-2">
        {/* Use CSS Grid: 1fr auto 1fr and add vertical padding */} 
        <div className="grid grid-cols-[1fr_auto_1fr] gap-x-2 items-center text-lg py-2" style={{ height: '3rem' }}>
           <span className="text-left truncate">{log.doorNumber}, {log.streetName}</span>
           <span className="text-center px-2">{formattedStatus}</span>
           <span className={`text-right text-gray-400 text-sm ${previousTimestamp ? 'italic' : ''}`}>{timeDisplay}</span>
        </div>
      </animated.div>
    </animated.div>
  );
}

export default LogItem; 