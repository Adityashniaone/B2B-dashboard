const { google } = require("googleapis");

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT),
  scopes: [
    "https://www.googleapis.com/auth/spreadsheets.readonly"
  ]
});

module.exports = async (req, res) => {

  try {

    const sheets = google.sheets({
      version: "v4",
      auth
    });

    const response = await sheets.spreadsheets.values.get({

      spreadsheetId: "1dqfRCXkHBNcQ5VUl3RrzI_a5wnJX369BPsLU8GSRGmg",

      range: "B2B"

    });

    const rows = response.data.values;

    if (!rows || rows.length === 0) {
      res.status(200).json([]);
      return;
    }

    const headers = rows.shift();

    const data = rows.map(row => {

      let obj = {};

      headers.forEach((h, i) => {

        obj[h] = row[i];

      });

      return obj;

    });

    res.status(200).json(data);

  } catch (err) {

    console.error(err);

    res.status(500).json({ error: err.message || "Failed to fetch sheet data" });

  }

};
