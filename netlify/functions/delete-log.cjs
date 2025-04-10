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

  const { timestampToDelete } = requestBody;

  if (!timestampToDelete) {
    console.error('Missing timestampToDelete in request body');
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing timestampToDelete field' }) };
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

    // Define the sheet and timestamp column
    const sheetName = 'Sheet1';
    const timestampColumn = 'L'; // Column L has the timestamp
    
    // For parsing and comparing timestamps
    const targetTimestamp = new Date(timestampToDelete).getTime();
    
    // Step 1: Get the spreadsheet metadata to find the correct sheet ID
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: spreadsheetId,
    });
    
    const targetSheet = spreadsheet.data.sheets.find(sheet => 
      sheet.properties.title === sheetName);
    
    if (!targetSheet) {
      console.error(`Sheet "${sheetName}" not found in spreadsheet`);
      return { statusCode: 404, body: JSON.stringify({ error: `Sheet "${sheetName}" not found` }) };
    }
    
    const sheetId = targetSheet.properties.sheetId;
    
    // Step 2: Find the row with the timestamp
    console.log(`Searching for timestamp: ${timestampToDelete} (unix time: ${targetTimestamp})`);
    const valuesResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: `${sheetName}!${timestampColumn}:${timestampColumn}`,
      valueRenderOption: 'UNFORMATTED_VALUE', // Get raw values to avoid formatting issues
    });
    
    if (!valuesResponse.data.values) {
      console.log('No data found in sheet');
      return { statusCode: 404, body: JSON.stringify({ message: 'No data found in sheet' }) };
    }
    
    // Log first few and last few timestamps from sheet for debugging
    const values = valuesResponse.data.values;
    console.log(`Sheet has ${values.length} rows with timestamps`);
    if (values.length > 0) {
      const sampleSize = Math.min(3, values.length);
      console.log('First few timestamps in sheet:');
      for (let i = 0; i < sampleSize; i++) {
        console.log(`Row ${i+1}: "${values[i]?.[0] || 'empty'}" (type: ${typeof values[i]?.[0]})`);
      }
      
      if (values.length > sampleSize) {
        console.log('Last few timestamps in sheet:');
        for (let i = values.length - sampleSize; i < values.length; i++) {
          console.log(`Row ${i+1}: "${values[i]?.[0] || 'empty'}" (type: ${typeof values[i]?.[0]})`);
        }
      }
    }
    
    // Find the row index containing our timestamp
    let rowToDelete = -1;
    
    // Try multiple match strategies
    values.forEach((row, index) => {
      const sheetValue = row[0];
      
      // Strategy 1: Direct string comparison (exact match)
      if (sheetValue === timestampToDelete) {
        console.log(`Found exact string match at row ${index + 1}: "${sheetValue}"`);
        rowToDelete = index + 1;
        return;
      }
      
      // Strategy 2: Compare as Date objects (if both are valid dates)
      try {
        if (sheetValue && typeof sheetValue === 'string') {
          const sheetTimestamp = new Date(sheetValue).getTime();
          if (!isNaN(sheetTimestamp) && sheetTimestamp === targetTimestamp) {
            console.log(`Found timestamp match at row ${index + 1}: "${sheetValue}" matches ${timestampToDelete}`);
            rowToDelete = index + 1;
            return;
          }
        }
      } catch (e) {
        // Skip this row if date parsing fails
      }
    });
    
    if (rowToDelete === -1) {
      console.log(`Timestamp ${timestampToDelete} not found using exact or date matching`);
      
      // Strategy 3: Try substring match as a last resort
      values.forEach((row, index) => {
        const sheetValue = row[0];
        if (sheetValue && typeof sheetValue === 'string' && 
            (sheetValue.includes(timestampToDelete) || timestampToDelete.includes(sheetValue))) {
          console.log(`Found substring match at row ${index + 1}: "${sheetValue}" contains or is contained in "${timestampToDelete}"`);
          rowToDelete = index + 1;
          return;
        }
      });
    }
    
    if (rowToDelete === -1) {
      console.log(`Timestamp ${timestampToDelete} not found after trying all matching strategies`);
      return { statusCode: 404, body: JSON.stringify({ message: 'Log timestamp not found in sheet' }) };
    }
    
    console.log(`Found timestamp at row ${rowToDelete}, proceeding with deletion`);
    
    // Step 3: Delete the row using the proper batchUpdate API
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheetId,
                dimension: "ROWS",
                startIndex: rowToDelete - 1, // 0-indexed
                endIndex: rowToDelete,      // exclusive end index
              }
            }
          }
        ]
      }
    });
    
    console.log(`Successfully deleted row ${rowToDelete}`);
    return { statusCode: 200, body: JSON.stringify({ message: 'Log deleted successfully' }) };

  } catch (error) {
    console.error('Error during sheet deletion process:', error);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ 
        error: 'Failed to delete log from sheet', 
        details: error.message
      }) 
    };
  }
}; 