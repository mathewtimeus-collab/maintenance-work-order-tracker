const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { WorkOrderStore, seedIfEmpty } = require("../src/store");

let dir;
let store;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "wo-store-"));
  store = new WorkOrderStore(path.join(dir, "orders.json"));
});

describe("WorkOrderStore", () => {
  it("creates a work order with a sequential id and required title", () => {
    const created = store.create({ title: "Replace filter", location: "Mech B", priority: "High" });
    assert.equal(created.id, "WO-1001");
    assert.equal(created.status, "Open");
    assert.equal(created.priority, "High");
    assert.equal(created.title, "Replace filter");
    assert.equal(store.list().length, 1);
    assert.throws(() => store.create({ title: "  " }), { statusCode: 400 });
  });

  it("rejects invalid status and priority", () => {
    store.create({ title: "Ok" });
    assert.throws(() => store.update("WO-1001", { status: "Done" }), { statusCode: 400 });
    assert.throws(() => store.create({ title: "Two", priority: "Critical" }), { statusCode: 400 });
  });

  it("updates, filters, searches, and deletes", () => {
    store.create({ title: "Leak under sink", location: "Restroom 2W", category: "Plumbing", priority: "Urgent" });
    store.create({ title: "Paint lobby", location: "Main lobby", category: "General", priority: "Low", assigned_to: "Priya Shah" });
    const updated = store.update("WO-1001", { status: "In Progress", assigned_to: "Chris Bailey" });
    assert.equal(updated.status, "In Progress");
    assert.equal(store.list({ status: "In Progress" }).length, 1);
    assert.equal(store.list({ q: "lobby" })[0].id, "WO-1002");
    assert.equal(store.list({ category: "Plumbing" })[0].title, "Leak under sink");
    store.delete("WO-1002");
    assert.equal(store.list().length, 1);
    assert.throws(() => store.delete("WO-9999"), { statusCode: 404 });
  });

  it("counts overdue open work and ignores closed ones", () => {
    store.create({ title: "Late", due_date: "2020-01-01", status: "Open" });
    store.create({ title: "Finished late", due_date: "2020-01-01", status: "Closed" });
    store.create({ title: "Future", due_date: "2099-01-01", status: "Open" });
    const stats = store.stats();
    assert.equal(stats.overdue, 1);
    assert.equal(stats.open, 2);
    assert.equal(stats.closed, 1);
  });

  it("persists to disk and seeds an empty file", () => {
    store.create({ title: "Persisted" });
    const reloaded = new WorkOrderStore(path.join(dir, "orders.json"));
    assert.equal(reloaded.list()[0].title, "Persisted");

    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "wo-seed-"));
    const emptyStore = new WorkOrderStore(path.join(emptyDir, "orders.json"));
    const seedPath = path.join(emptyDir, "seed.json");
    fs.writeFileSync(seedPath, JSON.stringify([{ id: "WO-2001", title: "Seeded", status: "Open", priority: "Medium" }]));
    assert.equal(seedIfEmpty(emptyStore, seedPath), true);
    assert.equal(emptyStore.get("WO-2001").title, "Seeded");
    assert.equal(seedIfEmpty(emptyStore, seedPath), false);
  });
});
