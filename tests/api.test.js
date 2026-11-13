const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { start } = require("../src/server");

let ctx;
let base;

before(async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "wo-api-"));
  const seedFile = path.join(__dirname, "..", "data", "orders.seed.json");
  ctx = await start({ dataDir, seedFile, dataFile: path.join(dataDir, "orders.json"), port: 0 });
  base = `http://127.0.0.1:${ctx.port}`;
});

after(async () => {
  await new Promise((resolve) => ctx.server.close(resolve));
});

async function request(pathname, options = {}) {
  const response = await fetch(`${base}${pathname}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await response.json();
  return { status: response.status, data };
}

describe("HTTP API", () => {
  it("serves the app and health check", async () => {
    const health = await request("/api/health");
    assert.equal(health.status, 200);
    assert.equal(health.data.ok, true);
    const home = await fetch(`${base}/`);
    assert.equal(home.status, 200);
    const html = await home.text();
    assert.match(html, /Work Order Tracker/);
  });

  it("lists seeded orders and returns stats", async () => {
    const listed = await request("/api/orders");
    assert.equal(listed.status, 200);
    assert.equal(listed.data.length, 10);
    assert.equal(listed.data[0].id, "WO-1001");
    const stats = await request("/api/stats");
    assert.ok(stats.data.open >= 1);
    assert.ok(stats.data.overdue >= 1);
    const filtered = await request("/api/orders?status=Closed");
    assert.ok(filtered.data.every((order) => order.status === "Closed"));
    const search = await request("/api/orders?q=boiler");
    assert.equal(search.data[0].id, "WO-1009");
  });

  it("creates, updates, and deletes a work order", async () => {
    const created = await request("/api/orders", {
      method: "POST",
      body: JSON.stringify({ title: "Test ballast in Lot A", category: "Electrical", priority: "Low" }),
    });
    assert.equal(created.status, 201);
    assert.equal(created.data.id, "WO-1011");
    const updated = await request("/api/orders/WO-1011", {
      method: "PATCH",
      body: JSON.stringify({ status: "Closed" }),
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.data.status, "Closed");
    const removed = await request("/api/orders/WO-1011", { method: "DELETE" });
    assert.equal(removed.status, 200);
    const missing = await request("/api/orders/WO-1011");
    assert.equal(missing.status, 404);
  });

  it("validates titles and unknown ids", async () => {
    const bad = await request("/api/orders", { method: "POST", body: JSON.stringify({ title: "" }) });
    assert.equal(bad.status, 400);
    const missing = await request("/api/orders/WO-0000", { method: "PATCH", body: JSON.stringify({ status: "Open" }) });
    assert.equal(missing.status, 404);
  });
});
