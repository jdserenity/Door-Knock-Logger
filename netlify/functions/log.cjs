const { google } = require('googleapis');

exports.handler = async (event) => {
  console.log('Function invoked. Body type:', typeof event.body);
  // Log raw body for debugging if needed, careful with sensitive data
  // console.log('Raw body:', event.body); 

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let requestBody;
  try {
    // Ensure body is parsed correctly, handle potential JSON errors
    requestBody = JSON.parse(event.body);
    console.log('Parsed request body:', requestBody);
  } catch (e) {
    console.error('Error parsing request body:', e);
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body', details: e.message }) };
  }

  try {
    // --- Destructure all expected fields from the parsed body --- 
    const {
      date,            // "YYYY-MM-DD"
      dayOfWeek,       // "Mon", "Tue", etc.
      streetName,
      doorNumber,
      status,
      timestamp,       // ISO string
      interval,        // "HH:MM"
      weather,         // { temp: number | null, condition: string }
      dailyQuestions   // { groomed: string, mood: string, jacket: string }
    } = requestBody;

    // --- Basic validation (optional but recommended) ---
    if (!date || !dayOfWeek || !streetName || !doorNumber || !status || !timestamp || !interval || !weather || !dailyQuestions) {
       console.error('Missing required fields in request body:', requestBody);
       // Be specific about what's missing if possible
       return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields in log data' }) };
    }

    // --- Check environment variables --- 
    if (!process.env.GOOGLE_CREDENTIALS) {
      console.error('Missing GOOGLE_CREDENTIALS environment variable');
      return { statusCode: 500, body: JSON.stringify({ error: 'Server configuration error (Credentials)' }) };
    }
    if (!process.env.SPREADSHEET_ID) {
      console.error('Missing SPREADSHEET_ID environment variable');
      return { statusCode: 500, body: JSON.stringify({ error: 'Server configuration error (Spreadsheet ID)' }) };
    }

    // --- Authenticate with Google Sheets API ---
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    // --- Prepare data row for Google Sheet --- 
    // Order: Date, DayOfWeek, Groomed, Mood, Jacket, Condition, Temp, Interval, Street, Door, Status, Timestamp
    const valuesToAppend = [
      date,
      dayOfWeek,
      dailyQuestions.groomed || 'N/A', // Handle potential missing keys gracefully
      dailyQuestions.mood || 'N/A',
      dailyQuestions.jacket || 'N/A',
      weather.condition || 'N/A',
      weather.temp !== null ? weather.temp : 'N/A', // Handle null temp
      interval,
      streetName,
      doorNumber,
      status,
      timestamp
    ];

    console.log('Attempting to append to spreadsheet:', process.env.SPREADSHEET_ID);
    console.log('Values to append:', valuesToAppend);

    // --- Append data to the sheet --- 
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: 'Sheet1!A:L', // Updated range for 12 columns (A to L)
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [valuesToAppend], // Pass the prepared array
      },
    });
    
    console.log('Successfully appended data to spreadsheet');
    return { statusCode: 200, body: JSON.stringify({ message: 'Log added successfully' }) };

  } catch (error) {
    console.error('Error processing request in function:', error);
    // Log the request body that caused the error for debugging
    console.error('Request body causing error:', requestBody); 
    return { 
      statusCode: 500, 
      body: JSON.stringify({ 
        error: 'Failed to process log', 
        details: error.message 
      }) 
    };
  }
};