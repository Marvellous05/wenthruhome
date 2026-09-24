require("dotenv").config();

const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
app.set("trust proxy", 1);
const PORT = Number(process.env.PORT || 3000);

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, "public");
const STORAGE = process.env.STORAGE_DIR || path.join(ROOT, "storage");
if (process.env.NODE_ENV === "production" && !process.env.STORAGE_DIR) {
  console.warn("WARNING: STORAGE_DIR is not set. Configure a Render persistent disk mount (for example /var/data) before production use.");
}
const UPLOADS = path.join(STORAGE, "uploads");
const DATA = path.join(STORAGE, "data");

fs.mkdirSync(UPLOADS, { recursive: true });
fs.mkdirSync(DATA, { recursive: true });

const db = new Database(path.join(DATA, "wenthruhome.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS properties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    location TEXT NOT NULL,
    price INTEGER NOT NULL,
    price_period TEXT NOT NULL DEFAULT 'per night',
    bedrooms INTEGER DEFAULT 1,
    bathrooms INTEGER DEFAULT 1,
    guests INTEGER DEFAULT 2,
    description TEXT DEFAULT '',
    property_type TEXT DEFAULT 'Serviced Apartment',
    property_size TEXT DEFAULT '',
    amenities TEXT DEFAULT '',
    nearby_attractions TEXT DEFAULT '',
    rules TEXT DEFAULT '',
    address TEXT DEFAULT '',
    maps_url TEXT DEFAULT 'https://maps.app.goo.gl/iMhQxUqJk9s43V2t5',
    map_query TEXT DEFAULT 'Wenthruhome Apt, Idimu, Lagos',
    image TEXT NOT NULL,
    images TEXT DEFAULT '',
    gallery TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'available',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id INTEGER NOT NULL,
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    check_in TEXT,
    check_out TEXT,
    message TEXT DEFAULT '',
    duration_days INTEGER DEFAULT 1,
    total_amount INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(property_id) REFERENCES properties(id) ON DELETE CASCADE
  );
`);

// Migrations for databases created by earlier Wenthruhome versions.
const bookingColumns = db.prepare("PRAGMA table_info(bookings)").all();
if (!bookingColumns.some(c => c.name === "duration_days")) {
  db.exec("ALTER TABLE bookings ADD COLUMN duration_days INTEGER DEFAULT 1");
}
if (!bookingColumns.some(c => c.name === "total_amount")) {
  db.exec("ALTER TABLE bookings ADD COLUMN total_amount INTEGER DEFAULT 0");
}

const propertyColumns = db.prepare("PRAGMA table_info(properties)").all();
const propertyMigrations = [
  ["property_type", "TEXT DEFAULT 'Serviced Apartment'"],
  ["property_size", "TEXT DEFAULT ''"],
  ["nearby_attractions", "TEXT DEFAULT ''"],
  ["rules", "TEXT DEFAULT ''"],
  ["address", "TEXT DEFAULT ''"],
  ["maps_url", "TEXT DEFAULT 'https://maps.app.goo.gl/iMhQxUqJk9s43V2t5'"],
  ["map_query", "TEXT DEFAULT 'Wenthruhome Apt, Idimu, Lagos'"]
];
for (const [name, definition] of propertyMigrations) {
  if (!propertyColumns.some(c => c.name === name)) db.exec(`ALTER TABLE properties ADD COLUMN ${name} ${definition}`);
}
if (!propertyColumns.some(c => c.name === "price_period")) {
  db.exec("ALTER TABLE properties ADD COLUMN price_period TEXT NOT NULL DEFAULT 'per night'");
}
if (!propertyColumns.some(c => c.name === "gallery")) {
  db.exec("ALTER TABLE properties ADD COLUMN gallery TEXT DEFAULT ''");
}
if (!propertyColumns.some(c => c.name === "images")) {
  db.exec("ALTER TABLE properties ADD COLUMN images TEXT DEFAULT ''");
  db.prepare("UPDATE properties SET images = image WHERE images IS NULL OR images = ''").run();
}

function normaliseImages(row) {
  let images = [];
  try { images = JSON.parse(row.images || "[]"); } catch {}
  if (!Array.isArray(images) || !images.length) images = row.image ? [row.image] : [];
  return images.filter(Boolean);
}

function normaliseGallery(row) {
  let gallery = [];
  try { gallery = JSON.parse(row.gallery || "[]"); } catch {}
  if (!Array.isArray(gallery)) gallery = [];
  return gallery.map((group) => ({
    name: String(group?.name || "General").trim() || "General",
    images: Array.isArray(group?.images) ? group.images.filter(Boolean) : []
  })).filter(group => group.images.length);
}

function galleryWithLegacyImages(row) {
  const gallery = normaliseGallery(row);
  if (gallery.length) return gallery;
  const legacy = normaliseImages(row);
  return legacy.length ? [{ name: "Property photos", images: legacy }] : [];
}

const adminEmail = process.env.ADMIN_EMAIL || "admin@wenthruhome.local";
const adminPassword = process.env.ADMIN_PASSWORD || "ChangeMe123!";

if (!db.prepare("SELECT id FROM admins WHERE email = ?").get(adminEmail)) {
  const hash = bcrypt.hashSync(adminPassword, 12);
  db.prepare("INSERT INTO admins (email, password_hash) VALUES (?, ?)").run(adminEmail, hash);
}

const count = db.prepare("SELECT COUNT(*) AS count FROM properties").get().count;
if (count === 0) {
  db.prepare(`
    INSERT INTO properties
    (title, location, price, price_period, bedrooms, bathrooms, guests, description, property_type, property_size, amenities, nearby_attractions, rules, address, maps_url, map_query, image, images, gallery, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    "Luxury 2 Bedroom Serviced Apartment",
    "Lekki Phase 1, Lagos",
    250000,
    "per night",
    2,
    2,
    4,
    "A polished demo listing for Wenthruhome. Replace this content with the client's real apartment information.",
    "Serviced Apartment",
    "",
    "Wi-Fi, 24/7 Power, Parking, Smart TV, Air Conditioning, Security",
    "Lekki Phase 1 · 10 mins from major business and leisure spots",
    "No smoking indoors\nNo pets unless approved\nCheck-in from 2:00 PM\nCheck-out by 12:00 PM",
    "Wenthruhome Apt, Idimu, Lagos 102213",
    "https://maps.app.goo.gl/iMhQxUqJk9s43V2t5",
    "Wenthruhome Apt, Idimu, Lagos",
    "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1400&q=85",
    JSON.stringify(["https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1400&q=85"]),
    JSON.stringify([{ name: "Property photos", images: ["https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1400&q=85"] }]),
    "available"
  );
}

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || "dev-only-change-this-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 8
  }
}));

app.get('/apartments/:slug', (_req, res) => res.sendFile(path.join(PUBLIC, 'index.html')));

app.use("/uploads", express.static(UPLOADS));
app.use(express.static(PUBLIC));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "-");
    cb(null, `${Date.now()}-${safe}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error("Only image files are allowed."));
  }
});

function requireAdmin(req, res, next) {
  if (!req.session.adminId) return res.status(401).json({ error: "Admin login required." });
  next();
}

function propertyForClient(row) {
  const images = normaliseImages(row);
  return {
    ...row,
    image: images[0] || row.image || "",
    images,
    gallery: galleryWithLegacyImages(row),
    amenities: row.amenities ? row.amenities.split(",").map(x => x.trim()).filter(Boolean) : [],
    property_type: row.property_type || "Serviced Apartment",
    property_size: row.property_size || "",
    nearby_attractions: row.nearby_attractions || "",
    rules: row.rules || "",
    address: row.address || row.location || "",
    maps_url: row.maps_url || "https://maps.app.goo.gl/iMhQxUqJk9s43V2t5",
    map_query: row.map_query || row.address || row.location || "Wenthruhome Apt, Idimu, Lagos"
  };
}

app.get("/api/public-config", (_req, res) => {
  res.json({
    whatsappNumber: String(process.env.WHATSAPP_NUMBER || "").replace(/\D/g, "")
  });
});

app.get("/api/properties", (_req, res) => {
  const rows = db.prepare("SELECT * FROM properties ORDER BY id DESC").all();
  res.json(rows.map(propertyForClient));
});

app.get("/api/properties/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM properties WHERE id = ?").get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: "Property not found." });
  res.json(propertyForClient(row));
});

app.post("/api/bookings", (req, res) => {
  const { propertyId, customerName, phone, checkIn, checkOut, message, durationDays, totalAmount } = req.body;
  if (!propertyId || !customerName || !phone || !durationDays) {
    return res.status(400).json({ error: "Property, name, phone and stay duration are required." });
  }

  const property = db.prepare("SELECT * FROM properties WHERE id = ?").get(Number(propertyId));
  if (!property) return res.status(404).json({ error: "Property not found." });
  if (property.status !== "available") return res.status(400).json({ error: "This property is not currently available." });

  const days = Math.max(1, Math.floor(Number(durationDays)));
  const total = Math.max(0, Math.round(Number(totalAmount) || 0));

  const result = db.prepare(`
    INSERT INTO bookings (property_id, customer_name, phone, check_in, check_out, message, duration_days, total_amount)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    Number(propertyId),
    String(customerName).trim(),
    String(phone).trim(),
    checkIn || "",
    checkOut || "",
    message || "",
    days,
    total
  );

  res.status(201).json({ ok: true, bookingId: result.lastInsertRowid });
});

app.post("/api/admin/login", (req, res) => {
  const { email, password } = req.body;
  const admin = db.prepare("SELECT * FROM admins WHERE email = ?").get(String(email || "").trim().toLowerCase());

  if (!admin || !bcrypt.compareSync(String(password || ""), admin.password_hash)) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  req.session.adminId = admin.id;
  req.session.adminEmail = admin.email;
  res.json({ ok: true });
});

app.post("/api/admin/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/admin/me", (req, res) => {
  res.json({
    authenticated: Boolean(req.session.adminId),
    email: req.session.adminEmail || null
  });
});

app.get("/api/admin/properties", requireAdmin, (_req, res) => {
  const rows = db.prepare("SELECT * FROM properties ORDER BY id DESC").all();
  res.json(rows.map(propertyForClient));
});

app.get("/api/admin/bookings", requireAdmin, (_req, res) => {
  const rows = db.prepare(`
    SELECT b.*, p.title AS property_title
    FROM bookings b
    LEFT JOIN properties p ON p.id = b.property_id
    ORDER BY b.id DESC
  `).all();
  res.json(rows);
});

app.post("/api/admin/properties", requireAdmin, upload.array("images", 100), (req, res) => {
  const {
    title, location, price, pricePeriod, bedrooms, bathrooms, guests,
    description, propertyType, propertySize, amenities, nearbyAttractions, rules, address, mapsUrl, mapQuery, status, imageUrl, imageUrls, replaceImages, galleryCategory
  } = req.body;

  if (!title || !location || !price) {
    return res.status(400).json({ error: "Title, location and price are required." });
  }

  const allowedPricePeriods = ["per night", "per week", "per month", "per year", "contact for price"];
  const selectedPricePeriod = allowedPricePeriods.includes(String(pricePeriod || "").toLowerCase())
    ? String(pricePeriod).toLowerCase()
    : "per night";

  const uploadedImages = (req.files || []).map(file => `/uploads/${file.filename}`);
  const suppliedImages = String(imageUrls || imageUrl || "")
    .split(/\n|,/).map(x => x.trim()).filter(Boolean);
  const images = [...uploadedImages, ...suppliedImages];
  if (!images.length) images.push("https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1400&q=85");
  const image = images[0];
  const categoryName = String(galleryCategory || "Property photos").trim() || "Property photos";
  const gallery = [{ name: categoryName, images }];

  const result = db.prepare(`
    INSERT INTO properties
    (title, location, price, price_period, bedrooms, bathrooms, guests, description, property_type, property_size, amenities, nearby_attractions, rules, address, maps_url, map_query, image, images, gallery, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    title.trim(),
    location.trim(),
    Number(price),
    selectedPricePeriod,
    Number(bedrooms || 1),
    Number(bathrooms || 1),
    Number(guests || 2),
    description || "",
    propertyType || "Serviced Apartment",
    propertySize || "",
    amenities || "",
    nearbyAttractions || "",
    rules || "",
    address || location.trim(),
    mapsUrl || "https://maps.app.goo.gl/iMhQxUqJk9s43V2t5",
    mapQuery || address || location.trim(),
    image,
    JSON.stringify(images),
    JSON.stringify(gallery),
    status || "available"
  );

  res.status(201).json({ ok: true, id: result.lastInsertRowid });
});

app.put("/api/admin/properties/:id", requireAdmin, upload.array("images", 100), (req, res) => {
  const id = Number(req.params.id);
  const old = db.prepare("SELECT * FROM properties WHERE id = ?").get(id);
  if (!old) return res.status(404).json({ error: "Property not found." });

  const {
    title, location, price, pricePeriod, bedrooms, bathrooms, guests,
    description, propertyType, propertySize, amenities, nearbyAttractions, rules, address, mapsUrl, mapQuery, status, imageUrl, imageUrls, replaceImages, galleryCategory
  } = req.body;

  const allowedPricePeriods = ["per night", "per week", "per month", "per year", "contact for price"];
  const selectedPricePeriod = allowedPricePeriods.includes(String(pricePeriod || "").toLowerCase())
    ? String(pricePeriod).toLowerCase()
    : (old.price_period || "per night");

  const uploadedImages = (req.files || []).map(file => `/uploads/${file.filename}`);
  const suppliedImages = String(imageUrls || imageUrl || "")
    .split(/\n|,/).map(x => x.trim()).filter(Boolean);
  let images = normaliseImages(old);
  if (replaceImages === "on") images = [];
  images = [...images, ...uploadedImages, ...suppliedImages].filter(Boolean);
  if (!images.length) images = [old.image || "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1400&q=85"];
  const image = images[0];
  let gallery = normaliseGallery(old);
  if (replaceImages === "on") gallery = [];
  if (uploadedImages.length || suppliedImages.length) {
    const categoryName = String(galleryCategory || "Property photos").trim() || "Property photos";
    let group = gallery.find(item => item.name.toLowerCase() === categoryName.toLowerCase());
    if (!group) { group = { name: categoryName, images: [] }; gallery.push(group); }
    group.images.push(...uploadedImages, ...suppliedImages);
  }
  if (!gallery.length) gallery = [{ name: "Property photos", images }];

  db.prepare(`
    UPDATE properties SET
      title = ?, location = ?, price = ?, price_period = ?, bedrooms = ?, bathrooms = ?,
      guests = ?, description = ?, property_type = ?, property_size = ?, amenities = ?, nearby_attractions = ?, rules = ?, address = ?, maps_url = ?, map_query = ?, image = ?, images = ?, gallery = ?, status = ?
    WHERE id = ?
  `).run(
    title.trim(),
    location.trim(),
    Number(price),
    selectedPricePeriod,
    Number(bedrooms || 1),
    Number(bathrooms || 1),
    Number(guests || 2),
    description || "",
    propertyType || "Serviced Apartment",
    propertySize || "",
    amenities || "",
    nearbyAttractions || "",
    rules || "",
    address || location.trim(),
    mapsUrl || "https://maps.app.goo.gl/iMhQxUqJk9s43V2t5",
    mapQuery || address || location.trim(),
    image,
    JSON.stringify(images),
    JSON.stringify(gallery),
    status || "available",
    id
  );

  res.json({ ok: true });
});

app.patch("/api/admin/properties/:id/status", requireAdmin, (req, res) => {
  const allowed = ["available", "unavailable", "sold-out"];
  if (!allowed.includes(req.body.status)) {
    return res.status(400).json({ error: "Invalid status." });
  }

  const result = db.prepare("UPDATE properties SET status = ? WHERE id = ?")
    .run(req.body.status, Number(req.params.id));

  if (!result.changes) return res.status(404).json({ error: "Property not found." });
  res.json({ ok: true });
});

app.delete("/api/admin/properties/:id", requireAdmin, (req, res) => {
  const property = db.prepare("SELECT * FROM properties WHERE id = ?").get(Number(req.params.id));
  if (!property) return res.status(404).json({ error: "Property not found." });

  for (const image of normaliseImages(property)) {
    if (image.startsWith("/uploads/")) {
      const filePath = path.join(UPLOADS, path.basename(image));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  }

  db.prepare("DELETE FROM properties WHERE id = ?").run(Number(req.params.id));
  res.json({ ok: true });
});

app.get("/admin", (_req, res) => {
  res.sendFile(path.join(PUBLIC, "admin.html"));
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(400).json({ error: err.message || "Something went wrong." });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Wenthruhome running at http://localhost:${PORT}`);
  console.log(`Admin portal: http://localhost:${PORT}/admin`);
  console.log(`Demo admin email: ${adminEmail}`);
  console.log(`Demo admin password: ${adminPassword}`);
});
