#!/usr/bin/env python3
"""Regression tests for the privileged helper's untrusted-input boundary."""

import contextlib
import importlib.machinery
import importlib.util
import io
import json
import pathlib
import unittest


HELPER_PATH = pathlib.Path(__file__).parents[1] / "src-tauri/system/karincore-helper"
LOADER = importlib.machinery.SourceFileLoader("karincore_helper", str(HELPER_PATH))
SPEC = importlib.util.spec_from_loader(LOADER.name, LOADER)
assert SPEC is not None
helper = importlib.util.module_from_spec(SPEC)
LOADER.exec_module(helper)


class HelperValidationTests(unittest.TestCase):
    def assert_rejected(self, callback, payload: bytes) -> None:
        with contextlib.redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit):
                callback(payload)

    def test_accepts_generated_xray_shape(self) -> None:
        payload = json.dumps({
            "log": {"error": "/var/log/karin-proxy/error.log"},
            "inbounds": [{"protocol": "mixed", "listen": "127.0.0.1", "port": 2080}],
            "outbounds": [{"protocol": "vless", "settings": {}}],
            "routing": {"rules": []},
        }).encode()
        helper.validate_xray(payload)

    def test_rejects_xray_command_and_file_escape_surfaces(self) -> None:
        cases = [
            {"stats": {}},
            {"log": {"error": "/tmp/attacker.log"}},
            {"inbounds": [{"protocol": "mixed", "listen": "0.0.0.0"}]},
            {"outbounds": [{"protocol": "vless", "settings": {"keyFile": "/tmp/key"}}]},
        ]
        for value in cases:
            with self.subTest(value=value):
                self.assert_rejected(helper.validate_xray, json.dumps(value).encode())

    def test_rejects_openvpn_execution_directives(self) -> None:
        helper.validate_openvpn(b"client\nremote vpn.example 443\n")
        for directive in (
            b"up /tmp/run-me\n",
            b"plugin evil.so\n",
            b"config /tmp/evil\n",
            b"auth-user-pass /etc/shadow\n",
            b"key /etc/shadow\n",
            b"iproute /tmp/run-me\n",
        ):
            with self.subTest(directive=directive):
                self.assert_rejected(helper.validate_openvpn, directive)

    def test_rejects_wireguard_command_hooks(self) -> None:
        helper.validate_wireguard(b"[Interface]\nPrivateKey = value\n")
        self.assert_rejected(helper.validate_wireguard, b"[Interface]\nPostUp = /tmp/run-me\n")


if __name__ == "__main__":
    unittest.main()
