import logging

import pytest

from server.utils import _to_float


def test_to_float_valid():
    assert _to_float("1.23") == 1.23
    assert _to_float(5) == 5.0


def test_to_float_invalid_returns_zero():
    assert _to_float("abc") == 0.0
    assert _to_float(None) == 0.0


def test_to_float_unexpected_exception_logs_and_raises(caplog):
    class Boom:
        def __float__(self):
            raise RuntimeError("boom")

    with caplog.at_level(logging.ERROR, logger="server.utils"):
        with pytest.raises(RuntimeError):
            _to_float(Boom())
    assert "Unexpected error converting" in caplog.text
