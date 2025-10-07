const axios = require('axios');

async function testFBRPDF() {
  try {
    console.log('🐛 Testing FBR PDF Generation with Debug...\n');

    const token = '6a95ce3a-7c6f-48d6-9151-211ba1336212';
    const taxReturnId = 'TR-1758264202121';

    console.log('📋 Calling FBR PDF endpoint...');
    const response = await axios.post(
      `http://localhost:3001/api/reports/tax-return-pdf/${taxReturnId}`,
      {},
      {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'stream'
      }
    );

    console.log('✅ PDF generation response received');
    console.log('📊 Status:', response.status);
    console.log('📦 Content-Type:', response.headers['content-type']);

    // Save the PDF to check its contents
    const fs = require('fs');
    const path = require('path');
    const pdfPath = path.join(__dirname, 'debug-fbr-output.pdf');

    const writer = fs.createWriteStream(pdfPath);
    response.data.pipe(writer);

    writer.on('finish', () => {
      console.log(`✅ PDF saved to: ${pdfPath}`);
      console.log('🔍 Please check the PDF values manually to see what is actually generated');
    });

    writer.on('error', (err) => {
      console.error('❌ Error saving PDF:', err);
    });

  } catch (error) {
    console.error('❌ Error testing FBR PDF:', error.message);
    if (error.response) {
      console.error('❌ Status:', error.response.status);
      console.error('❌ Response:', error.response.data);
    }
  }
}

testFBRPDF();