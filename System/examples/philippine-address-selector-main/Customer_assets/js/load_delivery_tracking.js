/**
 * Load Delivery Tracking
 * Loads order and delivery details for delivery-tracking.html
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

// Format datetime
function formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
}

// Normalize delivery status (convert old values to standardized values)
// This should be used consistently throughout the file
function normalizeStatus(status) {
    if (!status) return 'Pending';
    const s = String(status).trim();
    const sLower = s.toLowerCase();
    
    // Map old values to new standardized values
    if (sLower === 'on the way' || sLower === 'out for delivery') {
        return 'Out for Delivery';
    }
    if (sLower === 'preparing') {
        return 'Preparing';
    }
    if (sLower === 'pending') {
        return 'Pending';
    }
    if (sLower === 'delivered') {
        return 'Delivered';
    }
    if (sLower === 'cancelled') {
        return 'Cancelled';
    }
    
    // Return as-is if already standardized
    return s;
}

// Initialize delivery tracking page
// Check if order_id is in URL - if yes, show that order directly; if no, show orders list
async function loadDeliveryTracking() {
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('order_id');
    
    if (orderId) {
        // If order_id is in URL, show that order's tracking directly
        console.log(`[Delivery Tracking] Order ID in URL: ${orderId}, loading directly...`);
        // Hide orders list, show selected order section
        const ordersListSection = document.getElementById('ordersListSection');
        const selectedOrderSection = document.getElementById('selectedOrderSection');
        if (ordersListSection) ordersListSection.style.display = 'none';
        if (selectedOrderSection) selectedOrderSection.style.display = 'block';
        await loadOrderTracking(parseInt(orderId));
        updatePageTitle('single-order');
    } else {
        // Otherwise, show the orders list
        console.log('[Delivery Tracking] No order ID in URL, loading orders list...');
        const filterParam = urlParams.get('filter');
        window.currentActiveFilter = (filterParam === 'to-rate' || filterParam === 'history') ? filterParam : 'to-rate';
        await loadAllOrders();
        
        // Apply filter from URL or default to To Rate
        if (window.currentActiveFilter === 'history') {
            await showHistoryOrders();
        } else {
            await showToRateOrders();
        }
    }
}

// Store all orders globally for filtering
window.allOrdersData = [];

// Track current active filter
window.currentActiveFilter = null;

// Update page title (h1 and document) based on current view
function updatePageTitle(filterType) {
    const pageTitleEl = document.querySelector('.page-header .page-title');
    let title = 'My Orders';
    
    switch (filterType) {
        case 'to-rate':
            title = 'Order Rating';
            break;
        case 'history':
            title = 'Order History';
            break;
        case 'pending':
            title = 'Pending Orders';
            break;
        case 'preparing':
            title = 'Preparing Orders';
            break;
        case 'to-receive':
            title = 'Orders To Receive';
            break;
        case 'completed':
            title = 'Completed Orders';
            break;
        case 'single-order':
            title = 'Track Order';
            break;
    }
    
    if (pageTitleEl) pageTitleEl.textContent = title;
    document.title = `MATARIX - ${title}`;
}

// Load all orders and display them in a list
async function loadAllOrders() {
    const sessionUserId = sessionStorage.getItem('user_id');
    
    // Verify session first
    if (!sessionUserId) {
        console.error('[Delivery Tracking] No user ID in session, redirecting to login');
        window.location.href = '../Customer/Login.html';
        return;
    }
    
    try {
        const response = await fetch(`../api/get_customer_orders.php`, {
            method: 'GET',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('[Delivery Tracking] All orders loaded:', data);
        
        if (data.success && data.orders && data.orders.length > 0) {
            // Load delivery status for each order
            const ordersWithDelivery = await Promise.all(
                data.orders.map(async (order) => {
                    try {
                        const deliveryResponse = await fetch(`../api/get_delivery_status.php?order_id=${order.Order_ID}`, {
                            method: 'GET',
                            credentials: 'include'
                        });
                        const deliveryData = await deliveryResponse.json();
                        return {
                            ...order,
                            delivery: deliveryData.success ? deliveryData.delivery : null,
                            deliveryStatus: deliveryData.success && deliveryData.delivery 
                                ? normalizeStatus(deliveryData.delivery.Delivery_Status || 'Pending')
                                : 'Pending'
                        };
                    } catch (error) {
                        console.error(`Error loading delivery for order ${order.Order_ID}:`, error);
                        return {
                            ...order,
                            delivery: null,
                            deliveryStatus: 'Pending'
                        };
                    }
                })
            );
            
            // Store all orders globally for filtering
            window.allOrdersData = ordersWithDelivery;
            
            // Apply filters and display
            applyFilters();
        } else {
            window.allOrdersData = [];
            displayNoOrders();
        }
    } catch (error) {
        console.error('[Delivery Tracking] Error loading orders:', error);
        // Check if it's a network error or actual API error
        const isNetworkError = error.message.includes('Failed to fetch') || 
                             error.message.includes('NetworkError') ||
                             error.message.includes('network');
        
        if (isNetworkError) {
            displayError('Network error. Please check your connection and try again.');
        } else {
            // For other errors, show "No deliveries found" as it might just be no orders
            displayNoOrders();
        }
    }
}

// Apply filters to orders
function applyFilters() {
    if (!window.allOrdersData || window.allOrdersData.length === 0) {
        return;
    }
    
    const statusFilter = document.getElementById('statusFilter')?.value || 'all';
    const sortFilter = document.getElementById('sortFilter')?.value || 'date-desc';
    
    // Filter by status
    let filteredOrders = window.allOrdersData;
    if (statusFilter !== 'all') {
        filteredOrders = window.allOrdersData.filter(order => {
            const orderStatus = order.deliveryStatus || 'Pending';
            return orderStatus === statusFilter;
        });
    }
    
    // Sort orders
    filteredOrders = [...filteredOrders]; // Create a copy to avoid mutating original
    switch (sortFilter) {
        case 'date-desc':
            filteredOrders.sort((a, b) => new Date(b.order_date) - new Date(a.order_date));
            break;
        case 'date-asc':
            filteredOrders.sort((a, b) => new Date(a.order_date) - new Date(b.order_date));
            break;
        case 'amount-desc':
            filteredOrders.sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount));
            break;
        case 'amount-asc':
            filteredOrders.sort((a, b) => parseFloat(a.amount) - parseFloat(b.amount));
            break;
        case 'status':
            // Sort by status: Pending, Preparing, Out for Delivery, Delivered, Cancelled
            const statusOrder = {
                'Pending': 1,
                'Preparing': 2,
                'Out for Delivery': 3,
                'Delivered': 4,
                'Cancelled': 5
            };
            filteredOrders.sort((a, b) => {
                const statusA = statusOrder[a.deliveryStatus || 'Pending'] || 99;
                const statusB = statusOrder[b.deliveryStatus || 'Pending'] || 99;
                return statusA - statusB;
            });
            break;
    }
    
    // Show/hide clear filters button
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    if (clearFiltersBtn) {
        if (statusFilter !== 'all') {
            clearFiltersBtn.style.display = 'inline-flex';
        } else {
            clearFiltersBtn.style.display = 'none';
        }
    }
    
    // Update results info
    updateResultsInfo(filteredOrders.length, window.allOrdersData.length);
    
    // Display filtered orders
    displayOrdersList(filteredOrders);
}

// Clear all filters
function clearFilters() {
    const statusFilter = document.getElementById('statusFilter');
    const sortFilter = document.getElementById('sortFilter');
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    
    if (statusFilter) statusFilter.value = 'all';
    if (sortFilter) sortFilter.value = 'date-desc';
    if (clearFiltersBtn) clearFiltersBtn.style.display = 'none';
    
    applyFilters();
}

// Update results info
function updateResultsInfo(filteredCount, totalCount) {
    const resultsInfo = document.getElementById('resultsInfo');
    const resultsCount = document.getElementById('resultsCount');
    const totalCountEl = document.getElementById('totalCount');
    
    if (resultsInfo && resultsCount && totalCountEl) {
        resultsCount.textContent = filteredCount;
        totalCountEl.textContent = totalCount;
        
        if (filteredCount < totalCount) {
            resultsInfo.style.display = 'block';
        } else {
            resultsInfo.style.display = 'none';
        }
    }
}

// Display list of orders
function displayOrdersList(orders) {
    const ordersList = document.getElementById('ordersList');
    if (!ordersList) return;
    
    if (orders.length === 0) {
        ordersList.innerHTML = `
            <div class="text-center py-5">
                <i class="fas fa-search" style="font-size: 3rem; color: #ccc; margin-bottom: 1rem;"></i>
                <p class="text-muted">No orders match the selected filters</p>
                <button class="btn btn-primary mt-3" onclick="clearFilters()">Clear Filters</button>
            </div>
        `;
        return;
    }
    
    ordersList.innerHTML = orders.map(order => {
        const orderNumber = `ORD-${order.Order_ID.toString().padStart(4, '0')}`;
        const itemCount = order.items ? order.items.length : 0;
        const itemNames = order.items && order.items.length > 0
            ? order.items.slice(0, 2).map(item => item.Product_Name).join(', ') + (order.items.length > 2 ? ` +${order.items.length - 2} more` : '')
            : 'No items';
        const totalAmount = formatPrice(order.amount);
        const orderDate = formatDate(order.order_date);
        const deliveryStatus = order.deliveryStatus || 'Pending';
        const orderStatus = order.status || 'Pending Approval';
        const effectiveStatus = orderStatus === 'Pending Approval' ? 'Waiting Payment' : orderStatus;
        const deliveryMethod = (order.delivery_method || 'Standard Delivery').trim();
        const isPickup = deliveryMethod === 'Pick Up';
        const isDelivered = !isPickup && deliveryStatus.toLowerCase() === 'delivered';
        const isPickupCompleted = isPickup && effectiveStatus === 'Completed';
        const isRejected = effectiveStatus === 'Rejected';
        
        // Customize status display based on active filter
        let displayStatus = deliveryStatus;
        let statusBadgeClass = getDeliveryStatusBadgeClass(deliveryStatus);
        let statusIcon = getDeliveryStatusIcon(deliveryStatus);
        
        if (window.currentActiveFilter === 'to-rate' && (isDelivered || isPickupCompleted)) {
            displayStatus = 'To Rate';
            statusBadgeClass = 'status-to-rate';
            statusIcon = 'fas fa-star';
        } else if (window.currentActiveFilter === 'history') {
            if (isRejected || deliveryStatus.toLowerCase() === 'cancelled') {
                displayStatus = 'Cancelled';
                statusBadgeClass = 'status-cancelled';
                statusIcon = 'fas fa-times-circle';
            } else if (isDelivered || isPickupCompleted) {
                displayStatus = 'Completed';
                statusBadgeClass = 'status-completed';
                statusIcon = 'fas fa-check-circle';
            } else {
                statusBadgeClass = getDeliveryStatusBadgeClass(deliveryStatus);
                statusIcon = getDeliveryStatusIcon(deliveryStatus);
            }
        } else {
            statusBadgeClass = getDeliveryStatusBadgeClass(deliveryStatus);
            statusIcon = getDeliveryStatusIcon(deliveryStatus);
        }
        
        // When in "To Rate" filter, clicking should go to Product Review, not delivery tracking
        const canRate = isDelivered || isPickupCompleted;
        const orderId = order.Order_ID;
        const clickAction = (window.currentActiveFilter === 'to-rate' && canRate)
            ? `(function(){sessionStorage.setItem('productReviewReturnUrl',location.href);location.href='ProductReview.html?order_id=${orderId}';})()`
            : `selectOrder(${orderId})`;
        return `
            <div class="order-list-item" onclick="${clickAction}">
                <div class="order-list-item-content">
                    <div class="order-list-item-header">
                        <div class="order-list-item-id">
                            <i class="fas fa-box"></i>
                            <span>${orderNumber}</span>
                        </div>
                        <span class="delivery-status-badge ${statusBadgeClass}">
                            <i class="${statusIcon}"></i>
                            ${displayStatus}
                        </span>
                    </div>
                    <div class="order-list-item-body">
                        <div class="order-list-item-info">
                            <p class="order-list-item-items">${itemCount} items • ${itemNames}</p>
                            <p class="order-list-item-date">Ordered: ${orderDate}</p>
                        </div>
                        <div class="order-list-item-amount">
                            ${totalAmount}
                        </div>
                    </div>
                </div>
                <div class="order-list-item-arrow">
                    <i class="fas fa-chevron-right"></i>
                </div>
            </div>
        `;
    }).join('');
}

// Get delivery status badge class
function getDeliveryStatusBadgeClass(status) {
    const statusLower = status.toLowerCase();
    if (statusLower === 'delivered') return 'status-delivered';
    if (statusLower === 'out for delivery') return 'status-out-for-delivery';
    if (statusLower === 'preparing') return 'status-preparing';
    if (statusLower === 'cancelled') return 'status-cancelled';
    return 'status-pending';
}

// Get delivery status icon
function getDeliveryStatusIcon(status) {
    const statusLower = status.toLowerCase();
    if (statusLower === 'delivered') return 'fas fa-check-circle';
    if (statusLower === 'out for delivery') return 'fas fa-truck';
    if (statusLower === 'preparing') return 'fas fa-box';
    if (statusLower === 'cancelled') return 'fas fa-times-circle';
    return 'fas fa-clock';
}

// Display no orders message
function displayNoOrders() {
    const ordersList = document.getElementById('ordersList');
    if (ordersList) {
        ordersList.innerHTML = `
            <div class="text-center py-5">
                <i class="fas fa-inbox" style="font-size: 3rem; color: #ccc; margin-bottom: 1rem;"></i>
                <p class="text-muted">No orders found</p>
                <a href="OrderSummary.html" class="btn btn-primary mt-3">View Orders</a>
            </div>
        `;
    }
}

// Display error message (for actual errors, not just no orders)
function displayError(message) {
    const ordersList = document.getElementById('ordersList');
    if (ordersList) {
        ordersList.innerHTML = `
            <div class="text-center py-5">
                <i class="fas fa-exclamation-triangle text-danger" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                <p class="text-danger">${message}</p>
                <button class="btn btn-primary mt-3" onclick="loadAllOrders()">Retry</button>
            </div>
        `;
    }
}

// Show orders list view
function showOrdersList(event) {
    // Prevent default navigation behavior if event is provided
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    const ordersListSection = document.getElementById('ordersListSection');
    const selectedOrderSection = document.getElementById('selectedOrderSection');
    
    if (ordersListSection) ordersListSection.style.display = 'block';
    if (selectedOrderSection) selectedOrderSection.style.display = 'none';
    
    // Reset section headers to default
    const sectionTitle = document.querySelector('.section-title');
    const sectionSubtitle = document.querySelector('.section-subtitle');
    if (sectionTitle) {
        sectionTitle.textContent = 'My Orders';
    }
    if (sectionSubtitle) {
        sectionSubtitle.textContent = 'Select an order to track its delivery';
    }
    
    // Clear active filter state
    clearActiveFilter();
    
    // Clear active filter tracking
    window.currentActiveFilter = null;
    
    // Reset page title
    updatePageTitle(null);
    
    // Clear selected order data
    window.currentOrderId = null;
    window.currentOrderData = null;
    window.currentDeliveryData = null;
    
    // Update URL to remove order_id parameter (stay on delivery-tracking.html)
    const url = new URL(window.location.href);
    url.searchParams.delete('order_id');
    window.history.pushState({}, '', url.toString());
    
    // Reload orders list to ensure it's displayed
    loadAllOrders();
}

// Select an order and show its tracking details
async function selectOrder(orderId) {
    console.log(`[Delivery Tracking] Selecting order: ${orderId}`);
    
    // Hide orders list, show selected order section
    const ordersListSection = document.getElementById('ordersListSection');
    const selectedOrderSection = document.getElementById('selectedOrderSection');
    
    if (ordersListSection) ordersListSection.style.display = 'none';
    if (selectedOrderSection) selectedOrderSection.style.display = 'block';
    
    // Update URL to include order_id
    const url = new URL(window.location.href);
    url.searchParams.set('order_id', orderId);
    window.history.pushState({}, '', url.toString());
    
    // Load and display the selected order's tracking details
    await loadOrderTracking(orderId);
    updatePageTitle('single-order');
}

// Load delivery tracking data for a specific order
async function loadOrderTracking(orderId) {
    const sessionUserId = sessionStorage.getItem('user_id');
    
    if (!orderId) {
        console.error('No order_id provided');
        return;
    }
    
    try {
        // Load order details
        const orderResponse = await fetch(`../api/get_customer_orders.php?order_id=${orderId}`, {
            method: 'GET',
            credentials: 'include'
        });
        
        if (!orderResponse.ok) {
            if (orderResponse.status === 403 || orderResponse.status === 404) {
                console.error('[Delivery Tracking] Order access denied or not found');
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
        
        const orderData = await orderResponse.json();
        
        // Load delivery status (only if order belongs to user)
        let deliveryData = { success: false };
        if (orderData.success && orderData.order) {
            const deliveryResponse = await fetch(`../api/get_delivery_status.php?order_id=${orderId}`, {
                method: 'GET',
                credentials: 'include'
            });
            deliveryData = await deliveryResponse.json();
            console.log(`[Delivery Tracking] Delivery data loaded:`, deliveryData);
        }
        
        console.log(`[Delivery Tracking] API Response:`, orderData);
        
        if (orderData.success && orderData.order) {
            // Verify the order belongs to the logged-in user (API should have already checked, but verify)
            const sessionUserId = sessionStorage.getItem('user_id');
            const apiSessionUserId = orderData.session_user_id; // From PHP session
            
            console.log(`[Delivery Tracking] Frontend Session User ID: ${sessionUserId}, API Session User ID: ${apiSessionUserId}, Order User ID: ${orderData.order.User_ID}`);
            
            // CRITICAL: Check if PHP session matches frontend session
            if (apiSessionUserId && parseInt(apiSessionUserId) !== parseInt(sessionUserId)) {
                console.error(`[Delivery Tracking] CRITICAL: PHP Session User ID (${apiSessionUserId}) does not match Frontend Session User ID (${sessionUserId})`);
                alert('Session Mismatch: Your session has changed. Please log out and log back in.');
                window.location.href = '../Customer/Login.html';
                return;
            }
            
            // Additional verification: Check if order has User_ID field (if API returns it)
            if (orderData.order.User_ID && parseInt(orderData.order.User_ID) !== parseInt(sessionUserId)) {
                console.error(`[Delivery Tracking] SECURITY WARNING: Order User_ID (${orderData.order.User_ID}) does not match Session User_ID (${sessionUserId})`);
                alert('Security Error: This order does not belong to you. Redirecting...');
                window.location.href = 'OrderSummary.html';
                return;
            }
            
            console.log(`[Delivery Tracking] Order ID: ${orderData.order.Order_ID}, Order loaded successfully`);
            
            // Ensure we have delivery data structure
            const delivery = deliveryData.success && deliveryData.delivery 
                ? deliveryData.delivery 
                : { 
                    Order_ID: orderId,
                    Delivery_ID: null, // Explicitly set to null if no delivery record
                    Delivery_Status: 'Pending',
                    Created_At: null,
                    Updated_At: null
                };
            
            // Log delivery data for debugging
            console.log('[Load Order Tracking] Delivery data:', {
                deliveryData: deliveryData,
                delivery: delivery,
                hasDeliveryId: delivery && delivery.Delivery_ID !== undefined && delivery.Delivery_ID !== null && delivery.Delivery_ID !== 0,
                deliveryId: delivery ? delivery.Delivery_ID : 'N/A'
            });
            
            // Log if delivery record doesn't exist
            if (!deliveryData.success || !deliveryData.delivery || !deliveryData.has_record) {
                console.warn(`[Delivery Tracking] No delivery record found for order ${orderId}. Status will show as 'Pending' until a delivery record is created.`);
            }
            
            // Store delivery data for navigation tracker (normalize status first)
            const normalizedDelivery = {
                ...delivery,
                Delivery_Status: normalizeStatus(delivery.Delivery_Status || 'Pending')
            };
            window.currentDeliveryData = normalizedDelivery;
            console.log('[Delivery Tracking] Stored delivery data:', normalizedDelivery);
            console.log('[Delivery Tracking] Normalized Delivery_Status:', normalizedDelivery.Delivery_Status);
            
            // Regenerate progress tracker with correct step when delivery data is available
            // This is more reliable than trying to update an existing tracker
            const regenerateTrackerWithDeliveryData = (attempt = 1, maxAttempts = 10) => {
                if (window.MatarixNavigation) {
                    console.log(`[Delivery Tracking] Regenerating progress tracker with delivery data (attempt ${attempt})...`);
                    console.log('[Delivery Tracking] Current delivery status:', normalizedDelivery.Delivery_Status);
                    
                    // Try to regenerate the tracker
                    if (typeof window.MatarixNavigation.regenerateTracker === 'function') {
                        window.MatarixNavigation.regenerateTracker();
                        
                        // Verify regeneration worked
                        setTimeout(() => {
                            const tracker = document.querySelector('.progress-tracker-container');
                            if (tracker) {
                                const currentStep = window.MatarixNavigation.getCurrentStep();
                                const activeStep = tracker.querySelector(`.progress-step[data-step="${currentStep}"]`);
                                if (activeStep && activeStep.classList.contains('active')) {
                                    console.log('[Delivery Tracking] ✅ Progress tracker regenerated successfully with step', currentStep);
                                } else {
                                    console.warn(`[Delivery Tracking] ⚠️ Regeneration verification failed. Expected step: ${currentStep}, Active step found:`, activeStep ? activeStep.getAttribute('data-step') : 'none');
                                    // Try update as fallback
                                    if (typeof window.MatarixNavigation.updateProgressTracker === 'function') {
                                        window.MatarixNavigation.updateProgressTracker();
                                    }
                                }
                            }
                        }, 200);
                    } else if (typeof window.MatarixNavigation.updateProgressTracker === 'function') {
                        // Fallback to update if regenerate not available
                        console.log('[Delivery Tracking] Regenerate not available, using update instead...');
                        window.MatarixNavigation.updateProgressTracker();
                    } else {
                        console.warn('[Delivery Tracking] Neither regenerate nor update available');
                    }
                } else if (attempt < maxAttempts) {
                    console.warn(`[Delivery Tracking] MatarixNavigation not available yet, will retry (attempt ${attempt})...`);
                    setTimeout(() => regenerateTrackerWithDeliveryData(attempt + 1, maxAttempts), 300);
                } else {
                    console.error('[Delivery Tracking] ❌ MatarixNavigation not available after multiple attempts');
                }
            };
            
            // Start regeneration attempts
            setTimeout(() => regenerateTrackerWithDeliveryData(), 500);
            
            // Store order data as well
            window.currentOrderData = orderData.order;
            
            displayDeliveryTracking(orderData.order, delivery);
            
            // Set up periodic refresh to get latest delivery status from database
            // This enables real-time updates when drivers update delivery status
            if (window.deliveryTrackingRefreshInterval) {
                clearInterval(window.deliveryTrackingRefreshInterval);
            }
            
            console.log(`[Delivery Tracking] Setting up polling for order ${orderId} (every 5 seconds)`);
            
            // Store orderId globally for polling
            window.currentOrderId = orderId;
            
            // Clear any existing interval
            if (window.deliveryTrackingRefreshInterval) {
                clearInterval(window.deliveryTrackingRefreshInterval);
            }
            
            // Set up polling interval
            window.deliveryTrackingRefreshInterval = setInterval(async () => {
                if (window.currentOrderId) {
                    await refreshDeliveryStatus(window.currentOrderId);
                }
            }, 5000); // Refresh every 5 seconds
            
            // Also refresh immediately after a short delay to catch any updates
            setTimeout(async () => {
                if (window.currentOrderId) {
                    console.log(`[Delivery Tracking] Initial refresh after 2 seconds...`);
                    await refreshDeliveryStatus(window.currentOrderId);
                }
            }, 2000);
            
            // Add manual refresh function for testing
            window.manualRefreshDelivery = async () => {
                if (window.currentOrderId) {
                    console.log(`[Delivery Tracking] Manual refresh triggered`);
                    await refreshDeliveryStatus(window.currentOrderId);
                }
            };
            
            // Don't call initMatarixNavigation here - navigation.js will handle it
            // This prevents duplicate trackers
        } else {
            console.error('Failed to load order:', orderData.message);
            const orderCard = document.getElementById('orderCard');
            if (orderCard) {
                orderCard.innerHTML = `
                    <div class="order-item">
                        <div class="item-details">
                            <div class="item-name text-danger">Error: ${orderData.message || 'Failed to load order'}</div>
                            <div class="item-description">This order may not belong to you or may not exist. Please go back to Order Summary.</div>
                            <a href="OrderSummary.html" class="btn btn-primary mt-2">Go to Order Summary</a>
                        </div>
                    </div>
                `;
            }
        }
    } catch (error) {
        console.error('Error loading delivery tracking:', error);
    }
}

// Display delivery tracking (renamed to avoid confusion)
function displayDeliveryTracking(order, delivery) {
    const orderCard = document.getElementById('orderCard');
    if (!orderCard) return;
    
    const orderId = order.Order_ID;
    const orderNumber = `ORD-${orderId.toString().padStart(4, '0')}`;
    const totalAmount = formatPrice(order.amount);
    const itemCount = order.items ? order.items.length : 0;
    const itemNames = order.items ? order.items.map(item => item.Product_Name).join(', ') : 'No items';
        // Normalize delivery status (handle old values)
        let deliveryStatus = delivery.Delivery_Status || 'Pending';
        // Convert old statuses to standardized ones
        const statusLower = String(deliveryStatus).toLowerCase();
        if (statusLower === 'cancelled' || statusLower === 'canceled') {
            deliveryStatus = 'Cancelled';
        } else if (deliveryStatus === 'On the Way' || deliveryStatus === 'out for delivery' || deliveryStatus === 'preparing') {
            if (deliveryStatus === 'preparing') {
                deliveryStatus = 'Preparing';
            } else {
                deliveryStatus = 'Out for Delivery';
            }
        }
    
    // Update order card
    const orderItem = orderCard.querySelector('.order-item');
    if (orderItem) {
        const statusIcon = deliveryStatus === 'Delivered' ? 
            '<i class="fas fa-check-circle" style="color: var(--matarix-success); font-size: 1.5rem;"></i>' :
            '<i class="fas fa-truck" style="color: var(--matarix-red-light); font-size: 1.5rem;"></i>';
        
        // Format availability information
        let estimatedDeliveryText = 'TBD';
        if (deliveryStatus === 'Delivered' && delivery.Updated_At) {
            estimatedDeliveryText = `Delivered: ${formatDateTime(delivery.Updated_At)}`;
        } else if (order.availability_slots && order.availability_slots.length > 0) {
            const preferredSlot = order.availability_slots.find(s => s.is_preferred) || order.availability_slots[0];
            if (preferredSlot) {
                const date = new Date(preferredSlot.availability_date);
                const formattedDate = date.toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                });
                estimatedDeliveryText = `Estimated delivery: ${formattedDate}`;
                if (order.availability_slots.length > 1) {
                    estimatedDeliveryText += ` (${order.availability_slots.length} options)`;
                }
            }
        } else if (order.availability_date) {
            // Fallback to old format (date only - time no longer used)
            estimatedDeliveryText = `Estimated delivery: ${formatDate(order.availability_date)}`;
        }
        
        const deliveredText = estimatedDeliveryText;
        
        // Format delivery ID if it exists (check for both null/undefined and 0)
        const deliveryId = delivery && delivery.Delivery_ID !== undefined && delivery.Delivery_ID !== null && delivery.Delivery_ID !== 0 
            ? delivery.Delivery_ID 
            : null;
        const deliveryIdText = deliveryId ? `Delivery # ${deliveryId.toString().padStart(4, '0')}` : '';
        
        // Debug logging
        console.log('[Display Delivery Tracking] Delivery ID check:', {
            delivery: delivery,
            deliveryId: deliveryId,
            deliveryIdText: deliveryIdText,
            hasDeliveryId: !!deliveryId
        });
        
        // Format driver information - check for multiple drivers first
        let driverInfo = '';
        if (delivery.drivers && delivery.drivers.length > 0) {
            // Multiple drivers from junction table
            const driverNames = delivery.drivers.map(d => {
                const name = `${d.Driver_First_Name || ''} ${d.Driver_Middle_Name || ''} ${d.Driver_Last_Name || ''}`.trim();
                return name;
            }).join(', ');
            driverInfo = `<div class="item-description" style="font-size: 0.85rem; color: #666; margin-top: 0.25rem;"><i class="fas fa-user" style="margin-right: 4px;"></i>Driver${delivery.drivers.length > 1 ? 's' : ''}: ${driverNames}</div>`;
        } else if (delivery.Driver_ID && delivery.Driver_First_Name) {
            // Single driver from main delivery table
            const driverName = `${delivery.Driver_First_Name || ''} ${delivery.Driver_Middle_Name || ''} ${delivery.Driver_Last_Name || ''}`.trim();
            const driverPhone = delivery.Driver_Phone_Number || '';
            // Format phone number (add leading 0 if 10 digits)
            let formattedPhone = driverPhone;
            if (driverPhone && driverPhone.length === 10) {
                formattedPhone = '0' + driverPhone;
            }
            driverInfo = `<div class="item-description" style="font-size: 0.85rem; color: #666; margin-top: 0.25rem;"><i class="fas fa-user" style="margin-right: 4px;"></i>Driver: ${driverName}${formattedPhone ? ` • ${formattedPhone}` : ''}</div>`;
        }
        
        orderItem.innerHTML = `
            <div class="item-image">📦</div>
            <div class="item-details">
                <div class="item-name">Order # ${orderNumber}</div>
                ${deliveryIdText ? `<div class="item-description" style="font-size: 0.85rem; color: #666; margin-top: 0.25rem;">${deliveryIdText}</div>` : ''}
                <div class="item-description">${itemCount} items • ${itemNames}</div>
                <div class="item-description">${deliveredText}</div>
                ${driverInfo}
                <div class="item-price">${totalAmount}</div>
            </div>
            <div class="order-actions">
                ${statusIcon}
                <i class="fas fa-chevron-right expand-icon"></i>
            </div>
        `;
    }
    
    // Update expandable content
    const expandableContent = document.getElementById('expandableContent');
    if (expandableContent && order.items) {
        let itemsHTML = '';
        order.items.forEach(item => {
            // Build dimensions string
            let dimensions = '';
            if (item.length && item.Width && item.Unit) {
                dimensions = `${item.length}${item.Unit} x ${item.Width}${item.Unit}`;
            } else if (item.length && item.Width) {
                dimensions = `${item.length} x ${item.Width}`;
            }
            
            // Build specs string with dimensions and variation
            let specsParts = [];
            if (dimensions) {
                specsParts.push(dimensions);
            }
            if (item.variations && item.variations.trim() !== '') {
                specsParts.push(`Variation: ${item.variations}`);
            }
            specsParts.push(`Quantity: ${item.Quantity}`);
            
            const specsText = specsParts.join(' • ');
            
            itemsHTML += `
                <div class="item-row">
                    <div class="item-image">📦</div>
                    <div class="item-details">
                        <div class="item-name">${item.Product_Name}</div>
                        <div class="item-specs">${specsText}</div>
                    </div>
                </div>
            `;
        });
        
        // Build tracking timeline based on delivery status
        let trackingSteps = '';
        if (deliveryStatus === 'Delivered') {
            trackingSteps = `
                <div class="tracking-step">
                    <i class="fas fa-check-circle"></i>
                    <span>Picked up from warehouse</span>
                    <small>${delivery.Created_At ? formatDateTime(delivery.Created_At) : 'N/A'}</small>
                </div>
                <div class="tracking-step">
                    <i class="fas fa-check-circle"></i>
                    <span>In transit to delivery address</span>
                    <small>${delivery.Updated_At ? formatDateTime(delivery.Updated_At) : 'N/A'}</small>
                </div>
                <div class="tracking-step">
                    <i class="fas fa-check-circle"></i>
                    <span>Out for delivery</span>
                    <small>${delivery.Updated_At ? formatDateTime(delivery.Updated_At) : 'N/A'}</small>
                </div>
                <div class="tracking-step">
                    <i class="fas fa-check-circle"></i>
                    <span>Delivered</span>
                    <small>${delivery.Updated_At ? formatDateTime(delivery.Updated_At) : 'N/A'}</small>
                </div>
            `;
        } else if (deliveryStatus === 'Out for Delivery') {
            trackingSteps = `
                <div class="tracking-step">
                    <i class="fas fa-check-circle"></i>
                    <span>Picked up from warehouse</span>
                    <small>${delivery.Created_At ? formatDateTime(delivery.Created_At) : 'N/A'}</small>
                </div>
                <div class="tracking-step">
                    <i class="fas fa-check-circle"></i>
                    <span>In transit to delivery address</span>
                    <small>${delivery.Updated_At ? formatDateTime(delivery.Updated_At) : 'N/A'}</small>
                </div>
                <div class="tracking-step">
                    <i class="fas fa-clock"></i>
                    <span>Out for delivery</span>
                    <small>In progress...</small>
                </div>
                <div class="tracking-step">
                    <i class="fas fa-clock"></i>
                    <span>Delivered</span>
                    <small>Pending</small>
                </div>
            `;
        } else if (deliveryStatus === 'Preparing') {
            trackingSteps = `
                <div class="tracking-step">
                    <i class="fas fa-check-circle"></i>
                    <span>Preparing order</span>
                    <small>${delivery.Updated_At ? formatDateTime(delivery.Updated_At) : 'N/A'}</small>
                </div>
                <div class="tracking-step">
                    <i class="fas fa-clock"></i>
                    <span>Out for delivery</span>
                    <small>Pending</small>
                </div>
                <div class="tracking-step">
                    <i class="fas fa-clock"></i>
                    <span>Delivered</span>
                    <small>Pending</small>
                </div>
            `;
        } else if (deliveryStatus === 'Cancelled') {
            trackingSteps = `
                <div class="tracking-step cancelled">
                    <i class="fas fa-times-circle"></i>
                    <span>Order Cancelled</span>
                    <small>This order has been cancelled. Please select a new delivery date to reschedule.</small>
                </div>
            `;
        } else {
            trackingSteps = `
                <div class="tracking-step">
                    <i class="fas fa-clock"></i>
                    <span>Picked up from warehouse</span>
                    <small>Pending</small>
                </div>
                <div class="tracking-step">
                    <i class="fas fa-clock"></i>
                    <span>In transit to delivery address</span>
                    <small>Pending</small>
                </div>
                <div class="tracking-step">
                    <i class="fas fa-clock"></i>
                    <span>Out for delivery</span>
                    <small>Pending</small>
                </div>
                <div class="tracking-step">
                    <i class="fas fa-clock"></i>
                    <span>Delivered</span>
                    <small>Pending</small>
                </div>
            `;
        }
        
        // Build content based on status
        let statusContent = '';
        if (deliveryStatus === 'Cancelled') {
            statusContent = `
                <div class="unified-tracking">
                    <h3>Delivery Status</h3>
                    <div class="tracking-status cancelled">
                        <i class="fas fa-times-circle"></i>
                        <span>Cancelled</span>
                    </div>
                    <div class="tracking-details">
                        ${trackingSteps}
                    </div>
                </div>
                <div class="reschedule-section" style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
                    <h4 style="margin-bottom: 15px;">
                        <i class="fas fa-calendar-check mr-2"></i>Reschedule Delivery
                    </h4>
                    <p style="color: #666; margin-bottom: 20px;">Please select a new delivery date to reschedule this order.</p>
                    <div id="rescheduleCalendarContainer" style="margin-bottom: 20px;">
                        <div id="rescheduleCalendar"></div>
                    </div>
                    <div id="selectedRescheduleDateDisplay" class="selected-date-display" style="display: none; margin-bottom: 15px;">
                        <div class="alert alert-info mb-0">
                            <i class="fas fa-calendar-check mr-2"></i>
                            <strong>Selected Date:</strong> <span id="selectedRescheduleDateText"></span>
                        </div>
                    </div>
                    <button class="btn btn-primary btn-block" id="rescheduleOrderBtn" style="display: none;">
                        <i class="fas fa-calendar-check mr-2"></i>Reschedule Order
                    </button>
                </div>
            `;
        } else {
            // Build driver details section - handle multiple drivers
            let driverDetailsHTML = '';
            if (delivery.drivers && delivery.drivers.length > 0) {
                // Multiple drivers from junction table
                const driversList = delivery.drivers.map(driver => {
                    const driverName = `${driver.Driver_First_Name || ''} ${driver.Driver_Middle_Name || ''} ${driver.Driver_Last_Name || ''}`.trim();
                    const driverPhone = driver.Driver_Phone_Number || '';
                    const driverEmail = driver.Driver_Email || '';
                    
                    // Format phone number (add leading 0 if 10 digits)
                    let formattedPhone = driverPhone;
                    if (driverPhone && driverPhone.length === 10) {
                        formattedPhone = '0' + driverPhone;
                    }
                    
                    return `
                        <div style="padding: 12px; background: white; border-radius: 6px; margin-bottom: 10px; border-left: 3px solid var(--matarix-red-light);">
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                                <i class="fas fa-user-circle" style="color: #666; width: 16px;"></i>
                                <span style="font-weight: 500; color: #2c3e50;">${driverName}</span>
                            </div>
                            ${formattedPhone ? `
                            <div style="display: flex; align-items: center; gap: 8px; margin-left: 24px;">
                                <i class="fas fa-phone" style="color: #666; width: 16px;"></i>
                                <a href="tel:${formattedPhone}" style="color: var(--matarix-red-light); text-decoration: none;">${formattedPhone}</a>
                            </div>
                            ` : ''}
                            ${driverEmail ? `
                            <div style="display: flex; align-items: center; gap: 8px; margin-left: 24px;">
                                <i class="fas fa-envelope" style="color: #666; width: 16px;"></i>
                                <a href="mailto:${driverEmail}" style="color: var(--matarix-red-light); text-decoration: none;">${driverEmail}</a>
                            </div>
                            ` : ''}
                        </div>
                    `;
                }).join('');
                
                driverDetailsHTML = `
                    <div class="driver-details-section" style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                        <h4 style="margin-bottom: 12px; font-size: 1rem; color: #2c3e50;">
                            <i class="fas fa-users" style="margin-right: 8px; color: var(--matarix-red-light);"></i>Delivery Driver${delivery.drivers.length > 1 ? 's' : ''}
                        </h4>
                        <div style="display: flex; flex-direction: column; gap: 0;">
                            ${driversList}
                        </div>
                    </div>
                `;
            } else if (delivery.Driver_ID && delivery.Driver_First_Name) {
                // Single driver from main delivery table
                const driverName = `${delivery.Driver_First_Name || ''} ${delivery.Driver_Middle_Name || ''} ${delivery.Driver_Last_Name || ''}`.trim();
                const driverPhone = delivery.Driver_Phone_Number || '';
                const driverEmail = delivery.Driver_Email || '';
                
                // Format phone number (add leading 0 if 10 digits)
                let formattedPhone = driverPhone;
                if (driverPhone && driverPhone.length === 10) {
                    formattedPhone = '0' + driverPhone;
                }
                
                driverDetailsHTML = `
                    <div class="driver-details-section" style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                        <h4 style="margin-bottom: 12px; font-size: 1rem; color: #2c3e50;">
                            <i class="fas fa-user" style="margin-right: 8px; color: var(--matarix-red-light);"></i>Delivery Driver
                        </h4>
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <i class="fas fa-user-circle" style="color: #666; width: 16px;"></i>
                                <span style="font-weight: 500; color: #2c3e50;">${driverName}</span>
                            </div>
                            ${formattedPhone ? `
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <i class="fas fa-phone" style="color: #666; width: 16px;"></i>
                                <a href="tel:${formattedPhone}" style="color: var(--matarix-red-light); text-decoration: none;">${formattedPhone}</a>
                            </div>
                            ` : ''}
                            ${driverEmail ? `
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <i class="fas fa-envelope" style="color: #666; width: 16px;"></i>
                                <a href="mailto:${driverEmail}" style="color: var(--matarix-red-light); text-decoration: none;">${driverEmail}</a>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                `;
            }
            
            statusContent = `
                <div class="unified-tracking">
                    <h3>Delivery Status</h3>
                    <div class="tracking-status">
                        <i class="fas fa-${deliveryStatus === 'Delivered' ? 'check' : 'clock'}-circle"></i>
                        <span>${deliveryStatus === 'Delivered' ? 'Delivered' : deliveryStatus === 'Out for Delivery' ? 'Out for Delivery' : deliveryStatus === 'Preparing' ? 'Preparing' : 'Pending'}</span>
                    </div>
                    <div class="tracking-details">
                        ${trackingSteps}
                    </div>
                </div>
                ${driverDetailsHTML}
                ${deliveryStatus === 'Delivered' ? displayProofOfDelivery(delivery, orderId) : ''}
                ${deliveryStatus === 'Delivered' ? `
                    <div class="action-buttons-container">
                        <button class="btn btn-action btn-review" onclick="reviewOrder()">
                            <i class="fas fa-star"></i>
                            Review Order
                        </button>
                        <button class="btn btn-action btn-transaction" onclick="viewTransaction()">
                            <i class="fas fa-receipt"></i>
                            View Transaction
                        </button>
                        <button class="btn btn-action btn-home" onclick="goHome()">
                            <i class="fas fa-home"></i>
                            Home
                        </button>
                    </div>
                ` : ''}
            `;
        }
        
        expandableContent.innerHTML = `
            <div class="items-summary">
                <h3>Items in this Order</h3>
                ${itemsHTML}
            </div>
            ${statusContent}
        `;
        
        // Initialize calendar for cancelled orders
        if (deliveryStatus === 'Cancelled') {
            console.log('[Delivery Tracking] Cancelled order detected, initializing calendar...');
            
            // Fetch unavailable dates and advance notice settings (same as checkout.html)
            const initCalendarWithUnavailableDates = async () => {
                let unavailableDates = [];
                let minAdvanceDays = 3; // Default minimum advance notice
                let maxAdvanceDays = 30; // Default maximum advance notice
                
                // Get the previous/current selected date from the order to lock it
                let previousSelectedDate = null;
                if (order.availability_slots && order.availability_slots.length > 0) {
                    // Get preferred slot or first slot
                    const preferredSlot = order.availability_slots.find(s => s.is_preferred) || order.availability_slots[0];
                    if (preferredSlot && preferredSlot.availability_date) {
                        previousSelectedDate = preferredSlot.availability_date;
                        console.log('[Delivery Tracking] Found previous selected date from availability slots:', previousSelectedDate);
                    }
                } else if (order.availability_date) {
                    // Fallback to order.availability_date
                    previousSelectedDate = order.availability_date;
                    console.log('[Delivery Tracking] Found previous selected date from order:', previousSelectedDate);
                }
                
                // Add previous selected date to unavailable dates to lock it
                if (previousSelectedDate) {
                    // Format date as YYYY-MM-DD if needed
                    let formattedDate = previousSelectedDate;
                    if (previousSelectedDate.includes('T')) {
                        formattedDate = previousSelectedDate.split('T')[0];
                    } else if (previousSelectedDate.includes(' ')) {
                        formattedDate = previousSelectedDate.split(' ')[0];
                    }
                    unavailableDates.push({ date: formattedDate, reason: 'Previously selected date' });
                    console.log('[Delivery Tracking] Locked previous selected date:', formattedDate);
                }
                
                try {
                    // Get minimum advance notice from settings
                    const settingsResponse = await fetch('../api/get_order_settings.php', {
                        credentials: 'include'
                    });
                    const settingsData = await settingsResponse.json();
                    if (settingsData.success && settingsData.settings) {
                        const rawSettings = settingsData.raw_settings || {};
                        minAdvanceDays = parseInt(rawSettings.min_advance_notice_days || settingsData.settings.min_advance_notice_days || 3);
                        maxAdvanceDays = parseInt(rawSettings.max_advance_notice_days || settingsData.settings.max_advance_notice_days || 30);
                    }
                } catch (error) {
                    console.error('[Delivery Tracking] Error fetching advance notice settings:', error);
                }
                
                try {
                    // Load unavailable dates from API (same as checkout.html)
                    const response = await fetch('../api/get_unavailable_dates.php', {
                        credentials: 'include'
                    });
                    const data = await response.json();
                    if (data.success && data.unavailable_dates) {
                        // Add API unavailable dates (support string or { date, reason }), avoiding duplicates
                        const apiUnavailableDates = data.unavailable_dates.map(item =>
                            typeof item === 'string' ? { date: item } : { date: item.date, reason: item.reason || 'This date is unavailable' }
                        );
                        apiUnavailableDates.forEach(apiDate => {
                            // Only add if not already in unavailableDates (avoid duplicate with previous selected date)
                            if (!unavailableDates.some(ud => ud.date === apiDate.date)) {
                                unavailableDates.push(apiDate);
                            }
                        });
                        console.log('[Delivery Tracking] Loaded unavailable dates from API:', apiUnavailableDates.length);
                    }
                } catch (error) {
                    console.error('[Delivery Tracking] Error loading unavailable dates:', error);
                }
                
                // Wait for calendar script to load and DOM to be ready
                const initCalendar = (attempt = 0) => {
                    const maxAttempts = 15;
                    const calendarContainer = document.getElementById('rescheduleCalendar');
                    // Check for CalendarScheduler class (might be on window or global scope)
                    const CalendarSchedulerClass = window.CalendarScheduler || (typeof CalendarScheduler !== 'undefined' ? CalendarScheduler : null);
                    const hasCalendarScheduler = CalendarSchedulerClass !== null;
                    
                    console.log(`[Delivery Tracking] Calendar init attempt ${attempt + 1}:`, {
                        containerExists: !!calendarContainer,
                        calendarSchedulerExists: hasCalendarScheduler,
                        containerId: calendarContainer ? calendarContainer.id : 'NOT FOUND',
                        unavailableDatesCount: unavailableDates.length
                    });
                    
                    if (calendarContainer && hasCalendarScheduler) {
                        try {
                            console.log('[Delivery Tracking] Creating CalendarScheduler instance with unavailable dates...');
                            const calendar = new CalendarSchedulerClass('rescheduleCalendar', {
                                minAdvanceDays: minAdvanceDays,
                                maxAdvanceDays: maxAdvanceDays,
                                deliveryHours: { start: 7, end: 18 },
                                unavailableSlots: unavailableDates, // Pass unavailable dates like checkout.html
                                onDateSelect: function(dateStr) {
                                    console.log('[Delivery Tracking] Date selected:', dateStr);
                                    const selectedDateDisplay = document.getElementById('selectedRescheduleDateDisplay');
                                    const selectedDateText = document.getElementById('selectedRescheduleDateText');
                                    const rescheduleBtn = document.getElementById('rescheduleOrderBtn');
                                    
                                    if (selectedDateDisplay && selectedDateText) {
                                        const date = new Date(dateStr);
                                        const formattedDate = date.toLocaleDateString('en-US', {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric'
                                        });
                                        selectedDateText.textContent = formattedDate;
                                        selectedDateDisplay.style.display = 'block';
                                    }
                                    
                                if (rescheduleBtn) {
                                    rescheduleBtn.style.display = 'block';
                                    rescheduleBtn.onclick = async function() {
                                        if (!dateStr) {
                                            alert('Please select a date first.');
                                            return;
                                        }
                                        
                                        // Disable button during request
                                        rescheduleBtn.disabled = true;
                                        rescheduleBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Rescheduling...';
                                        
                                        try {
                                            const response = await fetch('../api/reschedule_order.php', {
                                                method: 'POST',
                                                headers: {
                                                    'Content-Type': 'application/json'
                                                },
                                                credentials: 'include',
                                                body: JSON.stringify({
                                                    order_id: window.currentOrderId,
                                                    availability_date: dateStr
                                                })
                                            });
                                            
                                            const data = await response.json();
                                            
                                            if (data.success) {
                                                // Show success message
                                                if (window.showToast) {
                                                    window.showToast('Order rescheduled successfully! The order is now pending approval.', 'success', 5000);
                                                } else {
                                                    alert('Order rescheduled successfully! The order is now pending approval.');
                                                }
                                                
                                                // Reload the delivery tracking to show updated status
                                                // Reload the current order to show updated status
                                                if (window.currentOrderId) {
                                                    setTimeout(async () => {
                                                        try {
                                                            // Reload order and delivery data
                                                            const orderResponse = await fetch(`../api/get_customer_orders.php?order_id=${window.currentOrderId}`, {
                                                                method: 'GET',
                                                                credentials: 'include'
                                                            });
                                                            const orderData = await orderResponse.json();
                                                            
                                                            if (orderData.success && orderData.order) {
                                                                // Reload delivery status
                                                                const deliveryResponse = await fetch(`../api/get_delivery_status.php?order_id=${window.currentOrderId}`, {
                                                                    method: 'GET',
                                                                    credentials: 'include'
                                                                });
                                                                const deliveryData = await deliveryResponse.json();
                                                                
                                                                const delivery = deliveryData.success && deliveryData.delivery ? deliveryData.delivery : {
                                                                    Delivery_Status: 'Pending',
                                                                    Order_ID: window.currentOrderId
                                                                };
                                                                
                                                                // Update stored data
                                                                window.currentOrderData = orderData.order;
                                                                window.currentDeliveryData = delivery;
                                                                
                                                                // Redisplay with updated data
                                                                displayDeliveryTracking(orderData.order, delivery);
                                                                
                                                                // Regenerate progress tracker
                                                                if (typeof window.MatarixNavigation !== 'undefined' && typeof window.MatarixNavigation.regenerateTracker === 'function') {
                                                                    window.MatarixNavigation.regenerateTracker();
                                                                }
                                                            }
                                                        } catch (error) {
                                                            console.error('[Delivery Tracking] Error reloading after reschedule:', error);
                                                            // Fallback: reload the page
                                                            window.location.reload();
                                                        }
                                                    }, 1000);
                                                } else {
                                                    // Fallback: reload the page
                                                    setTimeout(() => {
                                                        window.location.reload();
                                                    }, 1000);
                                                }
                                            } else {
                                                // Show error message
                                                if (window.showToast) {
                                                    window.showToast('Failed to reschedule order: ' + (data.message || 'Unknown error'), 'error', 7000);
                                                } else {
                                                    alert('Failed to reschedule order: ' + (data.message || 'Unknown error'));
                                                }
                                                
                                                // Re-enable button
                                                rescheduleBtn.disabled = false;
                                                rescheduleBtn.innerHTML = '<i class="fas fa-calendar-check mr-2"></i>Reschedule Order';
                                            }
                                        } catch (error) {
                                            console.error('[Delivery Tracking] Reschedule error:', error);
                                            if (window.showToast) {
                                                window.showToast('Connection error. Please check your internet connection and try again.', 'error', 7000);
                                            } else {
                                                alert('Connection error. Please check your internet connection and try again.');
                                            }
                                            
                                            // Re-enable button
                                            rescheduleBtn.disabled = false;
                                            rescheduleBtn.innerHTML = '<i class="fas fa-calendar-check mr-2"></i>Reschedule Order';
                                        }
                                    };
                                }
                                    
                                    // Store selected date for reschedule
                                    window.selectedRescheduleDate = dateStr;
                                }
                            });
                            console.log('[Delivery Tracking] ✅ Calendar initialized successfully for cancelled order with unavailable dates');
                        } catch (error) {
                            console.error('[Delivery Tracking] ❌ Error initializing calendar:', error);
                            console.error('[Delivery Tracking] Error stack:', error.stack);
                        }
                    } else if (attempt < maxAttempts) {
                        // Retry after a short delay
                        setTimeout(() => initCalendar(attempt + 1), 200);
                    } else {
                        console.error('[Delivery Tracking] ❌ Failed to initialize calendar after', maxAttempts, 'attempts');
                        if (!calendarContainer) {
                            console.error('[Delivery Tracking] Calendar container #rescheduleCalendar not found in DOM');
                            // Try to find it again
                            const retryContainer = document.getElementById('rescheduleCalendar');
                            console.error('[Delivery Tracking] Retry check - container exists:', !!retryContainer);
                        }
                        if (!hasCalendarScheduler) {
                            console.error('[Delivery Tracking] CalendarScheduler class not available.');
                            console.error('[Delivery Tracking] window.CalendarScheduler:', window.CalendarScheduler);
                            console.error('[Delivery Tracking] typeof CalendarScheduler:', typeof CalendarScheduler);
                            console.error('[Delivery Tracking] Make sure calendar-scheduler.js is loaded before load_delivery_tracking.js');
                        }
                    }
                };
                
                // Start initialization after DOM is updated
                // Use requestAnimationFrame to ensure DOM is ready
                requestAnimationFrame(() => {
                    setTimeout(() => initCalendar(), 100);
                });
            };
            
            // Start fetching unavailable dates and initializing calendar
            initCalendarWithUnavailableDates();
        }
    }
}

// Refresh delivery status from database (for real-time updates)
async function refreshDeliveryStatus(orderId) {
    try {
        console.log(`[Delivery Tracking] Polling for order ${orderId}...`);
        const deliveryResponse = await fetch(`../api/get_delivery_status.php?order_id=${orderId}`, {
            method: 'GET',
            credentials: 'include',
            cache: 'no-cache' // Prevent caching
        });
        
        if (!deliveryResponse.ok) {
            console.warn('[Delivery Tracking] Failed to refresh delivery status:', deliveryResponse.status);
            return;
        }
        
        const deliveryData = await deliveryResponse.json();
        console.log(`[Delivery Tracking] Poll response:`, deliveryData);
        
        if (deliveryData.success && deliveryData.delivery) {
            // Normalize statuses for comparison (handle old values)
            const normalizeStatus = (status) => {
                if (!status) return 'Pending';
                const s = status.trim();
                const sLower = s.toLowerCase();
                if (sLower === 'cancelled' || sLower === 'canceled') return 'Cancelled';
                if (s === 'On the Way' || s === 'out for delivery') return 'Out for Delivery';
                if (s === 'preparing') return 'Preparing';
                return s;
            };
            
            const oldStatus = normalizeStatus(window.currentDeliveryData?.Delivery_Status || 'Pending');
            const newStatus = normalizeStatus(deliveryData.delivery.Delivery_Status || 'Pending');
            const oldUpdatedAt = window.currentDeliveryData?.Updated_At || null;
            const newUpdatedAt = deliveryData.delivery.Updated_At || null;
            const oldDeliveryId = window.currentDeliveryData?.Delivery_ID || null;
            const newDeliveryId = deliveryData.delivery.Delivery_ID || null;
            
            console.log(`[Delivery Tracking] Status check - Old: "${oldStatus}", New: "${newStatus}"`);
            console.log(`[Delivery Tracking] Timestamp check - Old: "${oldUpdatedAt}", New: "${newUpdatedAt}"`);
            console.log(`[Delivery Tracking] Delivery ID check - Old: "${oldDeliveryId}", New: "${newDeliveryId}"`);
            
            // Check if status has changed OR if Updated_At timestamp has changed OR if delivery record was just created
            const statusChanged = oldStatus !== newStatus;
            const timestampChanged = oldUpdatedAt !== newUpdatedAt;
            const deliveryIdChanged = oldDeliveryId !== newDeliveryId;
            
            // Always update if delivery record was just created (ID changed from null to a value)
            if (statusChanged || timestampChanged || deliveryIdChanged) {
                if (statusChanged) {
                    console.log(`[Delivery Tracking] ✅ Status changed: ${oldStatus} -> ${newStatus}`);
                } else if (timestampChanged) {
                    console.log(`[Delivery Tracking] ✅ Delivery updated (timestamp changed)`);
                } else if (deliveryIdChanged) {
                    console.log(`[Delivery Tracking] ✅ Delivery record created (ID: ${newDeliveryId})`);
                }
                
                // Update stored delivery data (normalize status first)
                const normalizedDelivery = {
                    ...deliveryData.delivery,
                    Delivery_Status: normalizeStatus(deliveryData.delivery.Delivery_Status || 'Pending')
                };
                window.currentDeliveryData = normalizedDelivery;
                console.log('[Delivery Tracking] Updated window.currentDeliveryData with normalized status:', normalizedDelivery);
                
                // Reload order data to get latest information
                const orderResponse = await fetch(`../api/get_customer_orders.php?order_id=${orderId}`, {
                    method: 'GET',
                    credentials: 'include',
                    cache: 'no-cache'
                });
                
                if (orderResponse.ok) {
                    const orderData = await orderResponse.json();
                    if (orderData.success && orderData.order) {
                        window.currentOrderData = orderData.order;
                        // Update the display with new data
                        console.log(`[Delivery Tracking] 🔄 Updating display with new status: ${newStatus}`);
                        displayDeliveryTracking(orderData.order, normalizedDelivery);
                    }
                } else {
                    // Even if order fetch fails, update delivery status display
                    if (window.currentOrderData) {
                        console.log(`[Delivery Tracking] 🔄 Updating display (order fetch failed, using cached order data)`);
                        displayDeliveryTracking(window.currentOrderData, normalizedDelivery);
                    }
                }
                
                // Regenerate progress tracker after status change to ensure it's correct
                setTimeout(() => {
                    try {
                        console.log('[Delivery Tracking] 🔄 Regenerating progress tracker after status change...');
                        console.log('[Delivery Tracking] Current delivery data:', window.currentDeliveryData);
                        console.log('[Delivery Tracking] Delivery status:', normalizedDelivery.Delivery_Status);
                        console.log('[Delivery Tracking] MatarixNavigation available:', !!window.MatarixNavigation);
                        
                        if (window.MatarixNavigation) {
                            // Prefer regenerate over update for reliability
                            if (typeof window.MatarixNavigation.regenerateTracker === 'function') {
                                console.log('[Delivery Tracking] 🔄 Calling MatarixNavigation.regenerateTracker()...');
                                window.MatarixNavigation.regenerateTracker();
                                console.log('[Delivery Tracking] ✅ Progress tracker regenerated');
                                
                                // Verify regeneration worked
                                setTimeout(() => {
                                    const tracker = document.querySelector('.progress-tracker-container');
                                    if (tracker) {
                                        const currentStep = window.MatarixNavigation.getCurrentStep();
                                        const activeStep = tracker.querySelector(`.progress-step[data-step="${currentStep}"]`);
                                        if (activeStep && activeStep.classList.contains('active')) {
                                            console.log('[Delivery Tracking] ✅ Verification: Active step has active class');
                                        } else {
                                            console.warn('[Delivery Tracking] ⚠️ Regeneration verification failed, trying update...');
                                            if (typeof window.MatarixNavigation.updateProgressTracker === 'function') {
                                                window.MatarixNavigation.updateProgressTracker();
                                            }
                                        }
                                    }
                                }, 200);
                            } else if (typeof window.MatarixNavigation.updateProgressTracker === 'function') {
                                console.log('[Delivery Tracking] 🔄 Regenerate not available, using update instead...');
                                window.MatarixNavigation.updateProgressTracker();
                            } else {
                                console.warn('[Delivery Tracking] ⚠️ Neither regenerate nor update available');
                            }
                        } else {
                            console.warn('[Delivery Tracking] ⚠️ MatarixNavigation not available');
                        }
                    } catch (error) {
                        console.error('[Delivery Tracking] ❌ Error regenerating progress tracker:', error);
                        console.error('[Delivery Tracking] Error stack:', error.stack);
                    }
                }, 500);
            } else {
                // Update stored data even if nothing visibly changed (in case other fields updated)
                // Normalize status before storing
                const normalizedDelivery = {
                    ...deliveryData.delivery,
                    Delivery_Status: normalizeStatus(deliveryData.delivery.Delivery_Status || 'Pending')
                };
                window.currentDeliveryData = normalizedDelivery;
                console.log(`[Delivery Tracking] No changes detected, status still: ${newStatus}`);
                
                // Still update progress tracker in case it's out of sync
                setTimeout(() => {
                    if (window.MatarixNavigation && typeof window.MatarixNavigation.updateProgressTracker === 'function') {
                        console.log('[Delivery Tracking] Updating progress tracker (no status change detected but ensuring sync)...');
                        window.MatarixNavigation.updateProgressTracker();
                    }
                }, 500);
            }
        } else {
            console.warn('[Delivery Tracking] No delivery data received:', deliveryData);
        }
    } catch (error) {
        console.error('[Delivery Tracking] ❌ Error refreshing delivery status:', error);
    }
}

// Clean up interval when page is unloaded
window.addEventListener('beforeunload', () => {
    if (window.deliveryTrackingRefreshInterval) {
        clearInterval(window.deliveryTrackingRefreshInterval);
        console.log('[Delivery Tracking] Polling stopped (page unloading)');
    }
});

// Expose refresh function globally for debugging
window.refreshDeliveryStatus = refreshDeliveryStatus;

// Export functions for global access
window.loadAllOrders = loadAllOrders;
window.selectOrder = selectOrder;
window.showOrdersList = showOrdersList;
window.loadOrderTracking = loadOrderTracking;
window.applyFilters = applyFilters;
window.clearFilters = clearFilters;

// Export toggleOrderDetails if it exists in navigation
if (typeof window.MatarixNavigation !== 'undefined' && window.MatarixNavigation.toggleOrderDetails) {
    window.toggleOrderDetails = window.MatarixNavigation.toggleOrderDetails;
}

// Back button - go to previous page
function initBackButton() {
    const backBtn = document.getElementById('deliveryTrackingBackBtn');
    if (backBtn) {
        backBtn.addEventListener('click', function(e) {
            e.preventDefault();
            const selectedSection = document.getElementById('selectedOrderSection');
            if (selectedSection && selectedSection.style.display !== 'none') {
                showOrdersList(e);
            } else if (window.history.length > 1) {
                window.history.back();
            } else {
                window.location.href = 'OrderSummary.html';
            }
        });
    }
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        loadDeliveryTracking();
        setupFilterClickHandlers();
        initBackButton();
    });
} else {
    loadDeliveryTracking();
    setupFilterClickHandlers();
    initBackButton();
}

// Setup click handlers for all filter steps (Pending, Preparing, To Receive, Completed, To Rate, History)
function setupFilterClickHandlers() {
    // Use event delegation to handle clicks on dynamically generated tracker steps
    document.addEventListener('click', function(event) {
        const filterStep = event.target.closest('.progress-step.clickable-filter');
        if (filterStep) {
            const filterType = filterStep.getAttribute('data-filter');
            event.preventDefault();
            event.stopPropagation();
            
            // Remove active filter state from all steps
            document.querySelectorAll('.progress-step.filter-active').forEach(step => {
                step.classList.remove('filter-active');
            });
            
            // Add active filter state to clicked step
            filterStep.classList.add('filter-active');
            
            // Store current active filter globally
            window.currentActiveFilter = filterType;
            
            switch(filterType) {
                case 'to-rate':
                    showToRateOrders();
                    break;
                case 'history':
                    showHistoryOrders();
                    break;
            }
        }
    });
}

// Remove active filter state (called when returning to normal view)
function clearActiveFilter() {
    document.querySelectorAll('.progress-step.filter-active').forEach(step => {
        step.classList.remove('filter-active');
    });
}

// Show pending orders (Pending status only)
async function showPendingOrders() {
    console.log('[Delivery Tracking] Showing "Pending" orders...');
    
    // Set active filter
    window.currentActiveFilter = 'pending';
    updatePageTitle('pending');
    
    // Ensure we have orders loaded
    if (!window.allOrdersData || window.allOrdersData.length === 0) {
        await loadAllOrders();
    }
    
    // Filter orders: Pending status only
    const pendingOrders = window.allOrdersData.filter(order => {
        const deliveryStatus = normalizeStatus(order.deliveryStatus || 'Pending');
        return deliveryStatus === 'Pending';
    });
    
    // Sort by date (newest first)
    pendingOrders.sort((a, b) => {
        const dateA = new Date(a.order_date || 0);
        const dateB = new Date(b.order_date || 0);
        return dateB - dateA;
    });
    
    // Update section header
    const sectionTitle = document.querySelector('.section-title');
    const sectionSubtitle = document.querySelector('.section-subtitle');
    if (sectionTitle) {
        sectionTitle.textContent = 'Pending Orders';
    }
    if (sectionSubtitle) {
        sectionSubtitle.textContent = `${pendingOrders.length} order${pendingOrders.length !== 1 ? 's' : ''} pending or being prepared`;
    }
    
    // Show orders list section, hide selected order section
    const ordersListSection = document.getElementById('ordersListSection');
    const selectedOrderSection = document.getElementById('selectedOrderSection');
    if (ordersListSection) ordersListSection.style.display = 'block';
    if (selectedOrderSection) selectedOrderSection.style.display = 'none';
    
    // Display filtered orders
    if (pendingOrders.length === 0) {
        displayNoPendingOrders();
    } else {
        displayOrdersList(pendingOrders);
        updateResultsInfo(pendingOrders.length, window.allOrdersData.length);
    }
}

// Show preparing orders (Preparing status)
async function showPreparingOrders() {
    console.log('[Delivery Tracking] Showing "Preparing" orders...');
    
    // Set active filter
    window.currentActiveFilter = 'preparing';
    updatePageTitle('preparing');
    
    // Ensure we have orders loaded
    if (!window.allOrdersData || window.allOrdersData.length === 0) {
        await loadAllOrders();
    }
    
    // Filter orders: Preparing status
    const preparingOrders = window.allOrdersData.filter(order => {
        const deliveryStatus = normalizeStatus(order.deliveryStatus || 'Pending');
        return deliveryStatus === 'Preparing';
    });
    
    // Sort by date (newest first)
    preparingOrders.sort((a, b) => {
        const dateA = new Date(a.order_date || 0);
        const dateB = new Date(b.order_date || 0);
        return dateB - dateA;
    });
    
    // Update section header
    const sectionTitle = document.querySelector('.section-title');
    const sectionSubtitle = document.querySelector('.section-subtitle');
    if (sectionTitle) {
        sectionTitle.textContent = 'Preparing Orders';
    }
    if (sectionSubtitle) {
        sectionSubtitle.textContent = `${preparingOrders.length} order${preparingOrders.length !== 1 ? 's' : ''} being prepared`;
    }
    
    // Show orders list section, hide selected order section
    const ordersListSection = document.getElementById('ordersListSection');
    const selectedOrderSection = document.getElementById('selectedOrderSection');
    if (ordersListSection) ordersListSection.style.display = 'block';
    if (selectedOrderSection) selectedOrderSection.style.display = 'none';
    
    // Display filtered orders
    if (preparingOrders.length === 0) {
        displayNoPreparingOrders();
    } else {
        displayOrdersList(preparingOrders);
        updateResultsInfo(preparingOrders.length, window.allOrdersData.length);
    }
}

// Show orders to receive (Out for Delivery status)
async function showToReceiveOrders() {
    console.log('[Delivery Tracking] Showing "To Receive" orders...');
    
    // Set active filter
    window.currentActiveFilter = 'to-receive';
    updatePageTitle('to-receive');
    
    // Ensure we have orders loaded
    if (!window.allOrdersData || window.allOrdersData.length === 0) {
        await loadAllOrders();
    }
    
    // Filter orders: Out for Delivery status
    const toReceiveOrders = window.allOrdersData.filter(order => {
        const deliveryStatus = normalizeStatus(order.deliveryStatus || 'Pending');
        return deliveryStatus === 'Out for Delivery';
    });
    
    // Sort by date (newest first)
    toReceiveOrders.sort((a, b) => {
        const dateA = new Date(a.order_date || 0);
        const dateB = new Date(b.order_date || 0);
        return dateB - dateA;
    });
    
    // Update section header
    const sectionTitle = document.querySelector('.section-title');
    const sectionSubtitle = document.querySelector('.section-subtitle');
    if (sectionTitle) {
        sectionTitle.textContent = 'Orders To Receive';
    }
    if (sectionSubtitle) {
        sectionSubtitle.textContent = `${toReceiveOrders.length} order${toReceiveOrders.length !== 1 ? 's' : ''} out for delivery`;
    }
    
    // Show orders list section, hide selected order section
    const ordersListSection = document.getElementById('ordersListSection');
    const selectedOrderSection = document.getElementById('selectedOrderSection');
    if (ordersListSection) ordersListSection.style.display = 'block';
    if (selectedOrderSection) selectedOrderSection.style.display = 'none';
    
    // Display filtered orders
    if (toReceiveOrders.length === 0) {
        displayNoToReceiveOrders();
    } else {
        displayOrdersList(toReceiveOrders);
        updateResultsInfo(toReceiveOrders.length, window.allOrdersData.length);
    }
}

// Show completed orders (Delivered status)
async function showCompletedOrders() {
    console.log('[Delivery Tracking] Showing "Completed" orders...');
    
    // Set active filter
    window.currentActiveFilter = 'completed';
    updatePageTitle('completed');
    
    // Ensure we have orders loaded
    if (!window.allOrdersData || window.allOrdersData.length === 0) {
        await loadAllOrders();
    }
    
    // Filter orders: Delivered status
    const completedOrders = window.allOrdersData.filter(order => {
        const deliveryStatus = normalizeStatus(order.deliveryStatus || 'Pending');
        return deliveryStatus === 'Delivered';
    });
    
    // Sort by date (newest first)
    completedOrders.sort((a, b) => {
        const dateA = new Date(a.order_date || 0);
        const dateB = new Date(b.order_date || 0);
        return dateB - dateA;
    });
    
    // Update section header
    const sectionTitle = document.querySelector('.section-title');
    const sectionSubtitle = document.querySelector('.section-subtitle');
    if (sectionTitle) {
        sectionTitle.textContent = 'Completed Orders';
    }
    if (sectionSubtitle) {
        sectionSubtitle.textContent = `${completedOrders.length} order${completedOrders.length !== 1 ? 's' : ''} successfully delivered`;
    }
    
    // Show orders list section, hide selected order section
    const ordersListSection = document.getElementById('ordersListSection');
    const selectedOrderSection = document.getElementById('selectedOrderSection');
    if (ordersListSection) ordersListSection.style.display = 'block';
    if (selectedOrderSection) selectedOrderSection.style.display = 'none';
    
    // Display filtered orders
    if (completedOrders.length === 0) {
        displayNoCompletedOrders();
    } else {
        displayOrdersList(completedOrders);
        updateResultsInfo(completedOrders.length, window.allOrdersData.length);
    }
}

// Check if an order has been reviewed
async function hasOrderBeenReviewed(orderId) {
    try {
        const response = await fetch(`../api/get_order_reviews.php?order_id=${orderId}`, {
            method: 'GET',
            credentials: 'include'
        });
        
        if (!response.ok) {
            return false;
        }
        
        const data = await response.json();
        
        // Check if there's overall feedback or product reviews
        if (data.success) {
            const hasOverallFeedback = data.overall_feedback !== null && data.overall_feedback !== undefined;
            const hasProductReviews = data.product_reviews && data.product_reviews.length > 0;
            return hasOverallFeedback || hasProductReviews;
        }
        
        return false;
    } catch (error) {
        console.error(`Error checking review for order ${orderId}:`, error);
        return false;
    }
}

// Show orders that need to be rated (delivered but not reviewed)
async function showToRateOrders() {
    console.log('[Delivery Tracking] Showing "To Rate" orders...');
    
    // Set active filter
    window.currentActiveFilter = 'to-rate';
    updatePageTitle('to-rate');
    
    // Ensure we have orders loaded
    if (!window.allOrdersData || window.allOrdersData.length === 0) {
        await loadAllOrders();
    }
    
    // Filter orders: delivered/completed but not reviewed, exclude cancelled
    const toRateOrders = [];
    
    for (const order of window.allOrdersData) {
        const orderStatus = order.status || 'Pending Approval';
        const effectiveStatus = orderStatus === 'Pending Approval' ? 'Waiting Payment' : orderStatus;
        const deliveryStatus = normalizeStatus(order.deliveryStatus || 'Pending');
        const deliveryMethod = (order.delivery_method || 'Standard Delivery').trim();
        const isPickup = deliveryMethod === 'Pick Up';
        
        // Exclude rejected/cancelled
        if (effectiveStatus === 'Rejected') continue;
        
        const isDelivered = !isPickup && deliveryStatus === 'Delivered';
        const isPickupCompleted = isPickup && effectiveStatus === 'Completed';
        
        if (isDelivered || isPickupCompleted) {
            const hasReview = await hasOrderBeenReviewed(order.Order_ID);
            if (!hasReview) {
                toRateOrders.push(order);
            }
        }
    }
    
    // Update section header
    const sectionTitle = document.querySelector('.section-title');
    const sectionSubtitle = document.querySelector('.section-subtitle');
    if (sectionTitle) {
        sectionTitle.textContent = 'Orders To Rate';
    }
    if (sectionSubtitle) {
        sectionSubtitle.textContent = `${toRateOrders.length} delivered order${toRateOrders.length !== 1 ? 's' : ''} waiting for your review`;
    }
    
    // Show orders list section, hide selected order section
    const ordersListSection = document.getElementById('ordersListSection');
    const selectedOrderSection = document.getElementById('selectedOrderSection');
    if (ordersListSection) ordersListSection.style.display = 'block';
    if (selectedOrderSection) selectedOrderSection.style.display = 'none';
    
    // Display filtered orders
    if (toRateOrders.length === 0) {
        displayNoOrdersToRate();
    } else {
        displayOrdersList(toRateOrders);
        updateResultsInfo(toRateOrders.length, window.allOrdersData.length);
    }
}

// Show all delivered orders (history)
async function showHistoryOrders() {
    console.log('[Delivery Tracking] Showing "History" orders...');
    
    // Set active filter
    window.currentActiveFilter = 'history';
    updatePageTitle('history');
    
    // Ensure we have orders loaded
    if (!window.allOrdersData || window.allOrdersData.length === 0) {
        await loadAllOrders();
    }
    
    // Filter orders: all completed or cancelled (delivery + pickup)
    const historyOrders = window.allOrdersData.filter(order => {
        const orderStatus = order.status || 'Pending Approval';
        const effectiveStatus = orderStatus === 'Pending Approval' ? 'Waiting Payment' : orderStatus;
        const deliveryStatus = normalizeStatus(order.deliveryStatus || 'Pending');
        const deliveryMethod = (order.delivery_method || 'Standard Delivery').trim();
        const isPickup = deliveryMethod === 'Pick Up';
        
        if (effectiveStatus === 'Rejected') return true; // Cancelled
        if (deliveryStatus === 'Cancelled') return true; // Delivery cancelled
        if (isPickup && effectiveStatus === 'Completed') return true; // Pickup completed
        if (!isPickup && deliveryStatus === 'Delivered') return true; // Delivery completed
        return false;
    });
    
    // Sort by date (newest first)
    historyOrders.sort((a, b) => {
        const dateA = new Date(a.order_date || 0);
        const dateB = new Date(b.order_date || 0);
        return dateB - dateA;
    });
    
    // Update section header
    const sectionTitle = document.querySelector('.section-title');
    const sectionSubtitle = document.querySelector('.section-subtitle');
    if (sectionTitle) {
        sectionTitle.textContent = 'Delivery History';
    }
    if (sectionSubtitle) {
        sectionSubtitle.textContent = `${historyOrders.length} completed or cancelled order${historyOrders.length !== 1 ? 's' : ''}`;
    }
    
    // Show orders list section, hide selected order section
    const ordersListSection = document.getElementById('ordersListSection');
    const selectedOrderSection = document.getElementById('selectedOrderSection');
    if (ordersListSection) ordersListSection.style.display = 'block';
    if (selectedOrderSection) selectedOrderSection.style.display = 'none';
    
    // Display filtered orders
    if (historyOrders.length === 0) {
        displayNoHistoryOrders();
    } else {
        displayOrdersList(historyOrders);
        updateResultsInfo(historyOrders.length, window.allOrdersData.length);
    }
}

// Display message when no orders to rate
function displayNoOrdersToRate() {
    const ordersList = document.getElementById('ordersList');
    if (ordersList) {
        ordersList.innerHTML = `
            <div class="text-center py-5">
                <i class="fas fa-star" style="font-size: 3rem; color: #ccc; margin-bottom: 1rem;"></i>
                <p class="text-muted">No orders to rate</p>
                <p class="text-muted" style="font-size: 0.9rem;">All your delivered orders have been reviewed</p>
            </div>
        `;
    }
}

// Display message when no history orders
function displayNoHistoryOrders() {
    const ordersList = document.getElementById('ordersList');
    if (ordersList) {
        ordersList.innerHTML = `
            <div class="text-center py-5">
                <i class="fas fa-history" style="font-size: 3rem; color: #ccc; margin-bottom: 1rem;"></i>
                <p class="text-muted">No delivery history</p>
                <p class="text-muted" style="font-size: 0.9rem;">You haven't completed any deliveries yet</p>
            </div>
        `;
    }
}

// Display message when no pending orders
function displayNoPendingOrders() {
    const ordersList = document.getElementById('ordersList');
    if (ordersList) {
        ordersList.innerHTML = `
            <div class="text-center py-5">
                <i class="fas fa-clock" style="font-size: 3rem; color: #ccc; margin-bottom: 1rem;"></i>
                <p class="text-muted">No pending orders</p>
                <p class="text-muted" style="font-size: 0.9rem;">All your orders are being processed or delivered</p>
            </div>
        `;
    }
}

// Display message when no preparing orders
function displayNoPreparingOrders() {
    const ordersList = document.getElementById('ordersList');
    if (ordersList) {
        ordersList.innerHTML = `
            <div class="text-center py-5">
                <i class="fas fa-box" style="font-size: 3rem; color: #ccc; margin-bottom: 1rem;"></i>
                <p class="text-muted">No orders being prepared</p>
                <p class="text-muted" style="font-size: 0.9rem;">You don't have any orders currently being prepared</p>
            </div>
        `;
    }
}

// Display message when no orders to receive
function displayNoToReceiveOrders() {
    const ordersList = document.getElementById('ordersList');
    if (ordersList) {
        ordersList.innerHTML = `
            <div class="text-center py-5">
                <i class="fas fa-truck" style="font-size: 3rem; color: #ccc; margin-bottom: 1rem;"></i>
                <p class="text-muted">No orders out for delivery</p>
                <p class="text-muted" style="font-size: 0.9rem;">You don't have any orders currently being delivered</p>
            </div>
        `;
    }
}

// Display message when no completed orders
function displayNoCompletedOrders() {
    const ordersList = document.getElementById('ordersList');
    if (ordersList) {
        ordersList.innerHTML = `
            <div class="text-center py-5">
                <i class="fas fa-check-circle" style="font-size: 3rem; color: #ccc; margin-bottom: 1rem;"></i>
                <p class="text-muted">No completed orders</p>
                <p class="text-muted" style="font-size: 0.9rem;">You haven't completed any deliveries yet</p>
            </div>
        `;
    }
}

/**
 * Display Proof of Delivery (POD) image on customer delivery tracking.
 * When delivery status is Delivered: show section and load image by order_id (API resolves path server-side for reliable customer access).
 */
function displayProofOfDelivery(delivery, orderId) {
    if (!delivery) return '';
    // Prefer order_id-based URL so customer can view proof even if delivery_details is missing from response
    const orderIdNum = orderId != null ? parseInt(orderId, 10) : (delivery.Order_ID != null ? parseInt(delivery.Order_ID, 10) : 0);
    if (!orderIdNum) return '';
    const imageUrl = '../api/get_delivery_proof_image.php?order_id=' + orderIdNum;
    ensurePODModal();
    return `
        <div class="proof-of-delivery-section" style="margin-top: 25px; padding: 20px; background: #f0f8ff; border: 1px solid #4a90e2; border-radius: 8px;">
            <h4 style="margin-bottom: 15px; color: #2c3e50; font-size: 1rem;">
                <i class="fas fa-camera" style="margin-right: 8px; color: #4a90e2;"></i>Proof of Delivery
            </h4>
            <div style="text-align: center; padding: 15px;" class="proof-of-delivery-image-wrap">
                <img src="${imageUrl}" alt="Proof of Delivery" class="proof-of-delivery-img" style="max-width: 100%; max-height: 400px; border-radius: 6px; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.1);"
                     onclick="window.showPODModal &amp;&amp; window.showPODModal(this.src)" title="Click to enlarge"
                     onerror="this.style.display='none'; var msg=this.nextElementSibling; if(msg) msg.style.display='block';">
                <p class="proof-of-delivery-no-image" style="display: none; color: #888; font-size: 0.9rem; margin: 0;">No proof image available for this delivery.</p>
            </div>
            <p style="font-size: 0.85rem; color: #666; margin-top: 10px; text-align: center;">
                <i class="fas fa-info-circle"></i> Proof of delivery uploaded by driver
            </p>
        </div>
    `;
}

function ensurePODModal() {
    if (document.getElementById('podModal')) return;
    const modal = document.createElement('div');
    modal.id = 'podModal';
    modal.style.cssText = 'display:none; position:fixed; z-index:10000; left:0; top:0; width:100%; height:100%; background-color:rgba(0,0,0,0.7); padding:20px;';
    modal.innerHTML = '<div style="position:relative; width:100%; height:100%; display:flex; align-items:center; justify-content:center;">' +
        '<span onclick="window.closePODModal && window.closePODModal()" style="position:absolute; top:20px; right:40px; font-size:32px; color:white; cursor:pointer; z-index:1001;">&times;</span>' +
        '<img id="podModalImage" src="" alt="Proof of Delivery" style="max-width:90vw; max-height:90vh; object-fit:contain; border-radius:8px;">' +
        '</div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', function(e) {
        if (e.target === modal) window.closePODModal && window.closePODModal();
    });
    window.showPODModal = function(imageSrc) {
        const m = document.getElementById('podModal');
        const img = document.getElementById('podModalImage');
        if (m && img) { m.style.display = 'block'; img.src = imageSrc; }
    };
    window.closePODModal = function() {
        const m = document.getElementById('podModal');
        if (m) m.style.display = 'none';
    };
}

