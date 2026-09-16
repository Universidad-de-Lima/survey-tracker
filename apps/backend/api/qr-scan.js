const { getFirebaseDb } = require('../lib/firebase');

const db = getFirebaseDb();

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  console.log('Solicitud de QR Scan recibida.');

  try {
    const scannedRef = db.ref('survey_counts/scanned');
    await scannedRef.transaction((currentCount) => {
      return (currentCount || 0) + 1;
    });
    console.log('Contador de escaneos actualizado en Firebase.');

    res.writeHead(302, {
      Location: process.env.ZOHO_SURVEY_URL,
    });
    res.end();
  } catch (error) {
    console.error('Error al procesar QR scan y redirigir:', error);
    res.status(500).json({ error: 'Error al procesar la solicitud de escaneo QR.' });
  }
};
