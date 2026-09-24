# Wenthruhome Website + Private Admin

A premium serviced-apartment website with dedicated property pages, multi-photo galleries, calendar-based date selection, booking requests, WhatsApp handoff, Google Maps location, and a private admin dashboard.

## Run locally
1. Install Node.js.
2. Open this folder in VS Code.
3. Run `npm.cmd install` on Windows PowerShell if `npm` is blocked by execution policy.
4. Run `npm.cmd start`.
5. Open `http://localhost:3000`.
6. Admin: `http://localhost:3000/admin`.

## Admin demo
Use the values in your `.env` file. Do not use the demo password in production.

## Environment
Create `.env` in the project root:

```env
PORT=3000
NODE_ENV=development
SESSION_SECRET=replace-with-a-long-random-secret
ADMIN_EMAIL=admin@wenthruhome.local
ADMIN_PASSWORD=ChangeMe123!
WHATSAPP_NUMBER=234XXXXXXXXXX
```

For Render with a persistent disk, use `STORAGE_DIR=/var/data` so the SQLite database and uploaded property photos survive deploys/restarts.

## Main features
- Responsive premium public interface
- Dedicated `/apartments/...` property pages
- Multi-photo gallery and full-screen lightbox
- Property facts, description, facilities, nearby attractions and rules
- Calendar date selection with check-in/check-out
- Automatic stay duration and estimated total
- Live Google Maps embed + directions link
- Booking request saved to SQLite
- Ready-to-pay WhatsApp message with property/date/price/customer details
- Private admin dashboard
- Admin property editor for rich listing information and photo galleries
- Availability status controls

Replace placeholder images, logo, property information and contact details before launch.

## Render persistence checklist

For production deployment on Render, configure a paid persistent disk and set:

```env
STORAGE_DIR=/var/data
```

The disk must actually be mounted at `/var/data`. The application stores its SQLite database under `/var/data/data/wenthruhome.db` and uploaded photos under `/var/data/uploads/` when this setting is active. A free Render web service does not provide persistent disk storage, so setting the variable alone does not make data permanent.

## Categorized gallery

When adding or editing a property in the admin panel, enter a gallery category/area such as `Front Exterior`, `Living Room`, `Bedroom 1`, or `Bathroom`, then upload photos. Save again with another category to add another group. Existing legacy images remain supported under `Property photos`.


## Gallery upload behavior

- The admin upload accepts up to 100 image files per save.
- Gallery categories are flexible. Suggested categories include `Exterior`, `Backyard`, and `Interior (Rooms & Kitchen)`.
- You can use any custom category name and save repeatedly to build a larger gallery.
- There is no two-photo limit in the server upload route.
