const express = require("express");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const db = new Database(path.join(__dirname, "marketplace.db"));

db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    price REAL NOT NULL CHECK(price >= 0),
    currency TEXT NOT NULL DEFAULT 'MAD',
    category TEXT NOT NULL,
    city TEXT NOT NULL,
    country TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'en',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", name: "MARKETPLACE.MA" });
});

app.get("/api/listings", (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 200) : "";
  const category = typeof req.query.category === "string" ? req.query.category.trim().slice(0, 100) : "";
  const country = typeof req.query.country === "string" ? req.query.country.trim().slice(0, 100) : "";

  let sql = "SELECT * FROM listings WHERE 1 = 1";
  const params = {};
  if (q) {
    sql += " AND (title LIKE @q OR description LIKE @q)";
    params.q = `%${q}%`;
  }
  if (category) {
    sql += " AND category = @category";
    params.category = category;
  }
  if (country) {
    sql += " AND country LIKE @country";
    params.country = `%${country}%`;
  }
  sql += " ORDER BY id DESC LIMIT 100";
  res.json(db.prepare(sql).all(params));
});

app.post("/api/listings", (req, res) => {
  const body = req.body || {};
  const stringFields = ["title", "description", "category", "city", "country"];
  for (const field of stringFields) {
    if (typeof body[field] !== "string" || !body[field].trim()) {
      return res.status(400).json({ error: `Bitte das Feld "${field}" ausfüllen.` });
    }
  }
  if (body.title.trim().length > 120 || body.description.trim().length > 5000) {
    return res.status(400).json({ error: "Titel oder Beschreibung ist zu lang." });
  }
  const price = Number(body.price);
  if (!Number.isFinite(price) || price < 0) {
    return res.status(400).json({ error: "Bitte einen gültigen Preis eingeben." });
  }

  const currencies = ["MAD", "EUR", "USD"];
  const languages = ["de", "fr", "en", "ar"];
  const currency = currencies.includes(body.currency) ? body.currency : "MAD";
  const language = languages.includes(body.language) ? body.language : "en";

  const result = db.prepare(`
    INSERT INTO listings
      (title, description, price, currency, category, city, country, language)
    VALUES
      (@title, @description, @price, @currency, @category, @city, @country, @language)
  `).run({
    title: body.title.trim(),
    description: body.description.trim(),
    price,
    currency,
    category: body.category.trim().slice(0, 100),
    city: body.city.trim().slice(0, 100),
    country: body.country.trim().slice(0, 100),
    language
  });

  res.status(201).json(
    db.prepare("SELECT * FROM listings WHERE id = ?").get(result.lastInsertRowid)
  );
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`MARKETPLACE.MA läuft auf http://localhost:${PORT}`);
});
