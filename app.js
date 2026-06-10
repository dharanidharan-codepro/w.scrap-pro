/**
 * ScrapeMaster - Main Application Logic
 * Handles UI routing, state management, and API interactions.
 */

// ==========================================
// 1. Core Application (Routing & UI)
// ==========================================
const App = {
    init() {
        this.bindEvents();
        this.loadInitialRoute();
        this.updateStats();
    },

    bindEvents() {
        // Navigation clicks
        document.querySelectorAll('.nav-item').forEach(btn => {
            if (btn.hasAttribute('data-page')) {
                btn.addEventListener('click', (e) => {
                    this.navigate(btn.getAttribute('data-page'));
                });
            }
        });

        // Mobile menu toggle
        const mobileBtn = document.getElementById('mobileMenuBtn');
        if (mobileBtn) {
            mobileBtn.addEventListener('click', () => {
                document.getElementById('sidebar').classList.toggle('open');
            });
        }
    },

    navigate(pageId) {
        // Update active nav item
        document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
        const activeNav = document.querySelector(`.nav-item[data-page="${pageId}"]`);
        if (activeNav) activeNav.classList.add('active');

        // Update sections
        document.querySelectorAll('.page-section').forEach(sec => sec.classList.remove('active'));
        const activeSec = document.getElementById(`page-${pageId}`);
        if (activeSec) activeSec.classList.add('active');

        // Close mobile sidebar if open
        document.getElementById('sidebar').classList.remove('open');

        // Update headers based on page
        const titleMap = {
            'dashboard': 'Dashboard',
            'scrape': 'New Scrape Job',
            'history': 'Scrape History',
            'schedules': 'Automated Schedules',
            'settings': 'Settings'
        };
        const subtitleMap = {
            'dashboard': 'Overview of your scraping activity',
            'scrape': 'Configure and run a new web scraping task',
            'history': 'View and manage previous scraping results',
            'schedules': 'Manage recurring scraping tasks',
            'settings': 'Configure application preferences'
        };

        const pageTitle = document.getElementById('pageTitle');
        const pageSubtitle = document.getElementById('pageSubtitle');
        
        if (pageTitle) pageTitle.textContent = titleMap[pageId] || 'ScrapeMaster';
        if (pageSubtitle) pageSubtitle.textContent = subtitleMap[pageId] || '';

        // Trigger page-specific initializations
        if (pageId === 'history') History.load();
        if (pageId === 'schedules') Scheduler.load();
    },

    updateStats() {
        // Mock stats for dashboard
        document.getElementById('stat-total-scrapes').textContent = '12';
        document.getElementById('stat-data-points').textContent = '4,520';
        document.getElementById('stat-active-schedules').textContent = '2';
        document.getElementById('stat-success-rate').textContent = '98%';
    }
};

// ==========================================
// 2. Scraper Module (Configuration & Execution)
// ==========================================
const Scraper = {
    selectors: [],
    previewData: null,

    init() {
        // Add initial default selector
        this.addSelector();
    },

    addSelector() {
        const list = document.getElementById('selectorList');
        const row = document.createElement('div');
        row.className = 'selector-row';
        row.innerHTML = `
            <input type="text" class="form-input selector-name" placeholder="Field name">
            <input type="text" class="form-input selector-query" placeholder="e.g. h1, .title, #main">
            <select class="form-select selector-type">
                <option value="text">Text</option>
                <option value="html">HTML</option>
                <option value="attr">Attribute</option>
                <option value="href">Href</option>
                <option value="src">Src</option>
            </select>
            <button class="btn-remove" onclick="Scraper.removeSelector(this)">✕</button>
        `;
        list.appendChild(row);
    },

    removeSelector(btn) {
        const row = btn.closest('.selector-row');
        if (document.querySelectorAll('.selector-row').length > 1) {
            row.remove();
        } else {
            Toast.show('You must have at least one selector.', 'warning');
        }
    },

    switchSelectorTab(type) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`.tab-btn[data-tab="${type}"]`).classList.add('active');
        // Logic to switch between CSS and XPath validation could go here
    },

    getPayload() {
        const url = document.getElementById('scrapeUrl').value;
        if (!url) throw new Error('Please enter a target URL.');

        const selectors = [];
        document.querySelectorAll('.selector-row').forEach(row => {
            const name = row.querySelector('.selector-name').value || 'unnamed';
            const query = row.querySelector('.selector-query').value;
            const type = row.querySelector('.selector-type').value;
            if (query) {
                selectors.push({ name, query, type });
            }
        });

        if (selectors.length === 0) throw new Error('Please define at least one valid selector.');

        return { url, selectors };
    },

    async fetchPage() {
        const url = document.getElementById('scrapeUrl').value;
        if (!url) return Toast.show('Please enter a URL to fetch', 'error');
        
        const btn = document.getElementById('fetchBtn');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<div class="spinner"></div>';
        btn.disabled = true;

        try {
            // Mock API call
            await new Promise(r => setTimeout(r, 1000));
            Toast.show('Successfully connected to target URL', 'success');
        } catch (err) {
            Toast.show(err.message, 'error');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    },

    async run() {
        try {
            const payload = this.getPayload();
            
            const btn = document.getElementById('runScrapeBtn');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<div class="spinner" style="border-top-color:#fff;"></div> Running...';
            btn.disabled = true;

            // Mock API processing
            await new Promise(r => setTimeout(r, 1500));
            
            // Mock response
            this.previewData = [
                { title: 'Product 1', price: '$19.99', url: 'https://example.com/p1' },
                { title: 'Product 2', price: '$24.99', url: 'https://example.com/p2' },
                { title: 'Product 3', price: '$14.99', url: 'https://example.com/p3' },
            ];

            this.renderPreview('table');
            document.getElementById('exportCard').style.display = 'block';
            document.getElementById('exportCount').textContent = `${this.previewData.length} records`;
            
            Toast.show(`Scrape completed! Found ${this.previewData.length} items.`, 'success');
            
            // Add to history count mock
            const countEl = document.getElementById('history-count');
            countEl.textContent = parseInt(countEl.textContent) + 1;

        } catch (err) {
            Toast.show(err.message, 'error');
        } finally {
            const btn = document.getElementById('runScrapeBtn');
            btn.innerHTML = '🚀 Run Scrape';
            btn.disabled = false;
        }
    },

    preview() {
        this.run(); // For UI purposes, same as run but conceptually might be limited to 5 items on backend
    },

    setView(type) {
        if (!this.previewData) return;
        
        // Update buttons
        const headerBtn = document.querySelector('.preview-header .btn-group').children;
        Array.from(headerBtn).forEach(b => b.style.fontWeight = 'normal');
        event.target.style.fontWeight = '600';

        this.renderPreview(type);
    },

    renderPreview(type) {
        const body = document.getElementById('previewBody');
        
        if (!this.previewData || this.previewData.length === 0) {
            body.innerHTML = `
                <div class="empty-state">
                  <div class="empty-icon">🔎</div>
                  <h4>No data yet</h4>
                  <p>Enter a URL and selectors, then click "Run Scrape"</p>
                </div>`;
            return;
        }

        if (type === 'json' || type === 'raw') {
            body.innerHTML = `<div class="code-block">${JSON.stringify(this.previewData, null, 2)}</div>`;
        } else {
            // Table view
            const keys = Object.keys(this.previewData[0]);
            let tableHTML = `
                <div class="table-container">
                    <table class="data-table" style="margin:0;">
                        <thead>
                            <tr>${keys.map(k => `<th>${k}</th>`).join('')}</tr>
                        </thead>
                        <tbody>
                            ${this.previewData.map(row => `
                                <tr>${keys.map(k => `<td><span class="truncate" style="max-width:200px;display:inline-block;">${row[k] || ''}</span></td>`).join('')}</tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
            body.innerHTML = tableHTML;
        }
    },

    exportData(format) {
        if (!this.previewData) return Toast.show('No data to export', 'warning');
        
        Toast.show(`Exporting data as ${format.toUpperCase()}...`, 'info');
        // Logic to trigger download via Blob or backend API endpoint
    }
};

// ==========================================
// 3. History Module
// ==========================================
const History = {
    data: [
        { id: 1, url: 'https://quotes.toscrape.com', selectors: 3, results: 10, status: 'success', date: '2025-05-25 10:30' },
        { id: 2, url: 'https://books.toscrape.com', selectors: 4, results: 20, status: 'success', date: '2025-05-24 14:15' },
        { id: 3, url: 'https://example.com/protected', selectors: 2, results: 0, status: 'failed', date: '2025-05-23 09:00' }
    ],

    load() {
        this.renderTable(this.data);
    },

    renderTable(items) {
        const tbody = document.getElementById('historyTableBody');
        const empty = document.getElementById('historyEmpty');
        const table = document.getElementById('historyTable');

        if (items.length === 0) {
            table.style.display = 'none';
            empty.style.display = 'block';
            return;
        }

        table.style.display = 'table';
        empty.style.display = 'none';

        tbody.innerHTML = items.map(item => `
            <tr>
                <td><a href="${item.url}" target="_blank" class="url-text" title="${item.url}">${item.url}</a></td>
                <td><span class="badge badge-muted">${item.selectors} rules</span></td>
                <td><span class="font-medium">${item.results}</span> rows</td>
                <td>
                    <span class="badge badge-${item.status === 'success' ? 'success' : 'danger'}">
                        <span class="badge-dot"></span> ${item.status}
                    </span>
                </td>
                <td class="text-secondary text-sm">${item.date}</td>
                <td>
                    <button class="btn btn-sm btn-ghost" onclick="History.viewDetails(${item.id})">View</button>
                    <button class="btn btn-sm btn-ghost" onclick="History.delete(${item.id})" style="color:var(--danger-500);">✕</button>
                </td>
            </tr>
        `).join('');
    },

    filter() {
        const search = document.getElementById('historySearch').value.toLowerCase();
        const activeFilter = document.querySelector('.filter-pill.active').dataset.filter;

        const filtered = this.data.filter(item => {
            const matchesSearch = item.url.toLowerCase().includes(search);
            const matchesStatus = activeFilter === 'all' || item.status === activeFilter;
            return matchesSearch && matchesStatus;
        });

        this.renderTable(filtered);
    },

    setFilter(status, btn) {
        document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.filter();
    },

    clearAll() {
        if(confirm('Are you sure you want to clear all history?')) {
            this.data = [];
            this.renderTable([]);
            document.getElementById('history-count').textContent = '0';
            Toast.show('History cleared', 'success');
        }
    },

    viewDetails(id) {
        const item = this.data.find(d => d.id === id);
        if(!item) return;

        document.getElementById('detailModalTitle').textContent = `Job Details #${id}`;
        document.getElementById('detailModalBody').innerHTML = `
            <div class="grid-2">
                <div>
                    <div class="text-sm text-muted">Target URL</div>
                    <div class="font-medium mt-2"><a href="${item.url}" target="_blank">${item.url}</a></div>
                </div>
                <div>
                    <div class="text-sm text-muted">Status</div>
                    <div class="mt-2"><span class="badge badge-${item.status==='success'?'success':'danger'}">${item.status}</span></div>
                </div>
            </div>
            <div class="mt-4 pt-4" style="border-top:1px solid var(--border-color);">
                <div class="text-sm text-muted mb-2">Results (${item.results} rows)</div>
                ${item.results > 0 ? '<div class="code-block" style="background:var(--slate-100);color:var(--slate-800);padding:10px;border-radius:6px;font-family:var(--font-mono);font-size:12px;">[\n  { "data": "Sample content..." }\n]</div>' : '<div class="text-sm text-danger">No data extracted. Check selectors or page structure.</div>'}
            </div>
        `;
        document.getElementById('detailModal').classList.add('show');
    },

    delete(id) {
        if(confirm('Delete this record?')) {
            this.data = this.data.filter(d => d.id !== id);
            this.renderTable(this.data);
            Toast.show('Record deleted', 'success');
        }
    }
};

// ==========================================
// 4. Scheduler Module
// ==========================================
const Scheduler = {
    schedules: [
        { id: 1, name: 'Daily Quotes', url: 'https://quotes.toscrape.com', interval: '24 hours', active: true, lastRun: '1 hour ago' }
    ],

    load() {
        const grid = document.getElementById('scheduleGrid');
        const empty = document.getElementById('scheduleEmpty');

        if (this.schedules.length === 0) {
            grid.style.display = 'none';
            empty.style.display = 'block';
            return;
        }

        grid.style.display = 'grid';
        empty.style.display = 'none';

        grid.innerHTML = this.schedules.map(sch => `
            <div class="schedule-card">
                <div class="schedule-icon">⏱️</div>
                <div class="schedule-info">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <div class="font-semibold text-sm">${sch.name || 'Unnamed Schedule'}</div>
                        <label class="toggle-switch">
                            <input type="checkbox" ${sch.active ? 'checked' : ''} onchange="Scheduler.toggleActive(${sch.id}, this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    <div class="schedule-url mt-2" title="${sch.url}">${sch.url}</div>
                    <div class="schedule-meta mt-2">
                        <span><span class="text-muted">Every:</span> ${sch.interval}</span>
                        <span><span class="text-muted">Last run:</span> ${sch.lastRun}</span>
                    </div>
                </div>
            </div>
        `).join('');
    },

    showCreateModal() {
        document.getElementById('scheduleModal').classList.add('show');
        // Auto-fill from current scrape page if populated
        const currentUrl = document.getElementById('scrapeUrl').value;
        if(currentUrl) document.getElementById('scheduleUrl').value = currentUrl;
    },

    closeModal() {
        document.getElementById('scheduleModal').classList.remove('show');
    },

    create() {
        const url = document.getElementById('scheduleUrl').value;
        const interval = document.getElementById('scheduleInterval').value;
        const unit = document.getElementById('scheduleUnit').value;
        const name = document.getElementById('scheduleName').value;

        if(!url) return Toast.show('Target URL is required', 'error');

        this.schedules.push({
            id: Date.now(),
            name: name || 'New Schedule',
            url: url,
            interval: `${interval} ${unit}`,
            active: true,
            lastRun: 'Never'
        });

        this.closeModal();
        this.load();
        Toast.show('Schedule created successfully', 'success');
        
        // Update dashboard stat
        document.getElementById('stat-active-schedules').textContent = 
            this.schedules.filter(s => s.active).length;
    },

    toggleActive(id, isActive) {
        const sch = this.schedules.find(s => s.id === id);
        if(sch) {
            sch.active = isActive;
            Toast.show(`Schedule ${isActive ? 'enabled' : 'disabled'}`, 'info');
        }
    }
};

// ==========================================
// 5. Settings Module
// ==========================================
const Settings = {
    save() {
        Toast.show('Settings saved successfully', 'success');
    },
    exportAllData() {
        Toast.show('Exporting database archive...', 'info');
    },
    clearAllData() {
        if(confirm('WARNING: This will delete all history, schedules, and scraped data. Proceed?')) {
            Toast.show('All data cleared', 'success');
        }
    }
};

// ==========================================
// 6. Utility UI Elements (Toasts, Modals, Collapsibles)
// ==========================================

// Global utility for collapsible panels
window.toggleCollapse = function(btn) {
    btn.classList.toggle('open');
    const body = btn.nextElementSibling;
    if (body.classList.contains('open')) {
        body.classList.remove('open');
    } else {
        body.classList.add('open');
    }
};

// Global utility for generic modal closing
window.closeModal = function(id) {
    document.getElementById(id).classList.remove('show');
};

// Toggle Proxy fields visibility in Settings
document.getElementById('settingProxyEnabled')?.addEventListener('change', function(e) {
    const fields = document.getElementById('proxyFields');
    if(e.target.checked) {
        fields.classList.remove('hidden');
    } else {
        fields.classList.add('hidden');
    }
});

// Toggle Pagination fields
document.getElementById('paginationType')?.addEventListener('change', function(e) {
    const opts = document.getElementById('paginationOptions');
    if(e.target.value === 'none') {
        opts.classList.add('hidden');
    } else {
        opts.classList.remove('hidden');
    }
});

// Toast System
const Toast = {
    show(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        let icon = 'ℹ️';
        if(type === 'success') icon = '✅';
        if(type === 'error') icon = '🚨';
        if(type === 'warning') icon = '⚠️';

        toast.innerHTML = `
            <div class="toast-icon">${icon}</div>
            <div class="toast-message">${message}</div>
            <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            if(toast.parentElement) {
                toast.classList.add('removing');
                setTimeout(() => toast.remove(), 300);
            }
        }, 4000);
    }
};

// ==========================================
// Boot up Application
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    App.init();
    Scraper.init();
});
