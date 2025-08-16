import os
import sys
from pathlib import Path
import asyncio

import pytest

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
os.environ.setdefault("PYTHONPATH", str(ROOT))

from server import utils


@pytest.fixture(autouse=True)
def close_usda_client():
    yield
    asyncio.run(utils.aclose_usda_client())
