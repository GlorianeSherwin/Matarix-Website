/**
 * Load Delivery Details for ViewDelivery page
 * Dedicated page for Complete/Cancel delivery actions (drivers and admin)
 */

function escapeHtml(text) {
    if (!text) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

function formatPrice(price) {
    return '₱' + parseFloat(price || 0).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function formatTime(timeString) {
    if (!timeString) return '';
    const s = String(timeString).trim();
    if (!s) return '';
    if (s.includes(':') && !s.includes('T') && !s.includes(' ')) {
        const parts = s.split(':');
        const hour = parseInt(parts[0], 10);
        const min = parts[1] || '00';
        if (!isNaN(hour) && hour >= 0 && hour <= 23) {
            const ampm = hour >= 12 ? 'PM' : 'AM';
            const h = hour % 12 || 12;
            return h + ':' + min + ' ' + ampm;
        }
    }
    try {
        const d = new Date(timeString);
        if (!isNaN(d.getTime())) {
            return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        }
    } catch (e) {}
    return s;
}

function getItemImagePath(imagePath) {
    const fallback = '../Customer_assets/images/Slice 15 (2).png';
    if (!imagePath) return fallback;
    let normalized = String(imagePath).replace(/Admin assets/g, 'Admin_assets').replace(/Customer assets/g, 'Customer_assets');
    if (normalized.startsWith('http')) return normalized;
    return '../' + normalized;
}

function isDeliveryDriverRole() {
    const role = (sessionStorage.getItem('user_role') || window.__MATARIX_USER_ROLE || '').trim();
    return role === 'Delivery Driver';
}

async function loadDeliveryDetails() {
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('order_id');
    const deliveryId = urlParams.get('delivery_id');

    const loadingEl = document.getElementById('deliveryLoading');
    const errorEl = document.getElementById('deliveryError');
    const errorText = document.getElementById('deliveryErrorText');
    const contentEl = document.getElementById('deliveryContent');

    if (!orderId && !deliveryId) {
        loadingEl.style.display = 'none';
        errorEl.style.display = 'block';
        errorText.textContent = 'No order ID or delivery ID provided.';
        return;
    }

    try {
        const qs = orderId ? `order_id=${orderId}` : `delivery_id=${deliveryId}`;
        const response = await fetch(`../api/get_delivery_details.php?${qs}`, {
            method: 'GET',
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Failed to load delivery details');
        }

        loadingEl.style.display = 'none';

        if (!data.delivery) {
            errorEl.style.display = 'block';
            errorText.textContent = 'Delivery not found.';
            return;
        }

        const d = data.delivery;
        const isOutForDelivery = (d.Delivery_Status || '').trim() === 'Out for Delivery';
        const isDelivered = (d.Delivery_Status || '').toLowerCase() === 'delivered';
        const isCancelled = (d.Delivery_Status || '').toLowerCase() === 'cancelled';
        const isDriver = isDeliveryDriverRole();

        contentEl.style.display = 'block';

        // Populate display
        document.getElementById('orderIdDisplay').textContent = 'ORD-' + String(d.Order_ID || 0).padStart(4, '0');
        document.getElementById('amountDisplay').textContent = formatPrice(d.amount);
        document.getElementById('customerName').textContent = escapeHtml(d.customer_name || 'Customer');
        document.getElementById('customerPhone').textContent = d.phone || 'N/A';
        document.getElementById('customerAddress').textContent = escapeHtml(d.address || 'No address provided');
        document.getElementById('orderDate').textContent = formatDate(d.order_date);
        const availDate = formatDate(d.availability_date);
        const availTime = formatTime(d.availability_time);
        document.getElementById('availabilityDate').textContent = availDate + (availTime ? ' ' + availTime : '');
        document.getElementById('driverName').textContent = escapeHtml(d.driver_name || 'Unassigned');
        document.getElementById('vehicleModel').textContent = escapeHtml(d.vehicle_model || 'N/A');

        // Order items
        const tbody = document.getElementById('deliveryItemsBody');
        const items = d.items || [];
        if (items.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">No items in this delivery</td></tr>';
        } else {
            tbody.innerHTML = items.map(function(item) {
                const imgPath = getItemImagePath(item.image_path);
                const name = escapeHtml(item.Product_Name || 'Product');
                const variation = (item.variation && item.variation.trim()) ? '<div class="item-variation">' + escapeHtml(item.variation) + '</div>' : '';
                const qty = item.Quantity || 0;
                const price = formatPrice(item.Price);
                const total = formatPrice(item.line_total != null ? item.line_total : (qty * (item.Price || 0)));
                return '<tr>' +
                    '<td><div class="d-flex align-items-center"><img class="item-image mr-3" src="' + imgPath + '" alt="" onerror="this.src=\'../Customer_assets/images/Slice 15 (2).png\'"><div><div class="item-name">' + name + '</div>' + variation + '</div></div></td>' +
                    '<td class="text-center item-qty">' + qty + '</td>' +
                    '<td class="text-right item-price">' + price + '</td>' +
                    '<td class="text-right item-total">' + total + '</td></tr>';
            }).join('');
        }
        document.getElementById('deliveryItemsTotal').textContent = formatPrice(d.amount);

        const statusBadge = document.getElementById('statusBadge');
        statusBadge.textContent = d.Delivery_Status || 'Pending';
        statusBadge.className = 'badge ml-2 ' + (
            isDelivered ? 'badge-success' :
            isCancelled ? 'badge-danger' :
            isOutForDelivery ? 'badge-primary' : 'badge-secondary'
        );

        const viewFullOrderLink = document.getElementById('viewFullOrderLink');
        viewFullOrderLink.href = '../Admin/ViewOrderAccept.html?order_id=' + (d.Order_ID || '');
        viewFullOrderLink.style.display = 'inline-block';

        const completeBtn = document.getElementById('completeDeliveryBtn');
        const cancelBtn = document.getElementById('cancelDeliveryBtn');

        const customerName = d.customer_name || 'the customer';
        const escapedCustomerName = escapeHtml(customerName).replace(/"/g, '&quot;');

        if (isOutForDelivery) {
            completeBtn.style.display = 'inline-block';
            completeBtn.setAttribute('data-delivery-id', d.Delivery_ID);
            completeBtn.setAttribute('data-order-id', d.Order_ID);
            completeBtn.setAttribute('data-customer-name', escapedCustomerName);

            if (!isDriver) {
                cancelBtn.style.display = 'inline-block';
                cancelBtn.setAttribute('data-delivery-id', d.Delivery_ID);
                cancelBtn.setAttribute('data-order-id', d.Order_ID);
                cancelBtn.setAttribute('data-customer-name', escapedCustomerName);
            }
        } else {
            completeBtn.style.display = 'none';
            cancelBtn.style.display = 'none';
        }

    } catch (err) {
        console.error('[Load Delivery Details] Error:', err);
        loadingEl.style.display = 'none';
        errorEl.style.display = 'block';
        errorText.textContent = err.message || 'Failed to load delivery details.';
    }
}

document.addEventListener('DOMContentLoaded', function() {
    loadDeliveryDetails();
});
