const { google } = require('googleapis');

exports.handler = async (event) => {
  console.log('Get last log function invoked');

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // --- Check environment variables --- 
    if (!process.env.GOOGLE_CREDENTIALS) {
      console.error('Missing GOOGLE_CREDENTIALS environment variable');
      return { statusCode: 500, body: JSON.stringify({ error: 'Server configuration error (Credentials)' }) };
    }
    if (!process.env.SPREADSHEET_ID) {
      console.error('Missing SPREADSHEET_ID environment variable');
      return { statusCode: 500, body: JSON.stringify({ error: 'Server configuration error (Spreadsheet ID)' }) };
    }

    // Parse query parameters if a user is specified
    const queryParams = event.queryStringParameters || {};
    const user = queryParams.user || null;
    
    // --- Authenticate with Google Sheets API ---
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.SPREADSHEET_ID;
    const lastHouseSheet = 'Last House Knocked';
    
    console.log('Fetching last house knocked from sheet');
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${lastHouseSheet}!A:C`, // Get all rows
    });

    const rows = response.data.values;
    if (!rows || rows.length < 1) { // Empty sheet
      console.log('No data found in Last House Knocked sheet');
      return { 
        statusCode: 404, 
        body: JSON.stringify({ 
          error: 'No data found in Last House Knocked sheet',
          lastLog: {
            streetName: 'Maple Avenue',
            doorNumber: '1',
            status: 'not-home',
            timestamp: new Date().toISOString()
          }
        }) 
      };
    }

    // If a user is specified, find their last house
    let lastHouse = null;
    if (user) {
      console.log(`Looking for last house for user: ${user}`);
      for (let i = 0; i < rows.length; i++) {
        if (rows[i][0] === user) {
          lastHouse = {
            user: rows[i][0],
            streetName: rows[i][1] || 'Maple Avenue',
            doorNumber: rows[i][2] || '1'
          };
          break;
        }
      }
    }
    
    // If no user specified or user not found, use the first entry as default
    if (!lastHouse) {
      console.log('No matching user found, using default house');
      lastHouse = {
        user: rows[0][0] || 'Unknown',
        streetName: rows[0][1] || 'Maple Avenue',
        doorNumber: rows[0][2] || '1'
      };
    }
    
    console.log('Last house found:', lastHouse);
    
    // Format as a log entry for backward compatibility
    const lastLog = {
      date: new Date().toISOString().split('T')[0],
      dayOfWeek: new Date().toLocaleDateString('en-US', { weekday: 'short' }),
      streetName: lastHouse.streetName,
      doorNumber: lastHouse.doorNumber,
      status: 'not-home', // Default status
      timestamp: new Date().toISOString(),
      user: lastHouse.user
    };

    console.log('Created last log entry:', lastLog);
    return { 
      statusCode: 200, 
      body: JSON.stringify({ lastLog }) 
    };

  } catch (error) {
    console.error('Error fetching last log:', error);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ 
        error: 'Failed to fetch last log', 
        details: error.message,
        lastLog: null
      }) 
    };
  }
}; 