# macro_and_cal_tracker
Tracking macros and calories in an easy-to-use app

## Installation

The backend dependencies are pinned in `requirements.txt` for reproducible
environment setup. Install them with:

```
pip install -r requirements.txt
```

### Pre-commit Hooks

Install and configure the git hooks:

```
pip install pre-commit
pre-commit install
```

Run all hooks on demand:

```
pre-commit run --all-files
```


## Environment Variables

### Frontend

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

### Backend

The API reads `ALLOWED_ORIGINS` to configure CORS. Provide a comma-separated list of allowed
origins. If the variable is not set, all origins are allowed.

For development, allow any origin:

```
export ALLOWED_ORIGINS=*
```

For production, specify the permitted domains:

```
export ALLOWED_ORIGINS=https://example.com,https://app.example.com
```

Configuration endpoints require an authentication token. Set
`CONFIG_AUTH_TOKEN` and include the same value in the `X-Config-Token`
header when calling `/api/config/usda-key`:

```
export CONFIG_AUTH_TOKEN=secret-token
curl -H "X-Config-Token: secret-token" http://localhost:8000/api/config/usda-key
```

When building the frontend, expose the token as `VITE_CONFIG_AUTH_TOKEN` so
requests automatically include the header:

```
VITE_CONFIG_AUTH_TOKEN=secret-token npm run build
```

## Keyboard Shortcuts

The application supports a few global shortcuts:

- `Ctrl+M` — add a new meal.
- `Ctrl+F` or `/` — focus the food search box.
- `Ctrl+Z` — undo the most recent delete.
- `Ctrl+Shift+Z` or `Ctrl+Y` — redo the most recent delete.
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
