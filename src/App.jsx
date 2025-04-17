import { useState, useEffect, useCallback } from 'react';
import LogItem from './LogItem'; // Import the new component
import { v4 as uuidv4 } from 'uuid';

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
  const [uiMessage, setUiMessage] = useState({ text: '', type: '' });
  const [stats, setStats] = useState({ 
    totalHouses: 0,
    notHomePercent: 0,
    openedPercent: 0,
    totalEstimates: 0,
    avgTimeBetween: 0
  });
  const [isLoadingLastLog, setIsLoadingLastLog] = useState(false); // Loading state
  const [uiReady, setUiReady] = useState(false); // New state to synchronize UI rendering

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

    // Load daily state and check if the day is already started
    const savedLastStartDate = localStorage.getItem('lastStartDate');
    const savedDailyQuestions = localStorage.getItem('dailyQuestions');
    const today = getISODate();

    if (savedLastStartDate === today && savedDailyQuestions) {
      // Load the data into state, but DON'T set isDayStarted here for development
      setDailyQuestions(JSON.parse(savedDailyQuestions));
      setLastStartDate(savedLastStartDate);
      console.log("Loaded data for already started day, but requires manual start in this session (for testing).");
      // setIsDayStarted(true); // <--- COMMENTED OUT FOR DEV, RESTORE FOR PRODUCTION
    } else {
      // If it's a new day or data is missing, clear potentially stale daily data
      console.log("New day or missing daily data. Requires 'Start Day'.");
      setIsDayStarted(false);
      setDailyQuestions(null);
      localStorage.removeItem('dailyQuestions');
      
      // Reset stats to 0 when Start Day button is present
      setStats({
        totalHouses: 0,
        notHomePercent: 0,
        openedPercent: 0,
        totalEstimates: 0,
        avgTimeBetween: 0
      });
    }

  }, []); // Run only on mount

  // Add debugging for state changes
  useEffect(() => {
    console.log(`isEditingNumber state changed to: ${isEditingNumber}`);
  }, [isEditingNumber]);

  useEffect(() => {
    console.log(`isEditingStreet state changed to: ${isEditingStreet}`);
  }, [isEditingStreet]);
  
  useEffect(() => {
    console.log(`doorNumber state changed to: ${doorNumber}`);
  }, [doorNumber]);

  const handleNumberChange = (e) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    console.log(`handleNumberChange: input value = "${value}"`);
    setDoorNumber(value); // Allow empty string during editing
    if (value) { // Only save non-empty values to localStorage
      localStorage.setItem('doorNumber', value);
    }
  };

  const handleStreetNameChange = (e) => {
    const value = e.target.value;
    console.log(`handleStreetNameChange: input value = "${value}"`);
    setStreetName(value);
    if (value) { // Only save non-empty values to localStorage
      localStorage.setItem('streetName', value);
    }
  };

  const handleStreetBlur = () => {
    console.log('handleStreetBlur called');
    setIsEditingStreet(false);
    if (!streetName.trim()) {
      setStreetName('Maple Avenue');
      localStorage.setItem('streetName', 'Maple Avenue');
    }
  };

  const handleNumberBlur = () => {
    console.log('handleNumberBlur called');
    setIsEditingNumber(false);
    if (!doorNumber) {
      setDoorNumber('0');
      localStorage.setItem('doorNumber', '0');
    }
  };

  const incrementNumber = useCallback(() => {
    console.log(`incrementNumber called, isEditingNumber=${isEditingNumber}`);
    // First exit edit mode if we're in it
    if (isEditingNumber) {
      console.log('Exiting edit mode from increment');
      setIsEditingNumber(false);
    }
    // Then increment the number after a slight delay to allow state update
    setTimeout(() => {
      const newValue = String(Number(doorNumber) + 1);
      console.log(`Setting new value to ${newValue}`);
      setDoorNumber(newValue);
      localStorage.setItem('doorNumber', newValue);
    }, 10);
  }, [doorNumber, isEditingNumber]); 

  const decrementNumber = useCallback(() => {
    console.log(`decrementNumber called, isEditingNumber=${isEditingNumber}`);
    // First exit edit mode if we're in it
    if (isEditingNumber) {
      console.log('Exiting edit mode from decrement');
      setIsEditingNumber(false);
    }
    // Then decrement the number after a slight delay to allow state update
    setTimeout(() => {
      const newValue = String(Math.max(0, Number(doorNumber) - 1));
      console.log(`Setting new value to ${newValue}`);
      setDoorNumber(newValue);
      localStorage.setItem('doorNumber', newValue);
    }, 10);
  }, [doorNumber, isEditingNumber]);

  // --- Start Day Logic ---
  const handleStartDaySubmit = async (answers) => {
    const today = getISODate();
    setDailyQuestions(answers);
    setLastStartDate(today);
    setIsDayStarted(true);
    setIsLoadingLastLog(true); // Start loading
    setUiReady(false); // Reset UI ready state

    // Persist to localStorage
    localStorage.setItem('dailyQuestions', JSON.stringify(answers));
    localStorage.setItem('lastStartDate', today);
    
    setShowStartDayModal(false);
    console.log("Day started with answers:", answers);

    // Clear logs state and storage for the new day
    setLogs([]); 
    localStorage.removeItem('logs');
    console.log("UI Logs cleared for the new day.");
    
    // Fetch the last log from the Google Sheet
    try {
      console.log("Fetching last log from Google Sheet...");
      const response = await fetch('/.netlify/functions/get-last-log');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch last log: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.lastLog) {
        console.log("Retrieved last log:", data.lastLog);
        // Create first log entry using the last log's data
        await createFirstLogFromLastLog(data.lastLog, answers);
      } else {
        console.warn("No last log found in Google Sheet");
        // If no last log, create a default one with current door/street
        await createDefaultFirstLog(answers);
      }
    } catch (error) {
      console.error("Error fetching last log:", error);
      // Fallback to creating a default first log
      await createDefaultFirstLog(answers);
    } finally {
      // Slight delay to ensure all state updates have processed
      setTimeout(() => {
        setIsLoadingLastLog(false); // End loading
        setUiReady(true); // Signal UI is ready to render
      }, 300); // Small delay to ensure synchronized appearance
    }
  };
  
  // Creates first log entry based on the last log from the Google Sheet
  const createFirstLogFromLastLog = async (lastLog, currentDailyAnswers) => {
    // Set the door number and street name from the last log
    setDoorNumber(lastLog.doorNumber);
    setStreetName(lastLog.streetName);
    
    // Save to localStorage
    localStorage.setItem('doorNumber', lastLog.doorNumber);
    localStorage.setItem('streetName', lastLog.streetName);
    
    // Create a log entry with the exact data from the last log,
    // but with current timestamp and today's date
    const now = new Date();
    const interval = getCurrentInterval(now);
    
    // Fetch weather for completeness (since the backend expects it)
    const weather = await fetchWeather(now);
    
    const firstLog = {
      date: getISODate(now),
      dayOfWeek: now.toLocaleDateString('en-US', { weekday: 'short' }),
      streetName: lastLog.streetName,
      doorNumber: lastLog.doorNumber,
      status: lastLog.status,  // Use the actual status from the last log
      timestamp: now.toISOString(),
      interval,
      weather,
      dailyQuestions: currentDailyAnswers,
      isFirstEntry: true, // Mark as first entry to handle special display
      originalDate: lastLog.date, // Save original date for display
      user: currentDailyAnswers.user // Add user from daily answers
    };
    
    console.log("Creating first log from last Google Sheet entry:", firstLog);
    
    // Add to state and localStorage
    setLogs([firstLog]);
    localStorage.setItem('logs', JSON.stringify([firstLog]));
    
    // Send to backend
    await sendLogToBackend(firstLog);
    return firstLog;
  };
  
  // Creates a default first log if no last log is available
  const createDefaultFirstLog = async (currentDailyAnswers) => {
    // Use current door number and street name (already in state)
    const now = new Date();
    const interval = getCurrentInterval(now);
    
    // Fetch weather for completeness (since the backend expects it)
    const weather = await fetchWeather(now);
    
    const defaultLog = {
      date: getISODate(now),
      dayOfWeek: now.toLocaleDateString('en-US', { weekday: 'short' }),
      streetName,
      doorNumber,
      status: 'not-home',  // Default status
      timestamp: now.toISOString(),
      interval,
      weather,
      dailyQuestions: currentDailyAnswers,
      isFirstEntry: true, // Mark as first entry
      originalDate: getISODate(new Date(Date.now() - 86400000)), // Yesterday's date
      user: currentDailyAnswers.user // Add user from daily answers
    };
    
    console.log("Creating default first log (no previous data available):", defaultLog);
    
    // Add to state and localStorage
    setLogs([defaultLog]);
    localStorage.setItem('logs', JSON.stringify([defaultLog]));
    
    // Send to backend
    await sendLogToBackend(defaultLog);
    return defaultLog;
  };
  
  // Helper to send a log to the backend
  const sendLogToBackend = async (log) => {
    if (navigator.onLine) {
      try {
        const response = await fetch('/.netlify/functions/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(log),
        });
        
        if (!response.ok) {
          console.error("Failed to send first log entry to backend");
          // Add to queue for later sync
          const currentQueue = getQueue();
          localStorage.setItem('logQueue', JSON.stringify([...currentQueue, log]));
        }
      } catch (error) {
        console.error("Error sending first log entry:", error);
        // Add to queue for later sync
        const currentQueue = getQueue();
        localStorage.setItem('logQueue', JSON.stringify([...currentQueue, log]));
      }
    } else {
      // Add to queue for later sync
      const currentQueue = getQueue();
      localStorage.setItem('logQueue', JSON.stringify([...currentQueue, log]));
    }
  };

  // Component for Modal Content
  const StartDayModalContent = () => {
    const [answers, setAnswers] = useState({ groomed: 'Yes', mood: 'Yes', jacket: 'No' });
    const [user, setUser] = useState('');
    const [userMode, setUserMode] = useState('loading'); // 'loading', 'known', 'select', 'new'
    const [knownUsers, setKnownUsers] = useState([]);
    const [newUserName, setNewUserName] = useState('');

    useEffect(() => {
      // Get device ID - this uniquely identifies the device
      const deviceId = localStorage.getItem('deviceId');
      
      // If no device ID yet, create one
      if (!deviceId) {
        localStorage.setItem('deviceId', uuidv4());
      }
      
      // Check if this device has a user associated with it
      const storedUserId = localStorage.getItem('userId');
      
      if (storedUserId) {
        // Device has a user - retrieve the name
        const userName = localStorage.getItem(`user_${storedUserId}`);
        if (userName) {
          setUser(userName);
          setUserMode('known');
        } else {
          // User ID exists but name is missing - handle edge case
          setUserMode('select');
        }
      } else {
        // Get all existing users for the dropdown
        const allUsers = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('user_')) {
            allUsers.push(localStorage.getItem(key));
          }
        }
        
        setKnownUsers(allUsers);
        
        // No user associated with this device
        if (allUsers.length === 0) {
          // No users exist yet, go to new user mode
          setUserMode('new');
        } else {
          // Show selection with existing users
          setUserMode('select');
        }
      }
    }, []);

    const handleUserChange = (e) => {
      const selectedValue = e.target.value;
      if (selectedValue === "add-new") {
        setUserMode('new');
        setUser('');
      } else {
        setUser(selectedValue);
      }
    };

    const handleNewUserSubmit = () => {
      if (!newUserName.trim()) {
        alert("Please enter a user name");
        return;
      }
      
      // Update local state
      setUser(newUserName);
      setUserMode('known');
      
      // Create new user ID and store it
      const userId = uuidv4();
      localStorage.setItem(`user_${userId}`, newUserName);
      
      // Associate this device with this user
      localStorage.setItem('userId', userId);
      
      // Update known users list
      const updatedUsers = [...knownUsers, newUserName];
      setKnownUsers(updatedUsers);
    };

    const handleChange = (e) => {
      setAnswers({ ...answers, [e.target.name]: e.target.value });
    };

    const handleFormSubmit = (e) => {
      e.preventDefault();
      
      // Validate that we have a user
      if (!user) {
        alert("Please select or create a user");
        return;
      }
      
      // If we're in select mode, save the user association
      if (userMode === 'select') {
        // Find the userId for this username
        let selectedUserId = null;
        
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('user_')) {
            const storedName = localStorage.getItem(key);
            if (storedName === user) {
              selectedUserId = key.replace('user_', '');
              break;
            }
          }
        }
        
        if (selectedUserId) {
          // Associate this device with the selected user
          localStorage.setItem('userId', selectedUserId);
        }
      }
      
      // Add the user to the answers object
      const answersWithUser = { ...answers, user };
      
      // Submit to parent component
      handleStartDaySubmit(answersWithUser);
    };

    // Render loading state
    if (userMode === 'loading') {
      return (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-500 mx-auto mb-4"></div>
          <p>Loading user information...</p>
        </div>
      );
    }

    return (
      <form onSubmit={handleFormSubmit}>
        <h2 className="text-2xl font-bold mb-6 text-center">Daily Check-in</h2>
        
        {/* User Selection UI - changes based on userMode */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-400 mb-1">User</label>
          
          {userMode === 'known' && (
            // Known user - show disabled dropdown
            <select 
              disabled 
              className="w-full bg-gray-700 text-gray-300 rounded-md p-2 cursor-not-allowed"
            >
              <option>{user}</option>
            </select>
          )}
          
          {userMode === 'select' && (
            // User selection mode - active dropdown
            <select 
              value={user}
              onChange={handleUserChange}
              className="w-full bg-gray-600 text-white rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select your name</option>
              {knownUsers.map((name, index) => (
                <option key={index} value={name}>{name}</option>
              ))}
              <option value="add-new">+ Add new user</option>
            </select>
          )}
          
          {userMode === 'new' && (
            // New user creation mode
            <div className="flex gap-2">
              <input
                type="text"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                placeholder="Enter your name"
                className="flex-1 bg-gray-600 text-white rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <button 
                type="button"
                onClick={handleNewUserSubmit}
                className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-500"
              >
                Save
              </button>
            </div>
          )}
        </div>

        {/* Updated Groomed Question */}
        <fieldset className="mb-5">
          <legend className="mb-2 font-medium">Are you groomed well today?</legend>
          <div className="flex gap-x-4">
            <label className="flex items-center gap-x-2">
              <input type="radio" name="groomed" value="Yes" checked={answers.groomed === 'Yes'} onChange={handleChange} className="form-radio h-4 w-4 text-blue-600"/> 
              Yes
            </label>
            <label className="flex items-center gap-x-2">
              <input type="radio" name="groomed" value="Kind of" checked={answers.groomed === 'Kind of'} onChange={handleChange} className="form-radio h-4 w-4 text-blue-600"/> 
              Kind of
            </label>
            <label className="flex items-center gap-x-2">
              <input type="radio" name="groomed" value="No" checked={answers.groomed === 'No'} onChange={handleChange} className="form-radio h-4 w-4 text-blue-600"/> 
              No
            </label>
          </div>
        </fieldset>

        {/* Updated Mood Question */}
        <fieldset className="mb-5">
          <legend className="mb-2 font-medium">Are you in a good mood?</legend>
          <div className="flex gap-x-4">
            <label className="flex items-center gap-x-2">
              <input type="radio" name="mood" value="Yes" checked={answers.mood === 'Yes'} onChange={handleChange} className="form-radio h-4 w-4 text-blue-600"/> 
              Yes
            </label>
            <label className="flex items-center gap-x-2">
              <input type="radio" name="mood" value="Kind of" checked={answers.mood === 'Kind of'} onChange={handleChange} className="form-radio h-4 w-4 text-blue-600"/> 
              Kind of
            </label>
            <label className="flex items-center gap-x-2">
              <input type="radio" name="mood" value="No" checked={answers.mood === 'No'} onChange={handleChange} className="form-radio h-4 w-4 text-blue-600"/> 
              No
            </label>
          </div>
        </fieldset>

        {/* Jacket Question (unchanged) */}
        <fieldset className="mb-6">
          <legend className="mb-2 font-medium">Jacket covering company shirt?</legend>
          <div className="flex gap-x-4">
            <label className="flex items-center gap-x-2">
              <input type="radio" name="jacket" value="Yes" checked={answers.jacket === 'Yes'} onChange={handleChange} className="form-radio h-4 w-4 text-blue-600"/> 
              Yes
            </label>
            <label className="flex items-center gap-x-2">
              <input type="radio" name="jacket" value="No" checked={answers.jacket === 'No'} onChange={handleChange} className="form-radio h-4 w-4 text-blue-600"/> 
              No
            </label>
          </div>
        </fieldset>
        
        <button type="submit" className="w-full bg-green-600 text-white py-2 px-4 rounded-lg text-lg hover:bg-green-500">Confirm</button>
        <button 
          type="button"
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
      dailyQuestions: currentDailyQuestions,
      user: currentDailyQuestions.user // Add user from daily questions
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

  // --- Calculate Stats When Logs Change ---
  useEffect(() => {
    // If day is not started, always show zero stats
    if (!isDayStarted) {
      setStats({
        totalHouses: 0,
        notHomePercent: 0,
        openedPercent: 0,
        totalEstimates: 0,
        avgTimeBetween: 0
      });
      return;
    }
    
    if (logs.length === 0) {
      setStats({
        totalHouses: 0,
        notHomePercent: 0,
        openedPercent: 0,
        totalEstimates: 0,
        avgTimeBetween: 0
      });
      return;
    }

    // Filter out the first entry (which is from the previous day)
    const todaysLogs = logs.filter(log => !log.isFirstEntry);
    
    if (todaysLogs.length === 0) {
      setStats({
        totalHouses: 0,
        notHomePercent: 0,
        openedPercent: 0,
        totalEstimates: 0,
        avgTimeBetween: 0
      });
      return;
    }

    // Total houses is just the length of today's logs
    const totalHouses = todaysLogs.length;
    
    // Count statuses
    const notHomeCount = todaysLogs.filter(log => log.status === 'not-home').length;
    const openedCount = todaysLogs.filter(log => log.status === 'opened').length;
    const estimateCount = todaysLogs.filter(log => log.status === 'estimate').length;
    
    // Calculate percentages
    const notHomePercent = Math.round((notHomeCount / totalHouses) * 100);
    const openedPercent = Math.round((openedCount / totalHouses) * 100);
    
    // Calculate average time between entries
    let totalTimeBetween = 0;
    let timePoints = 0;
    
    for (let i = 0; i < todaysLogs.length - 1; i++) {
      const currentTime = new Date(todaysLogs[i].timestamp).getTime();
      const nextTime = new Date(todaysLogs[i + 1].timestamp).getTime();
      const diffInSeconds = Math.round((currentTime - nextTime) / 1000);
      
      if (!isNaN(diffInSeconds) && diffInSeconds > 0) {
        totalTimeBetween += diffInSeconds;
        timePoints++;
      }
    }
    
    const avgTimeBetween = timePoints > 0 ? Math.round(totalTimeBetween / timePoints) : 0;
    
    setStats({
      totalHouses,
      notHomePercent,
      openedPercent,
      totalEstimates: estimateCount,
      avgTimeBetween
    });
  }, [logs, isDayStarted]); // Also run when isDayStarted changes

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
                onBlur={handleStreetBlur}
                onKeyDown={(e) => e.key === 'Enter' && handleStreetBlur()}
                className="text-4xl text-center w-full bg-transparent border-b border-gray-500 focus:outline-none focus:border-blue-500 font-['Dancing_Script'] italic"
                autoFocus
                style={{fontSize: '2rem'}}
              />
            ) : (
              <div className="text-4xl text-center font-['Dancing_Script'] italic" style={{fontSize: '2rem'}}>
                {streetName}
              </div>
            )}
          </div>
          
          <div className="flex justify-center items-center mb-10">
            <button
              onClick={(e) => {
                console.log('Decrement button clicked');
                // Stop event propagation
                e.stopPropagation();
                decrementNumber();
              }}
              className="text-3xl px-5 py-2"
            >
              ◀
            </button>
            
            <div 
              className="cursor-pointer mx-5"
              onClick={() => {
                console.log('Number container clicked, setting isEditingNumber=true');
                setIsEditingNumber(true);
              }}
            >
              {isEditingNumber ? (
          <input
            type="text"
            value={doorNumber}
                  onChange={handleNumberChange}
                  onBlur={(e) => {
                    console.log('Number input blur event');
                    handleNumberBlur();
                  }}
                  onKeyDown={(e) => {
                    console.log(`Number input keyDown: ${e.key}`);
                    if (e.key === 'Enter') handleNumberBlur();
                  }}
                  className="text-4xl text-center w-28 bg-transparent border-b border-gray-500 focus:outline-none focus:border-blue-500 font-['Dancing_Script'] italic"
                  autoFocus
                  style={{fontSize: '2rem'}}
                  onClick={(e) => {
                    console.log('Number input clicked');
                    e.stopPropagation();
                  }}
                />
              ) : (
                <div className="text-4xl text-center border-b border-transparent w-28 font-['Dancing_Script'] italic" style={{fontSize: '2rem'}}>
                  {doorNumber}
                </div>
              )}
            </div>
            
            <button
              onClick={(e) => {
                console.log('Increment button clicked');
                // Stop event propagation
                e.stopPropagation();
                incrementNumber();
              }}
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
          
          {/* --- NEW: Action Button Area and Logs (Conditional Rendering) --- */}
          <div className="grid grid-cols-3 gap-6 mb-10 h-[52px]">
            {!isDayStarted ? (
              // Show Start Day button if day hasn't started in this session
              <div className="col-span-3">
                <button 
                    onClick={() => setShowStartDayModal(true)}
                    className="w-full h-full bg-gray-600 text-white py-2 px-2 rounded-lg text-xl hover:bg-gray-500 active:bg-gray-700 outline-none focus:outline-none"
                >
                    Start Day
                </button>
              </div>
            ) : isLoadingLastLog ? (
              // Show loading indicator while fetching last log
              <div className="col-span-3 flex justify-center items-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-500"></div>
              </div>
            ) : (
              // Show action buttons if day has started and loading is complete
              <>
                <button onClick={() => handleSubmit('not-home')} className="bg-yellow-600 text-white py-2 px-2 rounded-lg text-xl active:bg-yellow-700 outline-none focus:outline-none">Not Home</button>
                <button onClick={() => handleSubmit('opened')} className="bg-green-600 text-white py-2 px-2 rounded-lg text-xl active:bg-green-700 outline-none focus:outline-none">Opened</button>
                <button onClick={() => handleSubmit('estimate')} className="bg-blue-600 text-white py-2 px-2 rounded-lg text-xl active:bg-blue-700 outline-none focus:outline-none">Estimate</button>
              </>
            )}
          </div>
        </div>
        
        {/* Only show logs if day is started and UI is ready */}
        {isDayStarted && uiReady && (
          <div 
            className="overflow-y-auto scrollbar-hide fade-scroll-edges flex-grow"
            style={{
              paddingBottom: "120px", /* Add padding to allow scrolling up to reveal the last log */
              scrollbarWidth: "none", /* Hide scrollbar in Firefox */
              msOverflowStyle: "none" /* Hide scrollbar in IE/Edge */
            }}
          >
            {logs.map((log, index) => (
              <LogItem 
                key={log.timestamp}
                log={log}
                previousTimestamp={logs[index + 1]?.timestamp}
                onDelete={handleDeleteLog}
              />
            ))}
          </div>
        )}
        
        {/* Show loading spinner in logs area if loading */}
        {isDayStarted && isLoadingLastLog && (
          <div className="flex-grow flex justify-start items-start pt-8">
            <div className="text-center w-full">
              <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500 mx-auto mb-4"></div>
              <p className="text-white text-xl">Loading</p>
            </div>
          </div>
        )}
        
        {/* Stats Section - Always visible */}
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          zIndex: 10
        }}>
          <table style={{
            maxWidth: '390px',
            width: '100%',
            borderTopLeftRadius: '8px',
            borderTopRightRadius: '8px'
          }}>
            <tbody>
              <tr>
                <td style={{textAlign: 'center'}}><b style={{color: 'white'}}>{stats.totalHouses}</b></td>
                <td style={{textAlign: 'center'}}><b style={{color: 'white'}}>{stats.notHomePercent}%</b></td>
                <td style={{textAlign: 'center'}}><b style={{color: 'white'}}>{stats.openedPercent}%</b></td>
                <td style={{textAlign: 'center'}}><b style={{color: 'white'}}>{stats.totalEstimates}</b></td>
                <td style={{textAlign: 'center'}}><b style={{color: 'white'}}>{stats.avgTimeBetween}s</b></td>
              </tr>
              <tr>
                <td style={{textAlign: 'center', fontSize: '0.75rem', color: 'white'}}>Houses</td>
                <td style={{textAlign: 'center', fontSize: '0.75rem', color: 'white'}}>Not Home</td>
                <td style={{textAlign: 'center', fontSize: '0.75rem', color: 'white'}}>Opened</td>
                <td style={{textAlign: 'center', fontSize: '0.75rem', color: 'white'}}>Estimates</td>
                <td style={{textAlign: 'center', fontSize: '0.75rem', color: 'white'}}>Avg Time</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default App;