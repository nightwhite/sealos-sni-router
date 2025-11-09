// Tab 切换
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tabName = btn.getAttribute('data-tab');

        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));

        btn.classList.add('active');
        document.getElementById(tabName).classList.add('active');

        if (tabName === 'stats') {
            loadStats();
        }
    });
});

// Toast 提示
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// 加载服务列表
async function loadServices() {
    try {
        const res = await fetch('/api/services');
        const data = await res.json();

        const list = document.getElementById('servicesList');

        if (data.services.length === 0) {
            list.innerHTML = '<p class="empty">暂无服务</p>';
            return;
        }

        list.innerHTML = data.services.map((s, idx) => `
            <div class="service-item">
                <div class="service-info">
                    <strong>${s.domain}</strong>
                    <span>→ ${s.service}:${s.port}</span>
                </div>
                <button class="btn btn-danger btn-sm" onclick="deleteService('${s.domain}')">删除</button>
            </div>
        `).join('');
    } catch (error) {
        console.error('加载服务失败:', error);
        showToast('加载服务失败', 'error');
    }
}

// 添加服务
document.getElementById('addServiceForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const domain = document.getElementById('domain').value;
    const service = document.getElementById('service').value;
    const port = document.getElementById('port').value;

    try {
        const res = await fetch('/api/services', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domain, service, port: parseInt(port) })
        });

        const data = await res.json();

        if (data.success) {
            showToast(data.message || '服务已添加');
            document.getElementById('addServiceForm').reset();
            loadServices();
        } else {
            showToast(data.message || '添加失败', 'error');
        }
    } catch (error) {
        console.error('添加服务失败:', error);
        showToast('添加服务失败', 'error');
    }
});

// 删除服务
async function deleteService(domain) {
    if (!confirm(`确定删除服务 ${domain}？`)) return;

    try {
        const res = await fetch(`/api/services/${encodeURIComponent(domain)}`, {
            method: 'DELETE'
        });

        const data = await res.json();

        if (data.success) {
            showToast(data.message || '服务已删除');
            loadServices();
        } else {
            showToast(data.message || '删除失败', 'error');
        }
    } catch (error) {
        console.error('删除服务失败:', error);
        showToast('删除服务失败', 'error');
    }
}

// 加载统计信息
async function loadStats() {
    try {
        const res = await fetch('/api/services/stats');
        const data = await res.json();

        const statsDiv = document.getElementById('statsContent');

        statsDiv.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <h3>总服务数</h3>
                    <p class="stat-value">${data.totalServices}</p>
                </div>
                <div class="stat-card">
                    <h3>总连接数</h3>
                    <p class="stat-value">${data.totalConnections}</p>
                </div>
            </div>
            <div class="card" style="margin-top: 20px;">
                <h3>各域名连接统计</h3>
                ${Object.keys(data.connections).length === 0
                    ? '<p class="empty">暂无连接记录</p>'
                    : `<table class="stats-table">
                        <thead>
                            <tr>
                                <th>域名</th>
                                <th>连接次数</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${Object.entries(data.connections)
                                .sort((a, b) => b[1] - a[1])
                                .map(([domain, count]) => `
                                    <tr>
                                        <td>${domain}</td>
                                        <td>${count}</td>
                                    </tr>
                                `).join('')}
                        </tbody>
                    </table>`
                }
            </div>
        `;
    } catch (error) {
        console.error('加载统计失:', error);
        showToast('加载统计失败', 'error');
    }
}

// 初始加载
loadServices();

// 自动刷新
setInterval(loadServices, 5000);
