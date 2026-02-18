/**
 * Load Orders for Admin
 * Dynamically loads and displays orders from the database
 */

// Format price
function formatPrice(price) {
    return '₱' + parseFloat(price).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// Group orders by order date (when order was placed), sorted earliest first
function groupOrdersByOrderDate(orders) {
    const map = {};
    for (const o of orders) {
        const d = o.order_date;
        const dateKey = (d && String(d).trim() !== '') ? new Date(d).toISOString().slice(0, 10) : '__no_date__';
        if (!map[dateKey]) map[dateKey] = [];
        map[dateKey].push(o);
    }
    const sortedKeys = Object.keys(map).sort((a, b) => {
        if (a === '__no_date__') return 1;
        if (b === '__no_date__') return -1;
        return a.localeCompare(b);
    });
    return sortedKeys.map(dateKey => {
        const list = map[dateKey];
        list.sort((a, b) => {
            const tA = a.order_date ? new Date(a.order_date).getTime() : 0;
            const tB = b.order_date ? new Date(b.order_date).getTime() : 0;
            return tA - tB;
        });
        const dateLabel = dateKey === '__no_date__' ? 'No order date' : formatDateLong(dateKey);
        return { dateKey, dateLabel, orders: list };
    });
}

// Group orders by preferred date (availability_date), sorted earliest first
function groupOrdersByPreferredDate(orders) {
    const map = {};
    for (const o of orders) {
        const d = o.availability_date;
        const dateKey = (d && String(d).trim() !== '') ? new Date(d).toISOString().slice(0, 10) : '__no_date__';
        if (!map[dateKey]) map[dateKey] = [];
        map[dateKey].push(o);
    }
    const sortedKeys = Object.keys(map).sort((a, b) => {
        if (a === '__no_date__') return 1;
        if (b === '__no_date__') return -1;
        return a.localeCompare(b);
    });
    return sortedKeys.map(dateKey => {
        const list = map[dateKey];
        list.sort((a, b) => {
            const tA = a.order_date ? new Date(a.order_date).getTime() : 0;
            const tB = b.order_date ? new Date(b.order_date).getTime() : 0;
            return tA - tB;
        });
        const dateLabel = dateKey === '__no_date__' ? 'No preferred date' : formatDateLong(dateKey);
        return { dateKey, dateLabel, orders: list };
    });
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric'
    });
}

// Format date long: "February 1, 2025" for vertical display
function formatDateLong(dateString) {
    const date = new Date(dateString);
    const month = date.toLocaleDateString('en-US', { month: 'long' });
    const day = date.getDate();
    const year = date.getFullYear();
    return { month, dayYear: `${day}, ${year}` };
}

// Format datetime
function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Normalize delivery status (handle case variations and old values)
function normalizeDeliveryStatus(status) {
    if (!status) return 'Pending';
    const statusLower = status.toLowerCase().trim();
    
    // Map old values to new standardized values
    if (statusLower === 'on the way' || statusLower === 'out for delivery') {
        return 'Out for Delivery';
    }
    if (statusLower === 'preparing') {
        return 'Preparing';
    }
    if (statusLower === 'pending') {
        return 'Pending';
    }
    if (statusLower === 'delivered') {
        return 'Delivered';
    }
    if (statusLower === 'cancelled') {
        return 'Cancelled';
    }
    
    // Return as-is if already standardized (capitalize first letter of each word)
    return status.split(' ').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
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

// Get status badge class
function getStatusBadgeClass(status) {
    const statusMap = {
        'Order Confirmed': 'status-confirmed',
        'Being Processed': 'status-preparing',
        'On the Way': 'status-ready',
        'Completed': 'status-completed'
    };
    return statusMap[status] || 'status-confirmed';
}

// Global cache for vehicle capacities and delivery fees
let vehicleCapacitiesCache = null;
let deliveryFeeCache = {};

// Load vehicle capacities from fleet
async function loadVehicleCapacities() {
    if (vehicleCapacitiesCache) {
        return vehicleCapacitiesCache;
    }
    
    try {
        const response = await fetch('../api/get_fleet.php', {
            method: 'GET',
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.vehicles) {
                // Convert all capacities to kg
                vehicleCapacitiesCache = data.vehicles.map(vehicle => {
                    let capacityKg = parseFloat(vehicle.capacity) || 0;
                    const unit = vehicle.capacity_unit || 'kg';
                    
                    // Convert to kg
                    switch(unit) {
                        case 'g': capacityKg = capacityKg / 1000; break;
                        case 'lb': capacityKg = capacityKg * 0.453592; break;
                        case 'oz': capacityKg = capacityKg * 0.0283495; break;
                        case 'ton': capacityKg = capacityKg * 1000; break;
                    }
                    
                    return {
                        id: vehicle.vehicle_id || vehicle.Vehicle_ID,
                        model: vehicle.vehicle_model,
                        capacity: capacityKg,
                        status: vehicle.status
                    };
                }).filter(v => v.capacity > 0 && (v.status === 'Available' || v.status === 'In Use'))
                  .sort((a, b) => b.capacity - a.capacity); // Sort by capacity (largest first)
                
                return vehicleCapacitiesCache;
            }
        }
    } catch (error) {
        // Silently handle error
    }
    
    // Return default if API fails
    return [{ id: 1, model: 'Default Truck', capacity: 1700, status: 'Available' }];
}

// Calculate trucks needed for an order
async function calculateTrucksNeeded(orderWeightKg) {
    const vehicles = await loadVehicleCapacities();
    
    if (!vehicles || vehicles.length === 0) {
        return { trucks: 1, vehicles: [] };
    }
    
    let remainingWeight = parseFloat(orderWeightKg) || 0;
    let trucksNeeded = 0;
    const vehiclesUsed = [];
    
    // Use largest vehicles first
    for (const vehicle of vehicles) {
        if (remainingWeight <= 0) break;
        
        const trips = Math.ceil(remainingWeight / vehicle.capacity);
        trucksNeeded += trips;
        
        if (trips > 0) {
            vehiclesUsed.push({
                vehicle: vehicle.model,
                capacity: vehicle.capacity,
                trips: trips
            });
        }
        
        remainingWeight -= (vehicle.capacity * trips);
    }
    
    // If still weight remaining, add one more truck
    if (remainingWeight > 0) {
        trucksNeeded += 1;
    }
    
    return {
        trucks: trucksNeeded,
        vehicles: vehiclesUsed
    };
}

// Calculate delivery fee based on address
async function calculateDeliveryFee(deliveryAddress) {
    if (!deliveryAddress) {
        return { distance: 0, fee: 0 };
    }
    
    // Check cache first
    const cacheKey = deliveryAddress.toLowerCase().trim();
    if (deliveryFeeCache[cacheKey]) {
        return deliveryFeeCache[cacheKey];
    }
    
    try {
        const response = await fetch(`../api/calculate_delivery_fee.php?address=${encodeURIComponent(deliveryAddress)}`, {
            method: 'GET',
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                const result = {
                    distance: parseFloat(data.distance) || 0,
                    fee: parseFloat(data.delivery_fee) || 0
                };
                // Cache the result
                deliveryFeeCache[cacheKey] = result;
                return result;
            }
        }
    } catch (error) {
        // Silently handle error
    }
    
    // Return default if API fails
    return { distance: 0, fee: 0 };
}

// Get order weight from order items
async function getOrderWeight(orderId) {
    try {
        const response = await fetch(`../api/get_orders.php?order_id=${orderId}`, {
            method: 'GET',
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.order && data.order.items) {
                let totalWeightKg = 0;
                
                data.order.items.forEach(item => {
                    if (item.weight && item.Quantity) {
                        let weightKg = parseFloat(item.weight) || 0;
                        const unit = item.weight_unit || 'kg';
                        
                        // Convert to kg
                        switch(unit) {
                            case 'g': weightKg = weightKg / 1000; break;
                            case 'lb': weightKg = weightKg * 0.453592; break;
                            case 'oz': weightKg = weightKg * 0.0283495; break;
                            case 'ton': weightKg = weightKg * 1000; break;
                        }
                        
                        totalWeightKg += weightKg * parseInt(item.Quantity);
                    }
                });
                
                return totalWeightKg;
            }
        }
    } catch (error) {
        // Silently handle error
    }
    
    return 0;
}

// Create order card HTML for Kanban board
async function createOrderCard(order) {
    try {
        const orderId = order.Order_ID;
        const customerName = order.customer_name || 'Unknown Customer';
        const orderDate = formatDate(order.order_date);
        const status = order.status || 'Pending Approval';
        const payment = order.payment || 'To Pay';
        const amount = formatPrice(order.amount);
        const availabilityDate = order.availability_date ? formatDate(order.availability_date) : 'N/A';
        const deliveryAddress = order.address || '';
        // Get delivery method
        const deliveryMethod = order.delivery_method || 'Standard Delivery';
        // Normalize delivery status for consistent display
        const rawDeliveryStatus = order.Delivery_Status || 'Pending';
        const deliveryStatus = normalizeDeliveryStatus(rawDeliveryStatus);
        
        const isRejected = status === 'Rejected';
        const isApproved = !isRejected; // No approval step - all non-rejected orders are "approved"
        
        // Get payment method for display tag (prefer order.payment_method, fallback to transaction)
        const rawPayment = (order.payment_method != null && order.payment_method !== 'null' && order.payment_method !== 'NULL' && String(order.payment_method).trim() !== '')
            ? String(order.payment_method).trim()
            : (order.transaction_payment_method != null && order.transaction_payment_method !== 'null' && order.transaction_payment_method !== 'NULL' && String(order.transaction_payment_method).trim() !== '')
                ? String(order.transaction_payment_method).trim() : null;
        const paymentMethod = rawPayment || null;
        const pmLower = paymentMethod ? String(paymentMethod).toLowerCase().replace(/\s+/g, ' ') : '';
        // Map to display label for tag (COD when viewer chose Cash on Delivery)
        const isCOD = pmLower === 'cash on delivery' || pmLower === 'cod' || (pmLower.includes('cash') && pmLower.includes('delivery'));
        const paymentMethodLabel = isCOD ? 'COD' :
            (pmLower === 'on-site' || pmLower === 'pay on site' || pmLower === 'onsite') ? 'Pay on Site' :
            (pmLower === 'gcash') ? 'GCash' : null;
        
        // Determine status class
        let statusClass = 'pending';
        if (status === 'Processing') {
            statusClass = 'processing';
        } else if (status === 'Ready') {
            statusClass = 'ready';
        }
    
    // Only View button on cards - process/change orders when viewing the order
    const actionButtons = `
            <a href="../Admin/ViewOrderAccept.html?order_id=${orderId}" class="order-card-btn view-btn" title="View Order Details">
                <i class="fas fa-eye"></i> View
            </a>
        `;

        const paymentTagClass = paymentMethodLabel ? 'payment-tag-' + 
            (paymentMethodLabel === 'COD' ? 'cod' : paymentMethodLabel === 'Pay on Site' ? 'onsite' : 'gcash') : '';
        const paymentTagHtml = paymentMethodLabel 
            ? `<span class="order-payment-tag ${paymentTagClass}">${escapeHtml(paymentMethodLabel)}</span>` : '';
        
        const proofUpdatedAt = order.proof_updated_at || null;
        const hasProof = order.proof_of_payment != null && String(order.proof_of_payment).trim() !== '' && String(order.proof_of_payment) !== 'null' && String(order.proof_of_payment) !== 'NULL';
        const isGCash = paymentMethod && String(paymentMethod).toLowerCase() === 'gcash';
        const hasProofUpdatedAt = proofUpdatedAt && String(proofUpdatedAt).trim() !== '';
        // Only show "New proof uploaded" for re-upload after rejection (proof_updated_at set by backend)
        const showNewProofTag = hasProof && isGCash && hasProofUpdatedAt;
        const proofUpdatedTagHtml = showNewProofTag 
            ? `<span class="order-payment-tag payment-tag-proof-updated" style="background: #6c757d; color: #fff; font-size: 0.65rem;">New proof uploaded</span>` : '';
    
    return `
        <div class="order-card ${statusClass}" data-order-id="${orderId}">
            <div class="order-card-header">
                <span class="order-id">ORD-${orderId.toString().padStart(4, '0')}</span>
                ${paymentTagHtml}
                ${proofUpdatedTagHtml}
                <span class="order-amount">${amount}</span>
            </div>
            <div class="order-card-body">
                <div class="customer-name">${escapeHtml(customerName)}</div>
                <div class="order-meta">
                    <div class="order-meta-item">
                        <i class="fas fa-calendar"></i>
                        <span>${orderDate}</span>
                    </div>
                    <div class="order-meta-item">
                        <i class="fas fa-clock"></i>
                        <span>Available: ${availabilityDate}</span>
                    </div>
                </div>
            </div>
            <div class="order-card-footer">
                ${actionButtons}
            </div>
        </div>
    `;
    } catch (error) {
        console.error('[Create Order Card] Error creating card for order:', order.Order_ID, error);
        // Return a minimal error card
        return `
            <div class="order-card pending" data-order-id="${order.Order_ID || 'unknown'}">
                <div class="order-card-header">
                    <span class="order-id">ORD-${(order.Order_ID || 0).toString().padStart(4, '0')}</span>
                    <span class="order-amount">Error</span>
                </div>
                <div class="order-card-body">
                    <div class="customer-name">Error loading order</div>
                    <div class="text-danger small">${error.message || 'Unknown error'}</div>
                </div>
            </div>
        `;
    }
}

// Render orders to HTML - grouped by date (order date or preferred date)
// orderType: 'delivery' or 'pickup' - for calendar jump targeting
async function renderOrdersToHtml(orders, sortBy, orderType) {
    if (orders.length === 0) return '';
    const groups = sortBy === 'preferred_date' ? groupOrdersByPreferredDate(orders) : groupOrdersByOrderDate(orders);
    const parts = [];
    for (const g of groups) {
        const cardPromises = g.orders.map(order => createOrderCard(order));
        const cardHtmls = await Promise.all(cardPromises);
        const headerHtml = typeof g.dateLabel === 'object'
            ? `${escapeHtml(g.dateLabel.month)} ${escapeHtml(g.dateLabel.dayYear)}`
            : escapeHtml(g.dateLabel);
        let attrs = (sortBy === 'preferred_date' && g.dateKey && g.dateKey !== '__no_date__') ? ` data-preferred-date="${escapeHtml(g.dateKey)}"` : '';
        if (orderType) attrs += ` data-order-type="${escapeHtml(orderType)}"`;
        parts.push(`<div class="order-date-group"${attrs}><div class="order-date-group-header">${headerHtml}</div><div class="order-date-group-cards">${cardHtmls.join('')}</div></div>`);
    }
    return parts.join('');
}

// Escape HTML to prevent XSS
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

// Track last known order IDs to detect new orders
let lastKnownOrderIds = new Set();
let isInitialLoad = true;

// Load orders
async function loadOrders() {
    try {
        const response = await fetch('../api/get_orders.php', {
            method: 'GET',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.orders) {
            // Get current order IDs
            const currentOrderIds = new Set(data.orders.map(order => order.Order_ID));
            
            // Detect new orders (only after initial load)
            if (!isInitialLoad) {
                const newOrderIds = [];
                currentOrderIds.forEach(orderId => {
                    if (!lastKnownOrderIds.has(orderId)) {
                        newOrderIds.push(orderId);
                    }
                });
                
                // Show notification if new orders detected
                if (newOrderIds.length > 0) {
                    const newOrders = data.orders.filter(order => newOrderIds.includes(order.Order_ID));
                    const customerNames = newOrders.map(order => order.customer_name || 'Unknown').join(', ');
                    const orderCount = newOrderIds.length;
                    
                    // Show popup notification
                    if (typeof AdminNotifications !== 'undefined') {
                        AdminNotifications.info(
                            `${orderCount} new order${orderCount > 1 ? 's' : ''} received! ${orderCount > 1 ? 'Customers' : 'Customer'}: ${customerNames}`,
                            {
                                title: 'New Order Alert',
                                duration: 8000,
                                showProgress: true
                            }
                        );
                    }
                }
            } else {
                // Mark initial load as complete
                isInitialLoad = false;
            }
            
            // Update last known order IDs
            lastKnownOrderIds = currentOrderIds;
            
            // Categorize orders by delivery method (Delivery vs Pick Up)
            const deliveryOrdersPlaced = [];      // Waiting Payment, Pending Approval
            const deliveryOrdersPreparing = [];   // Processing or Ready (not yet out/delivered)
            const deliveryOrdersOutForDelivery = []; // Ready + Delivery_Status Out for Delivery
            const deliveryOrdersComplete = [];    // Ready + Delivery_Status Delivered
            const pickupOrdersPlaced = [];     // Waiting Payment, Pending Approval
            const pickupOrdersPreparing = [];  // Processing
            const pickupOrdersReady = [];      // Ready (ready for customer to pick up)
            const pickupOrdersCompleted = [];  // Rejected, Completed
            
            data.orders.forEach(order => {
                const status = order.status || 'Processing';
                const effectiveStatus = status === 'Pending Approval' ? 'Waiting Payment' : status;
                const deliveryMethod = (order.delivery_method || 'Standard Delivery').trim();
                const deliveryStatusRaw = order.Delivery_Status || order.delivery_status || 'Pending';
                const deliveryStatus = normalizeDeliveryStatus(deliveryStatusRaw);
                const isPickUp = deliveryMethod === 'Pick Up';
                
                if (isPickUp) {
                    if (effectiveStatus === 'Waiting Payment' || effectiveStatus === 'Pending Approval') {
                        pickupOrdersPlaced.push(order);
                    } else if (effectiveStatus === 'Processing' || effectiveStatus === 'Being Processed') {
                        pickupOrdersPreparing.push(order);
                    } else if (effectiveStatus === 'Ready') {
                        pickupOrdersReady.push(order);
                    } else if (effectiveStatus === 'Completed' || effectiveStatus === 'Rejected') {
                        pickupOrdersCompleted.push(order);
                    } else {
                        pickupOrdersCompleted.push(order);
                    }
                } else {
                    if (effectiveStatus === 'Waiting Payment' || effectiveStatus === 'Pending Approval') {
                        deliveryOrdersPlaced.push(order);
                    } else if (effectiveStatus === 'Ready' && deliveryStatus === 'Out for Delivery') {
                        deliveryOrdersOutForDelivery.push(order);
                    } else if (effectiveStatus === 'Ready' && deliveryStatus === 'Delivered') {
                        deliveryOrdersComplete.push(order);
                    } else {
                        deliveryOrdersPreparing.push(order);
                    }
                }
            });
            
            // Sort orders by selected criteria (order_date or preferred_date / availability_date)
            const sortDelivery = document.getElementById('sortOrdersDelivery');
            const sortPickup = document.getElementById('sortOrdersPickup');
            const sortBy = (sortDelivery && sortDelivery.value) || (sortPickup && sortPickup.value) || 'order_date';
            const sortKey = sortBy === 'preferred_date' ? 'availability_date' : 'order_date';
            const sortOrders = (arr) => {
                return [...arr].sort((a, b) => {
                    const dateA = a[sortKey] ? new Date(a[sortKey]).getTime() : 0;
                    const dateB = b[sortKey] ? new Date(b[sortKey]).getTime() : 0;
                    return dateA - dateB; // Ascending (earliest first)
                });
            };
            
            const sortedDeliveryPlaced = sortOrders(deliveryOrdersPlaced);
            const sortedDeliveryPreparing = sortOrders(deliveryOrdersPreparing);
            const sortedDeliveryOutForDelivery = sortOrders(deliveryOrdersOutForDelivery);
            const sortedDeliveryComplete = sortOrders(deliveryOrdersComplete);
            const sortedPickupPlaced = sortOrders(pickupOrdersPlaced);
            const sortedPickupPreparing = sortOrders(pickupOrdersPreparing);
            const sortedPickupReady = sortOrders(pickupOrdersReady);
            const sortedPickupCompleted = sortOrders(pickupOrdersCompleted);
            
            // Get tab card containers
            const deliveryOrdersPlacedCards = document.getElementById('deliveryOrdersPlacedCards');
            const deliveryOrdersPreparingCards = document.getElementById('deliveryOrdersPreparingCards');
            const deliveryOrdersOutForDeliveryCards = document.getElementById('deliveryOrdersOutForDeliveryCards');
            const deliveryOrdersCompleteCards = document.getElementById('deliveryOrdersCompleteCards');
            const pickupOrdersPlacedCards = document.getElementById('pickupOrdersPlacedCards');
            const pickupOrdersPreparingCards = document.getElementById('pickupOrdersPreparingCards');
            const pickupOrdersReadyCards = document.getElementById('pickupOrdersReadyCards');
            const pickupOrdersCompletedCards = document.getElementById('pickupOrdersCompletedCards');
            
            // Display delivery orders in secondary tab containers
            if (sortedDeliveryPlaced.length === 0 && deliveryOrdersPlacedCards) {
                deliveryOrdersPlacedCards.innerHTML = '<div class="text-center py-5"><p class="text-muted">No orders placed yet</p></div>';
            } else if (deliveryOrdersPlacedCards) {
                deliveryOrdersPlacedCards.innerHTML = await renderOrdersToHtml(sortedDeliveryPlaced, sortBy, 'delivery');
            }
            
            if (sortedDeliveryPreparing.length === 0 && deliveryOrdersPreparingCards) {
                deliveryOrdersPreparingCards.innerHTML = '<div class="text-center py-5"><p class="text-muted">No preparing orders</p></div>';
            } else if (deliveryOrdersPreparingCards) {
                deliveryOrdersPreparingCards.innerHTML = await renderOrdersToHtml(sortedDeliveryPreparing, sortBy, 'delivery');
            }
            
            if (sortedDeliveryOutForDelivery.length === 0 && deliveryOrdersOutForDeliveryCards) {
                deliveryOrdersOutForDeliveryCards.innerHTML = '<div class="text-center py-5"><p class="text-muted">No orders out for delivery</p></div>';
            } else if (deliveryOrdersOutForDeliveryCards) {
                deliveryOrdersOutForDeliveryCards.innerHTML = await renderOrdersToHtml(sortedDeliveryOutForDelivery, sortBy, 'delivery');
            }
            
            if (sortedDeliveryComplete.length === 0 && deliveryOrdersCompleteCards) {
                deliveryOrdersCompleteCards.innerHTML = '<div class="text-center py-5"><p class="text-muted">No completed deliveries</p></div>';
            } else if (deliveryOrdersCompleteCards) {
                deliveryOrdersCompleteCards.innerHTML = await renderOrdersToHtml(sortedDeliveryComplete, sortBy, 'delivery');
            }
            
            // Display pickup orders in secondary tab containers
            if (sortedPickupPlaced.length === 0 && pickupOrdersPlacedCards) {
                pickupOrdersPlacedCards.innerHTML = '<div class="text-center py-5"><p class="text-muted">No orders placed yet</p></div>';
            } else if (pickupOrdersPlacedCards) {
                pickupOrdersPlacedCards.innerHTML = await renderOrdersToHtml(sortedPickupPlaced, sortBy, 'pickup');
            }
            
            if (sortedPickupPreparing.length === 0 && pickupOrdersPreparingCards) {
                pickupOrdersPreparingCards.innerHTML = '<div class="text-center py-5"><p class="text-muted">No preparing orders</p></div>';
            } else if (pickupOrdersPreparingCards) {
                pickupOrdersPreparingCards.innerHTML = await renderOrdersToHtml(sortedPickupPreparing, sortBy, 'pickup');
            }
            
            if (sortedPickupReady.length === 0 && pickupOrdersReadyCards) {
                pickupOrdersReadyCards.innerHTML = '<div class="text-center py-5"><p class="text-muted">No orders ready for pick up</p></div>';
            } else if (pickupOrdersReadyCards) {
                pickupOrdersReadyCards.innerHTML = await renderOrdersToHtml(sortedPickupReady, sortBy, 'pickup');
            }
            
            if (sortedPickupCompleted.length === 0 && pickupOrdersCompletedCards) {
                pickupOrdersCompletedCards.innerHTML = '<div class="text-center py-5"><p class="text-muted">No completed pick ups</p></div>';
            } else if (pickupOrdersCompletedCards) {
                pickupOrdersCompletedCards.innerHTML = await renderOrdersToHtml(sortedPickupCompleted, sortBy, 'pickup');
            }
            
            // Update tab counts
            const deliveryOrdersCountEl = document.getElementById('deliveryOrdersCount');
            const pickupOrdersCountEl = document.getElementById('pickupOrdersCount');
            const deliveryOrdersPlacedCountEl = document.getElementById('deliveryOrdersPlacedCount');
            const deliveryOrdersPreparingCountEl = document.getElementById('deliveryOrdersPreparingCount');
            const deliveryOrdersOutForDeliveryCountEl = document.getElementById('deliveryOrdersOutForDeliveryCount');
            const deliveryOrdersCompleteCountEl = document.getElementById('deliveryOrdersCompleteCount');
            const pickupOrdersPlacedCountEl = document.getElementById('pickupOrdersPlacedCount');
            const pickupOrdersPreparingCountEl = document.getElementById('pickupOrdersPreparingCount');
            const pickupOrdersReadyCountEl = document.getElementById('pickupOrdersReadyCount');
            const pickupOrdersCompletedCountEl = document.getElementById('pickupOrdersCompletedCount');
            
            if (deliveryOrdersCountEl) deliveryOrdersCountEl.textContent = deliveryOrdersPlaced.length + deliveryOrdersPreparing.length + deliveryOrdersOutForDelivery.length + deliveryOrdersComplete.length;
            if (pickupOrdersCountEl) pickupOrdersCountEl.textContent = pickupOrdersPlaced.length + pickupOrdersPreparing.length + pickupOrdersReady.length + pickupOrdersCompleted.length;
            if (deliveryOrdersPlacedCountEl) deliveryOrdersPlacedCountEl.textContent = deliveryOrdersPlaced.length;
            if (deliveryOrdersPreparingCountEl) deliveryOrdersPreparingCountEl.textContent = deliveryOrdersPreparing.length;
            if (deliveryOrdersOutForDeliveryCountEl) deliveryOrdersOutForDeliveryCountEl.textContent = deliveryOrdersOutForDelivery.length;
            if (deliveryOrdersCompleteCountEl) deliveryOrdersCompleteCountEl.textContent = deliveryOrdersComplete.length;
            if (pickupOrdersPlacedCountEl) pickupOrdersPlacedCountEl.textContent = pickupOrdersPlaced.length;
            if (pickupOrdersPreparingCountEl) pickupOrdersPreparingCountEl.textContent = pickupOrdersPreparing.length;
            if (pickupOrdersReadyCountEl) pickupOrdersReadyCountEl.textContent = pickupOrdersReady.length;
            if (pickupOrdersCompletedCountEl) pickupOrdersCompletedCountEl.textContent = pickupOrdersCompleted.length;
            
            // Ensure event delegation is setup after adding cards
            if (!eventDelegationSetup) {
                setupEventDelegation();
            }
            
            // Update statistics
            updateStatistics(data.orders);

            // Re-apply search filter if user had typed in the search box
            if (typeof window.reapplyOrdersSearch === 'function') {
                window.reapplyOrdersSearch();
            }
        } else {
            // Silently handle failed load
        }
    } catch (error) {
        console.error('[Load Orders] Error loading orders:', error);
        const errorMessage = '<div class="text-center py-5"><p class="text-danger">Error loading orders. Please refresh the page.</p><p class="text-muted small">' + (error.message || 'Unknown error') + '</p></div>';
        const deliveryOrdersPlacedCards = document.getElementById('deliveryOrdersPlacedCards');
        const deliveryOrdersPreparingCards = document.getElementById('deliveryOrdersPreparingCards');
        const deliveryOrdersOutForDeliveryCards = document.getElementById('deliveryOrdersOutForDeliveryCards');
        const deliveryOrdersCompleteCards = document.getElementById('deliveryOrdersCompleteCards');
        const pickupOrdersPlacedCards = document.getElementById('pickupOrdersPlacedCards');
        const pickupOrdersPreparingCards = document.getElementById('pickupOrdersPreparingCards');
        const pickupOrdersReadyCards = document.getElementById('pickupOrdersReadyCards');
        const pickupOrdersCompletedCards = document.getElementById('pickupOrdersCompletedCards');
        if (deliveryOrdersPlacedCards) deliveryOrdersPlacedCards.innerHTML = errorMessage;
        if (deliveryOrdersPreparingCards) deliveryOrdersPreparingCards.innerHTML = errorMessage;
        if (deliveryOrdersOutForDeliveryCards) deliveryOrdersOutForDeliveryCards.innerHTML = errorMessage;
        if (deliveryOrdersCompleteCards) deliveryOrdersCompleteCards.innerHTML = errorMessage;
        if (pickupOrdersPlacedCards) pickupOrdersPlacedCards.innerHTML = errorMessage;
        if (pickupOrdersPreparingCards) pickupOrdersPreparingCards.innerHTML = errorMessage;
        if (pickupOrdersReadyCards) pickupOrdersReadyCards.innerHTML = errorMessage;
        if (pickupOrdersCompletedCards) pickupOrdersCompletedCards.innerHTML = errorMessage;
    }
}

// Update statistics
function updateStatistics(orders) {
    const totalOrders = orders.length;
    
    // In Progress: Processing, Waiting Payment, Pending Approval
    const inProgress = orders.filter(o => {
        const status = (o.status || '').trim();
        return status === 'Processing' || status === 'Being Processed' ||
               status === 'Waiting Payment' || status === 'Pending Approval';
    }).length;
    
    // Completed: Ready orders
    const completed = orders.filter(o => {
        const status = (o.status || '').trim();
        return status === 'Ready' || status === 'Completed';
    }).length;
    
    const totalOrdersEl = document.getElementById('totalOrders');
    const inProgressEl = document.getElementById('inProgress');
    const completedEl = document.getElementById('completed');
    
    if (totalOrdersEl) totalOrdersEl.textContent = totalOrders;
    if (inProgressEl) inProgressEl.textContent = inProgress;
    if (completedEl) completedEl.textContent = completed;
}

// Update payment status
async function updatePaymentStatus(orderId, paymentStatus) {
    
    // Check if order is approved (not pending approval or rejected)
    const row = document.querySelector(`tr[data-order-id="${orderId}"]`);
    if (row) {
        const paymentDropdown = row.querySelector('.payment-dropdown');
        if (paymentDropdown && paymentDropdown.disabled) {
            if (window.AdminNotifications) {
                AdminNotifications.warning('Cannot update payment status. Order must be approved first.', { duration: 4000 });
            }
            return;
        }
    }
    
    // Get the dropdown element to store previous value
    const dropdown = document.querySelector(`.payment-dropdown[data-order-id="${orderId}"]`);
    const previousValue = dropdown ? dropdown.value : null;
    
    const confirmed = await AdminNotifications.confirm(
        `Change payment status to "${paymentStatus}"?`,
        {
            title: 'Change Payment Status',
            confirmText: 'Change',
            cancelText: 'Cancel'
        }
    );
    
    if (!confirmed) {
        // Reset dropdown to previous value
        if (dropdown && previousValue) {
            dropdown.value = previousValue;
        }
        return;
    }
    
    try {
        const response = await fetch('../api/update_payment_status.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                order_id: parseInt(orderId),
                payment_status: paymentStatus
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            // Payment status updated successfully
            if (window.AdminNotifications) {
                AdminNotifications.success('Payment status updated successfully!', { duration: 3000 });
            }
            
            // Reload orders to reflect changes
            await loadOrders();
            
            // Trigger inventory update (works even if not on inventory page - function will check)
            setTimeout(() => {
                if (window.loadInventory) {
                    window.loadInventory();
                }
            }, 500);
        } else {
            const errorMessage = (data.message || 'Unknown error').replace(/https?:\/\/[^\s]+localhost[^\s]*/gi, '').replace(/localhost[^\s]*/gi, '');
            if (window.AdminNotifications) {
                AdminNotifications.error('Failed to update payment status: ' + errorMessage, { duration: 5000 });
            }
            // Reload to reset dropdown
            await loadOrders();
        }
    } catch (error) {
        if (window.AdminNotifications) {
            AdminNotifications.error('Failed to update payment status. Please try again.', { duration: 5000 });
        }
        // Reload to reset dropdown
        await loadOrders();
    }
}

// Track approval in progress to prevent double-clicks
let approvalInProgress = false;

// Approve order
async function approveOrder(orderId) {
    orderId = parseInt(orderId);
    
    // Prevent double-clicks
    if (approvalInProgress) {
        console.warn('Approval already in progress, ignoring duplicate request');
        if (typeof AdminNotifications !== 'undefined') {
            AdminNotifications.warning('Approval request already in progress. Please wait...', { duration: 3000 });
        }
        return;
    }
    
    if (!orderId || isNaN(orderId)) {
        if (typeof AdminNotifications !== 'undefined') {
            AdminNotifications.warning('Invalid order ID', { duration: 4000 });
        }
        return;
    }
    
    const confirmed = await AdminNotifications.confirm(
        `Approve order ORD-${orderId.toString().padStart(4, '0')}? The customer will be able to proceed with payment.`,
        {
            title: 'Approve Order',
            confirmText: 'Approve',
            cancelText: 'Cancel'
        }
    );
    
    if (!confirmed) {
        return;
    }
    
    // Set flag and disable buttons
    approvalInProgress = true;
    const approveButtons = document.querySelectorAll(`.approve-btn[onclick*="${orderId}"], .approve-order-btn[data-order-id="${orderId}"]`);
    approveButtons.forEach(btn => {
        btn.disabled = true;
        btn.style.opacity = '0.6';
        btn.style.cursor = 'not-allowed';
        const originalHTML = btn.innerHTML;
        btn.dataset.originalHTML = originalHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Approving...';
    });
    
    try {
        const response = await fetch('../api/approve_order.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            cache: 'no-cache',
            body: JSON.stringify({
                order_id: orderId
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            if (typeof AdminNotifications !== 'undefined') {
                AdminNotifications.success('Order approved successfully!', { duration: 3000 });
            }
            await loadOrders();
        } else {
            // Check if order was already approved (race condition)
            if (data.already_approved || (data.message && data.message.includes('not pending approval'))) {
                if (typeof AdminNotifications !== 'undefined') {
                    AdminNotifications.warning('Order was already approved. Refreshing list...', { duration: 3000 });
                }
                // Reload to get current status
                await loadOrders();
            } else {
                const errorMessage = (data.message || 'Unknown error').replace(/https?:\/\/[^\s]+localhost[^\s]*/gi, '').replace(/localhost[^\s]*/gi, '');
                if (typeof AdminNotifications !== 'undefined') {
                    AdminNotifications.error('Failed to approve order: ' + errorMessage, { duration: 5000 });
                }
            }
        }
    } catch (error) {
        console.error('Error approving order:', error);
        if (typeof AdminNotifications !== 'undefined') {
            AdminNotifications.error('Failed to approve order. Please try again.', { duration: 5000 });
        }
    } finally {
        // Re-enable buttons
        approvalInProgress = false;
        approveButtons.forEach(btn => {
            btn.disabled = false;
            btn.style.opacity = '';
            btn.style.cursor = '';
            if (btn.dataset.originalHTML) {
                btn.innerHTML = btn.dataset.originalHTML;
            }
        });
    }
}

// Reject order
// Set order as Ready for Delivery (updates delivery status to "Out for Delivery" and sends email)
// Show modal for driver and vehicle assignment (for order cards)
async function setReadyForDelivery(orderId) {
    if (!orderId) {
        console.error('[Ready for Delivery] Order ID is required');
        if (window.AdminNotifications) {
            AdminNotifications.error('Order ID not found. Please refresh the page.', { duration: 5000 });
        }
        return;
    }
    
    await showAssignDriverVehicleModalOrders(orderId);
}

// Show modal for driver and vehicle assignment (OrdersAdmin page)
async function showAssignDriverVehicleModalOrders(orderId) {
    const modal = document.getElementById('assignDriverVehicleModal');
    const driverSelect = document.getElementById('driverSelectOrders');
    const vehicleSelect = document.getElementById('vehicleSelectOrders');
    const assignError = document.getElementById('assignErrorOrders');
    const assignLoading = document.getElementById('assignLoadingOrders');
    
    if (!modal || !driverSelect || !vehicleSelect) {
        console.error('Assignment modal elements not found');
        return;
    }
    
    // Reset form
    assignError.style.display = 'none';
    assignError.textContent = '';
    driverSelect.innerHTML = '<option value="">Loading drivers...</option>';
    vehicleSelect.innerHTML = '<option value="">Loading vehicles...</option>';
    
    // Show modal
    $(modal).modal('show');
    
    // Load drivers and vehicles
    try {
        // Load drivers
        const driversResponse = await fetch('../api/get_delivery_drivers.php', {
            method: 'GET',
            credentials: 'include'
        });
        
        if (driversResponse.ok) {
            const driversData = await driversResponse.json();
            if (driversData.success && driversData.drivers) {
                driverSelect.innerHTML = '<option value="">Select a driver</option>';
                driversData.drivers.forEach(driver => {
                    const option = document.createElement('option');
                    option.value = driver.user_id;
                    option.textContent = `${driver.full_name}${driver.active_deliveries > 0 ? ` (${driver.active_deliveries} active)` : ' (Available)'}`;
                    driverSelect.appendChild(option);
                });
            } else {
                driverSelect.innerHTML = '<option value="">No drivers available</option>';
            }
        } else {
            driverSelect.innerHTML = '<option value="">Error loading drivers</option>';
        }
        
        // Load vehicles
        const vehiclesResponse = await fetch('../api/get_fleet.php', {
            method: 'GET',
            credentials: 'include'
        });
        
        if (vehiclesResponse.ok) {
            const vehiclesData = await vehiclesResponse.json();
            if (vehiclesData.success && vehiclesData.vehicles) {
                vehicleSelect.innerHTML = '<option value="">Select a vehicle</option>';
                vehiclesData.vehicles
                    .filter(vehicle => vehicle.status !== 'Unavailable')
                    .forEach(vehicle => {
                        const option = document.createElement('option');
                        option.value = vehicle.vehicle_id;
                        const statusText = vehicle.status === 'Available' ? 'Available' : vehicle.status;
                        const activeText = vehicle.active_deliveries > 0 ? ` (${vehicle.active_deliveries} active)` : '';
                        option.textContent = `${vehicle.vehicle_model} - ${statusText}${activeText}`;
                        vehicleSelect.appendChild(option);
                    });
            } else {
                vehicleSelect.innerHTML = '<option value="">No vehicles available</option>';
            }
        } else {
            vehicleSelect.innerHTML = '<option value="">Error loading vehicles</option>';
        }
    } catch (error) {
        console.error('Error loading drivers/vehicles:', error);
        assignError.textContent = 'Error loading drivers or vehicles. Please try again.';
        assignError.style.display = 'block';
    }
    
    // Setup confirm button
    const confirmBtn = document.getElementById('confirmAssignBtnOrders');
    if (confirmBtn) {
        // Remove any existing event listeners by cloning
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        
        newConfirmBtn.onclick = async function() {
            await handleDriverVehicleAssignmentOrders(orderId, driverSelect.value, vehicleSelect.value);
        };
    }
}

// Handle driver and vehicle assignment (OrdersAdmin page)
async function handleDriverVehicleAssignmentOrders(orderId, driverId, vehicleId) {
    const assignError = document.getElementById('assignErrorOrders');
    const assignLoading = document.getElementById('assignLoadingOrders');
    const confirmBtn = document.getElementById('confirmAssignBtnOrders');
    
    // Validate
    if (!driverId || !vehicleId) {
        assignError.textContent = 'Please select both a driver and a vehicle.';
        assignError.style.display = 'block';
        return;
    }
    
    // Show loading
    assignError.style.display = 'none';
    assignLoading.style.display = 'block';
    if (confirmBtn) confirmBtn.disabled = true;
    
    try {
        // First, get or create delivery record
        let deliveryId = null;
        const deliveryResponse = await fetch(`../api/get_delivery_by_order.php?order_id=${orderId}`, {
            method: 'GET',
            credentials: 'include'
        });
        
        if (deliveryResponse.ok) {
            const deliveryData = await deliveryResponse.json();
            if (deliveryData.success && deliveryData.delivery) {
                deliveryId = deliveryData.delivery.Delivery_ID;
            }
        }
        
        // If no delivery exists, update delivery status will create it
        // Update delivery status to "Out for Delivery" with driver assignment
        const statusResponse = await fetch('../api/update_delivery_status.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                order_id: orderId,
                delivery_id: deliveryId,
                status: 'Out for Delivery',
                driver_id: parseInt(driverId)
            })
        });
        
        const statusData = await statusResponse.json();
        
        if (!statusData.success) {
            throw new Error(statusData.message || 'Failed to update delivery status');
        }
        
        // Get the delivery ID from the response or use the one we found
        const finalDeliveryId = statusData.delivery_id || deliveryId;
        
        if (!finalDeliveryId) {
            throw new Error('Delivery ID not found after status update');
        }
        
        // Assign vehicle
        const vehicleResponse = await fetch('../api/assign_vehicle.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                delivery_id: finalDeliveryId,
                vehicle_id: parseInt(vehicleId)
            })
        });
        
        const vehicleData = await vehicleResponse.json();
        
        if (!vehicleData.success) {
            throw new Error(vehicleData.message || 'Failed to assign vehicle');
        }
        
        // Success - close modal and reload orders
        $('#assignDriverVehicleModal').modal('hide');
        
        if (window.AdminNotifications) {
            AdminNotifications.success('Driver and vehicle assigned successfully. Order is now Out for Delivery.', {
                duration: 5000
            });
        }
        
        // Reload orders to reflect the changes
        setTimeout(() => {
            loadOrders();
        }, 1000);
        
    } catch (error) {
        console.error('Error assigning driver/vehicle:', error);
        assignError.textContent = error.message || 'Failed to assign driver and vehicle. Please try again.';
        assignError.style.display = 'block';
    } finally {
        assignLoading.style.display = 'none';
        if (confirmBtn) confirmBtn.disabled = false;
    }
}

async function rejectOrder(orderId) {
    orderId = parseInt(orderId);
    
    if (!orderId || isNaN(orderId)) {
        if (window.AdminNotifications) {
            AdminNotifications.warning('Invalid order ID', { duration: 4000 });
        }
        return;
    }
    
    // Use custom prompt dialog for rejection reason
    const rejectionReason = await AdminNotifications.prompt(
        'Please provide a reason for rejecting this order (optional):',
        '',
        {
            title: 'Reject Order',
            placeholder: 'Enter rejection reason (optional)',
            confirmText: 'Continue',
            cancelText: 'Cancel'
        }
    );
    
    if (rejectionReason === null) {
        // User cancelled
        return;
    }
    
    // Use custom confirmation dialog
    const confirmed = await AdminNotifications.confirm(
        `Reject order ORD-${orderId.toString().padStart(4, '0')}? This action cannot be undone.`,
        {
            title: 'Confirm Rejection',
            confirmText: 'Reject',
            cancelText: 'Cancel',
            danger: true
        }
    );
    
    if (!confirmed) {
        return;
    }
    
    try {
        const response = await fetch('../api/reject_order.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                order_id: orderId,
                rejection_reason: rejectionReason || null
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            AdminNotifications.success('Order rejected successfully.', { duration: 3000 });
            await loadOrders();
        } else {
            AdminNotifications.error('Failed to reject order: ' + (data.message || 'Unknown error'), {
                details: data
            });
        }
    } catch (error) {
        AdminNotifications.error('Failed to reject order. Please try again.', {
            details: { error: error.message }
        });
    }
}

// Update order status
async function updateOrderStatus(orderId, newStatus) {
    // Ensure orderId is a number and newStatus is a string
    orderId = parseInt(orderId);
    newStatus = String(newStatus).trim();
    
    if (!orderId || !newStatus) {
        if (window.AdminNotifications) {
            AdminNotifications.warning('Invalid order ID or status', { duration: 4000 });
        }
        return;
    }
    
    // Check if order is approved (not pending approval or rejected)
    // We need to check the current order status from the table
    const row = document.querySelector(`tr[data-order-id="${orderId}"]`);
    if (row) {
        const statusDropdown = row.querySelector('.status-dropdown');
        if (statusDropdown && statusDropdown.disabled) {
            if (window.AdminNotifications) {
                AdminNotifications.warning('Cannot update status. Order must be approved first.', { duration: 4000 });
            }
            return;
        }
    }
    
    // Get the dropdown element to store previous value
    const dropdown = document.querySelector(`.status-dropdown[data-order-id="${orderId}"]`);
    const previousValue = dropdown ? dropdown.value : null;
    
    const confirmed = await AdminNotifications.confirm(
        `Change order status to "${newStatus}"?`,
        {
            title: 'Change Order Status',
            confirmText: 'Change',
            cancelText: 'Cancel'
        }
    );
    
    if (!confirmed) {
        // Reset dropdown to previous value
        if (dropdown && previousValue) {
            dropdown.value = previousValue;
        }
        return;
    }
    
    try {
        const requestBody = {
            order_id: orderId,
            status: newStatus
        };
        
        const response = await fetch('../api/update_order_status.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            // Filter out localhost URLs from error messages
            const cleanErrorText = errorText.replace(/https?:\/\/[^\s]+localhost[^\s]*/gi, '').replace(/localhost[^\s]*/gi, '');
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            // Show message with stock reduction info if applicable
            let message = 'Order status updated successfully!';
            if (data.stock_reduced) {
                message += '\n\nStock levels have been reduced for all products in this order.';
            }
            if (window.AdminNotifications) {
                AdminNotifications.success(message, { duration: 5000 });
            }
            
            // If status changed to Ready, switch to Ready tab
            if (newStatus === 'Ready') {
                // Switch to Ready tab
                $('.tab-btn').removeClass('active');
                $('.tab-content').removeClass('active');
                $('#ready-tab').addClass('active');
                $('#ready-content').addClass('active');
            }
            
            // Reload orders to reflect changes
            await loadOrders();
            
            // Trigger inventory update if stock was reduced (works even if not on inventory page)
            if (data.stock_reduced) {
                setTimeout(() => {
                    if (window.loadInventory) {
                        window.loadInventory();
                    }
                }, 1000);
            }
        } else {
            const errorMessage = (data.message || 'Unknown error').replace(/https?:\/\/[^\s]+localhost[^\s]*/gi, '').replace(/localhost[^\s]*/gi, '');
            if (window.AdminNotifications) {
                AdminNotifications.error('Failed to update order status: ' + errorMessage, { duration: 5000 });
            }
            // Reload to reset dropdown
            await loadOrders();
        }
    } catch (error) {
        if (window.AdminNotifications) {
            AdminNotifications.error('Failed to update order status. Please try again.', { duration: 5000 });
        }
        // Reload to reset dropdown
        await loadOrders();
    }
}

// Prepare Delivery order - moves from Orders Placed to Preparing Orders
async function prepareDeliveryOrder(orderId) {
    orderId = parseInt(orderId);
    if (!orderId || isNaN(orderId)) {
        if (window.AdminNotifications) {
            AdminNotifications.warning('Invalid order ID', { duration: 4000 });
        }
        return;
    }

    const confirmed = await AdminNotifications.confirm(
        'Prepare this order? It will move to Preparing Orders.',
        {
            title: 'Prepare Delivery Order',
            confirmText: 'Prepare',
            cancelText: 'Cancel'
        }
    );

    if (!confirmed) return;

    try {
        const response = await fetch('../api/update_order_status.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ order_id: orderId, status: 'Processing' })
        });

        const data = await response.json();

        if (data.success) {
            if (window.AdminNotifications) {
                AdminNotifications.success('Order moved to Preparing Orders.', { duration: 4000 });
            }
            $('.tab-btn').removeClass('active');
            $('.tab-content').removeClass('active');
            $('#delivery-orders-tab').addClass('active');
            $('#delivery-orders-content').addClass('active');
            $('#delivery-orders-content .delivery-sub-tab-btn').removeClass('active');
            $('#delivery-orders-content .delivery-sub-tab-content').removeClass('active');
            $('.delivery-sub-tab-btn[data-delivery-sub-tab="preparing-orders"]').addClass('active');
            $('#delivery-preparing-orders-content').addClass('active');
            await loadOrders();
        } else {
            const msg = (data.message || 'Failed to update order').replace(/https?:\/\/[^\s]+localhost[^\s]*/gi, '');
            if (window.AdminNotifications) {
                AdminNotifications.error(msg, { duration: 5000 });
            }
            await loadOrders();
        }
    } catch (error) {
        if (window.AdminNotifications) {
            AdminNotifications.error('Failed to prepare order. Please try again.', { duration: 5000 });
        }
        await loadOrders();
    }
}

// Mark Pick Up order as complete (customer has picked up)
async function completePickupOrder(orderId) {
    orderId = parseInt(orderId);
    if (!orderId || isNaN(orderId)) {
        if (window.AdminNotifications) {
            AdminNotifications.warning('Invalid order ID', { duration: 4000 });
        }
        return;
    }

    let confirmMessage = 'Mark this order as complete? Customer has picked up the order.';
    try {
        const res = await fetch(`../api/get_orders.php?order_id=${orderId}`, { method: 'GET', credentials: 'include' });
        if (res.ok) {
            const data = await res.json();
            const order = data.order || (data.orders && data.orders[0]);
            if (order) {
                const pm = String(order.payment_method || order.transaction_payment_method || '').toLowerCase();
                const isCashOnReceipt = pm.includes('cash on delivery') || pm === 'cod' || pm === 'on-site' || pm.includes('on site') || pm === 'onsite';
                const amount = order.amount != null ? parseFloat(order.amount) : NaN;
                if (isCashOnReceipt && !isNaN(amount) && amount > 0) {
                    const formatted = '₱' + amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    confirmMessage += '\n\nPlease collect cash: ' + formatted;
                }
            }
        }
    } catch (e) {
        console.warn('[Complete Pick Up] Could not fetch order for collect-cash check:', e);
    }

    const confirmed = await AdminNotifications.confirm(
        confirmMessage,
        {
            title: 'Order Complete',
            confirmText: 'Complete',
            cancelText: 'Cancel'
        }
    );

    if (!confirmed) return;

    try {
        const response = await fetch('../api/update_order_status.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ order_id: orderId, status: 'Completed' })
        });

        const data = await response.json();

        if (data.success) {
            if (window.AdminNotifications) {
                AdminNotifications.success('Order marked as complete. Moved to Completed Pick Up.', { duration: 4000 });
            }
            // Switch to Pick Up Orders > Completed Pick Up tab
            $('.tab-btn').removeClass('active');
            $('.tab-content').removeClass('active');
            $('#pickup-orders-tab').addClass('active');
            $('#pickup-orders-content').addClass('active');
            $('#pickup-orders-content .pickup-sub-tab-btn').removeClass('active');
            $('#pickup-orders-content .pickup-sub-tab-content').removeClass('active');
            $('.pickup-sub-tab-btn[data-pickup-sub-tab="completed-pickup"]').addClass('active');
            $('#pickup-completed-pickup-content').addClass('active');
            // Update URL so refresh keeps user on Completed Pick Up
            if (typeof history !== 'undefined' && history.replaceState) {
                const newUrl = window.location.pathname + '?tab=pickup-orders&subtab=completed-pickup';
                history.replaceState(null, '', newUrl);
            }
            await loadOrders();
        } else {
            const msg = (data.message || 'Failed to update order').replace(/https?:\/\/[^\s]+localhost[^\s]*/gi, '');
            if (window.AdminNotifications) {
                AdminNotifications.error(msg, { duration: 5000 });
            }
            await loadOrders();
        }
    } catch (error) {
        if (window.AdminNotifications) {
            AdminNotifications.error('Failed to complete order. Please try again.', { duration: 5000 });
        }
        await loadOrders();
    }
}

// Prepare Pick Up order - moves from Orders Placed to Preparing Orders
async function preparePickupOrder(orderId) {
    orderId = parseInt(orderId);
    if (!orderId || isNaN(orderId)) {
        if (window.AdminNotifications) {
            AdminNotifications.warning('Invalid order ID', { duration: 4000 });
        }
        return;
    }

    const confirmed = await AdminNotifications.confirm(
        'Prepare this order? It will move to Preparing Orders.',
        {
            title: 'Prepare Pick Up Order',
            confirmText: 'Prepare',
            cancelText: 'Cancel'
        }
    );

    if (!confirmed) return;

    try {
        const response = await fetch('../api/update_order_status.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ order_id: orderId, status: 'Processing' })
        });

        const data = await response.json();

        if (data.success) {
            if (window.AdminNotifications) {
                AdminNotifications.success('Order moved to Preparing Orders.', { duration: 4000 });
            }
            // Switch to Pick Up tab and Preparing Orders sub-tab
            $('.tab-btn').removeClass('active');
            $('.tab-content').removeClass('active');
            $('#pickup-orders-tab').addClass('active');
            $('#pickup-orders-content').addClass('active');
            $('#pickup-orders-content .pickup-sub-tab-btn').removeClass('active');
            $('#pickup-orders-content .pickup-sub-tab-content').removeClass('active');
            $('.pickup-sub-tab-btn[data-pickup-sub-tab="preparing-orders"]').addClass('active');
            $('#pickup-preparing-orders-content').addClass('active');
            await loadOrders();
        } else {
            const msg = (data.message || 'Failed to update order').replace(/https?:\/\/[^\s]+localhost[^\s]*/gi, '');
            if (window.AdminNotifications) {
                AdminNotifications.error(msg, { duration: 5000 });
            }
            await loadOrders();
        }
    } catch (error) {
        if (window.AdminNotifications) {
            AdminNotifications.error('Failed to prepare order. Please try again.', { duration: 5000 });
        }
        await loadOrders();
    }
}

// Download order (placeholder)
function downloadOrder(orderId) {
    if (window.AdminNotifications) {
        AdminNotifications.info(`Download order ${orderId} (Feature coming soon)`, {
            title: 'Download Order',
            duration: 4000
        });
    }
}

// Delete order
async function deleteOrder(orderId) {
    // Ensure orderId is a number
    orderId = parseInt(orderId);
    
    if (!orderId || isNaN(orderId)) {
        if (window.AdminNotifications) {
            AdminNotifications.warning('Invalid order ID', { duration: 4000 });
        }
        return;
    }
    
    // Use custom confirmation dialog
    const confirmed = await AdminNotifications.confirm(
        `Are you sure you want to delete order ORD-${orderId.toString().padStart(4, '0')}? This action cannot be undone.`,
        {
            title: 'Delete Order',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            danger: true
        }
    );
    
    if (!confirmed) {
        return;
    }
    
    try {
        const response = await fetch('../api/delete_order.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                order_id: orderId
            })
        });
        
        // Try to parse response
        let data;
        try {
            const responseText = await response.text();
            // Filter out localhost URLs from response
            const cleanResponseText = responseText.replace(/https?:\/\/[^\s]+localhost[^\s]*/gi, '').replace(/localhost[^\s]*/gi, '');
            data = JSON.parse(cleanResponseText || responseText);
        } catch (parseError) {
            throw new Error('Invalid response from server');
        }
        
        if (!response.ok) {
            throw new Error(data.message || `HTTP error! status: ${response.status}`);
        }
        
        if (data.success) {
            AdminNotifications.success('Order deleted successfully!', { duration: 3000 });
            
            // Reload orders to reflect changes
            await loadOrders();
        } else {
            throw new Error(data.message || 'Failed to delete order');
        }
    } catch (error) {
        AdminNotifications.error('Failed to delete order: ' + error.message, {
            details: { error: error.message }
        });
    }
}

// Setup event delegation for dropdowns (backup in case inline handlers don't work)
// NOTE: We're using event delegation as the PRIMARY method since inline handlers may not work reliably
let eventDelegationSetup = false;
function setupEventDelegation() {
    if (eventDelegationSetup) {
        return;
    }
    
    // Sort dropdowns (Delivery and Pick Up tabs) - sync and reload when sort changes
    const sortDelivery = document.getElementById('sortOrdersDelivery');
    const sortPickup = document.getElementById('sortOrdersPickup');
    const onSortChange = function() {
        const value = this.value;
        if (sortDelivery && sortDelivery !== this) sortDelivery.value = value;
        if (sortPickup && sortPickup !== this) sortPickup.value = value;
        loadOrders();
    };
    if (sortDelivery) sortDelivery.addEventListener('change', onSortChange);
    if (sortPickup) sortPickup.addEventListener('change', onSortChange);
    
    // Use event delegation for status dropdowns
    document.addEventListener('change', function(e) {
        if (e.target.classList.contains('status-dropdown')) {
            const orderId = parseInt(e.target.getAttribute('data-order-id'));
            const newStatus = e.target.value.trim();
            if (orderId && newStatus) {
                // Prevent inline handler from also firing
                e.stopImmediatePropagation();
                updateOrderStatus(orderId, newStatus);
            }
        }
        
        if (e.target.classList.contains('payment-dropdown')) {
            const orderId = parseInt(e.target.getAttribute('data-order-id'));
            const paymentStatus = e.target.value.trim();
            if (orderId && paymentStatus) {
                // Prevent inline handler from also firing
                e.stopImmediatePropagation();
                updatePaymentStatus(orderId, paymentStatus);
            }
        }
    });
    
    eventDelegationSetup = true;
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        setupEventDelegation();
        loadOrders();
    });
} else {
    setupEventDelegation();
    loadOrders();
}

// Auto-refresh every 15 seconds to detect new orders faster
setInterval(loadOrders, 15000);

// Export functions for global access
window.updatePaymentStatus = updatePaymentStatus;
window.updateOrderStatus = updateOrderStatus;
window.prepareDeliveryOrder = prepareDeliveryOrder;
window.preparePickupOrder = preparePickupOrder;
window.completePickupOrder = completePickupOrder;
window.downloadOrder = downloadOrder;
window.deleteOrder = deleteOrder;
window.loadOrders = loadOrders;
window.approveOrder = approveOrder;
window.rejectOrder = rejectOrder;
window.createOrderCard = createOrderCard;

// Scroll to orders for a given preferred date (used by calendar view)
// orderType: 'delivery' or 'pickup' - restricts search to that tab
function scrollToPreferredDate(dateStr, orderType) {
    const selector = orderType ? `[data-preferred-date="${dateStr}"][data-order-type="${orderType}"]` : `[data-preferred-date="${dateStr}"]`;
    const el = document.querySelector(selector);
    if (!el) return;
    const subTabContent = el.closest('.delivery-sub-tab-content, .pickup-sub-tab-content');
    if (subTabContent && subTabContent.classList && !subTabContent.classList.contains('active')) {
        const id = subTabContent.id || '';
        if (id.startsWith('delivery-')) {
            document.getElementById('delivery-orders-tab')?.click();
            const subTabMap = {
                'delivery-orders-placed-content': 'orders-placed',
                'delivery-preparing-orders-content': 'preparing-orders',
                'delivery-out-for-delivery-content': 'out-for-delivery',
                'delivery-complete-delivery-content': 'complete-delivery'
            };
            const subTab = subTabMap[id];
            if (subTab) document.querySelector(`[data-delivery-sub-tab="${subTab}"]`)?.click();
        } else if (id.startsWith('pickup-')) {
            document.getElementById('pickup-orders-tab')?.click();
            const subTabMap = {
                'pickup-orders-placed-content': 'orders-placed',
                'pickup-preparing-orders-content': 'preparing-orders',
                'pickup-ready-for-pickup-content': 'ready-for-pickup',
                'pickup-completed-pickup-content': 'completed-pickup'
            };
            const subTab = subTabMap[id];
            if (subTab) document.querySelector(`[data-pickup-sub-tab="${subTab}"]`)?.click();
        }
    }
    setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
}
window.scrollToPreferredDate = scrollToPreferredDate;

