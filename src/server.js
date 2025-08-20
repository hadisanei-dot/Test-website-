const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/flights', async (req, res) => {
  try {
    const bbox = req.query.bbox;
    if (!bbox) {
      return res.status(400).json({ error: "Missing 'bbox' query param. Expected 'south,north,west,east'." });
    }
    const parts = bbox.split(',').map(Number);
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) {
      return res.status(400).json({ error: "Invalid 'bbox' param; expected 4 comma-separated numbers." });
    }
    const [south, north, west, east] = parts;
    const url = `https://opensky-network.org/api/states/all?bbox=${south},${north},${west},${east}`;

    const response = await fetch(url, { timeout: 10000 });
    if (!response.ok) {
      return res.status(502).json({ error: `Upstream error ${response.status}` });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error fetching flights:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Flight tracker server running on http://localhost:${PORT}`);
});

