# macro_and_cal_tracker
Tracking macros and calories in an easy-to-use app

## Installation

The backend dependencies are pinned in `requirements.txt` for reproducible
environment setup. Install them with:

```
pip install -r requirements.txt
```

## Environment Variables

The frontend reads `VITE_API_BASE_URL` to know where to send API requests. If this
variable is not set, the app falls back to `window.location.origin`.

Create `.env` files under the `web/` directory to configure the API location for
different builds:

```
# web/.env.development
VITE_API_BASE_URL=http://localhost:8000

# web/.env.desktop
VITE_API_BASE_URL=http://localhost:8000

# web/.env.production
VITE_API_BASE_URL=https://example.com
```

Production builds use `npm run build` and desktop builds use `npm run build:desktop`.

## Keyboard Shortcuts

The application supports a few global shortcuts:

- `Ctrl+M` — add a new meal.
- `Ctrl+F` — focus the food search box.
- `Ctrl+Shift+L` — toggle between light and dark themes.
- `?` — show the in-app shortcuts help.

## Database Migrations

This project uses Alembic to manage database schema changes. Migrations run
automatically when the API starts, ensuring the database is up to date. You can
also apply them manually by executing:

```
python -m server.run_migrations
```

The initial migration adds the `sort_order` column to `meal` and `foodentry`
tables and an `archived` column to `food`.

## Daily Goals

When you save macro goals they are stored as the default for future days. New dates
will automatically use the most recently saved goals unless you override them for
that specific day.
