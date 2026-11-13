const rowsEl = document.getElementById("rows");
const emptyEl = document.getElementById("empty");
const statsEl = document.getElementById("stats");
const editor = document.getElementById("editor");
const form = document.getElementById("editor-form");
const formError = document.getElementById("form-error");
const deleteBtn = document.getElementById("delete-order");

const fields = {
  id: document.getElementById("field-id"),
  title: document.getElementById("field-title"),
  location: document.getElementById("field-location"),
  category: document.getElementById("field-category"),
  priority: document.getElementById("field-priority"),
  status: document.getElementById("field-status"),
  requested_by: document.getElementById("field-requested"),
  assigned_to: document.getElementById("field-assigned"),
  due_date: document.getElementById("field-due"),
  notes: document.getElementById("field-notes"),
};

async function api(path, options) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
}

function todayStamp() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function formatDue(value, status) {
  if (!value) return "—";
  const open = status !== "Closed";
  const overdue = open && value < todayStamp();
  return { text: value, overdue };
}

function badge(kind, value) {
  const extra = kind === "status" ? `data-status="${value}"` : "";
  return `<span class="badge ${kind === "priority" ? value : ""}" ${extra}>${value}</span>`;
}

function renderStats(stats) {
  const items = [
    ["Open", stats.open, ""],
    ["In progress", stats.in_progress, "accent"],
    ["On hold", stats.on_hold, ""],
    ["Closed", stats.closed, ""],
    ["Urgent", stats.urgent, "warn"],
    ["Overdue", stats.overdue, "warn"],
  ];
  statsEl.innerHTML = items
    .map(
      ([label, value, cls]) =>
        `<article class="stat ${cls}"><span class="label">${label}</span><span class="value">${value}</span></article>`
    )
    .join("");
}

function renderRows(orders) {
  rowsEl.innerHTML = "";
  emptyEl.hidden = orders.length > 0;
  for (const order of orders) {
    const due = formatDue(order.due_date, order.status);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="id">${order.id}</td>
      <td>
        <div class="title">${escapeHtml(order.title)}</div>
        <div class="sub">${escapeHtml(order.category)}</div>
      </td>
      <td>${escapeHtml(order.location || "—")}</td>
      <td>${badge("priority", order.priority)}</td>
      <td>${badge("status", order.status)}</td>
      <td class="due ${due.overdue ? "overdue" : ""}">${due.text}${due.overdue ? " · overdue" : ""}</td>
      <td>${escapeHtml(order.assigned_to || "Unassigned")}</td>
    `;
    tr.addEventListener("click", () => openEditor(order));
    rowsEl.appendChild(tr);
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function query() {
  const params = new URLSearchParams();
  const status = document.getElementById("filter-status").value;
  const priority = document.getElementById("filter-priority").value;
  const category = document.getElementById("filter-category").value;
  const q = document.getElementById("search").value.trim();
  if (status) params.set("status", status);
  if (priority) params.set("priority", priority);
  if (category) params.set("category", category);
  if (q) params.set("q", q);
  const suffix = params.toString();
  return suffix ? `/api/orders?${suffix}` : "/api/orders";
}

async function refresh() {
  const [orders, stats] = await Promise.all([api(query()), api("/api/stats")]);
  renderStats(stats);
  renderRows(orders);
}

function openEditor(order) {
  form.reset();
  formError.hidden = true;
  const isNew = !order;
  document.getElementById("editor-title").textContent = isNew ? "New work order" : order.id;
  deleteBtn.hidden = isNew;
  fields.id.value = order ? order.id : "";
  fields.title.value = order ? order.title : "";
  fields.location.value = order ? order.location : "";
  fields.category.value = order ? order.category : "General";
  fields.priority.value = order ? order.priority : "Medium";
  fields.status.value = order ? order.status : "Open";
  fields.requested_by.value = order ? order.requested_by : "";
  fields.assigned_to.value = order ? order.assigned_to : "";
  fields.due_date.value = order ? order.due_date : "";
  fields.notes.value = order ? order.notes : "";
  editor.showModal();
}

function readForm() {
  return {
    title: fields.title.value,
    location: fields.location.value,
    category: fields.category.value,
    priority: fields.priority.value,
    status: fields.status.value,
    requested_by: fields.requested_by.value,
    assigned_to: fields.assigned_to.value,
    due_date: fields.due_date.value,
    notes: fields.notes.value,
  };
}

document.getElementById("new-order").addEventListener("click", () => openEditor(null));
document.getElementById("cancel-edit").addEventListener("click", () => editor.close());

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  formError.hidden = true;
  const id = fields.id.value;
  try {
    if (id) {
      await api(`/api/orders/${id}`, { method: "PATCH", body: JSON.stringify(readForm()) });
    } else {
      await api("/api/orders", { method: "POST", body: JSON.stringify(readForm()) });
    }
    editor.close();
    await refresh();
  } catch (error) {
    formError.hidden = false;
    formError.textContent = error.message;
  }
});

deleteBtn.addEventListener("click", async () => {
  const id = fields.id.value;
  if (!id || !confirm(`Delete ${id}?`)) return;
  try {
    await api(`/api/orders/${id}`, { method: "DELETE" });
    editor.close();
    await refresh();
  } catch (error) {
    formError.hidden = false;
    formError.textContent = error.message;
  }
});

for (const id of ["filter-status", "filter-priority", "filter-category", "search"]) {
  document.getElementById(id).addEventListener("input", () => {
    refresh().catch((error) => {
      emptyEl.hidden = false;
      emptyEl.textContent = error.message;
    });
  });
}

refresh().catch((error) => {
  emptyEl.hidden = false;
  emptyEl.textContent = error.message;
});
