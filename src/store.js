const fs = require("fs");
const path = require("path");

const STATUSES = ["Open", "In Progress", "On Hold", "Closed"];
const PRIORITIES = ["Low", "Medium", "High", "Urgent"];
const CATEGORIES = ["HVAC", "Plumbing", "Electrical", "General", "Safety", "Grounds"];

function nowIso() {
  return new Date().toISOString();
}

function todayStamp() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

class WorkOrderStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.orders = [];
    this._load();
  }

  _load() {
    if (!fs.existsSync(this.filePath)) {
      this.orders = [];
      return;
    }
    const raw = fs.readFileSync(this.filePath, "utf8");
    const parsed = JSON.parse(raw);
    this.orders = Array.isArray(parsed) ? parsed : parsed.orders || [];
  }

  _save() {
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.orders, null, 2) + "\n");
  }

  _nextId() {
    const nums = this.orders
      .map((order) => {
        const match = String(order.id || "").match(/^WO-(\d+)$/);
        return match ? Number(match[1]) : 0;
      })
      .filter(Boolean);
    const next = (nums.length ? Math.max(...nums) : 1000) + 1;
    return `WO-${next}`;
  }

  list({ status, priority, category, q } = {}) {
    const needle = (q || "").trim().toLowerCase();
    return this.orders.filter((order) => {
      if (status && order.status !== status) return false;
      if (priority && order.priority !== priority) return false;
      if (category && order.category !== category) return false;
      if (!needle) return true;
      const haystack = [order.id, order.title, order.location, order.requested_by, order.assigned_to, order.notes]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }

  get(id) {
    return this.orders.find((order) => order.id === id) || null;
  }

  validate(payload, { partial } = {}) {
    const errors = [];
    if (!partial && !String(payload.title || "").trim()) {
      errors.push("title is required");
    }
    if (payload.status && !STATUSES.includes(payload.status)) {
      errors.push("status must be Open, In Progress, On Hold, or Closed");
    }
    if (payload.priority && !PRIORITIES.includes(payload.priority)) {
      errors.push("priority must be Low, Medium, High, or Urgent");
    }
    if (payload.category && !CATEGORIES.includes(payload.category)) {
      errors.push("category is not recognized");
    }
    return errors;
  }

  create(payload) {
    const errors = this.validate(payload);
    if (errors.length) {
      const error = new Error(errors.join("; "));
      error.statusCode = 400;
      throw error;
    }
    const timestamp = nowIso();
    const order = {
      id: this._nextId(),
      title: payload.title.trim(),
      location: (payload.location || "").trim(),
      category: payload.category || "General",
      priority: payload.priority || "Medium",
      status: payload.status || "Open",
      requested_by: (payload.requested_by || "").trim(),
      assigned_to: (payload.assigned_to || "").trim(),
      due_date: payload.due_date || "",
      notes: (payload.notes || "").trim(),
      created_at: timestamp,
      updated_at: timestamp,
    };
    this.orders.push(order);
    this._save();
    return order;
  }

  update(id, payload) {
    const existing = this.get(id);
    if (!existing) {
      const error = new Error("work order not found");
      error.statusCode = 404;
      throw error;
    }
    const errors = this.validate(payload, { partial: true });
    if (payload.title !== undefined && !String(payload.title || "").trim()) {
      errors.push("title is required");
    }
    if (errors.length) {
      const error = new Error(errors.join("; "));
      error.statusCode = 400;
      throw error;
    }
    const fields = [
      "title",
      "location",
      "category",
      "priority",
      "status",
      "requested_by",
      "assigned_to",
      "due_date",
      "notes",
    ];
    for (const field of fields) {
      if (payload[field] !== undefined) {
        existing[field] = typeof payload[field] === "string" ? payload[field].trim() : payload[field];
      }
    }
    existing.updated_at = nowIso();
    this._save();
    return existing;
  }

  delete(id) {
    const index = this.orders.findIndex((order) => order.id === id);
    if (index === -1) {
      const error = new Error("work order not found");
      error.statusCode = 404;
      throw error;
    }
    const [removed] = this.orders.splice(index, 1);
    this._save();
    return removed;
  }

  stats() {
    const today = todayStamp();
    const openStatuses = new Set(["Open", "In Progress", "On Hold"]);
    return {
      total: this.orders.length,
      open: this.orders.filter((o) => o.status === "Open").length,
      in_progress: this.orders.filter((o) => o.status === "In Progress").length,
      on_hold: this.orders.filter((o) => o.status === "On Hold").length,
      closed: this.orders.filter((o) => o.status === "Closed").length,
      urgent: this.orders.filter((o) => o.priority === "Urgent" && openStatuses.has(o.status)).length,
      overdue: this.orders.filter(
        (o) => o.due_date && o.due_date < today && openStatuses.has(o.status)
      ).length,
    };
  }
}

function seedIfEmpty(store, seedPath) {
  if (store.orders.length > 0) {
    return false;
  }
  if (!seedPath || !fs.existsSync(seedPath)) {
    return false;
  }
  const raw = JSON.parse(fs.readFileSync(seedPath, "utf8"));
  const orders = Array.isArray(raw) ? raw : raw.orders || [];
  store.orders = orders;
  store._save();
  return true;
}

module.exports = {
  WorkOrderStore,
  seedIfEmpty,
  STATUSES,
  PRIORITIES,
  CATEGORIES,
};
