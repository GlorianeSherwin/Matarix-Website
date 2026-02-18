/**
 * Load Transaction History
 * Loads completed/delivered orders for the transaction history page
 */

// Format price
function formatPrice(price) {
    return '₱' + parseFloat(price).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// Format date
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
}

// Format date and time
function formatDateTime(dateString) {
    if (!dateString) return { date: 'N/A', time: 'N/A' };
    const date = new Date(dateString);
    const dateStr = date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    const timeStr = date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
    });
    return { date: dateStr, time: timeStr };
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, function(m) { return map[m]; });
}

// Load transaction history
async function loadTransactionHistory() {
    const sessionUserId = sessionStorage.getItem('user_id');
    
    if (!sessionUserId) {
        console.error('[Transaction History] No user ID in session, redirecting to login');
        window.location.href = 'Login.html';
        return;
    }
    
    try {
        console.log('[Transaction History] Loading orders for user:', sessionUserId);
        
        // Fetch all orders
        const response = await fetch('../api/get_customer_orders.php', {
            method: 'GET',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('[Transaction History] Orders loaded:', data);
        
        if (data.success && data.orders && data.orders.length > 0) {
            // Filter for completed/delivered orders
            const completedOrders = [];
            
            for (const order of data.orders) {
                // Check delivery status
                try {
                    const deliveryResponse = await fetch(`../api/get_delivery_status.php?order_id=${order.Order_ID}`, {
                        method: 'GET',
                        credentials: 'include'
                    });
                    
                    if (deliveryResponse.ok) {
                        const deliveryData = await deliveryResponse.json();
                        if (deliveryData.success && deliveryData.delivery && 
                            deliveryData.delivery.Delivery_Status === 'Delivered') {
                            // Get full order details with items
                            const orderDetailResponse = await fetch(`../api/get_customer_orders.php?order_id=${order.Order_ID}`, {
                                method: 'GET',
                                credentials: 'include'
                            });
                            
                            if (orderDetailResponse.ok) {
                                const orderDetailData = await orderDetailResponse.json();
                                if (orderDetailData.success && orderDetailData.order) {
                                    completedOrders.push(orderDetailData.order);
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error(`Error checking delivery status for order ${order.Order_ID}:`, error);
                }
            }
            
            if (completedOrders.length > 0) {
                // Sort by order date (most recent first)
                completedOrders.sort((a, b) => new Date(b.order_date) - new Date(a.order_date));
                
                // Display the most recent completed order
                displayTransactionHistory(completedOrders[0]);
            } else {
                // No completed orders
                displayNoOrders();
            }
        } else {
            displayNoOrders();
        }
    } catch (error) {
        console.error('[Transaction History] Error loading orders:', error);
        alert('Failed to load transaction history. Please try again.');
    }
}

// Display transaction history
function displayTransactionHistory(order) {
    const historyCard = document.getElementById('historyCard');
    const expandableContent = document.getElementById('expandableContent');
    
    if (!historyCard || !expandableContent) {
        console.error('[Transaction History] Required elements not found');
        return;
    }
    
    const orderId = order.Order_ID;
    const orderNumber = `ORD-${orderId.toString().padStart(4, '0')}`;
    const totalAmount = formatPrice(order.amount);
    const itemCount = order.items ? order.items.length : 0;
    const itemNames = order.items ? order.items.map(item => escapeHtml(item.Product_Name)).join(', ') : 'No items';
    
    // Get delivery status and date
    const deliveryDate = order.availability_date || order.order_date;
    const deliveryDateTime = formatDateTime(deliveryDate);
    
    // Payment method
    const paymentMethod = order.payment_method || order.transaction_payment_method || 'On-Site';
    
    // Order date
    const orderDate = formatDate(order.order_date);
    
    // Update history card
    const orderItem = historyCard.querySelector('.order-item');
    if (orderItem) {
        orderItem.innerHTML = `
            <div class="item-image">🔩</div>
            <div class="item-details">
                <div class="item-name">Order # ${orderNumber}</div>
                <div class="item-description">${itemCount} items • ${itemNames}</div>
                <div class="item-description">Estimated delivery: ${deliveryDate ? formatDate(deliveryDate) : 'TBD'}</div>
                <div class="item-price">${totalAmount}</div>
            </div>
            <div class="order-status">
                <div class="completion-info">
                    <div class="completion-date">Order Received: ${deliveryDateTime.date}</div>
                    <div class="completion-time">Time: ${deliveryDateTime.time}</div>
                </div>
                <div class="status-actions">
                    <span class="status-badge status-completed">
                        <i class="fas fa-check-circle"></i>
                        Completed
                    </span>
                    <i class="fas fa-chevron-right expand-icon"></i>
                </div>
            </div>
        `;
    }
    
    // Update expandable content - Order Summary
    const orderSummarySection = expandableContent.querySelector('.order-summary-section');
    if (orderSummarySection) {
        orderSummarySection.innerHTML = `
            <h6 class="section-title">Order Summary</h6>
            <div class="summary-details">
                <div class="row">
                    <div class="col-md-6">
                        <div class="detail-group">
                            <label>Order Information</label>
                            <div class="detail-item">
                                <span class="detail-label">Order Number:</span>
                                <span class="detail-value">${orderNumber}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Order Date:</span>
                                <span class="detail-value">${orderDate}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Payment Method:</span>
                                <span class="detail-value">${paymentMethod === 'GCash' ? 'GCash' : (paymentMethod === 'Cash on Delivery' ? 'Cash on Delivery (COD)' : (paymentMethod || 'On-Site'))}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Total Amount:</span>
                                <span class="detail-value price">${totalAmount}</span>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="detail-group">
                            <label>Delivery Information</label>
                            <div class="detail-item">
                                <span class="detail-label">Delivery Date:</span>
                                <span class="detail-value">${deliveryDateTime.date}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Delivery Time:</span>
                                <span class="detail-value">${deliveryDateTime.time}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Status:</span>
                                <span class="detail-value status-text">COMPLETED</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Your Rating:</span>
                                <div class="rating-display">
                                    <span class="star filled">★</span>
                                    <span class="star filled">★</span>
                                    <span class="star filled">★</span>
                                    <span class="star filled">★</span>
                                    <span class="star filled">★</span>
                                    <span class="rating-text">(5.0)</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Update receipt button
    const receiptButton = expandableContent.querySelector('.btn-receipt');
    if (receiptButton) {
        receiptButton.setAttribute('onclick', `viewReceipt(${orderId})`);
    }
    
    // Update items delivered section
    const itemsDeliveredSection = expandableContent.querySelector('.items-delivered-section');
    if (itemsDeliveredSection && order.items && order.items.length > 0) {
        let itemsHTML = '<h6 class="section-title">Items Delivered</h6><div class="delivered-items">';
        
        order.items.forEach((item) => {
            // Build variation string
            let variation = '';
            if (item.length && item.Width) {
                variation = `${item.length}${item.Unit || ''} x ${item.Width}${item.Unit || ''}`;
            } else if (item.length) {
                variation = `${item.length}${item.Unit || ''}`;
            } else if (item.Width) {
                variation = `${item.Width}${item.Unit || ''}`;
            } else {
                variation = 'Standard';
            }
            
            // Get item icon based on category
            const itemIcon = getItemIcon(item.category || '');
            
            itemsHTML += `
                <div class="delivered-item">
                    <div class="item-info">
                        <div class="item-image">${itemIcon}</div>
                        <div class="item-details">
                            <div class="item-name">${escapeHtml(item.Product_Name || 'Unknown Product')}</div>
                            <div class="item-specs">${escapeHtml(variation)}</div>
                            <div class="item-qty">Quantity: ${item.Quantity}</div>
                        </div>
                    </div>
                    <div class="item-status">
                        <span class="status-badge status-delivered">
                            <i class="fas fa-check"></i>
                            Delivered
                        </span>
                        <div class="item-rating">
                            <span class="star filled">★</span>
                            <span class="star filled">★</span>
                            <span class="star filled">★</span>
                            <span class="star filled">★</span>
                            <span class="star filled">★</span>
                        </div>
                    </div>
                </div>
            `;
        });
        
        itemsHTML += '</div>';
        itemsDeliveredSection.innerHTML = itemsHTML;
    }
    
    // Store order ID for reorder function
    window.currentOrderId = orderId;
    window.currentOrderItems = order.items || [];
}

// Get item icon based on category
function getItemIcon(category) {
    const iconMap = {
        'Hollow Blocks': '🧱',
        'Steel': '⚙️',
        'Concrete': '🔩',
        'Cement': '🏗️',
        'default': '📦'
    };
    return iconMap[category] || iconMap['default'];
}

// Display no orders message
function displayNoOrders() {
    const historyCard = document.getElementById('historyCard');
    const expandableContent = document.getElementById('expandableContent');
    
    if (historyCard) {
        historyCard.innerHTML = `
            <div class="order-item">
                <div class="item-details" style="width: 100%; text-align: center; padding: 40px;">
                    <div class="item-name" style="color: var(--matarix-text-muted);">
                        <i class="fas fa-inbox" style="font-size: 3rem; margin-bottom: 20px; display: block; opacity: 0.5;"></i>
                        No Completed Orders Yet
                    </div>
                    <div class="item-description" style="margin-top: 10px;">
                        You don't have any completed orders in your transaction history.
                    </div>
                </div>
            </div>
        `;
    }
    
    if (expandableContent) {
        expandableContent.style.display = 'none';
    }
}

// Back button - go to previous page
function initTransactionHistoryBackButton() {
    const backBtn = document.getElementById('transactionHistoryBackBtn');
    if (backBtn) {
        backBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (window.history.length > 1) {
                window.history.back();
            } else {
                window.location.href = 'OrderSummary.html';
            }
        });
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    loadTransactionHistory();
    initTransactionHistoryBackButton();
});

// Make functions globally available
window.loadTransactionHistory = loadTransactionHistory;
window.displayTransactionHistory = displayTransactionHistory;

