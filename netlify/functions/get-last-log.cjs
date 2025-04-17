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

    // --- Authenticate with Google Sheets API ---
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.SPREADSHEET_ID;
    const sheetName = 'Sheet1';
    
    console.log('Fetching all data from sheet to find the last entry');
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:L`, // Get all relevant columns
    });

    const rows = response.data.values;
    if (!rows || rows.length <= 1) { // No data or just header row
      console.log('No data found in sheet');
      return { 
        statusCode: 404, 
        body: JSON.stringify({ 
          error: 'No data found in sheet',
          lastLog: null
        }) 
      };
    }

    // Get the last row (most recent entry, excluding header)
    const lastRow = rows[rows.length - 1];
    console.log('Last row from sheet:', lastRow);

    // Map the last row to a log object with just the fields we need for the first entry
    // Columns order (based on log.cjs): Date, DayOfWeek, Groomed, Mood, Jacket, Condition, Temp, Interval, Street, Door, Status, Timestamp
    const lastLog = {
      date: lastRow[0] || '',
      dayOfWeek: lastRow[1] || '',
      streetName: lastRow[8] || '', // Column I (index 8)
      doorNumber: lastRow[9] || '', // Column J (index 9)
      status: lastRow[10] || '',    // Column K (index 10)
      timestamp: lastRow[11] || ''  // Column L (index 11)
    };

    console.log('Formatted last log for new entry:', lastLog);
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