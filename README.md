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

## Keyboard Shortcuts

The application supports a few global shortcuts:

- `Ctrl+M` — add a new meal.
- `Ctrl+F` — focus the food search box.
- `Ctrl+Shift+L` — toggle between light and dark themes.
- `?` — show the in-app shortcuts help.
