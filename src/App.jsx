import { useState, useEffect } from 'react';

function App() {
  const [doorNumber, setDoorNumber] = useState('1');
  const [isEditingNumber, setIsEditingNumber] = useState(false);
  const [streetName, setStreetName] = useState('Maple Avenue');
  const [isEditingStreet, setIsEditingStreet] = useState(false);
  const [logs, setLogs] = useState([]);
  
  // Get the queue from localStorage
  const getQueue = () => {
    const queue = localStorage.getItem('logQueue');
    return queue ? JSON.parse(queue) : [];
  };

  // Load existing logs and street name on mount
  useEffect(() => {
    const savedLogs = localStorage.getItem('logs');
    if (savedLogs) {
      setLogs(JSON.parse(savedLogs));
    }
    const savedStreet = localStorage.getItem('streetName');
    if (savedStreet) {
      setStreetName(savedStreet);
    }
    const savedNumber = localStorage.getItem('doorNumber');
    if (savedNumber) {
      setDoorNumber(savedNumber);
    }
  }, []);

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

  const handleSubmit = async (status) => {
    const log = {
      streetName,
      doorNumber,
      status,
      timestamp: new Date().toISOString(),
    };

    // Add to local logs immediately
    const newLogs = [log, ...logs];
    setLogs(newLogs);
    localStorage.setItem('logs', JSON.stringify(newLogs));

    if (navigator.onLine) {
      try {
        const response = await fetch('/.netlify/functions/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(log),
        });
        if (!response.ok) {
          const errorData = await response.text();
          console.error('Server error:', response.status, errorData);
          localStorage.setItem('logQueue', JSON.stringify([...getQueue(), log]));
        }
      } catch (error) {
        console.error('Network error:', error);
        localStorage.setItem('logQueue', JSON.stringify([...getQueue(), log]));
      }
    } else {
      localStorage.setItem('logQueue', JSON.stringify([...getQueue(), log]));
      console.log('Offline: Log stored locally');
    }
  };

  return (
    <div className="flex justify-center items-center justify-self-center min-h-screen bg-gray-900 text-white overflow-hidden">
      <div className="w-full max-w-lg mx-auto px-6 overflow-hidden">
        {/* Fixed Header Area */}
        <div className="mb-8 pt-8 text-center">
          <h1 className="text-6xl font-bold mb-8">RLDLS</h1>
          
          {/* Street Name - Editable */}
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
                className="text-52 text-center w-full bg-transparent border-b border-gray-500 focus:outline-none focus:border-blue-500 font-['Dancing_Script']"
                autoFocus
              />
            ) : (
              <div className="text-52 text-center font-['Dancing_Script']">
                {streetName}
              </div>
            )}
          </div>
          
          {/* House Number with Controls */}
          <div className="flex justify-center items-center mb-10">
            <button
              onClick={decrementNumber}
              className="text-3xl px-5 py-2 focus:outline-none"
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
                  className="text-4xl text-center w-28 bg-transparent border-b border-gray-500 focus:outline-none focus:border-blue-500 font-['Dancing_Script']"
                  autoFocus
                />
              ) : (
                <div className="text-4xl text-center border-b border-transparent w-28 font-['Dancing_Script']">
                  {doorNumber}
                </div>
              )}
            </div>
            
            <button
              onClick={incrementNumber}
              className="text-3xl px-5 py-2 focus:outline-none"
            >
              ▶
            </button>
          </div>
          
          {/* Action Buttons */}
          <div className="grid grid-cols-3 gap-6 mb-10">
            <button
              onClick={() => handleSubmit('not-home')}
              className="bg-yellow-600 text-white py-4 px-2 rounded-lg text-xl"
            >
              Not Home
            </button>
            <button
              onClick={() => handleSubmit('opened')}
              className="bg-green-600 text-white py-4 px-2 rounded-lg text-xl"
            >
              Opened
            </button>
            <button
              onClick={() => handleSubmit('estimate')}
              className="bg-blue-600 text-white py-4 px-2 rounded-lg text-xl"
            >
              Estimate
            </button>
          </div>
        </div>
        
        {/* Scrollable Logs Area */}
        <div 
          className="overflow-y-auto scrollbar-hide fade-scroll-edges" 
          style={{ maxHeight: "calc(5 * 3rem + 2rem)" }} /* Adjust based on line height + padding */
        >
          {logs.map((log, index) => (
            <div
              key={log.timestamp}
              className="py-3 border-t border-gray-800"
            >
              <p className="text-lg">
                {log.doorNumber}, {log.streetName}. {log.status.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}. {new Date(log.timestamp).toLocaleTimeString()}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;