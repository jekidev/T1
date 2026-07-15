#!/usr/bin/env python3
"""Unit tests for scripts/fetch_telegram_api.py.

The tests mock the `requests` and `bs4` modules so they run without network
access or third-party dependencies.
"""

from __future__ import annotations

import io
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

# Make scripts/fetch_telegram_api.py importable from this test directory.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


# Provide lightweight fake modules for requests and bs4 before importing the
# module under test. This lets the test run in environments where the real
# libraries are not installed.
class FakeResponse:
    def __init__(self, text: str, json_value=None):
        self.text = text
        self._json = json_value

    def json(self):
        if isinstance(self._json, Exception):
            raise self._json
        return self._json


class FakeSession:
    def __init__(self, responses=None):
        self.responses = responses or {}
        self.calls = []

    def post(self, url, data=None, headers=None, timeout=None):
        self.calls.append(("post", url, data, headers, timeout))
        key = ("post", url)
        if key in self.responses:
            return self.responses[key]
        return FakeResponse("")

    def get(self, url, headers=None, timeout=None):
        self.calls.append(("get", url, headers, timeout))
        key = ("get", url)
        if key in self.responses:
            return self.responses[key]
        return FakeResponse("")


class FakeTag:
    def __init__(self, text=None, sibling=None, child=None):
        self._text = text
        self._sibling = sibling
        self._child = child

    def find_next_sibling(self, name):
        return self._sibling

    def find(self, name):
        return self._child

    def get_text(self, strip=False):
        value = self._text or ""
        return value.strip() if strip else value


class FakeSoup:
    def __init__(self, html: str, parser: str):
        self.html = html

    def find(self, name, string=None):
        # The implementation looks for labels "App api_id:" and "App api_hash:".
        if string == "App api_id:":
            return self._api_id_tag()
        if string == "App api_hash:":
            return self._api_hash_tag()
        return None

    def _api_id_tag(self):
        return FakeTag(
            sibling=FakeTag(child=FakeTag(text="12345")),
        )

    def _api_hash_tag(self):
        return FakeTag(
            sibling=FakeTag(child=FakeTag(text="abc123def456")),
        )


sys.modules["requests"] = type(sys)("requests")
sys.modules["requests"].Session = FakeSession
sys.modules["bs4"] = type(sys)("bs4")
sys.modules["bs4"].BeautifulSoup = FakeSoup

# Import must happen after sys.modules is seeded.
import fetch_telegram_api as fta


class UpdateDotenvTests(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.original_cwd = os.getcwd()
        os.chdir(self.tmpdir.name)

    def tearDown(self):
        os.chdir(self.original_cwd)
        self.tmpdir.cleanup()

    def test_update_dotenv_creates_keys_when_missing(self):
        Path(".env").write_text("EXISTING=value\n", encoding="utf-8")
        fta.update_dotenv("12345", "abc123")
        content = Path(".env").read_text(encoding="utf-8")
        self.assertIn("TELEGRAM_API_ID=12345", content)
        self.assertIn("TELEGRAM_API_HASH=abc123", content)
        self.assertIn("EXISTING=value", content)

    def test_update_dotenv_replaces_existing_keys(self):
        Path(".env").write_text(
            "TELEGRAM_API_ID=old\nTELEGRAM_API_HASH=oldhash\n", encoding="utf-8"
        )
        fta.update_dotenv("54321", "xyz789")
        content = Path(".env").read_text(encoding="utf-8")
        self.assertEqual(content.count("TELEGRAM_API_ID="), 1)
        self.assertEqual(content.count("TELEGRAM_API_HASH="), 1)
        self.assertIn("TELEGRAM_API_ID=54321", content)
        self.assertIn("TELEGRAM_API_HASH=xyz789", content)

    def test_update_dotenv_fails_when_no_env_file(self):
        with self.assertRaises(SystemExit):
            fta.update_dotenv("1", "2")


class ExtractValueTests(unittest.TestCase):
    def test_extract_value_returns_text(self):
        soup = FakeSoup("", "html.parser")
        self.assertEqual(fta.extract_value(soup, "App api_id:"), "12345")
        self.assertEqual(fta.extract_value(soup, "App api_hash:"), "abc123def456")

    def test_extract_value_returns_none_when_label_missing(self):
        soup = FakeSoup("", "html.parser")
        self.assertIsNone(fta.extract_value(soup, "Unknown label:"))


def build_fake_requests():
    """Return a fake `requests` module with Session wired to my.telegram.org."""
    responses = {
        ("post", fta.MY_TELEGRAM_AUTH_SEND): FakeResponse(
            "", json_value={"random_hash": "abc123"}
        ),
        ("post", fta.MY_TELEGRAM_AUTH_LOGIN): FakeResponse("ok"),
        ("get", fta.MY_TELEGRAM_APPS): FakeResponse("<html></html>"),
    }
    fake = type(sys)("requests")
    fake.Session = lambda: FakeSession(responses)
    return fake


class MainTests(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.original_cwd = os.getcwd()
        os.chdir(self.tmpdir.name)
        self.env = os.environ.copy()
        self.original_requests = fta.requests
        self.original_soup = fta.BeautifulSoup
        fta.requests = build_fake_requests()

    def tearDown(self):
        fta.requests = self.original_requests
        fta.BeautifulSoup = self.original_soup
        os.environ.clear()
        os.environ.update(self.env)
        os.chdir(self.original_cwd)
        self.tmpdir.cleanup()

    def _run_main(self, env: dict):
        for key, value in env.items():
            os.environ[key] = value
        with patch("sys.stdout", new=io.StringIO()) as stdout, patch(
            "sys.stderr", new=io.StringIO()
        ) as stderr:
            try:
                fta.main()
                return 0, stdout.getvalue(), stderr.getvalue()
            except SystemExit as exc:
                code = exc.code if isinstance(exc.code, int) else 1
                return code, stdout.getvalue(), stderr.getvalue()

    def test_main_fails_when_phone_missing(self):
        code, out, err = self._run_main({})
        self.assertEqual(code, 1)
        self.assertIn("TELEGRAM_FETCH_PHONE", err)

    def test_main_fails_when_code_missing(self):
        code, out, err = self._run_main({"TELEGRAM_FETCH_PHONE": "+4512345678"})
        self.assertEqual(code, 1)
        self.assertIn("TELEGRAM_FETCH_CODE", err)

    def test_main_fails_when_phone_has_no_country_code(self):
        code, out, err = self._run_main(
            {"TELEGRAM_FETCH_PHONE": "12345678", "TELEGRAM_FETCH_CODE": "12345"}
        )
        self.assertEqual(code, 1)
        self.assertIn("country code", err)

    def test_main_prints_credentials(self):
        env = {
            "TELEGRAM_FETCH_PHONE": "+4512345678",
            "TELEGRAM_FETCH_CODE": "12345",
        }
        code, out, err = self._run_main(env)
        self.assertEqual(code, 0)
        self.assertIn("TELEGRAM_API_ID=12345", out)
        self.assertIn("TELEGRAM_API_HASH=abc123def456", out)

    def test_main_writes_dotenv_when_flag_set(self):
        Path(".env").write_text("\n", encoding="utf-8")
        env = {
            "TELEGRAM_FETCH_PHONE": "+4512345678",
            "TELEGRAM_FETCH_CODE": "12345",
            "TELEGRAM_FETCH_UPDATE_DOTENV": "1",
        }
        code, out, err = self._run_main(env)
        self.assertEqual(code, 0)
        content = Path(".env").read_text(encoding="utf-8")
        self.assertIn("TELEGRAM_API_ID=12345", content)
        self.assertIn("TELEGRAM_API_HASH=abc123def456", content)

    def test_main_fails_on_telegram_rate_limit(self):
        fta.requests.Session = lambda: FakeSession(
            {
                ("post", fta.MY_TELEGRAM_AUTH_SEND): FakeResponse(
                    "Sorry, too many tries"
                )
            }
        )
        env = {
            "TELEGRAM_FETCH_PHONE": "+4512345678",
            "TELEGRAM_FETCH_CODE": "12345",
        }
        code, out, err = self._run_main(env)
        self.assertEqual(code, 1)
        self.assertIn("rate-limited", err)

    def test_main_fails_when_random_hash_missing(self):
        fta.requests.Session = lambda: FakeSession(
            {
                ("post", fta.MY_TELEGRAM_AUTH_SEND): FakeResponse(
                    "", json_value={}
                )
            }
        )
        env = {
            "TELEGRAM_FETCH_PHONE": "+4512345678",
            "TELEGRAM_FETCH_CODE": "12345",
        }
        code, out, err = self._run_main(env)
        self.assertEqual(code, 1)
        self.assertIn("No random_hash", err)


if __name__ == "__main__":
    unittest.main()
