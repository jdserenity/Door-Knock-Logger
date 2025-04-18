const { google } = require('googleapis');

// Helper to parse credentials safely
function parseCredentials(credsString) {
  try {
    return JSON.parse(credsString || '{}');
  } catch (e) {
    console.error('Failed to parse GOOGLE_CREDENTIALS', e);
    return {};
  }
}

exports.handler = async (event) => {
  console.log('delete-log function invoked.');

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let requestBody;
  try {
    if (!event.body || event.body.trim() === '') {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing request body' }) };
    }
    requestBody = JSON.parse(event.body);
    console.log('Parsed delete request body:', requestBody);
  } catch (e) {
    console.error('Error parsing delete request body:', e);
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body', details: e.message }) };
  }

  // In the new format, we need the date, interval, and status to identify which count to decrement
  const { date, interval, status } = requestBody;

  if (!date || !interval || !status) {
    console.error('Missing required fields in request body');
    return { statusCode: 400, body: JSON.stringify({ 
      error: 'Missing required fields', 
      message: 'Please provide date, interval, and status to identify which count to decrement' 
    }) };
  }

  // --- Check environment variables --- 
  if (!process.env.GOOGLE_CREDENTIALS) {
    console.error('Missing GOOGLE_CREDENTIALS');
    return { statusCode: 500, body: JSON.stringify({ error: 'Server configuration error (Credentials)' }) };
  }
  if (!process.env.SPREADSHEET_ID) {
    console.error('Missing SPREADSHEET_ID');
    return { statusCode: 500, body: JSON.stringify({ error: 'Server configuration error (Spreadsheet ID)' }) };
  }

  try {
    // --- Authenticate --- 
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.SPREADSHEET_ID;

    // Define the sheet
    const sheetName = 'Daily Stats';
    
    // Find the row with matching date and interval
    console.log(`Looking for row with date=${date} and interval=${interval}`);
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:C`, // Get date and interval columns
    });
    
    if (!response.data.values) {
      console.log('No data found in sheet');
      return { statusCode: 404, body: JSON.stringify({ message: 'No data found in sheet' }) };
    }
    
    const rows = response.data.values;
    let rowIndex = -1;
    
    // Start from row 1 to skip header
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === date && rows[i][2] === interval) {
        rowIndex = i;
        break;
      }
    }
    
    if (rowIndex === -1) {
      console.log(`No matching row found for date=${date} and interval=${interval}`);
      return { statusCode: 404, body: JSON.stringify({ 
        message: 'No matching interval found in the sheet' 
      }) };
    }
    
    // Get the current counts for this row
    const countsResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!I${rowIndex + 1}:K${rowIndex + 1}`, // Get the count columns
    });
    
    if (!countsResponse.data.values || !countsResponse.data.values[0]) {
      console.log('Count data not found for the row');
      return { statusCode: 404, body: JSON.stringify({ message: 'Count data not found for the interval' }) };
    }
    
    // Extract current counts
    const [notHomeCount, openedCount, estimateCount] = countsResponse.data.values[0].map(val => parseInt(val) || 0);
    console.log(`Current counts - NotHome: ${notHomeCount}, Opened: ${openedCount}, Estimate: ${estimateCount}`);
    
    // Determine which column to decrement based on status
    let updatedCounts;
    
    switch (status) {
      case 'not-home':
        if (notHomeCount <= 0) {
          return { statusCode: 400, body: JSON.stringify({ 
            message: 'Cannot decrement not-home count, already at 0' 
          }) };
        }
        updatedCounts = [notHomeCount - 1, openedCount, estimateCount];
        break;
      case 'opened':
        if (openedCount <= 0) {
          return { statusCode: 400, body: JSON.stringify({ 
            message: 'Cannot decrement opened count, already at 0' 
          }) };
        }
        updatedCounts = [notHomeCount, openedCount - 1, estimateCount];
        break;
      case 'estimate':
        if (estimateCount <= 0) {
          return { statusCode: 400, body: JSON.stringify({ 
            message: 'Cannot decrement estimate count, already at 0' 
          }) };
        }
        updatedCounts = [notHomeCount, openedCount, estimateCount - 1];
        break;
      default:
        return { statusCode: 400, body: JSON.stringify({ 
          message: `Unknown status: ${status}` 
        }) };
    }
    
    console.log(`Updating counts to: NotHome=${updatedCounts[0]}, Opened=${updatedCounts[1]}, Estimate=${updatedCounts[2]}`);
    
    // Update the counts in the sheet
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!I${rowIndex + 1}:K${rowIndex + 1}`,
      valueInputOption: 'USER_ENTERED',
      resource: { 
        values: [updatedCounts.map(count => count.toString())] 
      },
    });
    
    console.log(`Successfully decremented ${status} count for ${date} at interval ${interval}`);
    return { statusCode: 200, body: JSON.stringify({ message: 'Count decremented successfully' }) };

  } catch (error) {
    console.error('Error during count decrement:', error);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ 
        error: 'Failed to decrement count', 
        details: error.message
      }) 
    };
  }
}; 