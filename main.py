"""ASGI entrypoint for Uvicorn.

This allows running ``uvicorn main:app`` from the repository
root by re-exporting the FastAPI ``app`` defined in
``server.app``.
"""

from server.app import app
