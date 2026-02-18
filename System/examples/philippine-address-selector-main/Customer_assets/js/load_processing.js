/**
 * Load Processing Page
 * Loads order details for processing.html based on order_id from URL
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

// Load processing order
async function loadProcessingOrder() {
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('order_id');
    
    if (!orderId) {
        console.error('No order_id provided in URL');
        return;
    }
    
    try {
        const response = await fetch(`../api/get_customer_orders.php?order_id=${orderId}`, {
            method: 'GET',
            credentials: 'include'
        });
        
        if (!response.ok) {
            if (response.status === 403 || response.status === 404) {
                console.error('[Processing] Order access denied or not found');
                const orderCard = document.getElementById('orderCard');
                if (orderCard) {
                    orderCard.innerHTML = `
                        <div class="order-item">
                            <div class="item-details">
                                <div class="item-name text-danger">Access Denied</div>
                                <div class="item-description">This order does not belong to you or does not exist. Redirecting to Order Summary...</div>
                            </div>
                        </div>
                    `;
                }
                // Redirect after a short delay
                setTimeout(() => {
                    const userId = sessionStorage.getItem('user_id');
                    if (userId) {
                        window.location.href = 'OrderSummary.html';
                    } else {
                        window.location.href = 'OrderSummary.html';
                    }
                }, 2000);
                return;
            }
        }
        
        const data = await response.json();
        
        if (data.success && data.order) {
            // Verify the order belongs to the logged-in user
            const sessionUserId = sessionStorage.getItem('user_id');
            console.log(`[Processing] Session User ID: ${sessionUserId}, Order loaded successfully`);
            
            // Store order data for navigation tracker - make sure status is preserved
            window.currentOrderData = {
                ...data.order,
                status: data.order.status || 'Processing' // Ensure status is always set
            };
            console.log(`[Processing] Order loaded - Status: "${window.currentOrderData.status}", Order ID: ${data.order.Order_ID}`);
            console.log(`[Processing] Full order data stored:`, window.currentOrderData);
            
            displayProcessingOrder(data.order);
            
            // Update progress tracker after order data is loaded
            // Try multiple times to ensure tracker is ready
            let attempts = 0;
            const maxAttempts = 10;
            const updateTracker = () => {
                attempts++;
                const tracker = document.querySelector('.progress-tracker-container');
                if (tracker) {
                    console.log(`[Processing] Tracker found, updating (attempt ${attempts})`);
                    updateProgressTracker();
                } else if (attempts < maxAttempts) {
                    console.log(`[Processing] Tracker not found yet, retrying (attempt ${attempts}/${maxAttempts})`);
                    setTimeout(updateTracker, 200);
                } else {
                    console.warn(`[Processing] Tracker not found after ${maxAttempts} attempts`);
                }
            };
            
            // Start trying to update after a short delay
            setTimeout(updateTracker, 600);
            
            // Set up periodic refresh to get latest order status from database
            if (window.processingOrderRefreshInterval) {
                clearInterval(window.processingOrderRefreshInterval);
            }
            
            window.processingOrderRefreshInterval = setInterval(async () => {
                await refreshOrderData(data.order.Order_ID);
            }, 5000); // Refresh every 5 seconds
        } else {
            console.error('Failed to load order:', data.message);
            const orderCard = document.getElementById('orderCard');
            if (orderCard) {
                orderCard.innerHTML = `
                    <div class="order-item">
                        <div class="item-details">
                            <div class="item-name text-danger">Error: ${data.message || 'Failed to load order'}</div>
                            <div class="item-description">This order may not belong to you or may not exist. Please go back to Order Summary.</div>
                            <a href="OrderSummary.html" class="btn btn-primary mt-2">Go to Order Summary</a>
                        </div>
                    </div>
                `;
            }
        }
    } catch (error) {
        console.error('Error loading order:', error);
    }
}

// Display processing order
function displayProcessingOrder(order) {
    const orderCard = document.getElementById('orderCard');
    if (!orderCard) return;
    
    const orderId = order.Order_ID;
    const orderNumber = `ORD-${orderId.toString().padStart(4, '0')}`;
    const totalAmount = formatPrice(order.amount);
    const itemCount = order.items ? order.items.length : 0;
    const itemNames = order.items ? order.items.map(item => item.Product_Name).join(', ') : 'No items';
    
    // Update order card
    const orderItem = orderCard.querySelector('.order-item');
    if (orderItem) {
        orderItem.innerHTML = `
            <div class="item-image">🔩</div>
            <div class="item-details">
                <div class="item-name">Order # ${orderNumber}</div>
                <div class="item-description">${itemCount} items • ${itemNames}</div>
                <div class="item-description">Estimated delivery: ${order.availability_date ? formatDate(order.availability_date) : 'TBD'}</div>
                <div class="item-price">${totalAmount}</div>
            </div>
            <div class="order-actions">
                <i class="fas fa-clipboard-list" style="color: var(--matarix-red-light); font-size: 1.5rem;"></i>
                <i class="fas fa-chevron-right expand-icon"></i>
            </div>
        `;
    }
}

// Refresh order data from database
async function refreshOrderData(orderId) {
    try {
        const response = await fetch(`../api/get_customer_orders.php?order_id=${orderId}`, {
            method: 'GET',
            credentials: 'include'
        });
        
        if (!response.ok) {
            console.warn('Failed to refresh order data:', response.status);
            return;
        }
        
        const data = await response.json();
        console.log('[Refresh] API Response:', data);
        
        if (data.success && data.order) {
            const oldStatus = window.currentOrderData?.status || 'Unknown';
            const newStatus = data.order.status || 'Unknown';
            
            console.log(`[Refresh] Current status: "${oldStatus}", New status: "${newStatus}"`);
            console.log(`[Refresh] Full order data:`, data.order);
            
            // Update stored order data - make sure we preserve all fields
            window.currentOrderData = {
                ...window.currentOrderData,
                ...data.order
            };
            
            // Verify the status is now set
            console.log(`[Refresh] window.currentOrderData.status after update: "${window.currentOrderData.status}"`);
            
            // Always update the progress tracker to ensure it reflects current state
            // This handles cases where status might have changed externally
            if (oldStatus !== newStatus && oldStatus !== 'Unknown') {
                console.log(`Order status changed: ${oldStatus} -> ${newStatus}`);
            }
            
            // Update tracker regardless to ensure it's in sync
            updateProgressTracker();
        } else {
            console.warn('Failed to refresh order data:', data.message || 'Unknown error');
        }
    } catch (error) {
        console.error('Error refreshing order data:', error);
    }
}

// Update progress tracker based on current order data
function updateProgressTracker() {
    if (window.MatarixNavigation && window.MatarixNavigation.updateProgressTracker) {
        window.MatarixNavigation.updateProgressTracker();
    }
}

// Clean up interval when page is unloaded
window.addEventListener('beforeunload', function() {
    if (window.processingOrderRefreshInterval) {
        clearInterval(window.processingOrderRefreshInterval);
    }
});

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadProcessingOrder);
} else {
    loadProcessingOrder();
}

