/*
  script.js -- the BRAIN of the Expense Tracker.
  Everything you can DO in the app is programmed here:
  adding, deleting, filtering, charting, exporting and saving data.
*/

/* =========================================================
   1. SETTINGS AND CONSTANTS
   ========================================================= */

// Keys used to save data inside the browser's localStorage.
const STORAGE_KEY = "expenseTracker.transactions.v1";
const SEED_KEY = "expenseTracker.seeded.v1";

// Categories (exactly as requested).
const EXPENSE_CATEGORIES = ["Food", "Transport", "Shopping", "Bills", "Education", "Health", "Family", "Other"];
const INCOME_CATEGORIES = ["Salary", "Business", "Freelance", "Other"];

// A colour for each category (used by the chart and the table chips).
const CATEGORY_COLORS = {
  Food: "#f97316",
  Transport: "#14b8a6",
  Shopping: "#a855f7",
  Bills: "#6366f1",
  Education: "#0ea5e9",
  Health: "#ef4444",
  Family: "#f59e0b",
  Other: "#64748b",
  Salary: "#22c55e",
  Business: "#10b981",
  Freelance: "#84cc16"
};

/* =========================================================
   2. THE APP'S MEMORY (state)
   ========================================================= */

let transactions = []; // every transaction we have
const filters = { search: "", category: "all", type: "all", month: "all" };
let idCounter = 0;

/* Small helper: get an element by its id. */
const $ = (id) => document.getElementById(id);

/* Cache the elements we use often. */
const el = {
  income: $("summaryIncome"),
  expense: $("summaryExpense"),
  balance: $("summaryBalance"),
  balanceCard: $("balanceCard"),
  incomeCount: $("incomeCount"),
  expenseCount: $("expenseCount"),
  balanceNote: $("balanceNote"),
  form: $("txForm"),
  amount: $("amountInput"),
  description: $("descriptionInput"),
  category: $("categorySelect"),
  date: $("dateInput"),
  errAmount: $("errorAmount"),
  errDescription: $("errorDescription"),
  errCategory: $("errorCategory"),
  errDate: $("errorDate"),
  chart: $("chartEl"),
  monthly: $("monthlyEl"),
  search: $("searchInput"),
  filterCategory: $("filterCategory"),
  filterType: $("filterType"),
  filterMonth: $("filterMonth"),
  tableBody: $("tableBody"),
  tableInfo: $("tableInfo"),
  exportBtn: $("exportBtn"),
  clearAllBtn: $("clearAllBtn"),
  resetDemoBtn: $("resetDemoBtn"),
  toast: $("toast"),
  navLinks: document.querySelectorAll(".nav-link")
};

/* =========================================================
   3. SMALL UTILITY FUNCTIONS
   ========================================================= */

// Make a unique id for each transaction.
function uid() {
  idCounter += 1;
  return Date.now().toString(36) + "-" + idCounter + "-" + Math.random().toString(36).slice(2, 6);
}

// Format a number as Pakistani Rupees, e.g. 150000 -> "Rs 150,000.00"
function formatPKR(amount) {
  const n = Number(amount) || 0;
  return "Rs " + n.toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// Turn today's date into "YYYY-MM-DD" (the format the date input needs).
function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Build a demo date some months ago, e.g. demoDate(1, 15) = 15th of last month.
function demoDate(monthOffset, day) {
  const now = new Date();
  return toISODate(new Date(now.getFullYear(), now.getMonth() - monthOffset, day));
}

// Show a date nicely, e.g. "12 Oct 2026".
function formatDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// Turn "2026-10" into "October 2026".
function monthLabel(key) {
  const [y, m] = key.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

// Keep user text safe when we put it inside HTML.
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[ch]));
}

// Add up the amount of a list of transactions.
function sum(list) {
  return list.reduce((total, t) => total + Number(t.amount), 0);
}

// Show a short message at the bottom of the screen.
let toastTimer = null;
function showToast(message) {
  el.toast.textContent = message;
  el.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove("show"), 2200);
}

/* =========================================================
   4. SAVING AND LOADING (localStorage)
   ========================================================= */

function saveTransactions() {
  // localStorage can only store text, so we convert to JSON text.
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

function loadTransactions() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    transactions = [];
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    transactions = Array.isArray(parsed) ? parsed : [];
  } catch {
    transactions = [];
  }
}

/* =========================================================
   5. SAMPLE (DEMO) DATA
   ========================================================= */

function buildDemoData() {
  // [type, category, amount, description, monthsAgo, dayOfMonth]
  const raw = [
    // ---- this month ----
    ["income", "Salary", 150000, "Monthly salary", 0, 1],
    ["income", "Freelance", 45000, "Website project", 0, 8],
    ["expense", "Bills", 12000, "Electricity bill", 0, 5],
    ["expense", "Food", 18500, "Groceries & dining", 0, 6],
    ["expense", "Transport", 6200, "Fuel & rickshaw", 0, 7],
    ["expense", "Shopping", 9000, "New clothes", 0, 10],
    ["expense", "Education", 15000, "Tuition fee", 0, 12],
    ["expense", "Health", 3500, "Pharmacy", 0, 14],
    ["expense", "Family", 8000, "Family dinner", 0, 16],
    // ---- last month ----
    ["income", "Salary", 150000, "Monthly salary", 1, 1],
    ["income", "Business", 30000, "Shop profit", 1, 10],
    ["expense", "Food", 20000, "Groceries", 1, 6],
    ["expense", "Bills", 10000, "Utilities", 1, 5],
    ["expense", "Transport", 7500, "Fuel", 1, 12],
    ["expense", "Shopping", 15000, "Eid shopping", 1, 18],
    ["expense", "Family", 12000, "Gifts", 1, 20],
    // ---- two months ago ----
    ["income", "Salary", 145000, "Monthly salary", 2, 1],
    ["income", "Freelance", 25000, "Logo design", 2, 15],
    ["expense", "Food", 17000, "Groceries", 2, 8],
    ["expense", "Education", 15000, "Tuition fee", 2, 12],
    ["expense", "Health", 5000, "Doctor visit", 2, 20]
  ];

  return raw.map(([type, category, amount, description, monthsAgo, day]) => ({
    id: uid(),
    type,
    category,
    amount,
    description,
    date: demoDate(monthsAgo, day)
  }));
}

/* =========================================================
   6. RENDERING THE SUMMARY CARDS
   ========================================================= */

function renderSummary() {
  const incomeList = transactions.filter((t) => t.type === "income");
  const expenseList = transactions.filter((t) => t.type === "expense");

  const totalIncome = sum(incomeList);
  const totalExpense = sum(expenseList);
  const balance = totalIncome - totalExpense;

  el.income.textContent = formatPKR(totalIncome);
  el.expense.textContent = formatPKR(totalExpense);
  el.balance.textContent = formatPKR(balance);

  el.incomeCount.textContent = incomeList.length + (incomeList.length === 1 ? " transaction" : " transactions");
  el.expenseCount.textContent = expenseList.length + (expenseList.length === 1 ? " transaction" : " transactions");

  el.balanceCard.classList.toggle("negative", balance < 0);
  if (transactions.length === 0) {
    el.balanceNote.textContent = "No data yet";
  } else if (balance >= 0) {
    el.balanceNote.textContent = "You are in profit \uD83C\uDF89";
  } else {
    el.balanceNote.textContent = "Spending more than earning";
  }
}

/* =========================================================
   7. CHART: expenses by category (plain HTML bars)
   ========================================================= */

function renderChart() {
  const totals = {};
  transactions
    .filter((t) => t.type === "expense")
    .forEach((t) => {
      totals[t.category] = (totals[t.category] || 0) + Number(t.amount);
    });

  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) {
    el.chart.innerHTML = '<p class="empty">No expenses yet. Add one to see the chart.</p>';
    return;
  }

  const max = entries[0][1];
  const grandTotal = entries.reduce((s, [, v]) => s + v, 0);

  el.chart.innerHTML = entries
    .map(([cat, value]) => {
      const percent = ((value / grandTotal) * 100).toFixed(1);
      const width = (value / max) * 100;
      const color = CATEGORY_COLORS[cat] || "#64748b";
      return `
        <div class="chart-row">
          <span class="chart-label">${escapeHtml(cat)}</span>
          <div class="bar-track">
            <div class="bar-fill" style="width:${width}%;background:${color}"></div>
          </div>
          <span class="chart-value">
            <strong>${formatPKR(value)}</strong>
            ${percent}%
          </span>
        </div>`;
    })
    .join("");
}

/* =========================================================
   8. MONTHLY SUMMARY (income, expenses, savings)
   ========================================================= */

function renderMonthly() {
  const groups = {};
  transactions.forEach((t) => {
    const key = t.date.slice(0, 7); // e.g. "2026-10"
    if (!groups[key]) groups[key] = { income: 0, expense: 0 };
    if (t.type === "income") groups[key].income += Number(t.amount);
    else groups[key].expense += Number(t.amount);
  });

  const keys = Object.keys(groups).sort().reverse(); // newest first

  if (keys.length === 0) {
    el.monthly.innerHTML = '<p class="empty">No data yet.</p>';
    return;
  }

  const rows = keys
    .map((key) => {
      const g = groups[key];
      const savings = g.income - g.expense;
      return `
        <tr>
          <td>${monthLabel(key)}</td>
          <td class="pos">${formatPKR(g.income)}</td>
          <td class="neg">${formatPKR(g.expense)}</td>
          <td class="${savings >= 0 ? "pos" : "neg"}">${formatPKR(savings)}</td>
        </tr>`;
    })
    .join("");

  el.monthly.innerHTML = `
    <table class="mini-table">
      <thead>
        <tr><th>Month</th><th>Income</th><th>Expenses</th><th>Savings</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

/* =========================================================
   9. HISTORY TABLE + FILTERS
   ========================================================= */

// Return the transactions that match the search box and the filters.
function getFilteredTransactions() {
  const search = filters.search.trim().toLowerCase();

  return transactions
    .filter((t) => {
      if (search && !t.description.toLowerCase().includes(search)) return false;
      if (filters.category !== "all" && t.category !== filters.category) return false;
      if (filters.type !== "all" && t.type !== filters.type) return false;
      if (filters.month !== "all" && t.date.slice(0, 7) !== filters.month) return false;
      return true;
    })
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)); // newest first
}

function renderTable() {
  const list = getFilteredTransactions();

  if (list.length === 0) {
    el.tableBody.innerHTML = '<tr><td colspan="6" class="empty">No transactions match your filters.</td></tr>';
  } else {
    el.tableBody.innerHTML = list
      .map((t) => {
        const isIncome = t.type === "income";
        const sign = isIncome ? "+" : "\u2212";
        const colorClass = isIncome ? "pos" : "neg";
        const color = CATEGORY_COLORS[t.category] || "#64748b";
        return `
          <tr>
            <td>${formatDate(t.date)}</td>
            <td>${escapeHtml(t.description)}</td>
            <td><span class="badge" style="--c:${color}">${escapeHtml(t.category)}</span></td>
            <td class="num ${colorClass}">${sign} ${formatPKR(t.amount)}</td>
            <td><span class="pill ${t.type}">${t.type}</span></td>
            <td><button class="icon-btn" data-delete="${t.id}" title="Delete">&#128465;&#65039;</button></td>
          </tr>`;
      })
      .join("");
  }

  el.tableInfo.textContent = `Showing ${list.length} of ${transactions.length} transactions`;
}

/* Fill the category filter dropdown with the categories that exist in the data. */
function populateCategoryFilter() {
  const categories = [...new Set(transactions.map((t) => t.category))].sort();
  const current = filters.category;

  el.filterCategory.innerHTML =
    '<option value="all">All categories</option>' +
    categories.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");

  el.filterCategory.value = categories.includes(current) ? current : "all";
  filters.category = el.filterCategory.value;
}

/* Fill the month filter dropdown with the months that exist in the data. */
function populateMonthFilter() {
  const months = [...new Set(transactions.map((t) => t.date.slice(0, 7)))].sort().reverse();
  const current = filters.month;

  el.filterMonth.innerHTML =
    '<option value="all">All months</option>' +
    months.map((m) => `<option value="${m}">${monthLabel(m)}</option>`).join("");

  el.filterMonth.value = months.includes(current) ? current : "all";
  filters.month = el.filterMonth.value;
}

/* =========================================================
   10. RENDER EVERYTHING AT ONCE
   ========================================================= */

function renderAll() {
  renderSummary();
  renderChart();
  renderMonthly();
  populateCategoryFilter();
  populateMonthFilter();
  renderTable();
}

/* =========================================================
   11. ADDING A TRANSACTION (with validation)
   ========================================================= */

// Fill the category dropdown based on the chosen type.
function populateCategorySelect(type) {
  const list = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  el.category.innerHTML = list.map((c) => `<option value="${c}">${c}</option>`).join("");
}

function clearErrors() {
  el.errAmount.textContent = "";
  el.errDescription.textContent = "";
  el.errCategory.textContent = "";
  el.errDate.textContent = "";
  el.amount.classList.remove("invalid");
  el.description.classList.remove("invalid");
  el.category.classList.remove("invalid");
  el.date.classList.remove("invalid");
}

function handleSubmit(event) {
  event.preventDefault();
  clearErrors();

  const type = document.querySelector('input[name="type"]:checked').value;
  const amountRaw = el.amount.value.trim();
  const description = el.description.value.trim();
  const category = el.category.value;
  const date = el.date.value;
  const amount = Number(amountRaw);

  // --- validation ---
  let hasError = false;

  if (!amountRaw || isNaN(amount) || amount <= 0) {
    el.errAmount.textContent = "Please enter an amount greater than 0.";
    el.amount.classList.add("invalid");
    hasError = true;
  } else if (amount > 1000000000) {
    el.errAmount.textContent = "That amount is too large.";
    el.amount.classList.add("invalid");
    hasError = true;
  }

  if (!description) {
    el.errDescription.textContent = "Please enter a description.";
    el.description.classList.add("invalid");
    hasError = true;
  }

  if (!category) {
    el.errCategory.textContent = "Please choose a category.";
    el.category.classList.add("invalid");
    hasError = true;
  }

  if (!date) {
    el.errDate.textContent = "Please pick a date.";
    el.date.classList.add("invalid");
    hasError = true;
  }

  if (hasError) return;

  // --- save it ---
  transactions.push({
    id: uid(),
    type,
    amount: Number(amount.toFixed(2)),
    description,
    category,
    date
  });

  saveTransactions();
  renderAll();

  // reset the form for the next entry
  el.form.reset();
  clearErrors();
  populateCategorySelect("expense");
  el.date.value = toISODate(new Date());

  showToast(`Added ${type}: ${formatPKR(amount)}`);
}

/* =========================================================
   12. DELETING, CLEARING, EXPORTING
   ========================================================= */

function handleTableClick(event) {
  const button = event.target.closest("[data-delete]");
  if (!button) return;

  const id = button.dataset.delete;
  const tx = transactions.find((t) => t.id === id);
  if (!tx) return;

  const ok = confirm(`Delete this transaction?\n\n${tx.description} - ${formatPKR(tx.amount)}`);
  if (!ok) return;

  transactions = transactions.filter((t) => t.id !== id);
  saveTransactions();
  renderAll();
  showToast("Transaction deleted");
}

function handleClearAll() {
  if (transactions.length === 0) {
    showToast("There is nothing to clear");
    return;
  }
  const ok = confirm("Clear ALL data? This permanently deletes every transaction in this browser.");
  if (!ok) return;

  transactions = [];
  saveTransactions();
  renderAll();
  showToast("All data cleared");
}

function handleResetDemo() {
  const ok = confirm("Replace all current data with the sample demo data?");
  if (!ok) return;

  transactions = buildDemoData();
  saveTransactions();
  localStorage.setItem(SEED_KEY, "true");
  renderAll();
  showToast("Demo data restored");
}

// Turn any value into a safe CSV cell.
function csvCell(value) {
  const s = String(value);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function handleExport() {
  if (transactions.length === 0) {
    alert("There are no transactions to export yet.");
    return;
  }

  const rows = [["Date", "Type", "Category", "Description", "Amount (PKR)"]];
  transactions
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .forEach((t) => rows.push([t.date, t.type, t.category, t.description, t.amount]));

  const csv = rows.map((r) => r.map(csvCell).join(",")).join("\r\n");

  // The "\uFEFF" BOM helps Microsoft Excel open the file with correct characters.
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `expense-tracker-${toISODate(new Date())}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showToast("CSV file downloaded");
}

/* =========================================================
   13. WIRING UP THE BUTTONS AND INPUTS
   ========================================================= */

function attachEvents() {
  // Add transaction form
  el.form.addEventListener("submit", handleSubmit);

  // Change the category list when Income / Expense is switched
  document.querySelectorAll('input[name="type"]').forEach((radio) => {
    radio.addEventListener("change", () => populateCategorySelect(radio.value));
  });

  // Filters
  el.search.addEventListener("input", () => {
    filters.search = el.search.value;
    renderTable();
  });
  el.filterCategory.addEventListener("change", () => {
    filters.category = el.filterCategory.value;
    renderTable();
  });
  el.filterType.addEventListener("change", () => {
    filters.type = el.filterType.value;
    renderTable();
  });
  el.filterMonth.addEventListener("change", () => {
    filters.month = el.filterMonth.value;
    renderTable();
  });

  // Delete buttons inside the table
  el.tableBody.addEventListener("click", handleTableClick);

  // Sidebar + top bar buttons
  el.clearAllBtn.addEventListener("click", handleClearAll);
  el.resetDemoBtn.addEventListener("click", handleResetDemo);
  el.exportBtn.addEventListener("click", handleExport);

  // Sidebar navigation highlight
  el.navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      el.navLinks.forEach((l) => l.classList.remove("active"));
      link.classList.add("active");
    });
  });

  // Highlight the sidebar link for the section you are looking at
  const sectionIds = ["dashboard", "add", "reports", "history"];
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            el.navLinks.forEach((l) =>
              l.classList.toggle("active", l.getAttribute("href") === "#" + entry.target.id)
            );
          }
        });
      },
      { rootMargin: "-40% 0px -55% 0px" }
    );
    sectionIds.forEach((id) => {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    });
  }
}

/* =========================================================
   14. START THE APP
   ========================================================= */

function init() {
  loadTransactions();

  // First ever visit? Load the sample data so the app looks alive.
  if (!localStorage.getItem(SEED_KEY) && transactions.length === 0) {
    transactions = buildDemoData();
    saveTransactions();
    localStorage.setItem(SEED_KEY, "true");
  }

  // Default date = today
  el.date.value = toISODate(new Date());

  // Default categories (Expense is selected by default in the HTML)
  populateCategorySelect("expense");

  attachEvents();
  renderAll();
}

init();
