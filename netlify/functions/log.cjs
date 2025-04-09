const { google } = require('googleapis');

exports.handler = async (event) => {
  console.log('Function invoked with event:', event);

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { streetName, doorNumber, status, timestamp } = JSON.parse(event.body);
    console.log('Parsed request body:', { streetName, doorNumber, status, timestamp });

    if (!process.env.GOOGLE_CREDENTIALS) {
      console.error('Missing GOOGLE_CREDENTIALS environment variable');
      return { 
        statusCode: 500, 
        body: JSON.stringify({ error: 'Missing Google credentials configuration' })
      };
    }

    if (!process.env.SPREADSHEET_ID) {
      console.error('Missing SPREADSHEET_ID environment variable');
      return { 
        statusCode: 500, 
        body: JSON.stringify({ error: 'Missing spreadsheet ID configuration' })
      };
    }

    // Authenticate with Google Sheets API
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    console.log('Attempting to append to spreadsheet:', process.env.SPREADSHEET_ID);

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: 'Sheet1!A:D',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [[timestamp, streetName, doorNumber, status]],
      },
    });
    
    console.log('Successfully appended data to spreadsheet');
    return { statusCode: 200, body: JSON.stringify({ message: 'Log added' }) };
  } catch (error) {
    console.error('Error in function:', error);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ 
        error: 'Failed to add log', 
        details: error.message 
      }) 
    };
  }
};