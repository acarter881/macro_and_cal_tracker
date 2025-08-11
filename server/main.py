"""Expose the FastAPI ``app`` instance for ASGI servers.

This module allows the server package to be executed in a couple of ways:

* ``uvicorn server.main:app`` when the ``server`` package is on the import
  path.
* ``python server/main.py`` when running from within the ``server`` directory.

Previously, ``main.py`` unconditionally imported ``app`` using an absolute
import.  This worked only when executing the file directly from the ``server``
directory but failed when the module was imported as part of the ``server``
package (e.g. ``uvicorn server.main:app``).  That scenario raised a
``ModuleNotFoundError`` because the top-level ``app`` module could not be
found.

To support both use cases we try a package-relative import first and fall back
to the absolute import when ``main.py`` is executed as a script.
"""

try:  # pragma: no cover - exercised in integration but trivial to test
    from .app import app
except ImportError:  # pragma: no cover
    from app import app  # type: ignore

