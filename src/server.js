const path = require("path");
const express = require("express");
const { WorkOrderStore, seedIfEmpty } = require("./store");

function createApp(store) {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, "..", "public")));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/api/stats", (_req, res) => {
    res.json(store.stats());
  });

  app.get("/api/orders", (req, res) => {
    const orders = store.list({
      status: req.query.status,
      priority: req.query.priority,
      category: req.query.category,
      q: req.query.q,
    });
    res.json(orders);
  });

  app.get("/api/orders/:id", (req, res) => {
    const order = store.get(req.params.id);
    if (!order) {
      res.status(404).json({ error: "work order not found" });
      return;
    }
    res.json(order);
  });

  app.post("/api/orders", (req, res) => {
    try {
      const created = store.create(req.body || {});
      res.status(201).json(created);
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.patch("/api/orders/:id", (req, res) => {
    try {
      const updated = store.update(req.params.id, req.body || {});
      res.json(updated);
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.delete("/api/orders/:id", (req, res) => {
    try {
      const removed = store.delete(req.params.id);
      res.json(removed);
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  return app;
}

function start(options = {}) {
  const dataDir = options.dataDir || path.join(__dirname, "..", "data");
  const dataFile = options.dataFile || path.join(dataDir, "orders.json");
  const seedFile = options.seedFile || path.join(dataDir, "orders.seed.json");
  const store = new WorkOrderStore(dataFile);
  seedIfEmpty(store, seedFile);
  const app = createApp(store);
  const port = options.port || Number(process.env.PORT || 3000);
  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      const address = server.address();
      resolve({ app, store, server, port: address.port });
    });
  });
}

if (require.main === module) {
  start().then(({ port }) => {
    console.log(`Work order tracker running at http://localhost:${port}`);
  });
}

module.exports = { createApp, start };
