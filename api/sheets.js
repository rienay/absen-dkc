// Vercel Serverless Function Proxy for Google Apps Script
// This allows forwarding requests to Google Sheets API without CORS issues
// and allows setting GOOGLE_SHEETS_URL as an environment variable in Vercel.

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Get Google Sheets Script URL from env or query param
  const targetUrl = process.env.GOOGLE_SHEETS_URL || req.query.targetUrl;

  if (!targetUrl) {
    return res.status(400).json({
      status: 'error',
      message: 'GOOGLE_SHEETS_URL environment variable or targetUrl query parameter is missing.'
    });
  }

  try {
    if (req.method === 'GET') {
      const queryParams = new URLSearchParams(req.query).toString();
      const fetchUrl = `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}${queryParams}`;
      
      const response = await fetch(fetchUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      const data = await response.json();
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(req.body)
      });
      const data = await response.json();
      return res.status(200).json(data);
    }

    return res.status(405).json({ status: 'error', message: 'Method Not Allowed' });
  } catch (error) {
    console.error('Proxy Error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Proxy Error: ' + error.message
    });
  }
}
