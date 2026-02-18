/**
 * Load Order Summary for Customer
 * Displays the customer's order details
 */

// Format price
function formatPrice(price) {
    return '₱' + parseFloat(price).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// Get product image - use item.image_path when available
function getProductImage(item) {
    if (item && item.image_path && item.image_path.trim() !== '') {
        let path = item.image_path.replace(/Admin assets/g, 'Admin_assets').replace(/Customer assets/g, 'Customer_assets');
        if (!path.startsWith('uploads/') && !path.startsWith('../')) {
            path = path.startsWith('/') ? path.slice(1) : path;
        }
        return path.startsWith('../') ? path : '../' + path;
    }
    return '../Customer_assets/images/PreviewMain.png';
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Format time
function formatTime(timeString) {
    if (!timeString) return '';
    
    // Handle time-only strings (HH:MM:SS or HH:MM)
    if (timeString.includes(':') && !timeString.includes('T') && !timeString.includes(' ')) {
        const [hours, minutes] = timeString.split(':');
        const hour = parseInt(hours, 10);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minutes} ${ampm}`;
    }
    
    // Handle full date-time strings
    const date = new Date(timeString);
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
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
    return text.toString().replace(/[&<>"']/g, m => map[m]);
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

// Create order item row HTML
function createOrderItemRow(item, productDetails = null) {
    // Get product name - item already has Product_Name from API JOIN, prioritize that
    let productName = item.Product_Name || item.product_name;
    
    // Fallback to productDetails if item doesn't have name
    if (!productName && productDetails) {
        productName = productDetails.Product_Name || productDetails.product_name;
    }
    
    // Final fallback
    if (!productName) {
        productName = `Product ${item.Product_ID}`;
    }
    
    // Variation column: use item.variations (from transaction_items/order) when available
    // Fallback to dimensions (length x width). Never use category - it's not a variation
    let variationText = '';
    if (item.variations && String(item.variations).trim() !== '') {
        variationText = String(item.variations).trim();
    } else if (item.length && item.Width) {
        variationText = `${item.length}${item.Unit || ''} x ${item.Width}${item.Unit || ''}`;
    } else if (productDetails) {
        const width = productDetails.Width || productDetails.width;
        const length = productDetails.length;
        const unit = productDetails.Unit || productDetails.unit || '';
        if (length && width) {
            variationText = `${length}${unit} x ${width}${unit}`;
        } else {
            variationText = '—';
        }
    } else {
        variationText = '—';
    }
    
    const image = getProductImage(item);
    const price = formatPrice(item.Price);
    const total = formatPrice(item.Price * item.Quantity);
    
    return `
        <tr class="order-item">
            <td>
                <div class="d-flex align-items-center">
                    <img src="${image}" alt="${productName}" class="product-thumb mr-3" onerror="this.src='../Customer_assets/images/PreviewMain.png'">
                    <div class="product-info">
                        <span class="product-name">${productName}</span>
                        <div class="d-md-none mt-1">
                            <small class="text-muted d-block">Qty: ${item.Quantity}</small>
                            <small class="text-muted d-md-none d-block">${escapeHtml(variationText)}</small>
                            <small class="text-muted d-sm-none d-block">${price}</small>
                        </div>
                    </div>
                </div>
            </td>
            <td class="text-center quantity-col">${item.Quantity}</td>
            <td class="text-center variation-col d-none d-md-table-cell">${escapeHtml(variationText)}</td>
            <td class="text-center price-col d-none d-sm-table-cell">${price}</td>
            <td class="text-center total-col font-weight-bold">${total}</td>
        </tr>
    `;
}

// Get product details from API
async function getProductDetails(productId) {
    try {
        const response = await fetch(`../api/get_product_customer.php?product_id=${productId}`);
        const data = await response.json();
        return data.success ? data.product : null;
    } catch (error) {
        console.error('Error fetching product details:', error);
        return null;
    }
}

// Load order summary
async function loadOrderSummary() {
    // Get order_id from URL if present (from checkout redirect) - for single order view
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('order_id');
    const sessionUserId = sessionStorage.getItem('user_id');
    
    console.log(`[OrderSummary] Loading - URL Order ID: ${orderId}, Session User ID: ${sessionUserId}`);
    
    // Verify session first
    if (!sessionUserId) {
        console.error('[OrderSummary] No user ID in session, redirecting to login');
        window.location.href = '../Customer/Login.html';
        return;
    }
    
    try {
        let url = '../api/get_customer_orders.php';
        if (orderId) {
            url += '?order_id=' + orderId;
            console.log(`[OrderSummary] Fetching specific order: ${orderId} for user: ${sessionUserId}`);
        } else {
            console.log(`[OrderSummary] Fetching all orders for user: ${sessionUserId}`);
        }
        
        const response = await fetch(url, {
            method: 'GET',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Orders API response:', data);
        
        // Check if PHP session matches frontend session (only if session_user_id is provided)
        const apiSessionUserId = data.session_user_id; // From PHP session
        let frontendUserId = parseInt(sessionUserId);
        const backendUserId = apiSessionUserId ? parseInt(apiSessionUserId) : null;
        
        console.log('[OrderSummary] Session verification:', {
            frontendUserId: frontendUserId,
            backendUserId: backendUserId,
            apiSessionUserId: apiSessionUserId,
            sessionUserId: sessionUserId
        });
        
        // Handle session mismatch - sync frontend with backend (backend is source of truth)
        if (apiSessionUserId !== undefined && apiSessionUserId !== null && backendUserId !== null && backendUserId !== frontendUserId) {
            console.warn(`[OrderSummary] Session mismatch detected: PHP Session User ID (${backendUserId}) does not match Frontend Session User ID (${frontendUserId})`);
            
            // Verify order ownership first (security check)
            const orderBelongsToFrontendUser = data.order && data.order.User_ID && parseInt(data.order.User_ID) === frontendUserId;
            const orderBelongsToBackendUser = data.order && data.order.User_ID && parseInt(data.order.User_ID) === backendUserId;
            
            // Security check: If viewing a specific order, verify it belongs to one of the sessions
            if (data.order) {
                if (!orderBelongsToFrontendUser && !orderBelongsToBackendUser) {
                    // Order doesn't belong to either user - security issue
                    console.error('[OrderSummary] SECURITY: Order does not belong to either session user', {
                        orderUserID: data.order.User_ID,
                        frontendUserID: frontendUserId,
                        backendUserID: backendUserId
                    });
                    alert('Security Error: This order does not belong to you. Redirecting...');
                    window.location.href = '../Customer/Login.html';
                    return;
                }
            }
            
            // Sync frontend sessionStorage with backend session (backend is source of truth)
            console.log(`[OrderSummary] Syncing frontend sessionStorage with backend session: ${frontendUserId} -> ${backendUserId}`);
            sessionStorage.setItem('user_id', String(backendUserId));
            
            // Update local variable to use synced user ID for subsequent checks
            frontendUserId = backendUserId;
            
            // Verify orders belong to the synced user (backend user)
            if (data.order && !orderBelongsToBackendUser) {
                console.error('[OrderSummary] Order does not belong to backend session user after sync', {
                    orderUserID: data.order.User_ID,
                    backendUserID: backendUserId
                });
                alert('Session Error: Unable to verify order ownership. Please log out and log back in.');
                window.location.href = '../Customer/Login.html';
                return;
            }
            
            console.log('[OrderSummary] Session synced successfully. Backend session is now authoritative.');
        } else if (apiSessionUserId === undefined || apiSessionUserId === null) {
            // Backend didn't provide session_user_id - this is okay, we'll verify by order ownership
            console.log('[OrderSummary] Backend did not provide session_user_id, will verify by order ownership');
        } else {
            // Session IDs match
            console.log('[OrderSummary] Session verification passed');
        }
        
        if (data.success) {
            // If specific order_id requested, show single order
            if (data.order) {
                // Verify order ownership (use synced frontendUserId which may have been updated during session sync)
                if (data.order.User_ID && parseInt(data.order.User_ID) !== frontendUserId) {
                    console.error(`[OrderSummary] SECURITY WARNING: Order User_ID (${data.order.User_ID}) does not match Session User_ID (${frontendUserId})`);
                    alert('Security Error: This order does not belong to you. Redirecting...');
                    window.location.href = 'OrderSummary.html';
                    return;
                }
                console.log('Displaying single order:', data.order.Order_ID, 'for user:', data.order.User_ID);
                displaySingleOrder(data.order);
            } else if (data.orders !== undefined) {
                // Verify all orders belong to the user (use synced frontendUserId)
                // Note: Backend already filters by User_ID, but this is an extra security check
                const invalidOrders = data.orders.filter(order => 
                    order.User_ID && parseInt(order.User_ID) !== frontendUserId
                );
                if (invalidOrders.length > 0) {
                    console.error(`[OrderSummary] SECURITY WARNING: Found ${invalidOrders.length} orders that do not belong to user ${frontendUserId}`);
                    // Filter out invalid orders
                    data.orders = data.orders.filter(order => 
                        !order.User_ID || parseInt(order.User_ID) === frontendUserId
                    );
                }
                // Display all orders (use new tab structure; empty array shows empty states)
                console.log(`Received ${data.orders.length} orders from API`);
                await displayAllOrders(data.orders || []);
            } else {
                // No orders property in response
                console.log('No orders property in response');
                await displayAllOrders([]);
            }
        } else {
            // Check if it's a "no orders" case or an actual error
            const errorMessage = data.message || 'Unknown error';
            const isNoOrdersCase = errorMessage.toLowerCase().includes('no orders') || 
                                  errorMessage.toLowerCase().includes('not found') ||
                                  (data.orders !== undefined && (!data.orders || data.orders.length === 0));
            
            console.error('Failed to load orders:', errorMessage);
            const errHtml = isNoOrdersCase
                ? '<div class="text-center py-5"><p class="text-muted">No orders found. Start shopping to place your first order!</p></div>'
                : `<div class="text-center py-5"><p class="text-danger">Error loading orders: ${escapeHtml(errorMessage)}</p><button class="btn btn-primary mt-2" onclick="location.reload()">Retry</button></div>`;
            await displayAllOrders([], errHtml);
        }
        } catch (error) {
        console.error('Error loading order summary:', error);
        const isNetworkError = error.message && (error.message.includes('Failed to fetch') || 
            error.message.includes('NetworkError') || error.message.includes('network'));
        const errMsg = isNetworkError
            ? 'Network error. Please check your connection and try again.'
            : (error.message || 'Error loading orders.');
        const errHtml = `<div class="text-center py-5"><p class="text-danger">${escapeHtml(errMsg)}</p><button class="btn btn-primary mt-2" onclick="location.reload()">Retry</button></div>`;
        displayAllOrders([], errHtml).catch(() => {});
    }
}

// Generate star rating HTML (1-5 filled stars, rest empty)
function generateStarsHtml(rating) {
    const r = Math.min(5, Math.max(1, parseInt(rating, 10) || 0));
    let html = '';
    for (let i = 1; i <= 5; i++) {
        html += `<i class="${i <= r ? 'fas fa-star star-filled' : 'far fa-star star-empty'}"></i>`;
    }
    return html;
}

// Normalize delivery status (match admin)
function normalizeDeliveryStatus(status) {
    if (!status) return 'Pending';
    const s = String(status).toLowerCase().trim();
    if (s === 'on the way' || s === 'out for delivery') return 'Out for Delivery';
    if (s === 'preparing') return 'Preparing';
    if (s === 'pending') return 'Pending';
    if (s === 'delivered') return 'Delivered';
    if (s === 'cancelled') return 'Cancelled';
    return status;
}

// Display all orders - categorized by Delivery/Pick Up and status (matches admin flow)
// Optional errorHtml: shown in all tab containers when provided (e.g. on load error)
async function displayAllOrders(orders, errorHtml) {
    const singleOrderView = document.getElementById('singleOrderView');
    if (singleOrderView) singleOrderView.style.display = 'none';
    const orderSummaryBackBtn = document.getElementById('orderSummaryBackBtn');
    if (orderSummaryBackBtn) orderSummaryBackBtn.style.display = 'none';

    const emptyHtml = errorHtml || '<div class="text-center py-5"><p class="text-muted">No orders in this category.</p></div>';

    if (!orders || orders.length === 0 || errorHtml) {
        const containers = ['deliveryOrdersPlacedCards', 'deliveryPreparingCards', 'deliveryOutForDeliveryCards', 'deliveryCompletedCards',
            'deliveryToRateCards', 'deliveryOrderHistoryCards',
            'pickupOrdersPlacedCards', 'pickupPreparingCards', 'pickupReadyCards', 'pickupCompletedCards'];
        containers.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = emptyHtml;
        });
        const setCount = (id, n) => { const e = document.getElementById(id); if (e) e.textContent = n; };
        setCount('deliveryOrdersCount', 0);
        setCount('pickupOrdersCount', 0);
        setCount('deliveryOrdersPlacedCount', 0);
        setCount('deliveryPreparingCount', 0);
        setCount('deliveryOutForDeliveryCount', 0);
        setCount('deliveryCompletedCount', 0);
        setCount('deliveryToRateCount', 0);
        setCount('deliveryOrderHistoryCount', 0);
        setCount('pickupOrdersPlacedCount', 0);
        setCount('pickupPreparingCount', 0);
        setCount('pickupReadyCount', 0);
        setCount('pickupCompletedCount', 0);
        setupOrderSummaryTabs();
        return;
    }

    // Categorize orders (match admin logic) - Delivery | Pick Up with sub-tabs
    const deliveryPlaced = [], deliveryPreparing = [], deliveryOutForDelivery = [], deliveryCompleted = [];
    const deliveryToRate = [], deliveryOrderHistory = [];
    const pickupPlaced = [], pickupPreparing = [], pickupReady = [], pickupCompleted = [];

    orders.forEach(order => {
        const status = order.status || 'Pending Approval';
        const effectiveStatus = status === 'Pending Approval' ? 'Waiting Payment' : status;
        const deliveryMethod = (order.delivery_method || 'Standard Delivery').trim();
        const deliveryStatusRaw = order.Delivery_Status || order.delivery_status || 'Pending';
        const deliveryStatus = normalizeDeliveryStatus(deliveryStatusRaw);
        const isPickup = deliveryMethod === 'Pick Up';

        if (isPickup) {
            if (effectiveStatus === 'Waiting Payment' || effectiveStatus === 'Pending Approval') {
                pickupPlaced.push(order);
            } else if (effectiveStatus === 'Processing' || effectiveStatus === 'Being Processed') {
                pickupPreparing.push(order);
            } else if (effectiveStatus === 'Ready') {
                pickupReady.push(order);
            } else if (effectiveStatus === 'Completed' || effectiveStatus === 'Rejected') {
                pickupCompleted.push(order);
            } else {
                pickupCompleted.push(order);
            }
        } else {
            if (effectiveStatus === 'Waiting Payment' || effectiveStatus === 'Pending Approval') {
                deliveryPlaced.push(order);
            } else if (effectiveStatus === 'Ready' && deliveryStatus === 'Out for Delivery') {
                deliveryOutForDelivery.push(order);
            } else if (effectiveStatus === 'Ready' && deliveryStatus === 'Delivered') {
                deliveryCompleted.push(order);
            } else if (effectiveStatus === 'Processing' || effectiveStatus === 'Being Processed' || effectiveStatus === 'Ready') {
                deliveryPreparing.push(order);
            } else if (effectiveStatus === 'Rejected') {
                deliveryCompleted.push(order);
            } else {
                deliveryPreparing.push(order);
            }
        }
    });

    // Derive To Rate (delivered/completed, not rated, not cancelled) and Order History (all completed or cancelled)
    const pickupToRate = [], pickupOrderHistory = [];
    deliveryCompleted.forEach(o => {
        const hasRating = o.order_rating != null && o.order_rating >= 1 && o.order_rating <= 5;
        const isRejected = (o.status || '') === 'Rejected';
        if (!hasRating && !isRejected) deliveryToRate.push(o);
        deliveryOrderHistory.push(o);
    });
    pickupCompleted.forEach(o => {
        const hasRating = o.order_rating != null && o.order_rating >= 1 && o.order_rating <= 5;
        const isRejected = (o.status || '') === 'Rejected';
        if (!hasRating && !isRejected) pickupToRate.push(o);
        pickupOrderHistory.push(o);
    });
    // To Rate and Order History show all (delivery + pickup) for comprehensive view
    const allToRate = [...deliveryToRate, ...pickupToRate];
    const allOrderHistory = [...deliveryOrderHistory, ...pickupOrderHistory];

    // Render into containers (fromTab: 'completed' = hide Rate button when View Order opens single view)
    const renderTo = (id, arr, fromTab) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = arr.length === 0 ? emptyHtml : arr.map(o => createOrderCard(o, fromTab)).join('');
    };
    renderTo('deliveryOrdersPlacedCards', deliveryPlaced, 'orders-placed');
    renderTo('deliveryPreparingCards', deliveryPreparing, 'preparing');
    renderTo('deliveryOutForDeliveryCards', deliveryOutForDelivery, 'out-for-delivery');
    renderTo('deliveryCompletedCards', deliveryCompleted, 'completed');
    renderTo('deliveryToRateCards', allToRate, 'to-rate');
    renderTo('deliveryOrderHistoryCards', allOrderHistory, 'order-history');
    renderTo('pickupOrdersPlacedCards', pickupPlaced, 'orders-placed');
    renderTo('pickupPreparingCards', pickupPreparing, 'preparing');
    renderTo('pickupReadyCards', pickupReady, 'ready-for-pickup');
    renderTo('pickupCompletedCards', pickupCompleted, 'completed');

    // Update counts
    document.getElementById('deliveryOrdersCount').textContent = deliveryPlaced.length + deliveryPreparing.length + deliveryOutForDelivery.length + deliveryCompleted.length;
    document.getElementById('pickupOrdersCount').textContent = pickupPlaced.length + pickupPreparing.length + pickupReady.length + pickupCompleted.length;
    document.getElementById('deliveryOrdersPlacedCount').textContent = deliveryPlaced.length;
    document.getElementById('deliveryPreparingCount').textContent = deliveryPreparing.length;
    document.getElementById('deliveryOutForDeliveryCount').textContent = deliveryOutForDelivery.length;
    document.getElementById('deliveryCompletedCount').textContent = deliveryCompleted.length;
    document.getElementById('deliveryToRateCount').textContent = allToRate.length;
    document.getElementById('deliveryOrderHistoryCount').textContent = allOrderHistory.length;
    document.getElementById('pickupOrdersPlacedCount').textContent = pickupPlaced.length;
    document.getElementById('pickupPreparingCount').textContent = pickupPreparing.length;
    document.getElementById('pickupReadyCount').textContent = pickupReady.length;
    document.getElementById('pickupCompletedCount').textContent = pickupCompleted.length;

    setupOrderSummaryTabs();
}

// Setup tab switching for Order Summary (Delivery | Pick Up with sub-tabs)
function setupOrderSummaryTabs() {
    document.querySelectorAll('#delivery-orders-tab, #pickup-orders-tab').forEach(btn => {
        btn.onclick = function() {
            document.querySelectorAll('.order-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.order-tab-content').forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            const tab = this.getAttribute('data-tab');
            const content = document.getElementById(tab + '-content');
            if (content) content.classList.add('active');
        };
    });
    document.querySelectorAll('[data-delivery-sub]').forEach(btn => {
        btn.onclick = function() {
            document.querySelectorAll('#delivery-orders-content .sub-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('#delivery-orders-content .delivery-sub-content').forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            const sub = this.getAttribute('data-delivery-sub');
            const el = document.getElementById('delivery-' + sub + '-content');
            if (el) el.classList.add('active');
        };
    });
    document.querySelectorAll('[data-pickup-sub]').forEach(btn => {
        btn.onclick = function() {
            document.querySelectorAll('#pickup-orders-content .sub-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('#pickup-orders-content .pickup-sub-content').forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            const sub = this.getAttribute('data-pickup-sub');
            const el = document.getElementById('pickup-' + sub + '-content');
            if (el) el.classList.add('active');
        };
    });
}

// Create order card HTML (fromTab: 'completed' = pass to trackOrder to hide Rate in single view)
function createOrderCard(order, fromTab) {
    const orderId = order.Order_ID;
    const orderNumber = `ORD-${orderId.toString().padStart(4, '0')}`;
    const totalAmount = formatPrice(order.amount);
    const itemCount = order.items ? order.items.length : 0;
    const orderDate = formatDate(order.order_date);
    const status = order.status || 'Waiting Payment';
    // Treat legacy Pending Approval as Waiting Payment (no approval step)
    const effectiveStatus = status === 'Pending Approval' ? 'Waiting Payment' : status;
    
    const isRejected = effectiveStatus === 'Rejected';
    const isApproved = !isRejected;
    const deliveryMethod = order.delivery_method || 'Standard Delivery';
    const isPickupOrder = deliveryMethod === 'Pick Up';
    
    // Determine if order is completed/delivered (for showing rating)
    const deliveryStatusRaw = order.Delivery_Status || order.delivery_status || 'Pending';
    const deliveryStatus = normalizeDeliveryStatus(deliveryStatusRaw);
    const isDeliveryCompleted = !isPickupOrder && effectiveStatus === 'Ready' && deliveryStatus === 'Delivered';
    const isPickupCompleted = isPickupOrder && effectiveStatus === 'Completed';
    const isCompletedForRating = (isDeliveryCompleted || isPickupCompleted) && !isRejected;
    const orderRating = order.order_rating != null && order.order_rating >= 1 && order.order_rating <= 5 ? parseInt(order.order_rating, 10) : null;
    const showRating = isCompletedForRating && orderRating;
    
    // Create items list
    let itemsList = '';
    if (order.items && order.items.length > 0) {
        itemsList = order.items.map(item => item.Product_Name).join(', ');
    }
    
    return `
        <div class="order-card-container mb-4">
            <div class="card">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <div>
                        <h5 class="mb-0">Order # ${orderNumber}</h5>
                        <small class="text-muted">${orderDate}</small>
                    </div>
                    <div class="d-flex align-items-center gap-2 flex-wrap">
                        ${isRejected ? `
                            <span class="badge badge-danger">
                                <i class="fas fa-times-circle mr-1"></i>
                                Rejected
                            </span>
                        ` : ''}
                        ${showRating ? `
                            <div class="order-rating-inline" aria-label="Your rating: ${orderRating} out of 5 stars" title="Your rating">
                                <span class="rating-stars">${generateStarsHtml(orderRating)}</span>
                                <span class="rating-value">${orderRating}.0</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div class="card-body">
                    ${isRejected ? `
                        <div class="alert alert-danger mb-3">
                            <i class="fas fa-exclamation-triangle mr-2"></i>
                            <strong>This order has been cancelled.</strong>
                            ${order.rejection_reason ? `<br><small>Reason: ${escapeHtml(order.rejection_reason)}</small>` : '<br><small>No reason provided.</small>'}
                            <br>
                            <button class="btn btn-sm btn-outline-danger mt-2" onclick="showCancellationDetails(${orderId}, '${orderNumber.replace(/'/g, "\\'")}', ${order.rejection_reason ? `'${order.rejection_reason.replace(/'/g, "\\'")}'` : 'null'}, ${order.rejected_at ? `'${order.rejected_at.replace(/'/g, "\\'")}'` : 'null'})">
                                <i class="fas fa-info-circle mr-1"></i>
                                View Cancellation Details
                            </button>
                        </div>
                    ` : ''}
                    <div class="row">
                        <div class="col-md-8">
                            <h6>Items (${itemCount})</h6>
                            <p class="text-muted mb-2">${itemsList || 'No items'}</p>
                            ${order.availability_date ? `
                            <p class="mb-0">
                                <strong>Availability:</strong> 
                                <span class="text-muted">
                                    ${formatDate(order.availability_date)}
                                </span>
                            </p>
                            ` : ''}
                        </div>
                        <div class="col-md-4 text-right">
                            <h5 class="text-primary">${totalAmount}</h5>
                            ${isApproved ? `
                                <button class="btn btn-track-order mt-2" onclick="trackOrder(${orderId}, ${isPickupOrder}, ${fromTab ? `'${fromTab}'` : 'undefined'})">
                                    <i class="fas fa-eye mr-2"></i>
                                    View Order
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Tab name to display title mapping
const TAB_TITLES = {
    'orders-placed': 'Orders Placed',
    'preparing': 'Preparing',
    'out-for-delivery': 'Out for Delivery',
    'completed': 'Completed',
    'to-rate': 'To Rate',
    'order-history': 'Order History',
    'ready-for-pickup': 'Ready for Pick Up'
};

// Display single order (for when order_id is in URL)
function displaySingleOrder(order) {
    const ordersContainer = document.getElementById('ordersContainer');
    const singleOrderView = document.getElementById('singleOrderView');
    const orderTypeTabs = document.querySelector('.order-type-tabs');
    const deliveryContent = document.getElementById('delivery-orders-content');
    const pickupContent = document.getElementById('pickup-orders-content');

    if (ordersContainer) ordersContainer.style.display = 'none';
    if (orderTypeTabs) orderTypeTabs.style.display = 'none';
    if (deliveryContent) deliveryContent.style.display = 'none';
    if (pickupContent) pickupContent.style.display = 'none';
    if (singleOrderView) singleOrderView.style.display = 'block';

    // Show Back button in single order view
    const backBtn = document.getElementById('orderSummaryBackBtn');
    if (backBtn) {
        backBtn.style.display = 'inline-flex';
        backBtn.onclick = function() { window.history.back(); };
    }

    // Update page title based on which tab the user came from
    const fromParam = new URLSearchParams(window.location.search).get('from');
    const orderTitleEl = document.querySelector('.order-title');
    if (orderTitleEl) {
        orderTitleEl.textContent = (fromParam && TAB_TITLES[fromParam]) ? TAB_TITLES[fromParam] : 'Order Summary';
    }
    document.title = `MATARIX - ${orderTitleEl ? orderTitleEl.textContent : 'Order Summary'}`;

    displayOrderDetails(order);
}

// Display order details
async function displayOrderDetails(order) {
    const tbody = document.getElementById('orderItemsBody');
    if (!tbody) {
        console.error('Order items body not found');
        return;
    }
    
    // Check if order is cancelled/rejected and show cancellation notice
    const orderStatus = order.status || 'Pending Approval';
    const isRejected = orderStatus === 'Rejected';
    
    if (isRejected) {
        // Add cancellation notice above the order items table
        const orderTableContainer = document.querySelector('.order-table-container');
        if (orderTableContainer) {
            const existingNotice = orderTableContainer.previousElementSibling;
            if (!existingNotice || !existingNotice.classList.contains('cancellation-notice-single')) {
                const orderNumber = `ORD-${order.Order_ID.toString().padStart(4, '0')}`;
                const cancellationNotice = document.createElement('div');
                cancellationNotice.className = 'cancellation-notice-single alert alert-danger mb-4';
                cancellationNotice.innerHTML = `
                    <div class="d-flex align-items-start">
                        <i class="fas fa-times-circle fa-2x mr-3 mt-1"></i>
                        <div class="flex-grow-1">
                            <h5 class="alert-heading mb-2">
                                <strong>This order has been cancelled</strong>
                            </h5>
                            <p class="mb-2">
                                Your order ${orderNumber} has been cancelled by our team.
                            </p>
                            ${order.rejection_reason ? `
                                <p class="mb-2"><strong>Reason:</strong> ${escapeHtml(order.rejection_reason)}</p>
                            ` : ''}
                            <button class="btn btn-outline-danger btn-sm mt-2" onclick="showCancellationDetails(${order.Order_ID}, '${orderNumber.replace(/'/g, "\\'")}', ${order.rejection_reason ? `'${order.rejection_reason.replace(/'/g, "\\'")}'` : 'null'}, ${order.rejected_at ? `'${order.rejected_at.replace(/'/g, "\\'")}'` : 'null'})">
                                <i class="fas fa-info-circle mr-1"></i>
                                View Full Cancellation Details
                            </button>
                        </div>
                    </div>
                `;
                orderTableContainer.parentNode.insertBefore(cancellationNotice, orderTableContainer);
            }
        }
    } else {
        // Remove cancellation notice if order is not rejected
        const existingNotice = document.querySelector('.cancellation-notice-single');
        if (existingNotice) {
            existingNotice.remove();
        }
    }
    
    // Clear existing items
    tbody.innerHTML = '';
    
    // Load and display order items
    let subtotal = 0;
    
    if (order.items && order.items.length > 0) {
        for (const item of order.items) {
            // Item already has Product_Name from the API JOIN, so we can use it directly
            // Optionally fetch additional details if needed, but not required
            tbody.insertAdjacentHTML('beforeend', createOrderItemRow(item, null));
            subtotal += item.Price * item.Quantity;
        }
    }
    
    // Get discount information from transaction or calculate from order
    const discountAmount = parseFloat(order.Discount || 0);
    const transactionSubtotal = parseFloat(order.Subtotal || subtotal);
    const finalAmount = parseFloat(order.Transaction_Total || order.amount || subtotal);
    
    // Calculate discount percentage if discount exists
    const discountPercentage = discountAmount > 0 && transactionSubtotal > 0 
        ? Math.round((discountAmount / transactionSubtotal) * 100) 
        : 0;
    
    // Update order total section with subtotal, discount, and total (rate button stays inside card)
    const orderTotalBreakdownContainer = document.querySelector('.order-total-breakdown-container');
    const orderTotalSection = document.querySelector('.order-total-section');
    if (orderTotalBreakdownContainer) {
        let totalHTML = `
            <div class="order-total-breakdown">
                <div class="total-row">
                    <span class="total-label">Subtotal:</span>
                    <span class="total-value">${formatPrice(transactionSubtotal || subtotal)}</span>
                </div>
        `;
        
        if (discountAmount > 0) {
            totalHTML += `
                <div class="total-row" style="color: #28a745;">
                    <span class="total-label">Volume Discount (${discountPercentage}%):</span>
                    <span class="total-value">-${formatPrice(discountAmount)}</span>
                </div>
            `;
        }
        
        // Only show delivery fee row for Standard Delivery (hide for Pick Up)
        const deliveryMethod = order.delivery_method || 'Standard Delivery';
        const deliveryFee = finalAmount - transactionSubtotal + discountAmount;
        if (deliveryMethod !== 'Pick Up') {
            totalHTML += `
                <div class="total-row">
                    <span class="total-label">Delivery Fee:</span>
                    <span class="total-value" style="${deliveryFee <= 0 ? 'color: #28a745;' : ''}">${deliveryFee <= 0 ? 'Free Delivery' : formatPrice(deliveryFee)}</span>
                </div>
            `;
        }
        
        totalHTML += `
                <div class="total-row total-final">
                    <span class="total-label">Total:</span>
                    <span class="total-value" id="orderTotalValue">${formatPrice(finalAmount)}</span>
                </div>
            </div>
        `;
        
        orderTotalBreakdownContainer.innerHTML = totalHTML;
    } else {
        // Fallback to old method if section not found
        const totalElement = document.getElementById('orderTotalValue');
        if (totalElement) {
            totalElement.textContent = formatPrice(finalAmount);
        }
    }
    
    // Update delivery date (if available) - time no longer used
    if (order.availability_date) {
        const deliveryDateEl = document.querySelector('.delivery-date');
        if (deliveryDateEl) {
            deliveryDateEl.textContent = formatDate(order.availability_date);
        }
    }
    
    // Update delivery method display
    const deliveryMethod = order.delivery_method || 'Standard Delivery';
    let deliveryMethodHTML = `
        <div class="delivery-method-info mt-3 mb-3" style="padding: 15px; background-color: #f8f9fa; border-radius: 8px; border-left: 4px solid #BC3131;">
            <div class="d-flex align-items-center">
                <i class="fas ${deliveryMethod === 'Pick Up' ? 'fa-store' : 'fa-truck'} mr-3" style="font-size: 1.5rem; color: #BC3131;"></i>
                <div>
                    <strong style="color: #252121;">Delivery Method:</strong>
                    <span style="color: #665D5D; margin-left: 8px;">${escapeHtml(deliveryMethod)}</span>
                </div>
            </div>
        </div>
    `;
    
    // Delivery tracking: driver, vehicle, time window (Standard Delivery with assigned driver only)
    const tracking = order.delivery_tracking;
    if (deliveryMethod !== 'Pick Up' && tracking && (tracking.driver_name && tracking.driver_name !== '—')) {
        const driverPhone = tracking.driver_phone ? ('<a href="tel:' + escapeHtml(tracking.driver_phone) + '">' + escapeHtml(tracking.driver_phone) + '</a>') : '—';
        const timeWindow = tracking.delivery_time_window || '—';
        const availDate = tracking.availability_date ? formatDate(tracking.availability_date) : '—';
        deliveryMethodHTML += `
        <div class="delivery-tracking-info mt-3 mb-3" style="padding: 15px; background-color: #f0f7ff; border-radius: 8px; border-left: 4px solid #3788d8;">
            <h6 class="mb-3" style="color: #252121;"><i class="fas fa-map-marker-alt mr-2" style="color: #3788d8;"></i>Delivery tracking</h6>
            <div class="delivery-tracking-details">
                <div class="mb-2"><strong style="color: #252121;">Driver:</strong> <span style="color: #665D5D;">${escapeHtml(tracking.driver_name)}</span></div>
                <div class="mb-2"><strong style="color: #252121;">Phone:</strong> <span style="color: #665D5D;">${driverPhone}</span></div>
                <div class="mb-2"><strong style="color: #252121;">Vehicle:</strong> <span style="color: #665D5D;">${escapeHtml(tracking.vehicle_model || '—')}</span></div>
                <div class="mb-2"><strong style="color: #252121;">Delivery time:</strong> <span style="color: #665D5D;">${escapeHtml(timeWindow)}</span></div>
                <div class="mb-2"><strong style="color: #252121;">Scheduled date:</strong> <span style="color: #665D5D;">${availDate}</span></div>
                <div class="mb-0"><strong style="color: #252121;">Status:</strong> <span style="color: #665D5D;">${escapeHtml(tracking.delivery_status || 'Pending')}</span></div>
            </div>
        </div>
        `;
    }
    
    // Insert delivery method into its container (left column, above status)
    const deliveryMethodContainer = document.getElementById('deliveryMethodContainer');
    if (deliveryMethodContainer) {
        deliveryMethodContainer.innerHTML = deliveryMethodHTML;
    }
    
    // Update payment method display (only if order is approved and payment method is selected)
    const isPendingApproval = orderStatus === 'Pending Approval';
    const isApproved = !isPendingApproval && !isRejected;
    
    // Only get payment method if order is approved
    let paymentMethod = null;
    if (isApproved) {
        const rawPaymentMethod = order.payment_method;
        // Only set payment method if it's a valid non-empty value
        if (rawPaymentMethod && 
            rawPaymentMethod !== 'null' && 
            rawPaymentMethod !== 'NULL' && 
            rawPaymentMethod !== '' && 
            rawPaymentMethod !== null && 
            rawPaymentMethod !== undefined) {
            paymentMethod = rawPaymentMethod;
        }
    }

    // Update order progress tracker (Pending | Processing | To Receive | Completed)
    const progressSteps = document.querySelectorAll('.order-progress-tracker .progress-step');
    if (progressSteps.length >= 4) {
        const effectiveStatus = orderStatus === 'Pending Approval' ? 'Waiting Payment' : orderStatus;
        const deliveryStatus = normalizeDeliveryStatus(order.Delivery_Status || order.delivery_status || 'Pending');
        const isPickup = (order.delivery_method || 'Standard Delivery') === 'Pick Up';

        let currentStep = 1;
        if (isRejected) {
            currentStep = 4; // Show as completed (cancelled)
        } else if (effectiveStatus === 'Waiting Payment' || effectiveStatus === 'Pending Approval') {
            currentStep = 1;
        } else if (effectiveStatus === 'Processing' || effectiveStatus === 'Being Processed') {
            currentStep = 2;
        } else if (effectiveStatus === 'Ready') {
            if (isPickup || deliveryStatus === 'Out for Delivery') {
                currentStep = 3;
            } else if (deliveryStatus === 'Delivered') {
                currentStep = 4;
            } else {
                currentStep = 3;
            }
        } else if (effectiveStatus === 'Completed') {
            currentStep = 4;
        }

        progressSteps.forEach((step, idx) => {
            const stepNum = idx + 1;
            step.classList.remove('active', 'passed');
            if (stepNum < currentStep) step.classList.add('passed');
            else if (stepNum === currentStep) step.classList.add('active');
        });
    }

    // Update order status message (replaces View Order button)
    const statusMsgEl = document.getElementById('orderStatusMessage');
    const statusTextEl = document.getElementById('orderStatusText');
    if (statusMsgEl && statusTextEl) {
        const effectiveStatus = orderStatus === 'Pending Approval' ? 'Waiting Payment' : orderStatus;
        const deliveryStatus = normalizeDeliveryStatus(order.Delivery_Status || order.delivery_status || 'Pending');
        const isPickup = (order.delivery_method || 'Standard Delivery') === 'Pick Up';

        let statusText = 'The store is preparing your order.';
        if (isRejected) {
            statusText = 'This order has been cancelled.';
        } else if (effectiveStatus === 'Waiting Payment' || effectiveStatus === 'Pending Approval') {
            statusText = 'Your order has been placed and is awaiting confirmation.';
        } else if (effectiveStatus === 'Processing' || effectiveStatus === 'Being Processed') {
            statusText = 'The store is preparing your order.';
        } else if (effectiveStatus === 'Ready') {
            if (isPickup) {
                statusText = 'Your order is ready for pick up.';
            } else if (deliveryStatus === 'Out for Delivery') {
                statusText = 'Your order is out for delivery.';
            } else if (deliveryStatus === 'Delivered') {
                statusText = 'Your order has been delivered.';
            } else {
                statusText = 'The store is preparing your order for delivery.';
            }
        } else if (effectiveStatus === 'Completed') {
            statusText = 'Your order has been completed. Thank you!';
        }
        statusTextEl.textContent = statusText;
    }

    // Show rating for completed/delivered orders when rating exists; show To Rate button when delivered but not rated
    const ratingDisplayEl = document.getElementById('orderRatingDisplay');
    const toRateActionsEl = document.getElementById('orderToRateActions');
    const btnToRate = document.getElementById('btnToRate');
    if (ratingDisplayEl || toRateActionsEl) {
        const effectiveStatus = orderStatus === 'Pending Approval' ? 'Waiting Payment' : orderStatus;
        const deliveryStatus = normalizeDeliveryStatus(order.Delivery_Status || order.delivery_status || 'Pending');
        const isPickup = (order.delivery_method || 'Standard Delivery') === 'Pick Up';
        const isDeliveryCompleted = !isPickup && effectiveStatus === 'Ready' && deliveryStatus === 'Delivered';
        const isPickupCompleted = isPickup && effectiveStatus === 'Completed';
        const isCompleted = isDeliveryCompleted || isPickupCompleted;
        const hasRating = order.order_rating != null && order.order_rating >= 1 && order.order_rating <= 5;
        const showRating = !isRejected && isCompleted && hasRating;
        const fromParam = new URLSearchParams(window.location.search).get('from');
        const hideRateButton = ['completed', 'order-history'].includes(fromParam);
        const showToRateButton = !isRejected && isCompleted && !hasRating && !hideRateButton;
        if (ratingDisplayEl) {
            if (showRating) {
                const rating = parseInt(order.order_rating, 10);
                ratingDisplayEl.innerHTML = `
                    <div class="order-rating-inline" aria-label="Your rating: ${rating} out of 5 stars" title="Your rating">
                        <span class="rating-label">Your Rating:</span>
                        <span class="rating-stars">${generateStarsHtml(rating)}</span>
                        <span class="rating-value">${rating}.0</span>
                    </div>
                `;
                ratingDisplayEl.style.display = 'block';
            } else {
                ratingDisplayEl.innerHTML = '';
                ratingDisplayEl.style.display = 'none';
            }
        }
        if (toRateActionsEl) {
            toRateActionsEl.style.display = showToRateButton ? 'block' : 'none';
        }
        if (btnToRate && showToRateButton) {
            const orderId = order.Order_ID;
            btnToRate.href = `ProductReview.html?order_id=${orderId}`;
            btnToRate.onclick = function(e) {
                e.preventDefault();
                sessionStorage.setItem('productReviewReturnUrl', window.location.href);
                const userId = sessionStorage.getItem('user_id');
                let url = `ProductReview.html?order_id=${orderId}`;
                if (userId) url += (url.includes('?') ? '&' : '?') + 'user_id=' + userId;
                window.location.href = url;
            };
        }
        // View Receipt link - show for approved orders (not pending/rejected)
        const viewReceiptLink = document.getElementById('viewReceiptLink');
        if (viewReceiptLink) {
            const showReceiptLink = !isRejected && !(orderStatus === 'Pending Approval');
            if (showReceiptLink) {
                const orderId = order.Order_ID;
                const userId = sessionStorage.getItem('user_id');
                let receiptUrl = `receipt.html?order_id=${orderId}&from=order-summary`;
                if (userId) receiptUrl += '&user_id=' + userId;
                viewReceiptLink.href = receiptUrl;
                viewReceiptLink.style.display = 'inline-flex';
            } else {
                viewReceiptLink.style.display = 'none';
            }
        }
        // View Proof of Delivery link - show for delivered orders (Standard Delivery only)
        const viewProofLink = document.getElementById('viewProofOfDeliveryLink');
        if (viewProofLink) {
            const orderId = order.Order_ID;
            const showProofLink = !isRejected && isDeliveryCompleted && orderId;
            if (showProofLink) {
                viewProofLink.href = `../api/get_delivery_proof_image.php?order_id=${orderId}`;
                viewProofLink.target = '_blank';
                viewProofLink.rel = 'noopener noreferrer';
                viewProofLink.style.display = 'inline-flex';
            } else {
                viewProofLink.style.display = 'none';
            }
        }
    }

}

// Initialize on page load with error handling
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        console.log('DOMContentLoaded - Starting loadOrderSummary');
        loadOrderSummary().catch(error => {
            console.error('Error in loadOrderSummary:', error);
            const container = document.getElementById('ordersContainer');
            if (container) {
                const isNetworkError = error.message.includes('Failed to fetch') || 
                                     error.message.includes('NetworkError') ||
                                     error.message.includes('network');
                
                if (isNetworkError) {
                    container.innerHTML = `
                        <div class="text-center py-5">
                            <p class="text-danger">Network error. Please check your connection and try again.</p>
                            <button class="btn btn-primary mt-2" onclick="location.reload()">Retry</button>
                        </div>
                    `;
                } else {
                    container.innerHTML = `
                        <div class="text-center py-5">
                            <p class="text-muted">Unable to load orders at this time. Please try again later.</p>
                            <button class="btn btn-primary mt-2" onclick="location.reload()">Retry</button>
                        </div>
                    `;
                }
            }
        });
    });
} else {
    console.log('DOM already loaded - Starting loadOrderSummary');
    loadOrderSummary().catch(error => {
        console.error('Error in loadOrderSummary:', error);
        const container = document.getElementById('ordersContainer');
        if (container) {
            const isNetworkError = error.message.includes('Failed to fetch') || 
                                 error.message.includes('NetworkError') ||
                                 error.message.includes('network');
            
            if (isNetworkError) {
                container.innerHTML = `
                    <div class="text-center py-5">
                        <p class="text-danger">Network error. Please check your connection and try again.</p>
                        <button class="btn btn-primary mt-2" onclick="location.reload()">Retry</button>
                    </div>
                `;
            } else {
                container.innerHTML = `
                    <div class="text-center py-5">
                        <p class="text-muted">Unable to load orders at this time. Please try again later.</p>
                        <button class="btn btn-primary mt-2" onclick="location.reload()">Retry</button>
                    </div>
                `;
            }
        }
    });
}

// Auto-refresh every 15 seconds to keep order data updated
let orderSummaryRefreshInterval;
function startOrderSummaryAutoRefresh() {
    if (orderSummaryRefreshInterval) clearInterval(orderSummaryRefreshInterval);
    orderSummaryRefreshInterval = setInterval(() => {
        // Only refresh if page is visible
        if (!document.hidden) {
            loadOrderSummary();
        }
    }, 15000); // Refresh every 15 seconds
}

// Start auto-refresh after initial load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        // Wait a bit after initial load before starting auto-refresh
        setTimeout(startOrderSummaryAutoRefresh, 2000);
    });
} else {
    // DOM already loaded
    setTimeout(startOrderSummaryAutoRefresh, 2000);
}

// Pause auto-refresh when page is hidden
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        if (orderSummaryRefreshInterval) clearInterval(orderSummaryRefreshInterval);
    } else {
        startOrderSummaryAutoRefresh();
    }
});

// Show cancellation details popup
function showCancellationDetails(orderId, orderNumber, rejectionReason, rejectedAt) {
    // Set order number
    const orderNumberEl = document.getElementById('cancellationOrderNumber');
    if (orderNumberEl) {
        orderNumberEl.textContent = orderNumber || `ORD-${orderId.toString().padStart(4, '0')}`;
    }
    
    // Set cancellation date
    const dateEl = document.getElementById('cancellationDate');
    if (dateEl) {
        if (rejectedAt && rejectedAt !== 'null' && rejectedAt !== '') {
            try {
                const date = new Date(rejectedAt);
                dateEl.textContent = formatDate(rejectedAt) + ' ' + formatTime(rejectedAt);
            } catch (e) {
                dateEl.textContent = rejectedAt;
            }
        } else {
            dateEl.textContent = 'Date not available';
        }
    }
    
    // Set rejection reason
    const reasonEl = document.getElementById('cancellationReason');
    if (reasonEl) {
        if (rejectionReason && rejectionReason !== 'null' && rejectionReason !== '') {
            reasonEl.innerHTML = `<p class="mb-0">${escapeHtml(rejectionReason)}</p>`;
        } else {
            reasonEl.innerHTML = '<em class="text-muted">No reason provided.</em>';
        }
    }
    
    // Show modal using Bootstrap
    if (typeof jQuery !== 'undefined' && jQuery.fn.modal) {
        jQuery('#cancellationModal').modal('show');
    } else {
        // Fallback if Bootstrap/jQuery not available
        const modal = document.getElementById('cancellationModal');
        if (modal) {
            modal.style.display = 'block';
            modal.classList.add('show');
        }
    }
}

// Make function globally available
window.showCancellationDetails = showCancellationDetails;

