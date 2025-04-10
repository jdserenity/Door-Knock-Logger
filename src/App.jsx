import { useState, useEffect, useCallback } from 'react';
import LogItem from './LogItem'; // Import the new component

// Helper function to format date as YYYY-MM-DD
const getISODate = (date = new Date()) => {
  return date.toISOString().split('T')[0];
};

// Helper function to get 30-min interval string (e.g., "14:00")
const getCurrentInterval = (date = new Date()) => {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const intervalMinutes = Math.floor(minutes / 30) * 30;
  return `${String(hours).padStart(2, '0')}:${String(intervalMinutes).padStart(2, '0')}`;
};

// Simple Modal Component
function Modal({ isOpen, onClose, children }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4">
      <div className="bg-gray-800 p-6 rounded-lg shadow-xl max-w-sm w-full">
        {children}
        {/* Close button is now added within the modal content where needed */}
      </div>
    </div>
  );
}

function App() {
  const [doorNumber, setDoorNumber] = useState('1');
  const [isEditingNumber, setIsEditingNumber] = useState(false);
  const [streetName, setStreetName] = useState('Maple Avenue');
  const [isEditingStreet, setIsEditingStreet] = useState(false);
  const [logs, setLogs] = useState([]);
  
  // --- New State ---
  const [dailyQuestions, setDailyQuestions] = useState(null); // { groomed: 'Yes' | 'No', mood: 'Yes' | 'No', jacket: 'Yes' | 'No' } | null
  const [lastStartDate, setLastStartDate] = useState(null); // 'YYYY-MM-DD' | null
  const [showStartDayModal, setShowStartDayModal] = useState(false);
  const [intervalWeatherCache, setIntervalWeatherCache] = useState({}); // { 'YYYY-MM-DD_HH:MM': { temp: number, condition: string, fetchedAt: timestamp } }
  const [isDayStarted, setIsDayStarted] = useState(false); // NEW state to control UI visibility *within* the session
  const [uiMessage, setUiMessage] = useState({ text: '', type: '' }); // For temporary messages (e.g., errors, success)

  // Get the queue from localStorage
  const getQueue = () => {
    const queue = localStorage.getItem('logQueue');
    return queue ? JSON.parse(queue) : [];
  };

  // --- LocalStorage and Initial Load ---
  useEffect(() => {
    // Load non-daily state
    const savedLogs = localStorage.getItem('logs');
    if (savedLogs) setLogs(JSON.parse(savedLogs));
    const savedStreet = localStorage.getItem('streetName');
    if (savedStreet) setStreetName(savedStreet);
    const savedNumber = localStorage.getItem('doorNumber');
    if (savedNumber) setDoorNumber(savedNumber);
    const savedWeatherCache = localStorage.getItem('intervalWeatherCache');
    if (savedWeatherCache) setIntervalWeatherCache(JSON.parse(savedWeatherCache));

    // Load daily state *without* setting isDayStarted based on it
    const savedLastStartDate = localStorage.getItem('lastStartDate');
    const savedDailyQuestions = localStorage.getItem('dailyQuestions');
    const today = getISODate();

    if (savedLastStartDate === today && savedDailyQuestions) {
      // Load the data into state, but DON'T set isDayStarted here
      setDailyQuestions(JSON.parse(savedDailyQuestions));
      setLastStartDate(savedLastStartDate); // Keep track of the last actual start date
      console.log("Loaded data for already started day, but requires manual start in this session (for testing).");
      // setIsDayStarted(true); // <--- REMOVED THIS LINE
    } else {
      // If it's a new day or data is missing, clear potentially stale daily data
      console.log("New day or missing daily data. Requires 'Start Day'.");
      setIsDayStarted(false); // Ensure session state is false
      setDailyQuestions(null);
      localStorage.removeItem('dailyQuestions');
      // Optionally clear weather cache for a new day
      // setIntervalWeatherCache({});
      // localStorage.removeItem('intervalWeatherCache');
    }

  }, []); // Run only on mount

  const handleNumberChange = (e) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    if (value) {
      setDoorNumber(value);
      localStorage.setItem('doorNumber', value);
    }
  };

  const handleStreetNameChange = (e) => {
    setStreetName(e.target.value);
    localStorage.setItem('streetName', e.target.value);
  };

  const incrementNumber = () => {
    const newValue = String(Number(doorNumber) + 1);
    setDoorNumber(newValue);
    localStorage.setItem('doorNumber', newValue);
  };

  const decrementNumber = () => {
    const newValue = String(Math.max(1, Number(doorNumber) - 1));
    setDoorNumber(newValue);
    localStorage.setItem('doorNumber', newValue);
  };

  // --- Start Day Logic ---
  const handleStartDaySubmit = (answers) => {
    const today = getISODate();
    setDailyQuestions(answers);
    setLastStartDate(today); // Keep track of the actual start date
    setIsDayStarted(true); // Update the session state

    // Persist to localStorage
    localStorage.setItem('dailyQuestions', JSON.stringify(answers));
    localStorage.setItem('lastStartDate', today);
    
    setShowStartDayModal(false); // Close modal
    console.log("Day started with answers:", answers);

    // Clear logs state and storage for the new day
    setLogs([]); 
    localStorage.removeItem('logs');
    console.log("UI Logs cleared for the new day.");
  };

  // Component for Modal Content
  const StartDayModalContent = () => {
    const [answers, setAnswers] = useState({ groomed: 'Yes', mood: 'Yes', jacket: 'No' });

    const handleChange = (e) => {
      setAnswers({ ...answers, [e.target.name]: e.target.value });
    };

    return (
      <form onSubmit={(e) => { e.preventDefault(); handleStartDaySubmit(answers); }}>
        <h2 className="text-2xl font-bold mb-6 text-center">Daily Check-in</h2>
        
        <fieldset className="mb-5">
          <legend className="mb-2 font-medium">Are you groomed well today?</legend>
          <div className="flex gap-x-4">
             <label className="flex items-center gap-x-2"><input type="radio" name="groomed" value="Yes" checked={answers.groomed === 'Yes'} onChange={handleChange} className="form-radio h-4 w-4 text-blue-600"/> Yes</label>
             <label className="flex items-center gap-x-2"><input type="radio" name="groomed" value="No" checked={answers.groomed === 'No'} onChange={handleChange} className="form-radio h-4 w-4 text-blue-600"/> No</label>
          </div>
        </fieldset>

        <fieldset className="mb-5">
            <legend className="mb-2 font-medium">Are you in a good mood?</legend>
            <div className="flex gap-x-4">
              <label className="flex items-center gap-x-2"><input type="radio" name="mood" value="Yes" checked={answers.mood === 'Yes'} onChange={handleChange} className="form-radio h-4 w-4 text-blue-600"/> Yes</label>
              <label className="flex items-center gap-x-2"><input type="radio" name="mood" value="No" checked={answers.mood === 'No'} onChange={handleChange} className="form-radio h-4 w-4 text-blue-600"/> No</label>
            </div>
        </fieldset>

        <fieldset className="mb-6">
           <legend className="mb-2 font-medium">Jacket covering company shirt?</legend>
           <div className="flex gap-x-4">
              <label className="flex items-center gap-x-2"><input type="radio" name="jacket" value="Yes" checked={answers.jacket === 'Yes'} onChange={handleChange} className="form-radio h-4 w-4 text-blue-600"/> Yes</label>
              <label className="flex items-center gap-x-2"><input type="radio" name="jacket" value="No" checked={answers.jacket === 'No'} onChange={handleChange} className="form-radio h-4 w-4 text-blue-600"/> No</label>
           </div>
        </fieldset>
        
        <button type="submit" className="w-full bg-green-600 text-white py-2 px-4 rounded-lg text-lg hover:bg-green-500">Confirm</button>
         <button 
            type="button" // Important: Prevents form submission
            onClick={() => setShowStartDayModal(false)} 
            className="mt-3 w-full bg-gray-600 text-white py-2 px-4 rounded-lg text-lg hover:bg-gray-500"
          >
            Cancel
        </button>
      </form>
    );
  };

  // --- Weather Fetching Logic ---
  const fetchWeather = useCallback(async (date) => {
      const interval = getCurrentInterval(date);
      const cacheKey = `${getISODate(date)}_${interval}`; // Cache key includes date and interval
      const now = Date.now();
      const cacheEntry = intervalWeatherCache[cacheKey];

      // Use cache if valid (e.g., fetched within the last 30 minutes)
      if (cacheEntry && (now - cacheEntry.fetchedAt < 30 * 60 * 1000)) {
          console.log(`Using cached weather for ${cacheKey}`);
          return cacheEntry;
      }

      console.log(`Fetching new weather for ${cacheKey}`);
      const apiKey = import.meta.env.VITE_OPENWEATHERMAP_API_KEY;
      if (!apiKey) {
          console.error("OpenWeatherMap API key missing: VITE_OPENWEATHERMAP_API_KEY");
          return { temp: null, condition: 'API Key Missing', fetchedAt: now };
      }

      // Hardcoded coordinates (New York City) - Replace with dynamic if needed
      const lat = 40.7128;
      const lon = -74.0060;
      const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;

      try {
          const response = await fetch(url);
          if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
          }
          const data = await response.json();
          const weatherData = {
              temp: data.main?.temp !== undefined ? Math.round(data.main.temp) : null, // Round temperature
              condition: data.weather?.[0]?.main || 'Unknown', // e.g., Clouds, Rain, Clear
              fetchedAt: now
          };

          // Update cache state and localStorage
          const newCache = { ...intervalWeatherCache, [cacheKey]: weatherData };
          setIntervalWeatherCache(newCache);
          localStorage.setItem('intervalWeatherCache', JSON.stringify(newCache)); // Persist cache

          return weatherData;
      } catch (error) {
          console.error("Error fetching weather:", error);
          return { temp: null, condition: 'Fetch Error', fetchedAt: now }; // Return placeholder on error
      }
  }, [intervalWeatherCache]); // Re-create function if cache changes

  const handleSubmit = async (status) => {
    // Ensure day has been started
    if (!isDayStarted) {
      console.warn("Attempted to log before starting the day.");
      setUiMessage({ text: "Please start your day first.", type: 'error' });
      setTimeout(() => setUiMessage({ text: '', type: '' }), 3000); // Clear after 3s
      return;
    }

    // --- Client-side Duplicate Check ---
    const isDuplicate = logs.some(l => l.doorNumber === doorNumber && l.streetName === streetName);
    if (isDuplicate) {
      console.warn(`Duplicate entry detected: ${doorNumber}, ${streetName}`);
      setUiMessage({ text: "Duplicate entry: This address was already logged today.", type: 'error' });
      setTimeout(() => setUiMessage({ text: '', type: '' }), 300); // Changed from 4000 to 400ms
      return; // Prevent submission
    }

    // Ensure daily questions are loaded
    if (!dailyQuestions) {
      const savedQs = localStorage.getItem('dailyQuestions');
      if (savedQs) {
        setDailyQuestions(JSON.parse(savedQs));
      } else {
        alert("Daily questions missing. Please restart the day.");
        setIsDayStarted(false);
        return;
      }
    }

    const timestamp = new Date();
    const interval = getCurrentInterval(timestamp);
    const dayOfWeek = timestamp.toLocaleDateString('en-US', { weekday: 'short' });

    const weather = await fetchWeather(timestamp);
    const currentDailyQuestions = dailyQuestions || JSON.parse(localStorage.getItem('dailyQuestions') || '{}');

    const log = {
      date: getISODate(timestamp),
      dayOfWeek,
      streetName,
      doorNumber,
      status,
      timestamp: timestamp.toISOString(),
      interval,
      weather: { temp: weather.temp, condition: weather.condition },
      dailyQuestions: currentDailyQuestions
    };

    console.log("Submitting Log:", log);
    const newLogs = [log, ...logs];
    setLogs(newLogs);
    localStorage.setItem('logs', JSON.stringify(newLogs));

    // --- Send to Backend (No change here needed for duplicate check) ---
    if (navigator.onLine) {
      try {
        const response = await fetch('/.netlify/functions/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(log),
        });
        if (!response.ok) {
          // Attempt to parse error from backend
          let backendError = `Server error: ${response.status}`;
          try { 
            const errorData = await response.json();
            backendError = errorData.error || errorData.message || backendError;
          } catch(e) { /* Ignore if response not json */ }
          
          // Set UI message about backend error
          setUiMessage({ text: `Backend Error: ${backendError}`, type: 'error' });
          setTimeout(() => setUiMessage({ text: '', type: '' }), 5000);
          
          // Note: We don't revert UI optimistically here, relies on sync logic/user action
          console.error('Backend error, adding to queue potentially:', backendError);
          // Add to queue even on backend error, sync will retry
          const currentQueue = getQueue();
          localStorage.setItem('logQueue', JSON.stringify([...currentQueue, log]));
        } else {
          console.log("Log sent successfully to backend.");
          // Optional: Clear UI message on success?
          // setUiMessage({ text: 'Log saved!', type: 'success' });
          // setTimeout(() => setUiMessage({ text: '', type: '' }), 2000);
        }
      } catch (error) {
        console.error('Send/Network error, adding to queue:', error);
        setUiMessage({ text: 'Network Error: Log queued.', type: 'warning' });
        setTimeout(() => setUiMessage({ text: '', type: '' }), 3000);
        const currentQueue = getQueue();
        localStorage.setItem('logQueue', JSON.stringify([...currentQueue, log]));
      }
    } else {
      const currentQueue = getQueue();
      localStorage.setItem('logQueue', JSON.stringify([...currentQueue, log]));
      console.log('Offline: Log added to queue');
      setUiMessage({ text: 'Offline: Log queued.', type: 'warning' });
      setTimeout(() => setUiMessage({ text: '', type: '' }), 3000);
    }
  };

  // --- Syncing Logic (Updated) ---
  useEffect(() => {
    const syncLogs = async () => {
      const queue = getQueue(); // Use helper function
      if (queue.length === 0 || !navigator.onLine) return;

      console.log(`Syncing ${queue.length} logs...`);
      let remainingQueue = [...queue]; // Copy queue to modify

      for (let i = 0; i < queue.length; i++) {
        const log = queue[i];
        try {
          const response = await fetch('/.netlify/functions/log', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(log), // Send the full log object from the queue
            });
            if (response.ok) {
             console.log(`Synced queued log: ${log.timestamp}`);
             // Remove successfully synced log from our temporary queue copy
             remainingQueue = remainingQueue.filter(item => item.timestamp !== log.timestamp);
          } else {
             const errorData = await response.text();
             console.error(`Sync server error for queued log ${log.timestamp}:`, response.status, errorData);
             // Keep failed log in remainingQueue (it's already there)
          }
        } catch (error) {
          console.error(`Sync network error for queued log ${log.timestamp}:`, error);
          // Keep failed log in remainingQueue
          // Potentially break or add delay here if network is consistently failing
           break; // Stop syncing this cycle on first network error
        }
      }
      
      // Update the queue in localStorage with only the logs that failed or weren't attempted
      if (remainingQueue.length !== queue.length) { // Only update if something changed
          localStorage.setItem('logQueue', JSON.stringify(remainingQueue));
          console.log(`Sync attempt complete. ${queue.length - remainingQueue.length} logs synced. ${remainingQueue.length} logs remain queued.`);
      } else {
          console.log("Sync attempt complete. No logs were synced in this cycle.");
      }
    };

    // Listener for online event
    window.addEventListener('online', syncLogs);
    
    // Initial sync attempt on load
    syncLogs();

    // Cleanup listener on unmount
    return () => window.removeEventListener('online', syncLogs);
  }, []); // Empty dependency array - runs once on mount

  // --- Deletion Handler ---
  const handleDeleteLog = async (timestampToDelete) => {
    console.log("Initiating delete for log:", timestampToDelete);

    // 1. Optimistically remove from UI state
    const originalLogs = [...logs]; // Keep a copy in case backend fails
    const updatedLogs = logs.filter(log => log.timestamp !== timestampToDelete);
    setLogs(updatedLogs);

    // 2. Remove from local storage log history
    localStorage.setItem('logs', JSON.stringify(updatedLogs));

    // 3. Attempt to delete from backend (Google Sheet)
    try {
      const response = await fetch('/.netlify/functions/delete-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timestampToDelete }),
      });

      if (!response.ok) {
        // Get detailed error message
        let errorMessage = 'Unknown error';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || `Error: ${response.status}`;
          console.error('Backend delete failed:', response.status, errorData);
        } catch (e) {
          // If response isn't valid JSON
          errorMessage = `Server error (${response.status})`;
          console.error('Backend delete failed with non-JSON response:', response.status);
        }
        
        // Only show alert for non-404 errors (404 = item not found, which is expected sometimes)
        if (response.status !== 404) {
          alert(`Failed to delete log from sheet: ${errorMessage}`);
        } else {
          console.warn(`Item with timestamp ${timestampToDelete} not found in sheet but was deleted from UI`);
        }
        
        // Don't revert the UI for 404s - we want to remove items that don't exist in the backend
        if (response.status !== 404) {
          setLogs(originalLogs); // Restore original logs in UI
          localStorage.setItem('logs', JSON.stringify(originalLogs)); // Restore local storage
        }
      } else {
        console.log("Log successfully deleted from backend.");
        // Optionally, clean up the offline queue too
        const currentQueue = getQueue();
        const updatedQueue = currentQueue.filter(log => log.timestamp !== timestampToDelete);
        if (currentQueue.length !== updatedQueue.length) {
          localStorage.setItem('logQueue', JSON.stringify(updatedQueue));
          console.log('Removed deleted log from offline queue.');
        }
      }
    } catch (error) {
      // Network or other fetch error
      console.error('Network error during delete:', error);
      
      // Check if we're offline - if so, don't revert UI (will sync when online)
      if (!navigator.onLine) {
        console.log('Device is offline. UI changes maintained, will try to sync when online.');
      } else {
        alert('Network error: Failed to communicate with server to delete log.');
        setLogs(originalLogs); // Restore original logs
        localStorage.setItem('logs', JSON.stringify(originalLogs)); // Restore local storage
      }
    }
  };

  // --- Render Logic ---
  // Removed: const today = getISODate(); 
  // We use the isDayStarted state variable now for immediate UI control

  return (
    <div className="flex justify-center items-start min-h-screen bg-gray-900 text-white overflow-hidden pt-6 pb-6">
      {/* Modal for Start Day */}
      <Modal isOpen={showStartDayModal} onClose={() => setShowStartDayModal(false)}>
          <StartDayModalContent />
      </Modal>

      <div className={`w-full max-w-[390px] mx-auto px-6 flex flex-col h-screen ${showStartDayModal ? 'invisible' : ''}`}>
        {/* Fixed Header Area (Your existing UI) */}
        <div className="text-center flex-shrink-0">
          <h1 className="text-6xl font-bold mb-8">RLDLS</h1>
          
          <div 
            className="cursor-pointer mb-8"
            onClick={() => setIsEditingStreet(true)}
          >
            {isEditingStreet ? (
              <input
                type="text"
                value={streetName}
                onChange={handleStreetNameChange}
                onBlur={() => setIsEditingStreet(false)}
                onKeyDown={(e) => e.key === 'Enter' && setIsEditingStreet(false)}
                className="text-4xl text-center w-full bg-transparent border-b border-gray-500 focus:outline-none focus:border-blue-500 font-['Dancing_Script'] italic"
                autoFocus
              />
            ) : (
              <div className="text-4xl text-center font-['Dancing_Script'] italic">
                {streetName}
              </div>
            )}
          </div>
          
          <div className="flex justify-center items-center mb-10">
            <button
              onClick={decrementNumber}
              className="text-3xl px-5 py-2"
            >
              ◀
            </button>
            
            <div 
              className="cursor-pointer mx-5"
              onClick={() => setIsEditingNumber(true)}
            >
              {isEditingNumber ? (
          <input
            type="text"
            value={doorNumber}
                  onChange={handleNumberChange}
                  onBlur={() => setIsEditingNumber(false)}
                  onKeyDown={(e) => e.key === 'Enter' && setIsEditingNumber(false)}
                  className="text-4xl text-center w-28 bg-transparent border-b border-gray-500 focus:outline-none focus:border-blue-500 font-['Dancing_Script'] italic"
                  autoFocus
                />
              ) : (
                <div className="text-4xl text-center border-b border-transparent w-28 font-['Dancing_Script'] italic">
                  {doorNumber}
                </div>
              )}
        </div>
            
            <button
              onClick={incrementNumber}
              className="text-3xl px-5 py-2"
            >
              ▶
            </button>
          </div>
          
          {/* --- UI Message Area --- */}
          {uiMessage.text && (
            <div style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 9999,
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              padding: '20px 40px',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <span style={{
                color: '#ff0000',
                fontSize: '28px',
                fontStyle: 'italic',
                fontWeight: 'bold'
              }}>
                {uiMessage.type === 'error' && uiMessage.text.includes('Duplicate') ? 'Duplicate Entry' : uiMessage.text}
              </span>
            </div>
          )}
          
          {/* --- NEW: Action Button Area (Conditional Rendering) --- */}
          <div className="grid grid-cols-3 gap-6 mb-10 h-[52px]"> {/* Reduced height from 72px to 52px */}
            {!isDayStarted ? (
              // Show Start Day button if day hasn't started in this session
              <div className="col-span-3">
                <button 
                    onClick={() => setShowStartDayModal(true)}
                    className="w-full h-full bg-gray-600 text-white py-2 px-2 rounded-lg text-xl hover:bg-gray-500" /* Reduced py-4 to py-2 */
                >
                    Start Day
                </button>
              </div>
            ) : (
              // Show action buttons if day has started
              <>
                <button onClick={() => handleSubmit('not-home')} className="bg-yellow-600 text-white py-2 px-2 rounded-lg text-xl">Not Home</button>
                <button onClick={() => handleSubmit('opened')} className="bg-green-600 text-white py-2 px-2 rounded-lg text-xl">Opened</button>
                <button onClick={() => handleSubmit('estimate')} className="bg-blue-600 text-white py-2 px-2 rounded-lg text-xl">Estimate</button>
              </>
            )}
          </div>
        </div>
        
        <div 
          className="overflow-y-auto scrollbar-hide fade-scroll-edges flex-grow"
        >
          {logs.map((log, index) => (
            <LogItem 
              key={log.timestamp} // Use timestamp as key
              log={log}
              previousTimestamp={logs[index + 1]?.timestamp} // Pass timestamp of the previous log
              onDelete={handleDeleteLog} // Pass the delete handler
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;