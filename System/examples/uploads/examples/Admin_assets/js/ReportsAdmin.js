// reports-admin.js - Sales and Report Analytics JavaScript

$(document).ready(function() {
    // Global variables
    let currentFilterDays = 30;
    let analyticsData = null;
    
    // Initialize: Load analytics data
    loadAnalytics();
    loadTopProducts();
    
    /**
     * Load analytics statistics
     */
    async function loadAnalytics() {
        try {
            const response = await fetch(`../api/get_analytics.php?days=${currentFilterDays}`, {
                method: 'GET',
                credentials: 'include' // Include cookies for session
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                } catch (e) {
                    errorData = { message: errorText || `HTTP error! status: ${response.status}` };
                }
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                analyticsData = data.analytics;
                updateAnalyticsCards(data.analytics);
            } else {
                console.error('Analytics API error:', data.message);
                showError(data.message || 'Failed to load analytics');
                // Show zeros if API fails
                updateAnalyticsCards({
                    total_revenue: { formatted: '₱0.00', change_formatted: '0% from last period' },
                    total_orders: { formatted: '0', change_formatted: '0% from last period' },
                    avg_order_value: { formatted: '₱0.00', change_formatted: '0% from last period' },
                    new_customers: { formatted: '0', change_formatted: '0% from last period' }
                });
            }
        } catch (error) {
            console.error('Load analytics error:', error);
            showError('Failed to load analytics data: ' + error.message);
            // Show zeros on error
            updateAnalyticsCards({
                total_revenue: { formatted: '₱0.00', change_formatted: 'No data available' },
                total_orders: { formatted: '0', change_formatted: 'No data available' },
                avg_order_value: { formatted: '₱0.00', change_formatted: 'No data available' },
                new_customers: { formatted: '0', change_formatted: 'No data available' }
            });
        }
    }
    
    /**
     * Update analytics cards with data
     */
    function updateAnalyticsCards(analytics) {
        // Total Revenue
        $('#total-revenue').text(analytics.total_revenue.formatted);
        $('#revenue-change').text(analytics.total_revenue.change_formatted);
        updateChangeColor('#revenue-change', analytics.total_revenue.change);
        
        // Total Orders
        $('#total-orders').text(analytics.total_orders.formatted);
        $('#orders-change').text(analytics.total_orders.change_formatted);
        updateChangeColor('#orders-change', analytics.total_orders.change);
        
        // Avg Order Value
        $('#avg-order-value').text(analytics.avg_order_value.formatted);
        $('#avg-order-change').text(analytics.avg_order_value.change_formatted);
        updateChangeColor('#avg-order-change', analytics.avg_order_value.change);
        
        // New Customers
        $('#new-customers').text(analytics.new_customers.formatted);
        $('#customers-change').text(analytics.new_customers.change_formatted);
        updateChangeColor('#customers-change', analytics.new_customers.change);
    }
    
    /**
     * Update change color based on positive/negative
     */
    function updateChangeColor(selector, change) {
        const $element = $(selector).closest('.card-change');
        $element.removeClass('positive negative');
        if (change >= 0) {
            $element.addClass('positive');
        } else {
            $element.addClass('negative');
        }
    }
    
    /**
     * Load top performing products
     */
    async function loadTopProducts() {
        try {
            const tbody = $('#products-table-body');
            tbody.html(`
                <tr class="product-analytics-row loading-row">
                    <td colspan="5" class="text-center">
                        <div class="spinner-border text-primary" role="status">
                            <span class="sr-only">Loading...</span>
                        </div>
                        <p class="mt-2">Loading products...</p>
                    </td>
                </tr>
            `);
            
            const response = await fetch(`../api/get_top_products.php?days=${currentFilterDays}`, {
                method: 'GET',
                credentials: 'include' // Include cookies for session
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                } catch (e) {
                    errorData = { message: errorText || `HTTP error! status: ${response.status}` };
                }
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                if (data.products && data.products.length > 0) {
                    displayProducts(data.products);
                } else {
                    // No products found - show message
                    tbody.html(`
                        <tr class="product-analytics-row">
                            <td colspan="5" class="text-center">
                                <p class="mt-2 text-muted">No products sold in the selected period</p>
                                <small class="text-muted">Try selecting a different time period or wait for sales data</small>
                            </td>
                        </tr>
                    `);
                }
            } else {
                console.error('Products API error:', data.message);
                tbody.html(`
                    <tr class="product-analytics-row">
                        <td colspan="5" class="text-center text-danger">
                            <p class="mt-2">Failed to load products</p>
                            <small>${data.message || 'Unknown error'}</small>
                        </td>
                    </tr>
                `);
            }
        } catch (error) {
            console.error('Load products error:', error);
            $('#products-table-body').html(`
                <tr class="product-analytics-row">
                    <td colspan="5" class="text-center text-danger">
                        <p class="mt-2">Error loading products</p>
                        <small class="text-muted">${error.message || 'Unknown error'}</small>
                    </td>
                </tr>
            `);
        }
    }
    
    /**
     * Display products in table
     */
    function displayProducts(products) {
        const tbody = $('#products-table-body');
        tbody.empty();
        
        if (products.length === 0) {
            tbody.html(`
                <tr class="product-analytics-row">
                    <td colspan="5" class="text-center">
                        <p class="mt-2">No products found for this period</p>
                    </td>
                </tr>
            `);
            return;
        }
        
        products.forEach((product, index) => {
            const growthClass = product.growth.value >= 0 ? 'positive' : 'negative';
            const row = `
                <tr class="product-analytics-row">
                    <td class="product-name">${escapeHtml(product.product_name)}</td>
                    <td class="revenue-amount">${escapeHtml(product.revenue.formatted)}</td>
                    <td class="units-sold">${escapeHtml(product.units_sold.formatted)}</td>
                    <td>
                        <span class="growth-percentage ${growthClass}">${escapeHtml(product.growth.formatted)}</span>
                    </td>
                    <td>
                        <button class="details-btn" data-product-id="${product.product_id}" data-product-name="${escapeHtml(product.product_name)}">
                            <i class="fas fa-chart-line"></i>
                            <span>Details</span>
                        </button>
                    </td>
                </tr>
            `;
            tbody.append(row);
        });
        
        // Re-attach event handlers
        attachProductHandlers();
    }
    
    /**
     * Attach event handlers to product rows
     */
    function attachProductHandlers() {
        $('.details-btn').off('click').on('click', function() {
            const productId = $(this).data('product-id');
            const productName = $(this).data('product-name');
            viewProductDetails(productId, productName);
        });
    }
    
    /**
     * View product details
     */
    async function viewProductDetails(productId, productName) {
        const modalBody = $('#productDetailsBody');
        const modal = $('#productDetailsModal');
        
        // Show loading state
        modalBody.html(`
            <div class="text-center py-5">
                <div class="spinner-border text-danger" role="status">
                    <span class="sr-only">Loading...</span>
                </div>
                <p class="mt-3">Loading product details...</p>
            </div>
        `);
        
        modal.modal('show');
        
        try {
            const response = await fetch(`../api/get_product_details.php?product_id=${productId}&days=${currentFilterDays}`, {
                method: 'GET',
                credentials: 'include' // Include cookies for session
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                displayProductDetails(data);
            } else {
                modalBody.html(`
                    <div class="alert alert-danger">
                        <i class="fas fa-exclamation-circle"></i> ${data.message || 'Failed to load product details'}
                    </div>
                `);
            }
        } catch (error) {
            console.error('Load product details error:', error);
            modalBody.html(`
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-circle"></i> Error loading product details: ${error.message}
                </div>
            `);
        }
    }
    
    /**
     * Display product details in modal
     */
    function displayProductDetails(data) {
        const product = data.product;
        const analytics = data.analytics;
        const recentOrders = data.recent_orders || [];
        const monthlyData = data.monthly_breakdown || [];
        
        const revenueGrowthClass = analytics.growth.revenue >= 0 ? 'text-success' : 'text-danger';
        const unitsGrowthClass = analytics.growth.units >= 0 ? 'text-success' : 'text-danger';
        const ordersGrowthClass = analytics.growth.orders >= 0 ? 'text-success' : 'text-danger';
        
        let html = `
            <div class="product-details-container">
                <!-- Product Header -->
                <div class="product-header-section">
                    <div class="product-info">
                        <h4 class="product-name-title">${escapeHtml(product.product_name)}</h4>
                        <div class="product-meta">
                            <span class="product-category"><i class="fas fa-tag"></i> ${escapeHtml(product.category || 'N/A')}</span>
                            <span class="product-stock ${product.stock_status === 'In Stock' ? 'text-success' : product.stock_status === 'Low Stock' ? 'text-warning' : 'text-danger'}">
                                <i class="fas fa-box"></i> ${product.stock_status} (${product.stock_level} units)
                            </span>
                            <span class="product-price"><i class="fas fa-peso-sign"></i> ₱${number_format(product.price, 2)}</span>
                        </div>
                    </div>
                </div>
                
                <!-- Analytics Cards -->
                <div class="product-analytics-section">
                    <h6 class="section-title"><i class="fas fa-chart-line"></i> Sales Analytics</h6>
                    <div class="row">
                        <div class="col-md-4 mb-3">
                            <div class="analytics-card-small">
                                <div class="card-label">Total Revenue</div>
                                <div class="card-value text-danger">₱${number_format(analytics.current_period.total_revenue, 2)}</div>
                                <div class="card-change ${revenueGrowthClass}">
                                    <i class="fas fa-arrow-${analytics.growth.revenue >= 0 ? 'up' : 'down'}"></i>
                                    ${analytics.growth.revenue >= 0 ? '+' : ''}${number_format(analytics.growth.revenue, 2)}%
                                </div>
                            </div>
                        </div>
                        <div class="col-md-4 mb-3">
                            <div class="analytics-card-small">
                                <div class="card-label">Units Sold</div>
                                <div class="card-value">${number_format(analytics.current_period.units_sold, 0)}</div>
                                <div class="card-change ${unitsGrowthClass}">
                                    <i class="fas fa-arrow-${analytics.growth.units >= 0 ? 'up' : 'down'}"></i>
                                    ${analytics.growth.units >= 0 ? '+' : ''}${number_format(analytics.growth.units, 2)}%
                                </div>
                            </div>
                        </div>
                        <div class="col-md-4 mb-3">
                            <div class="analytics-card-small">
                                <div class="card-label">Total Orders</div>
                                <div class="card-value">${number_format(analytics.current_period.total_orders, 0)}</div>
                                <div class="card-change ${ordersGrowthClass}">
                                    <i class="fas fa-arrow-${analytics.growth.orders >= 0 ? 'up' : 'down'}"></i>
                                    ${analytics.growth.orders >= 0 ? '+' : ''}${number_format(analytics.growth.orders, 2)}%
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="row mt-2">
                        <div class="col-md-6">
                            <div class="analytics-card-small">
                                <div class="card-label">Average Price</div>
                                <div class="card-value">₱${number_format(analytics.current_period.avg_price, 2)}</div>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="analytics-card-small">
                                <div class="card-label">Average Order Value</div>
                                <div class="card-value">₱${number_format(analytics.current_period.avg_order_value, 2)}</div>
                            </div>
                        </div>
                    </div>
                </div>
        `;
        
        // Monthly Breakdown
        if (monthlyData.length > 0) {
            html += `
                <div class="product-section">
                    <h6 class="section-title"><i class="fas fa-calendar-alt"></i> Monthly Breakdown</h6>
                    <div class="table-responsive">
                        <table class="table table-sm table-bordered">
                            <thead>
                                <tr>
                                    <th>Month</th>
                                    <th class="text-right">Units Sold</th>
                                    <th class="text-right">Revenue</th>
                                </tr>
                            </thead>
                            <tbody>
            `;
            monthlyData.forEach(month => {
                html += `
                    <tr>
                        <td>${escapeHtml(month.month_formatted)}</td>
                        <td class="text-right">${number_format(month.units_sold, 0)}</td>
                        <td class="text-right font-weight-bold">₱${number_format(month.revenue, 2)}</td>
                    </tr>
                `;
            });
            html += `
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }
        
        // Recent Orders
        if (recentOrders.length > 0) {
            html += `
                <div class="product-section">
                    <h6 class="section-title"><i class="fas fa-shopping-cart"></i> Recent Orders</h6>
                    <div class="table-responsive">
                        <table class="table table-sm table-bordered">
                            <thead>
                                <tr>
                                    <th>Order ID</th>
                                    <th>Date</th>
                                    <th>Customer</th>
                                    <th class="text-right">Quantity</th>
                                    <th class="text-right">Price</th>
                                    <th class="text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody>
            `;
            recentOrders.forEach(order => {
                html += `
                    <tr>
                        <td>INV${order.Order_ID}</td>
                        <td>${new Date(order.order_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                        <td>${escapeHtml(order.customer_name || 'N/A')}</td>
                        <td class="text-right">${number_format(order.Quantity, 0)}</td>
                        <td class="text-right">₱${number_format(order.Price, 2)}</td>
                        <td class="text-right font-weight-bold">₱${number_format(order.total, 2)}</td>
                    </tr>
                `;
            });
            html += `
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        } else {
            html += `
                <div class="product-section">
                    <div class="alert alert-info">
                        <i class="fas fa-info-circle"></i> No recent orders found for this period.
                    </div>
                </div>
            `;
        }
        
        html += `</div>`;
        
        $('#productDetailsBody').html(html);
    }
    
    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return String(text).replace(/[&<>"']/g, m => map[m]);
    }
    
    // Filter buttons functionality
    $('.products-filters .filter-btn').on('click', function() {
        // Remove active class from all filter buttons
        $('.products-filters .filter-btn').removeClass('active');
        
        // Add active class to clicked button
        $(this).addClass('active');
        
        const filterId = $(this).attr('id');
        
        // Set days based on filter
        if (filterId === 'last-30-days-btn') {
            currentFilterDays = 30;
        } else if (filterId === 'all-categories-btn') {
            currentFilterDays = 365; // All time
        } else if (filterId === 'overview-btn') {
            currentFilterDays = 90; // Last 90 days
        }
        
        // Reload data with new filter
        loadAnalytics();
        loadTopProducts();
    });
    
    // Export report button - show options modal
    $('#export-report-btn').on('click', function(e) {
        e.preventDefault();
        $('#exportOptionsModal').modal('show');
    });
    
    // Export as Excel button functionality (from modal)
    $('#export-excel-btn-modal').on('click', async function(e) {
        e.preventDefault();
        
        // Close modal
        $('#exportOptionsModal').modal('hide');
        
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - currentFilterDays);
            const endDate = new Date();
            
            const params = new URLSearchParams({
                format: 'excel',
                start_date: startDate.toISOString().split('T')[0],
                end_date: endDate.toISOString().split('T')[0]
            });
            
            // Create download link
            const url = `../api/export_report.php?${params}`;
            const link = document.createElement('a');
            link.href = url;
            link.download = `sales_report_${endDate.toISOString().split('T')[0]}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            showSuccess('Report exported to Excel successfully');
        } catch (error) {
            console.error('Export error:', error);
            showError('Failed to export report: ' + error.message);
        }
    });
    
    // Export as PDF button functionality (from modal)
    $('#export-pdf-btn-modal').on('click', async function(e) {
        e.preventDefault();
        
        // Close modal
        $('#exportOptionsModal').modal('hide');
        
        try {
            // Generate report first, then export as PDF directly without showing modal
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - currentFilterDays);
            const endDate = new Date();
            
            const response = await fetch('../api/generate_report.php', {
                method: 'POST',
                credentials: 'include', // Include cookies for session
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    start_date: startDate.toISOString().split('T')[0],
                    end_date: endDate.toISOString().split('T')[0],
                    report_type: 'sales'
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                // Export PDF directly without showing modal
                exportToPDFDirectly(data.report);
            } else {
                showError(data.message || 'Failed to generate report');
            }
        } catch (error) {
            console.error('Export PDF error:', error);
            showError('Failed to export report as PDF: ' + error.message);
        }
    });
    
    /**
     * Export report to PDF directly without showing modal
     */
    function exportToPDFDirectly(report) {
        // Format dates
        const startDate = new Date(report.period.start_date).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        const endDate = new Date(report.period.end_date).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        const generatedDate = new Date(report.generated_at).toLocaleString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // Format dates for header
        const startDateShort = new Date(report.period.start_date).toLocaleDateString('en-US', { 
            month: 'numeric', 
            day: 'numeric', 
            year: 'numeric' 
        });
        const endDateShort = new Date(report.period.end_date).toLocaleDateString('en-US', { 
            month: 'numeric', 
            day: 'numeric', 
            year: 'numeric' 
        });
        
        // Build HTML for PDF
        let html = buildReportHTML(report, startDate, endDate, generatedDate, startDateShort, endDateShort);
        
        // Create a new window for printing
        const printWindow = window.open('', '_blank');
        printWindow.document.write(html);
        printWindow.document.close();
        
        // Wait for content to load, then print
        setTimeout(() => {
            printWindow.print();
        }, 250);
    }
    
    /**
     * Build report HTML for PDF export
     */
    function buildReportHTML(report, startDate, endDate, generatedDate, startDateShort, endDateShort) {
        let tableRows = '';
        
        // Group sales by month
        if (report.detailed_sales && report.detailed_sales.length > 0) {
            const salesByMonth = {};
            report.detailed_sales.forEach(sale => {
                if (!salesByMonth[sale.month]) {
                    salesByMonth[sale.month] = [];
                }
                salesByMonth[sale.month].push(sale);
            });
            
            // Process each month
            Object.keys(salesByMonth).sort().forEach(month => {
                const monthSales = salesByMonth[month];
                let monthTotal = { cost: 0, total: 0, paid: 0, balance_due: 0 };
                let firstRow = true;
                
                monthSales.forEach((sale, index) => {
                    monthTotal.cost += parseFloat(sale.cost || 0);
                    monthTotal.total += parseFloat(sale.total || 0);
                    monthTotal.paid += parseFloat(sale.paid || 0);
                    monthTotal.balance_due += parseFloat(sale.balance_due || 0);
                    
                    tableRows += `
                        <tr>
                            <td>${firstRow ? sale.month : '---'}</td>
                            <td>${firstRow ? sale.order_date_formatted : '---'}</td>
                            <td class="text-right">₱${number_format(sale.cost || 0, 2)}</td>
                            <td>${sale.invoice_number}</td>
                            <td>${sale.sales_rep || '---'}</td>
                            <td class="text-right">₱${number_format(sale.total || 0, 2)}</td>
                            <td class="text-right">₱${number_format(sale.paid || 0, 2)}</td>
                            <td class="text-right">₱${number_format(sale.balance_due || 0, 2)}</td>
                        </tr>
                    `;
                    firstRow = false;
                });
                
                // Add month total row
                tableRows += `
                    <tr class="month-total-row">
                        <td class="font-weight-bold">${month} Total</td>
                        <td>---</td>
                        <td class="text-right font-weight-bold">₱${number_format(monthTotal.cost, 2)}</td>
                        <td>---</td>
                        <td>---</td>
                        <td class="text-right font-weight-bold">₱${number_format(monthTotal.total, 2)}</td>
                        <td class="text-right font-weight-bold text-success">₱${number_format(monthTotal.paid, 2)}</td>
                        <td class="text-right font-weight-bold text-warning">₱${number_format(monthTotal.balance_due, 2)}</td>
                    </tr>
                `;
            });
        } else {
            tableRows = `
                <tr>
                    <td colspan="8" class="text-center text-muted py-4">No sales data available for this period</td>
                </tr>
            `;
        }
        
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Sales Report</title>
                <style>
                    @page {
                        size: letter portrait;
                        margin: 0.5in;
                    }
                    * {
                        box-sizing: border-box;
                    }
                    body {
                        margin: 0;
                        padding: 0;
                        font-family: Arial, sans-serif;
                        font-size: 10px;
                        width: 8.5in;
                    }
                    .report-summary {
                        width: 100%;
                        max-width: 8.5in;
                        background: white;
                        padding: 0;
                    }
                    .report-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        padding: 12px 15px;
                        background: #fff5f5;
                        border-bottom: 3px solid #dc3545;
                        margin-bottom: 10px;
                    }
                    .report-title {
                        font-size: 18px;
                        font-weight: 700;
                        color: #dc3545;
                        margin-bottom: 6px;
                        text-transform: uppercase;
                    }
                    .company-name {
                        font-size: 13px;
                        font-weight: 700;
                        color: #333;
                        margin-bottom: 2px;
                    }
                    .company-details {
                        font-size: 9px;
                        color: #666;
                    }
                    .report-dates {
                        background: white;
                        border: 2px solid #dc3545;
                        border-radius: 4px;
                        padding: 8px 10px;
                        min-width: 150px;
                        max-width: 170px;
                    }
                    .date-label {
                        font-size: 8px;
                        font-weight: 600;
                        color: #666;
                        text-transform: uppercase;
                        margin-bottom: 4px;
                    }
                    .date-range {
                        font-size: 10px;
                        color: #333;
                        line-height: 1.4;
                    }
                    .table-container {
                        margin-top: 10px;
                        overflow: visible;
                    }
                    .sales-report-table {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 9px;
                        table-layout: fixed;
                    }
                    .sales-report-table thead {
                        background: #dc3545;
                        color: white;
                    }
                    .sales-report-table thead th {
                        padding: 5px 3px;
                        font-weight: 600;
                        font-size: 8px;
                        text-transform: uppercase;
                        text-align: left;
                        border: 1px solid #c82333;
                    }
                    .sales-report-table thead th:nth-child(1) { width: 9%; }
                    .sales-report-table thead th:nth-child(2) { width: 10%; }
                    .sales-report-table thead th:nth-child(3) { width: 10%; }
                    .sales-report-table thead th:nth-child(4) { width: 11%; }
                    .sales-report-table thead th:nth-child(5) { width: 12%; }
                    .sales-report-table thead th:nth-child(6) { width: 12%; }
                    .sales-report-table thead th:nth-child(7) { width: 12%; }
                    .sales-report-table thead th:nth-child(8) { width: 12%; }
                    .sales-report-table tbody tr {
                        border-bottom: 1px solid #e9ecef;
                    }
                    .sales-report-table tbody tr:nth-child(even) {
                        background-color: #fafafa;
                    }
                    .sales-report-table tbody td {
                        padding: 4px 3px;
                        color: #333;
                        font-size: 9px;
                        border: 1px solid #e9ecef;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                    }
                    .month-total-row {
                        background-color: #fff5f5 !important;
                        border-top: 2px solid #dc3545;
                        font-weight: 700;
                    }
                    .month-total-row td {
                        padding: 5px 3px;
                        font-size: 9px;
                    }
                    .text-right {
                        text-align: right;
                    }
                    .text-success {
                        color: #28a745;
                    }
                    .text-warning {
                        color: #ffc107;
                    }
                    @media print {
                        body { 
                            margin: 0;
                            width: 100%;
                        }
                        .report-summary {
                            width: 100%;
                            max-width: 100%;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="report-summary">
                    <div class="report-header">
                        <div class="report-header-left">
                            <h2 class="report-title">Sales Report</h2>
                            <div class="company-info">
                                <div class="company-name">MATARIX</div>
                                <div class="company-details">Construction Materials Supplier</div>
                            </div>
                        </div>
                        <div class="report-header-right">
                            <div class="report-dates">
                                <div class="date-label">Date:</div>
                                <div class="date-range">
                                    <div>From: ${startDateShort}</div>
                                    <div>To: ${endDateShort}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="report-section">
                        <div class="table-container">
                            <table class="sales-report-table">
                                <thead>
                                    <tr>
                                        <th>Month</th>
                                        <th>Date</th>
                                        <th>Cost</th>
                                        <th>Invoice #</th>
                                        <th>Sales Rep.</th>
                                        <th class="text-right">Total</th>
                                        <th class="text-right">Paid</th>
                                        <th class="text-right">Balance Due</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${tableRows}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `;
    }
    
    // Generate report button functionality
    $('#generate-report-btn').on('click', async function() {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - currentFilterDays);
            const endDate = new Date();
            
            const response = await fetch('../api/generate_report.php', {
                method: 'POST',
                credentials: 'include', // Include cookies for session
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    start_date: startDate.toISOString().split('T')[0],
                    end_date: endDate.toISOString().split('T')[0],
                    report_type: 'sales'
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Display report in a modal or new window
                showReportModal(data.report);
            } else {
                showError(data.message || 'Failed to generate report');
            }
        } catch (error) {
            console.error('Generate report error:', error);
            showError('Failed to generate report');
        }
    });
    
    /**
     * Show report modal
     */
    function showReportModal(report) {
        const modalBody = $('#reportModalBody');
        
        // Format dates
        const startDate = new Date(report.period.start_date).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        const endDate = new Date(report.period.end_date).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        const generatedDate = new Date(report.generated_at).toLocaleString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // Format dates for header
        const startDateShort = new Date(report.period.start_date).toLocaleDateString('en-US', { 
            month: 'numeric', 
            day: 'numeric', 
            year: 'numeric' 
        });
        const endDateShort = new Date(report.period.end_date).toLocaleDateString('en-US', { 
            month: 'numeric', 
            day: 'numeric', 
            year: 'numeric' 
        });
        
        let html = `
            <div class="report-summary">
                <!-- Report Header -->
                <div class="report-header">
                    <div class="report-header-left">
                        <h2 class="report-title">Sales Report</h2>
                        <div class="company-info">
                            <div class="company-name">MATARIX</div>
                            <div class="company-details">Construction Materials Supplier</div>
                        </div>
                    </div>
                    <div class="report-header-right">
                        <div class="report-dates">
                            <div class="date-label">Date:</div>
                            <div class="date-range">
                                <div>From: ${startDateShort}</div>
                                <div>To: ${endDateShort}</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Detailed Sales Table -->
                <div class="report-section">
                    <div class="table-container">
                        <table class="sales-report-table">
                            <thead>
                                <tr>
                                    <th>Month</th>
                                    <th>Date</th>
                                    <th>Cost</th>
                                    <th>Invoice #</th>
                                    <th>Sales Rep.</th>
                                    <th class="text-right">Total</th>
                                    <th class="text-right">Paid</th>
                                    <th class="text-right">Balance Due</th>
                                </tr>
                            </thead>
                            <tbody>
        `;
        
        // Group sales by month
        if (report.detailed_sales && report.detailed_sales.length > 0) {
            const salesByMonth = {};
            report.detailed_sales.forEach(sale => {
                if (!salesByMonth[sale.month]) {
                    salesByMonth[sale.month] = [];
                }
                salesByMonth[sale.month].push(sale);
            });
            
            // Process each month
            Object.keys(salesByMonth).sort().forEach(month => {
                const monthSales = salesByMonth[month];
                let monthTotal = { cost: 0, total: 0, paid: 0, balance_due: 0 };
                let firstRow = true;
                
                monthSales.forEach((sale, index) => {
                    monthTotal.cost += parseFloat(sale.cost || 0);
                    monthTotal.total += parseFloat(sale.total || 0);
                    monthTotal.paid += parseFloat(sale.paid || 0);
                    monthTotal.balance_due += parseFloat(sale.balance_due || 0);
                    
                    html += `
                        <tr>
                            <td>${firstRow ? sale.month : '---'}</td>
                            <td>${firstRow ? sale.order_date_formatted : '---'}</td>
                            <td class="text-right">₱${number_format(sale.cost || 0, 2)}</td>
                            <td>${sale.invoice_number}</td>
                            <td>${sale.sales_rep || '---'}</td>
                            <td class="text-right">₱${number_format(sale.total || 0, 2)}</td>
                            <td class="text-right">₱${number_format(sale.paid || 0, 2)}</td>
                            <td class="text-right">₱${number_format(sale.balance_due || 0, 2)}</td>
                        </tr>
                    `;
                    firstRow = false;
                });
                
                // Add month total row
                html += `
                    <tr class="month-total-row">
                        <td class="font-weight-bold">${month} Total</td>
                        <td>---</td>
                        <td class="text-right font-weight-bold">₱${number_format(monthTotal.cost, 2)}</td>
                        <td>---</td>
                        <td>---</td>
                        <td class="text-right font-weight-bold">₱${number_format(monthTotal.total, 2)}</td>
                        <td class="text-right font-weight-bold text-success">₱${number_format(monthTotal.paid, 2)}</td>
                        <td class="text-right font-weight-bold text-warning">₱${number_format(monthTotal.balance_due, 2)}</td>
                    </tr>
                `;
            });
        } else {
            html += `
                <tr>
                    <td colspan="8" class="text-center text-muted py-4">No sales data available for this period</td>
                </tr>
            `;
        }
        
        html += `
                            </tbody>
                        </table>
                    </div>
                </div>
        `;
        
        // Order Status Breakdown
        if (report.order_status_breakdown && report.order_status_breakdown.length > 0) {
            html += `
                <div class="report-section">
                    <div class="section-header">
                        <i class="fas fa-list-alt"></i>
                        <span>Order Status Breakdown</span>
                    </div>
                    <div class="table-container">
                        <table class="report-table">
                            <thead>
                                <tr>
                                    <th><i class="fas fa-tag"></i> Status</th>
                                    <th><i class="fas fa-hashtag"></i> Count</th>
                                    <th><i class="fas fa-peso-sign"></i> Total Amount</th>
                                </tr>
                            </thead>
                            <tbody>
            `;
            report.order_status_breakdown.forEach(status => {
                html += `
                    <tr>
                        <td><span class="status-badge">${escapeHtml(status.status)}</span></td>
                        <td class="text-center">${number_format(status.count, 0)}</td>
                        <td class="text-right font-weight-bold">₱${number_format(status.total_amount, 2)}</td>
                    </tr>
                `;
            });
            html += `
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }
        
        // Top Products
        if (report.top_products && report.top_products.length > 0) {
            html += `
                <div class="report-section">
                    <div class="section-header">
                        <i class="fas fa-star"></i>
                        <span>Top Performing Products</span>
                        <span class="section-badge">${report.top_products.length}</span>
                    </div>
                    <div class="table-container">
                        <table class="report-table">
                            <thead>
                                <tr>
                                    <th style="width: 50px;"><i class="fas fa-trophy"></i> Rank</th>
                                    <th><i class="fas fa-box"></i> Product Name</th>
                                    <th class="text-center"><i class="fas fa-cubes"></i> Units Sold</th>
                                    <th class="text-right"><i class="fas fa-peso-sign"></i> Revenue</th>
                                </tr>
                            </thead>
                            <tbody>
            `;
            report.top_products.forEach((product, index) => {
                const rankClass = index === 0 ? 'rank-gold' : index === 1 ? 'rank-silver' : index === 2 ? 'rank-bronze' : '';
                html += `
                    <tr>
                        <td class="text-center">
                            <span class="rank-badge ${rankClass}">${index + 1}</span>
                        </td>
                        <td class="product-name-cell">${escapeHtml(product.Product_Name)}</td>
                        <td class="text-center">${number_format(product.units_sold, 0)}</td>
                        <td class="text-right font-weight-bold text-danger">₱${number_format(product.revenue, 2)}</td>
                    </tr>
                `;
            });
            html += `
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        } else {
            html += `
                <div class="report-section">
                    <div class="empty-state">
                        <i class="fas fa-box-open"></i>
                        <p>No products data available for this period.</p>
                    </div>
                </div>
            `;
        }
        
        html += `</div>`;
        
        modalBody.html(html);
        
        // Store report data for export
        $('#reportModal').data('report', report);
        
        // Show modal
        $('#reportModal').modal('show');
    }
    
    /**
     * Format number with commas
     */
    function number_format(number, decimals = 2) {
        return parseFloat(number).toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }
    
    // Utility functions for notifications
    function showSuccess(message) {
        if (window.AdminNotifications) {
            AdminNotifications.success(message, { duration: 3000 });
        } else {
            alert('Success: ' + message);
        }
    }
    
    function showError(message) {
        if (window.AdminNotifications) {
            AdminNotifications.error(message, { duration: 5000 });
        } else {
            alert('Error: ' + message);
        }
    }
    
    // Export as PDF button
    $('#exportPDFBtn').on('click', function() {
        exportToPDF();
    });
    
    // Export as Excel button
    $('#exportExcelBtn').on('click', function() {
        const report = $('#reportModal').data('report');
        if (report) {
            const params = new URLSearchParams({
                format: 'excel',
                start_date: report.period.start_date,
                end_date: report.period.end_date
            });
            
            const url = `../api/export_report.php?${params}`;
            const link = document.createElement('a');
            link.href = url;
            link.download = `sales_report_${report.period.end_date}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            showSuccess('Report exported to Excel successfully');
        }
    });
    
    /**
     * Export report to PDF
     */
    function exportToPDF() {
        const reportContent = document.querySelector('.report-summary');
        if (!reportContent) {
            showError('Report content not found');
            return;
        }
        
        // Create a new window for printing
        const printWindow = window.open('', '_blank');
        const reportHTML = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Sales Report</title>
                <style>
                    @page {
                        size: letter portrait;
                        margin: 0.5in;
                    }
                    * {
                        box-sizing: border-box;
                    }
                    body {
                        margin: 0;
                        padding: 0;
                        font-family: Arial, sans-serif;
                        font-size: 10px;
                        width: 8.5in;
                    }
                    .report-summary {
                        width: 100%;
                        max-width: 8.5in;
                        background: white;
                        padding: 0;
                    }
                    .report-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        padding: 12px 15px;
                        background: #fff5f5;
                        border-bottom: 3px solid #dc3545;
                        margin-bottom: 10px;
                    }
                    .report-title {
                        font-size: 18px;
                        font-weight: 700;
                        color: #dc3545;
                        margin-bottom: 6px;
                        text-transform: uppercase;
                    }
                    .company-name {
                        font-size: 13px;
                        font-weight: 700;
                        color: #333;
                        margin-bottom: 2px;
                    }
                    .company-details {
                        font-size: 9px;
                        color: #666;
                    }
                    .report-dates {
                        background: white;
                        border: 2px solid #dc3545;
                        border-radius: 4px;
                        padding: 8px 10px;
                        min-width: 150px;
                        max-width: 170px;
                    }
                    .date-label {
                        font-size: 8px;
                        font-weight: 600;
                        color: #666;
                        text-transform: uppercase;
                        margin-bottom: 4px;
                    }
                    .date-range {
                        font-size: 10px;
                        color: #333;
                        line-height: 1.4;
                    }
                    .table-container {
                        margin-top: 10px;
                        overflow: visible;
                    }
                    .sales-report-table {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 9px;
                        table-layout: fixed;
                    }
                    .sales-report-table thead {
                        background: #dc3545;
                        color: white;
                    }
                    .sales-report-table thead th {
                        padding: 5px 3px;
                        font-weight: 600;
                        font-size: 8px;
                        text-transform: uppercase;
                        text-align: left;
                        border: 1px solid #c82333;
                    }
                    .sales-report-table thead th:nth-child(1) { width: 9%; }
                    .sales-report-table thead th:nth-child(2) { width: 10%; }
                    .sales-report-table thead th:nth-child(3) { width: 10%; }
                    .sales-report-table thead th:nth-child(4) { width: 11%; }
                    .sales-report-table thead th:nth-child(5) { width: 12%; }
                    .sales-report-table thead th:nth-child(6) { width: 12%; }
                    .sales-report-table thead th:nth-child(7) { width: 12%; }
                    .sales-report-table thead th:nth-child(8) { width: 12%; }
                    .sales-report-table tbody tr {
                        border-bottom: 1px solid #e9ecef;
                    }
                    .sales-report-table tbody tr:nth-child(even) {
                        background-color: #fafafa;
                    }
                    .sales-report-table tbody td {
                        padding: 4px 3px;
                        color: #333;
                        font-size: 9px;
                        border: 1px solid #e9ecef;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                    }
                    .month-total-row {
                        background-color: #fff5f5 !important;
                        border-top: 2px solid #dc3545;
                        font-weight: 700;
                    }
                    .month-total-row td {
                        padding: 5px 3px;
                        font-size: 9px;
                    }
                    .text-right {
                        text-align: right;
                    }
                    .text-success {
                        color: #28a745;
                    }
                    .text-warning {
                        color: #ffc107;
                    }
                    @media print {
                        body { 
                            margin: 0;
                            width: 100%;
                        }
                        .report-summary {
                            width: 100%;
                            max-width: 100%;
                        }
                    }
                </style>
            </head>
            <body>
                ${reportContent.outerHTML}
            </body>
            </html>
        `;
        
        printWindow.document.write(reportHTML);
        printWindow.document.close();
        
        // Wait for content to load, then print
        setTimeout(() => {
            printWindow.print();
        }, 250);
    }
    
    console.log('Reports Admin JavaScript initialized successfully');
});
