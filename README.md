# macro_and_cal_tracker
Tracking macros and calories in an easy-to-use app

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

## Database Migrations

The backend uses Alembic for database migrations. When the API starts it will
automatically run any pending migrations. To apply migrations manually, run:

```
alembic upgrade head
```

This ensures the database has the latest columns, such as `sort_order` on meals
and food entries and the `archived` flag on foods.

## Keyboard Shortcuts

The application supports a few global shortcuts:

- `Ctrl+M` — add a new meal.
- `Ctrl+F` — focus the food search box.
- `Ctrl+Shift+L` — toggle between light and dark themes.
- `?` — show the in-app shortcuts help.

## Daily Goals

When you save macro goals they are stored as the default for future days. New dates
will automatically use the most recently saved goals unless you override them for
that specific day.
