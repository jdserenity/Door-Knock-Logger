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
      dailyQuestions,  // { groomed: string, mood: string, jacket: string, user: string }
      user,            // The user who logged this entry
      isFirstEntry     // Flag indicating if this is the first entry of the day (from previous day's data)
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
    const spreadsheetId = process.env.SPREADSHEET_ID;
    const dailyStatsSheet = 'Daily Stats';
    const notHomeSheet = 'Houses Not Home';
    const lastHouseSheet = 'Last House Knocked';
    
    // If this is the first entry of the day, we don't count it for statistics
    // but we still want to log it for continuity
    if (!isFirstEntry) {
      // --- Handle Daily Stats Sheet (New Interval-based Approach) ---
      // Check if there's already a row for this date and interval combination
      const statsResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${dailyStatsSheet}!A:K`, // Column range for the updated format
      });
      
      const statsRows = statsResponse.data.values || [];
      let intervalRowIndex = -1;
      
      // Find if this date+interval combination already exists
      for (let i = 1; i < statsRows.length; i++) { // Start from 1 to skip header
        const row = statsRows[i];
        // Note: Now interval is the third column (index 2)
        if (row && row.length >= 3 && row[0] === date && row[2] === interval) {
          intervalRowIndex = i;
          break;
        }
      }
      
      // Get the username from either the directly passed user or from dailyQuestions
      const userName = user || dailyQuestions.user || 'Unknown';
      
      if (intervalRowIndex === -1) {
        // This is a new interval for this date - create a new row
        console.log(`Creating new interval row for ${date} at ${interval}`);
        
        // Initialize counts based on the current status
        const notHomeCount = status === 'not-home' ? 1 : 0;
        const openedCount = status === 'opened' ? 1 : 0;
        const estimateCount = status === 'estimate' ? 1 : 0;
        
        // New format: Date, DayOfWeek, Interval, Groomed, Jacket, Mood, Condition, Temp, 
        // NotHomeCount, OpenedCount, EstimateCount, UserName
        const newRow = [
          date,
          dayOfWeek,
          interval,
          dailyQuestions.groomed || 'N/A',
          dailyQuestions.jacket || 'N/A',
          dailyQuestions.mood || 'N/A',
          weather.condition || 'N/A',
          weather.temp !== null ? weather.temp : 'N/A',
          notHomeCount.toString(),
          openedCount.toString(),
          estimateCount.toString(),
          userName
        ];
        
        // Append the new row
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `${dailyStatsSheet}!A:L`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [newRow] },
        });
        
        console.log(`New interval row created with counts: NH=${notHomeCount}, O=${openedCount}, E=${estimateCount}`);
      } else {
        // This interval already exists - update the counts
        const row = statsRows[intervalRowIndex];
        
        // Get existing counts (handling potential missing values)
        // Note: Counts now start at index 8 due to the interval column moving
        let notHomeCount = parseInt(row[8]) || 0;
        let openedCount = parseInt(row[9]) || 0;
        let estimateCount = parseInt(row[10]) || 0;
        
        // Update the appropriate count based on status
        if (status === 'not-home') notHomeCount++;
        else if (status === 'opened') openedCount++;
        else if (status === 'estimate') estimateCount++;
        
        // Update only the count columns (9-11)
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${dailyStatsSheet}!I${intervalRowIndex + 1}:K${intervalRowIndex + 1}`,
          valueInputOption: 'USER_ENTERED',
          resource: { 
            values: [[notHomeCount.toString(), openedCount.toString(), estimateCount.toString()]] 
          },
        });
        
        console.log(`Updated interval row at index ${intervalRowIndex + 1} with new counts: NH=${notHomeCount}, O=${openedCount}, E=${estimateCount}`);
      }
      
      // --- Track Last House Knocked (only for real entries, not first entry of the day) ---
      console.log(`Updating Last House Knocked sheet for user: ${userName}`);
      
      // Check if user already exists in the Last House Knocked sheet
      const lastHouseResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${lastHouseSheet}!A:C`,
      });
      
      const lastHouseRows = lastHouseResponse.data.values || [];
      let userRowIndex = -1;
      
      // Find if this user already exists
      for (let i = 0; i < lastHouseRows.length; i++) {
        if (lastHouseRows[i][0] === userName) {
          userRowIndex = i;
          break;
        }
      }
      
      if (userRowIndex === -1) {
        // User not found, add a new row
        console.log(`User ${userName} not found in Last House Knocked sheet, creating new row`);
        
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `${lastHouseSheet}!A:C`,
          valueInputOption: 'USER_ENTERED',
          resource: { 
            values: [[userName, streetName, doorNumber]] 
          },
        });
      } else {
        // User found, update the street name and door number
        console.log(`User ${userName} found in Last House Knocked sheet at row ${userRowIndex + 1}, updating`);
        
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${lastHouseSheet}!B${userRowIndex + 1}:C${userRowIndex + 1}`,
          valueInputOption: 'USER_ENTERED',
          resource: { 
            values: [[streetName, doorNumber]] 
          },
        });
      }
      
      // --- If status is "not-home", update the Houses Not Home sheet ---
      if (status === 'not-home') {
        console.log(`Updating Houses Not Home sheet for ${streetName}, house number ${doorNumber}`);
        
        // Check if street already exists in the sheet
        const notHomeResponse = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${notHomeSheet}!A:C`,
        });
        
        const notHomeRows = notHomeResponse.data.values || [];
        let streetRowIndex = -1;
        
        // Find the row index for this street (if it exists)
        for (let i = 0; i < notHomeRows.length; i++) {
          if (notHomeRows[i][0] === streetName) {
            streetRowIndex = i;
            break;
          }
        }
        
        if (streetRowIndex === -1) {
          // Street not found, find the first empty row and update cells A and C
          console.log(`Street not found in Not Home sheet, finding first empty row for ${streetName}`);
          
          // Find the first completely empty row (check column A)
          let firstEmptyRowIndex = 0; // Start checking from the first row (index 0)
          for (let i = 0; i < notHomeRows.length; i++) {
            // If column A is empty or undefined, consider this the potential start
            if (!notHomeRows[i][0]) {
              firstEmptyRowIndex = i;
              break;
            } else {
              // If column A has data, the next row is the potential empty one
              firstEmptyRowIndex = i + 1;
            }
          }
          // If the loop finished, the first empty row is after the last row
          if (firstEmptyRowIndex >= notHomeRows.length) {
             firstEmptyRowIndex = notHomeRows.length; 
          }

          const newRowNumber = firstEmptyRowIndex + 1; // Sheet rows are 1-indexed
          console.log(`First empty row determined to be: ${newRowNumber}`);

          // Update cell A with the street name
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${notHomeSheet}!A${newRowNumber}`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [[streetName]] },
          });

          // Update cell C with the door number
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${notHomeSheet}!C${newRowNumber}`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [[doorNumber]] },
          });

        } else {
          // Street found, update the existing house numbers cell (column C)
          console.log(`Street found in Not Home sheet at row ${streetRowIndex + 1}, updating house numbers`);
          
          // Get existing house numbers, if any
          const existingHouseNumbers = notHomeRows[streetRowIndex][2] || '';
          
          // Add new house number with comma separator if there are existing numbers
          const updatedHouseNumbers = existingHouseNumbers ? 
            `${existingHouseNumbers}, ${doorNumber}` : 
            doorNumber;
          
          // Update the cell with the new list of house numbers
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${notHomeSheet}!C${streetRowIndex + 1}`,
            valueInputOption: 'USER_ENTERED',
            resource: { 
              values: [[updatedHouseNumbers]] 
            },
          });
        }
      }
    } else {
      console.log('First entry of the day detected - not counting towards statistics or last house knocked');
    }
    
    console.log('Successfully updated spreadsheet(s)');
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