# 🛡️ MCP Telemetry Interceptor Sandbox

A lightweight, zero-cost local prototyping environment simulating Model Context Protocol (MCP) telemetry interception, agent-tool communication, and non-blocking I/O streaming.

## 🧠 Overview
This project mimics core architectural patterns used in modern AI agent infrastructure (such as tool-use monitoring, JSON-RPC 2.0 message tracking, and zero-overhead telemetry extraction) without relying on paid cloud sandboxes or proprietary APIs.

## ⚙️ Architecture
- **Protocol:** JSON-RPC 2.0 over `stdio` (Standard Input/Output).
- **Interception Layer:** A non-blocking wrapper process capturing round-trip latency (`hrtime`) and method telemetry out-of-band.
- **Mock Server:** A local Python-based MCP server exposing modular tools (`tools/list`, `tools/call`).
- **Data Sink:** Local structured logging (`logs.jsonl`), serving as a lightweight equivalent to columnar stores like ClickHouse for local experimentation.

## 🚀 Quick Start

1. Run the local interceptor and mock server:
   ```bash
   python interceptor.py
   # Or using uv:
   uv run interceptor.py
   ```