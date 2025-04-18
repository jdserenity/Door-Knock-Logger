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

// Helper to format date as DD/MM/YY
function formatDate(dateString) {
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear().toString().slice(-2);
  return `${day}/${month}/${year}`;
}

function LogItem({ log, previousTimestamp, previousLogIsFirstEntry, onDelete }) {
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
    // If this is the first entry, don't allow dragging
    if (log.isFirstEntry) {
      return;
    }
    
    // If released and dragged past 50% threshold
    if (last && mx < threshold) {
      console.log(`Threshold passed (${mx}px < ${threshold}px), triggering delete for log`, log);
      // Animate off-screen
      api.start({ 
        x: -windowWidth, 
        config: { tension: 200, friction: 30 }, 
        onRest: () => onDelete(log)
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
  
  if (log.isFirstEntry) {
    // 1. Automatic First Entry (from previous day)
    timeDisplay = formatDate(log.originalDate || log.date); 
  } else if (previousLogIsFirstEntry) {
    // 2. First Manual Entry of the day
    timeDisplay = new Date(log.timestamp).toLocaleTimeString([], { hour: 'numeric', minute:'2-digit' });
  } else if (previousTimestamp) {
    // 3. Subsequent Manual Entries
    const current = new Date(log.timestamp);
    const previous = new Date(previousTimestamp);
    const diffSeconds = Math.round((current - previous) / 1000);
    if (!isNaN(diffSeconds) && diffSeconds >= 0) {
      timeDisplay = formatElapsedTime(diffSeconds);
    }
  } else {
     // Fallback for the very first manual log if the automatic one somehow wasn't there
     timeDisplay = new Date(log.timestamp).toLocaleTimeString([], { hour: 'numeric', minute:'2-digit' });
  }
  
  // Format status for display
  const formattedStatus = log.status.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  
  // Special styling for first entry
  const bgColorClass = log.isFirstEntry 
    ? "relative py-4 border-t border-gray-800 bg-gray-800 cursor-default overflow-hidden" 
    : "relative py-4 border-t border-gray-800 bg-gray-900 cursor-grab overflow-hidden";

  return (
    <animated.div
      ref={itemRef}
      {...(log.isFirstEntry ? {} : bind())} 
      style={{ x, touchAction: 'pan-y' }} 
      className={bgColorClass}
    >
      <animated.div 
        className="absolute inset-0 bg-red-600 flex items-center justify-end pr-6 text-white font-bold z-0"
        style={{ 
          opacity: x.to(val => {
            // Only show when intentionally dragging (val < 0)
            return val < -5 ? Math.max(0, Math.min(1, Math.abs(val / threshold))) : 0;
          }),
          // Show full background when dragged enough
          transform: x.to(val => `translateX(${Math.max(0, -val)}px)`)
        }}
        aria-hidden="true"
      >
        Delete
      </animated.div> 
      
      <animated.div className={`relative z-10 ${log.isFirstEntry ? 'bg-gray-800' : 'bg-gray-900'} px-2`}>
        {/* Use CSS Grid: 1fr auto 1fr and add vertical padding */} 
        <div className="grid grid-cols-[1fr_auto_1fr] gap-x-2 items-center text-lg py-2" style={{ height: '3rem' }}>
           <span className="text-left truncate">{log.doorNumber}, {log.streetName}</span>
           <span className="text-center px-2">{formattedStatus}</span>
           <span className={`text-right text-gray-400 text-sm ${log.isFirstEntry ? 'font-semibold' : previousTimestamp ? 'italic' : ''}`}>{timeDisplay}</span>
        </div>
      </animated.div>
    </animated.div>
  );
}

export default LogItem; 