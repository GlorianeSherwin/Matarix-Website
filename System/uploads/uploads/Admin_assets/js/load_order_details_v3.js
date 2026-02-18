/**
 * Load Order Details for Admin View
 * Loads order details from API based on order_id in URL
 * VERSION 3.0 - Fixed proof of payment display with escaped slash handling
 */

console.log('🚀🚀🚀 load_order_details.js VERSION 3.0 LOADED - Proof of Payment Feature Enabled 🚀🚀🚀');
console.log('🔵 VERSION CHECK: If you see this, the new version is loaded!');

// Use in-app notifications/confirmations (avoid browser "localhost says" popups)
function notify(type, message, options = {}) {
    if (window.AdminNotifications && typeof window.AdminNotifications[type] === 'function') {
        return window.AdminNotifications[type](message, options);
    }
    // Last-resort fallback: log only (avoid browser alerts).
    if (type === 'error') console.error(message);
    else if (type === 'warning') console.warn(message);
    else console.log(message);
    return null;
}

async function confirmDialog(message, options = {}) {
    if (window.AdminNotifications && typeof window.AdminNotifications.confirm === 'function') {
        return await window.AdminNotifications.confirm(message, options);
    }
    // If confirmations UI isn't available, fail closed.
    return false;
}

// Get app base URL (handles root and subdirectory deployments, e.g. matarix.store/ or matarix.store/MatarixWEB/)
function getAppBaseUrl() {
    const path = window.location.pathname || '';
    const parts = path.split('/').filter(Boolean);
    const adminIdx = parts.indexOf('Admin');
    if (adminIdx > 0) {
        const basePath = '/' + parts.slice(0, adminIdx).join('/') + '/';
        return window.location.origin + basePath;
    }
    return window.location.origin + '/';
}

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

// Format time
function formatTime(timeString) {
    if (!timeString) return 'N/A';
    
    // Handle time-only strings (HH:MM:SS or HH:MM)
    // Check if it's a time-only format (contains : but no date parts)
    if (timeString.includes(':') && !timeString.includes('T') && !timeString.includes(' ') && !timeString.includes('-')) {
        const timeParts = timeString.split(':');
        if (timeParts.length >= 2) {
            const hour = parseInt(timeParts[0], 10);
            const minutes = timeParts[1];
            if (!isNaN(hour) && hour >= 0 && hour <= 23) {
                const ampm = hour >= 12 ? 'PM' : 'AM';
                const displayHour = hour % 12 || 12;
                return `${displayHour}:${minutes} ${ampm}`;
            }
        }
    }
    
    // Handle full datetime strings
    try {
        const date = new Date(timeString);
        if (isNaN(date.getTime())) {
            // If date parsing fails, try to extract time from the string
            const timeMatch = timeString.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
            if (timeMatch) {
                const hour = parseInt(timeMatch[1], 10);
                const minutes = timeMatch[2];
                const ampm = hour >= 12 ? 'PM' : 'AM';
                const displayHour = hour % 12 || 12;
                return `${displayHour}:${minutes} ${ampm}`;
            }
            return 'N/A';
        }
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    } catch (error) {
        console.error('Error formatting time:', timeString, error);
        return 'N/A';
    }
}

// Load order details on page load
async function loadOrderDetails() {
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('order_id');
    
    if (!orderId) {
        console.error('No order_id in URL');
        notify('warning', 'No order ID provided. Redirecting to Orders page...', { duration: 3000 });
        setTimeout(() => {
            window.location.href = 'OrdersAdmin.html';
        }, 600);
        return;
    }
    
    // Set View Receipt link href and click handler immediately so it works before order fetch completes
    const viewReceiptLinkEarly = document.querySelector('.view-receipt-link');
    if (viewReceiptLinkEarly) {
        const receiptUrl = `ViewReceipt.html?order_id=${orderId}`;
        viewReceiptLinkEarly.href = receiptUrl;
        viewReceiptLinkEarly.setAttribute('href', receiptUrl);
        viewReceiptLinkEarly.onclick = function(e) {
            e.preventDefault();
            window.location.href = receiptUrl;
            return false;
        };
    }
    
    console.log(`[Order Details] Loading order: ${orderId}`);
    
    try {
        console.log(`[Order Details] Fetching order ${orderId} from: ../api/get_orders.php`);
        
        // Create AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        let response;
        try {
            response = await fetch(`../api/get_orders.php?order_id=${orderId}`, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json'
                },
                signal: controller.signal
            });
            clearTimeout(timeoutId);
        } catch (error) {
            clearTimeout(timeoutId);
            console.error('[Order Details] Fetch error:', error);
            if (error.name === 'AbortError') {
                throw new Error('Request timeout: Server took too long to respond. Please try again.');
            } else if (error.message.includes('Failed to fetch')) {
                throw new Error('Network error: Unable to connect to server. Please check if the server is running and try again.');
            } else {
                throw new Error(`Network error: ${error.message || 'Failed to connect to server'}`);
            }
        }
        
        console.log(`[Order Details] Response status: ${response.status} ${response.statusText}`);
        
        // Check if response has content
        const contentType = response.headers.get('content-type') || '';
        console.log(`[Order Details] Response content-type: ${contentType}`);
        
        if (!response.ok) {
            // Try to parse error response
            let errorData;
            try {
                const text = await response.text();
                errorData = text ? JSON.parse(text) : { message: `HTTP ${response.status} Error` };
            } catch (e) {
                errorData = { message: `HTTP ${response.status} Error: ${response.statusText || 'Unknown error'}` };
            }
            
            if (response.status === 401) {
                notify('error', 'Please log in to view order details.', { duration: 4000 });
                setTimeout(() => {
                    window.location.href = '../Customer/Login.html';
                }, 600);
                return;
            } else if (response.status === 403) {
                const errorMsg = errorData.details || errorData.message || 'You do not have permission to view this order.';
                notify('error', errorMsg, { duration: 5000 });
                setTimeout(() => {
                    window.location.href = 'DeliveriesAdmin.html';
                }, 2000);
                return;
            } else if (response.status === 404) {
                notify('warning', 'Order not found. Redirecting to Orders page...', { duration: 4000 });
                setTimeout(() => {
                    window.location.href = 'OrdersAdmin.html';
                }, 600);
                return;
            }
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        
        // Check if response is actually JSON
        if (!contentType.includes('application/json')) {
            const text = await response.text();
            console.error('[Order Details] Non-JSON response:', text.substring(0, 200));
            throw new Error('Server returned non-JSON response. Please check server logs.');
        }
        
        const data = await response.json();
        console.log('[Order Details] API Response:', data);
        
        if (data.success && data.order) {
            console.log('🔴🔴🔴 ABOUT TO CALL displayOrderDetails - THIS IS VERSION 3.0 🔴🔴🔴');
            displayOrderDetails(data.order);
        } else {
            console.error('Failed to load order:', data.message);
            notify('error', 'Failed to load order details: ' + (data.message || 'Unknown error'), { duration: 7000 });
        }
    } catch (error) {
        console.error('Error loading order details:', error);
        // Provide more specific error message
        const errorMsg = error.message || 'Unknown error';
        if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError')) {
            notify('error', 'Network error: Unable to connect to server. Please check your connection and try again.', { duration: 7000 });
        } else {
            notify('error', 'Error loading order details: ' + errorMsg, { duration: 7000 });
        }
    }
}

// Display order details
function displayOrderDetails(order) {
    console.log('🔵🔵🔵 [Order Details] FUNCTION CALLED - displayOrderDetails VERSION 3.0 🔵🔵🔵');
    console.log('[Order Details] Displaying order:', order);
    console.log('[Order Details] Order proof_of_payment field (RAW):', order.proof_of_payment);
    console.log('[Order Details] Order payment_method field:', order.payment_method);
    console.log('[Order Details] Order transaction_payment_method field:', order.transaction_payment_method);
    console.log('[Order Details] All order keys:', Object.keys(order));
    
    // Update customer information
    const customerName = order.First_Name && order.Last_Name 
        ? `${order.First_Name} ${order.Last_Name}`.trim()
        : order.email || 'Unknown Customer';
    
    const customerNameEl = document.querySelector('.customer-name');
    if (customerNameEl) {
        // Set customer name (View Profile button removed)
        customerNameEl.textContent = customerName;
    }
    
    const customerAddressEl = document.querySelector('.customer-address');
    if (customerAddressEl) {
        customerAddressEl.textContent = order.address || 'No address provided';
    }
    
    const customerPhoneEl = document.querySelector('.customer-phone');
    if (customerPhoneEl) {
        customerPhoneEl.textContent = order.Phone_Number || 'No phone number';
    }
    
    // Determine order status early - needed for payment method display logic
    const orderStatus = order.status || 'Pending Approval';
    const isPendingApproval = orderStatus === 'Pending Approval';
    const isRejected = orderStatus === 'Rejected';
    const isApproved = !isPendingApproval && !isRejected;
    const isWaitingForPayment = orderStatus === 'Waiting Payment';
    
    // Update delivery method
    const deliveryMethodEl = document.querySelector('#deliveryMethodText');
    if (deliveryMethodEl) {
        const deliveryMethod = order.delivery_method || 'Standard Delivery';
        deliveryMethodEl.textContent = deliveryMethod;
        
        // Update icon based on delivery method
        const deliveryMethodContainer = document.querySelector('.delivery-method');
        if (deliveryMethodContainer) {
            const icon = deliveryMethodContainer.querySelector('i');
            if (icon) {
                if (deliveryMethod === 'Pick Up') {
                    icon.className = 'fas fa-store mr-2';
                } else {
                    icon.className = 'fas fa-truck mr-2';
                }
            }
        }
    }
    
    // Update payment method details (only show if customer has selected a payment method)
    const paymentMethodDetailEl = document.querySelector('#paymentMethodDetail');
    const paymentMethodTextEl = document.querySelector('#paymentMethodText');
    
    // Get payment method - use the same logic as the payment section
    // For pending approval or rejected orders, don't show payment method
    // IMPORTANT: Only show payment method if customer has actually selected it
    // For "Waiting Payment" orders, only use order.payment_method (set by process_payment.php)
    // Don't use transaction_payment_method as fallback for "Waiting Payment" as it may contain old data
    let displayPaymentMethod = null;
    if (!isPendingApproval && !isRejected) {
        const orderPaymentMethod = order.payment_method;
        const transactionPaymentMethod = order.transaction_payment_method;
        
        // For "Waiting Payment" orders, only show if order.payment_method is set (customer selected it)
        // Also verify that the order was actually approved (has approved_at timestamp)
        // This ensures we don't show payment method from old/test data
        if (isWaitingForPayment) {
            // Only use order.payment_method - don't fall back to transaction_payment_method
            // Also check if order was approved (has approved_at) to ensure proper flow
            const isOrderApproved = order.approved_at && order.approved_at !== null && order.approved_at !== '';
            if (isOrderApproved && orderPaymentMethod && 
                typeof orderPaymentMethod === 'string' &&
                orderPaymentMethod.trim() !== '' &&
                orderPaymentMethod !== 'null' && 
                orderPaymentMethod !== 'NULL') {
                displayPaymentMethod = orderPaymentMethod;
            }
        } else {
            // For other statuses (Processing, Ready), check payment_method first, then fall back to transaction_payment_method
            if (orderPaymentMethod && 
                typeof orderPaymentMethod === 'string' &&
                orderPaymentMethod.trim() !== '' &&
                orderPaymentMethod !== 'null' && 
                orderPaymentMethod !== 'NULL') {
                displayPaymentMethod = orderPaymentMethod;
            } 
            // Only fall back to transaction_payment_method for non-Waiting Payment orders
            else if (transactionPaymentMethod && 
                     typeof transactionPaymentMethod === 'string' &&
                     transactionPaymentMethod.trim() !== '' &&
                     transactionPaymentMethod !== 'null' && 
                     transactionPaymentMethod !== 'NULL') {
                displayPaymentMethod = transactionPaymentMethod;
            }
        }
    }
    
    if (paymentMethodDetailEl && paymentMethodTextEl) {
        if (displayPaymentMethod) {
            // Show payment method details
            paymentMethodTextEl.textContent = displayPaymentMethod;
            
            // Update icon based on payment method
            const paymentMethodContainer = paymentMethodDetailEl;
            const icon = paymentMethodContainer.querySelector('i');
            if (icon) {
                if (displayPaymentMethod.toLowerCase() === 'gcash') {
                    icon.className = 'fas fa-mobile-alt mr-2';
                } else if (displayPaymentMethod.toLowerCase() === 'on-site' || displayPaymentMethod.toLowerCase() === 'on site') {
                    icon.className = 'fas fa-money-bill-wave mr-2';
                } else {
                    icon.className = 'fas fa-credit-card mr-2';
                }
            }
            
            paymentMethodDetailEl.style.display = 'block';
        } else {
            // Hide payment method details if no payment method selected
            paymentMethodDetailEl.style.display = 'none';
        }
    }
    
    // Update customer availability (delivery date only - time no longer used)
    const deliveryDateEl = document.querySelector('.delivery-date');
    
    if (order.availability_date) {
        if (deliveryDateEl) {
            deliveryDateEl.textContent = formatDate(order.availability_date);
        }
    } else {
        if (deliveryDateEl) {
            deliveryDateEl.textContent = 'Not specified';
        }
    }
    
    // Update order info text (Order Status, Payment Status, Delivery Status, Delivery Fee)
    const orderStatusEl = document.getElementById('orderStatusText');
    if (orderStatusEl) {
        orderStatusEl.textContent = order.status || 'Pending Approval';
    }
    const paymentStatusEl = document.getElementById('paymentStatusText');
    if (paymentStatusEl) {
        paymentStatusEl.textContent = order.payment || 'To Pay';
    }
    const deliveryStatusEl = document.getElementById('deliveryStatusText');
    if (deliveryStatusEl) {
        const rawStatus = order.Delivery_Status || 'Pending';
        const normalized = rawStatus.toLowerCase().replace(/\s+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        deliveryStatusEl.textContent = normalized;
    }
    // Delivery fee - fetch from API for Standard Delivery, show Free for Pick Up
    const deliveryFeeEl = document.getElementById('deliveryFeeText');
    if (deliveryFeeEl) {
        const deliveryMethod = order.delivery_method || 'Standard Delivery';
        if (deliveryMethod === 'Pick Up') {
            deliveryFeeEl.textContent = 'Free';
        } else {
            const address = order.address || '';
            if (address) {
                fetch(`../api/calculate_delivery_fee.php?address=${encodeURIComponent(address)}`, { credentials: 'include' })
                    .then(r => r.json())
                    .then(feeData => {
                        if (feeData.success && feeData.delivery_fee !== undefined) {
                            const fee = parseFloat(feeData.delivery_fee) || 0;
                            deliveryFeeEl.textContent = fee <= 0 ? 'Free' : formatPrice(fee);
                        } else {
                            deliveryFeeEl.textContent = '—';
                        }
                    })
                    .catch(() => { deliveryFeeEl.textContent = '—'; });
            } else {
                deliveryFeeEl.textContent = '—';
            }
        }
    }
    
    // Update order items table
    const orderItemsTableBody = document.querySelector('#orderItemsTable tbody');
    if (orderItemsTableBody && order.items && order.items.length > 0) {
        orderItemsTableBody.innerHTML = '';
        
        // Check if any item has a variation (from product_variations table)
        const hasVariations = order.items.some(item => item.variation && item.variation.trim() !== '');
        
        // Show/hide variation column header based on whether any item has variations
        const variationHeader = document.querySelector('#orderItemsTable thead th.variation-column');
        if (variationHeader) {
            if (hasVariations) {
                variationHeader.style.display = '';
            } else {
                variationHeader.style.display = 'none';
            }
        }
        
        order.items.forEach(item => {
            const row = document.createElement('tr');
            
            // Product image column
            const imgCell = document.createElement('td');
            // Get product image path with fallback
            let imagePath = '../Customer_assets/images/Slice 15 (2).png'; // Default fallback
            if (item.image_path) {
                // Normalize path: replace spaces with underscores in folder names
                let normalizedPath = item.image_path.replace(/Admin assets/g, 'Admin_assets');
                normalizedPath = normalizedPath.replace(/Customer assets/g, 'Customer_assets');
                imagePath = '../' + normalizedPath;
            }
            imgCell.innerHTML = `<img src="${imagePath}" alt="${item.Product_Name}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;" onerror="this.src='../Customer_assets/images/Slice 15 (2).png'">`;
            row.appendChild(imgCell);
            
            // Product name column
            const nameCell = document.createElement('td');
            nameCell.textContent = item.Product_Name || 'Unknown Product';
            row.appendChild(nameCell);
            
            // Quantity column
            const qtyCell = document.createElement('td');
            qtyCell.textContent = item.Quantity || 0;
            row.appendChild(qtyCell);
            
            // Variation column (only add if at least one item has a variation)
            if (hasVariations) {
                const varCell = document.createElement('td');
                // Use variation from API (product_variations table)
                if (item.variation && item.variation.trim() !== '') {
                    varCell.textContent = item.variation;
                } else {
                    varCell.textContent = 'N/A';
                }
                row.appendChild(varCell);
            }
            
            // Price column
            const priceCell = document.createElement('td');
            priceCell.textContent = formatPrice(item.Price || 0);
            row.appendChild(priceCell);
            
            // Total column
            const totalCell = document.createElement('td');
            const itemTotal = (parseFloat(item.Price || 0) * parseInt(item.Quantity || 0));
            totalCell.textContent = formatPrice(itemTotal);
            row.appendChild(totalCell);
            
            orderItemsTableBody.appendChild(row);
        });
    }
    
    // Calculate subtotal from items
    let subtotal = 0;
    if (order.items && order.items.length > 0) {
        order.items.forEach(item => {
            subtotal += (parseFloat(item.Price || 0) * parseInt(item.Quantity || 0));
        });
    }
    
    // Update subtotal
    const subtotalEl = document.getElementById('orderSubtotal');
    if (subtotalEl) {
        subtotalEl.textContent = formatPrice(subtotal);
    }
    
    // Update total amount
    const totalAmountEl = document.querySelector('.total-amount');
    if (totalAmountEl) {
        totalAmountEl.textContent = formatPrice(order.amount || order.Total || 0);
    }
    
    // Order status variables are already defined above (moved earlier for payment method logic)
    
    // Get payment method once for use throughout the function
    // IMPORTANT: For pending approval or rejected orders, payment_method should be null
    // Only check transaction_payment_method if order is approved and payment_method is null
    let paymentMethod = null;
    
    // CRITICAL: Always check order status first - if pending or rejected, payment method is ALWAYS null
    // IMPORTANT: For "Waiting Payment" orders, only use order.payment_method (set by customer via process_payment.php)
    // Don't use transaction_payment_method as fallback for "Waiting Payment" as it may contain old/default data
    if (isPendingApproval || isRejected) {
        // For pending approval or rejected orders, payment method should ALWAYS be null
        // Ignore any values that might exist in the database
        paymentMethod = null;
    } else if (isApproved) {
        const orderPaymentMethod = order.payment_method;
        const transactionPaymentMethod = order.transaction_payment_method;
        
        // For "Waiting Payment" orders, only use order.payment_method (customer must have selected it)
        // Also verify that the order was actually approved (has approved_at timestamp)
        // This ensures we don't show payment method from old/test data
        if (isWaitingForPayment) {
            // Only use order.payment_method - don't fall back to transaction_payment_method
            // Also check if order was approved (has approved_at) to ensure proper flow
            const isOrderApproved = order.approved_at && order.approved_at !== null && order.approved_at !== '';
            if (isOrderApproved && orderPaymentMethod && 
                typeof orderPaymentMethod === 'string' &&
                orderPaymentMethod.trim() !== '' &&
                orderPaymentMethod !== 'null' && 
                orderPaymentMethod !== 'NULL') {
                paymentMethod = orderPaymentMethod;
            } else {
                paymentMethod = null;
            }
        } else {
            // For other statuses (Processing, Ready), check payment_method first, then fall back to transaction_payment_method
            if (orderPaymentMethod && 
                typeof orderPaymentMethod === 'string' &&
                orderPaymentMethod.trim() !== '' &&
                orderPaymentMethod !== 'null' && 
                orderPaymentMethod !== 'NULL') {
                paymentMethod = orderPaymentMethod;
            } 
            // Only fall back to transaction_payment_method for non-Waiting Payment orders
            else if (transactionPaymentMethod && 
                     typeof transactionPaymentMethod === 'string' &&
                     transactionPaymentMethod.trim() !== '' &&
                     transactionPaymentMethod !== 'null' && 
                     transactionPaymentMethod !== 'NULL') {
                paymentMethod = transactionPaymentMethod;
            } else {
                paymentMethod = null;
            }
        }
    } else {
        // Unknown status - default to null for safety
        paymentMethod = null;
    }
    
    // Update payment method text - only show if payment method is actually selected
    const paymentTitleEl = document.querySelector('.payment-title');
    const paymentInfoSection = document.querySelector('.payment-info');
    
    // Check payment status - for "Waiting Payment" orders, only show if payment is confirmed
    const paymentStatus = order.payment || order.Payment_Status || null;
    const isPaymentConfirmed = paymentStatus && 
                               (paymentStatus === 'Paid' || 
                                paymentStatus === 'paid' || 
                                String(paymentStatus).toLowerCase() === 'paid');
    // isWaitingForPayment is already defined earlier in the function
    
    // Check if payment method is "On-Site" (case-insensitive)
    const isOnSitePayment = paymentMethod && (
        paymentMethod.toLowerCase() === 'on-site' || 
        paymentMethod.toLowerCase() === 'on site' ||
        paymentMethod.toLowerCase() === 'onsite'
    );
    
    // Check if payment method is "Cash on Delivery" (case-insensitive)
    const isCODPayment = paymentMethod && (
        paymentMethod.toLowerCase().includes('cash on delivery') ||
        paymentMethod.toLowerCase() === 'cod'
    );
    
    // Check if payment method is "GCash" (case-insensitive)
    const isGCashPayment = paymentMethod && (
        paymentMethod.toLowerCase() === 'gcash'
    );
    
    // Check if proof of payment exists (for GCash orders)
    let proofOfPayment = order.proof_of_payment || null;
    if (proofOfPayment && typeof proofOfPayment === 'string') {
        proofOfPayment = proofOfPayment.replace(/\\\//g, '/');
    }
    const hasProof = proofOfPayment && 
        String(proofOfPayment) !== 'null' && 
        String(proofOfPayment) !== 'NULL' && 
        String(proofOfPayment) !== '' &&
        proofOfPayment !== null &&
        proofOfPayment !== undefined;
    
    // Check if payment method is valid - must be a non-empty string that's not 'null' or 'NULL'
    // Also ensure order is not pending approval or rejected
    // CRITICAL: For "Waiting Payment" orders, show payment method if:
    //   - Payment is confirmed (Paid), OR
    //   - Payment method is "On-Site" or "Cash on Delivery" (show as "Incomplete" until paid), OR
    //   - Payment method is "GCash" (show as "Incomplete" until proof is uploaded or status changes to Processing)
    const hasValidPaymentMethod = !isPendingApproval && 
                                  !isRejected && 
                                  paymentMethod && 
                                  typeof paymentMethod === 'string' &&
                                  paymentMethod.trim() !== '' &&
                                  paymentMethod !== 'null' && 
                                  paymentMethod !== 'NULL' && 
                                  paymentMethod !== null && 
                                  paymentMethod !== undefined &&
                                  // For "Waiting Payment" status, show if payment confirmed OR if On-Site/COD OR if GCash
                                  (!isWaitingForPayment || isPaymentConfirmed || isOnSitePayment || isCODPayment || isGCashPayment);
    
    // Determine payment status text
    let paymentStatusText = '';
    if (isWaitingForPayment && (isOnSitePayment || isCODPayment)) {
        // For "Waiting Payment" orders with "On-Site" or "Cash on Delivery", show as "Incomplete"
        paymentStatusText = 'Incomplete';
    } else if (isWaitingForPayment && isGCashPayment && !hasProof) {
        // For "Waiting Payment" orders with "GCash" payment but no proof, show as "Incomplete"
        paymentStatusText = 'Incomplete';
    } else if (isPaymentConfirmed || orderStatus === 'Processing' || orderStatus === 'Ready') {
        // For confirmed payments or orders being processed/ready, show as "Paid"
        paymentStatusText = 'Paid';
    } else if (isWaitingForPayment) {
        // For other "Waiting Payment" orders, show as "Incomplete"
        paymentStatusText = 'Incomplete';
    } else {
        // Default to "Paid" for other statuses
        paymentStatusText = 'Paid';
    }
    
    console.log('[Order Details] Payment Method Check:', {
        orderStatus: orderStatus,
        paymentStatus: paymentStatus,
        isPaymentConfirmed: isPaymentConfirmed,
        isWaitingForPayment: isWaitingForPayment,
        isOnSitePayment: isOnSitePayment,
        isGCashPayment: isGCashPayment,
        hasProof: hasProof,
        isPendingApproval: isPendingApproval,
        isRejected: isRejected,
        isApproved: isApproved,
        paymentMethod: paymentMethod,
        paymentStatusText: paymentStatusText,
        orderPaymentMethod: order.payment_method,
        transactionPaymentMethod: order.transaction_payment_method,
        approvedAt: order.approved_at,
        hasValidPaymentMethod: hasValidPaymentMethod,
        displayPaymentMethod: displayPaymentMethod
    });
    
    // CRITICAL: Hide payment info section immediately if order is pending approval or rejected
    // For "Waiting Payment" orders: show if payment confirmed OR if On-Site payment method OR if GCash payment method
    // This ensures On-Site and GCash orders show payment info with "Incomplete" status
    if (paymentInfoSection) {
        if (isPendingApproval || isRejected) {
            // Force hide for pending/rejected orders - no exceptions
            paymentInfoSection.style.display = 'none';
            paymentInfoSection.setAttribute('data-payment-hidden', 'true');
            if (paymentTitleEl) {
                paymentTitleEl.style.display = 'none';
            }
            console.log('[Order Details] Payment section HIDDEN - Order is pending approval or rejected');
        } else if (hasValidPaymentMethod) {
            // Show if order is approved AND has valid payment method
            // For "Waiting Payment" orders, this includes On-Site and GCash payment methods
            paymentInfoSection.style.display = 'block';
            paymentInfoSection.removeAttribute('data-payment-hidden');
            if (paymentTitleEl) {
                // Update payment title with status
                paymentTitleEl.textContent = `Paid thru: ${paymentMethod} (${paymentStatusText})`;
                paymentTitleEl.style.display = 'block';
            }
            console.log('[Order Details] Payment section SHOWN - Valid payment method:', paymentMethod, 'Status:', paymentStatusText);
        } else {
            // Hide if no valid payment method (even if approved)
            paymentInfoSection.style.display = 'none';
            paymentInfoSection.setAttribute('data-payment-hidden', 'true');
            if (paymentTitleEl) {
                paymentTitleEl.style.display = 'none';
            }
            console.log('[Order Details] Payment section HIDDEN - No valid payment method');
        }
    }
    
    // Display rejection notice if order is rejected
    const rejectionNotice = document.getElementById('rejectionNotice');
    const rejectionOrderNumber = document.getElementById('rejectionOrderNumber');
    const rejectionDateInfo = document.getElementById('rejectionDateInfo');
    const rejectionDate = document.getElementById('rejectionDate');
    const rejectionReasonInfo = document.getElementById('rejectionReasonInfo');
    const rejectionReason = document.getElementById('rejectionReason');
    
    if (isRejected && rejectionNotice) {
        rejectionNotice.style.display = 'block';
        
        // Set order number
        if (rejectionOrderNumber) {
            const orderNumber = `ORD-${order.Order_ID.toString().padStart(4, '0')}`;
            rejectionOrderNumber.textContent = orderNumber;
        }
        
        // Set rejection date
        if (order.rejected_at) {
            if (rejectionDateInfo && rejectionDate) {
                rejectionDateInfo.style.display = 'block';
                try {
                    const date = new Date(order.rejected_at);
                    rejectionDate.textContent = formatDate(order.rejected_at) + ' ' + formatTime(order.rejected_at);
                } catch (e) {
                    rejectionDate.textContent = order.rejected_at;
                }
            }
        } else {
            if (rejectionDateInfo) {
                rejectionDateInfo.style.display = 'none';
            }
        }
        
        // Set rejection reason
        if (order.rejection_reason && order.rejection_reason.trim() !== '') {
            if (rejectionReasonInfo && rejectionReason) {
                rejectionReasonInfo.style.display = 'block';
                rejectionReason.textContent = order.rejection_reason;
            }
        } else {
            if (rejectionReasonInfo) {
                rejectionReasonInfo.style.display = 'block';
                if (rejectionReason) {
                    rejectionReason.innerHTML = '<em class="text-muted">No reason provided.</em>';
                }
            }
        }
    } else {
        if (rejectionNotice) {
            rejectionNotice.style.display = 'none';
        }
    }
    
    // Update view receipt link - show for all approved orders, even without payment method
    // Receipt link is now outside payment-info section so it's always visible when order is approved
    const viewReceiptLink = document.querySelector('.view-receipt-link');
    if (viewReceiptLink) {
        // Show receipt link for all approved orders (not pending/rejected)
        // Receipt should be viewable regardless of payment method selection
        if (isApproved) {
            const receiptUrl = `ViewReceipt.html?order_id=${order.Order_ID}`;
            viewReceiptLink.href = receiptUrl;
            viewReceiptLink.setAttribute('href', receiptUrl);
            viewReceiptLink.onclick = function(e) {
                e.preventDefault();
                window.location.href = receiptUrl;
                return false;
            };
            viewReceiptLink.style.display = 'inline-block';
            viewReceiptLink.style.visibility = 'visible';
            viewReceiptLink.style.opacity = '1';
            viewReceiptLink.style.pointerEvents = 'auto';
            viewReceiptLink.style.cursor = 'pointer';
            console.log('[Order Details] ✅ Receipt link SHOWN for approved order:', {
                orderId: order.Order_ID,
                orderStatus: orderStatus,
                isApproved: isApproved,
                receiptUrl: receiptUrl,
                linkDisplay: viewReceiptLink.style.display,
                linkVisibility: viewReceiptLink.style.visibility
            });
        } else {
            // Hide receipt link for pending approval or rejected orders
            viewReceiptLink.style.display = 'none';
            console.log('[Order Details] Receipt link HIDDEN - Order not approved:', {
                orderId: order.Order_ID,
                orderStatus: orderStatus,
                isApproved: isApproved
            });
        }
    } else {
        console.error('[Order Details] ❌ Receipt link element not found in DOM!');
        console.log('[Order Details] Available elements:', document.querySelectorAll('a[href*="receipt"], .view-receipt-link, [class*="receipt"]'));
    }
    
    console.log('🟢🟢🟢 ABOUT TO CHECK PROOF OF PAYMENT - VERSION 3.0 CODE IS RUNNING 🟢🟢🟢');
    console.log('[Order Details] About to check proof of payment...');
    
    // Display proof of payment image if payment method is GCash and proof exists
    console.log('[Order Details] ===== PROOF OF PAYMENT CHECK START =====');
    console.log('[Order Details] Full order object:', order);
    console.log('[Order Details] Order keys:', Object.keys(order));
    
    const proofOfPaymentContainer = document.getElementById('proofOfPaymentContainer');
    const proofOfPaymentImage = document.getElementById('proofOfPaymentImage');
    
    // Debug logging
    console.log('[Order Details] Element Check:', {
        hasContainer: !!proofOfPaymentContainer,
        hasImage: !!proofOfPaymentImage,
        containerElement: proofOfPaymentContainer,
        imageElement: proofOfPaymentImage
    });
    
    if (!proofOfPaymentContainer) {
        console.error('[Order Details] ❌ proofOfPaymentContainer element not found in DOM!');
        console.log('[Order Details] Available elements with "proof" in id:', document.querySelectorAll('[id*="proof"]'));
    }
    
    if (!proofOfPaymentImage) {
        console.error('[Order Details] ❌ proofOfPaymentImage element not found in DOM!');
    }
    
    if (proofOfPaymentContainer && proofOfPaymentImage) {
        // Use the proofOfPayment and hasProof variables already defined earlier in the function
        
        console.log('[Order Details] Payment Data:', {
            paymentMethod: paymentMethod,
            transactionPaymentMethod: order.transaction_payment_method,
            proofOfPayment: proofOfPayment,
            proofOfPaymentType: typeof proofOfPayment,
            proofOfPaymentLength: proofOfPayment ? proofOfPayment.length : 0,
            originalProofOfPayment: order.proof_of_payment,
            isGCashPayment: isGCashPayment,
            hasProof: hasProof
        });
        
        // Use isGCashPayment variable already defined earlier
        const isGCash = hasValidPaymentMethod && isGCashPayment;
        
        console.log('[Order Details] Condition Check:', {
            hasValidPaymentMethod: hasValidPaymentMethod,
            paymentMethod: paymentMethod,
            isGCash: isGCash,
            hasProof: hasProof,
            willShow: isGCash && hasProof
        });
        
        // Only show proof of payment if there's a valid payment method AND it's GCash AND proof exists
        if (hasValidPaymentMethod && isGCash && hasProof) {
            // Use API to serve image (works correctly when site is hosted in subdirectories)
            let imagePath = String(proofOfPayment).replace(/\\/g, '/');
            if (imagePath.startsWith('../')) imagePath = imagePath.slice(3);
            if (imagePath.startsWith('/')) imagePath = imagePath.slice(1);
            if (!imagePath.startsWith('uploads/')) {
                imagePath = imagePath.startsWith('proof_of_payment/') ? 'uploads/' + imagePath : 'uploads/proof_of_payment/' + imagePath.split('/').pop();
            }
            const cacheBust = 't=' + Date.now();
            const baseUrl = getAppBaseUrl();
            const apiUrl = `${baseUrl}api/get_proof_image.php?path=${encodeURIComponent(imagePath)}&${cacheBust}`;
            const directUrl = `${baseUrl}${imagePath}?${cacheBust}`;
            
            console.log('[Order Details] ✅ Showing proof of payment. Base:', baseUrl, 'API:', apiUrl);
            
            proofOfPaymentImage.alt = 'Proof of Payment';
            proofOfPaymentContainer.style.display = 'block';
            proofOfPaymentContainer.setAttribute('style', 'display: block !important; margin-top: 15px;');
            
            proofOfPaymentImage.onerror = function() {
                if (this.src && this.src.includes('get_proof_image.php')) {
                    console.warn('[Order Details] API failed (404), trying direct path:', directUrl);
                    this.onerror = function() {
                        console.error('[Order Details] ❌ Failed to load proof of payment image (API and direct path both returned 404)');
                        if (!proofOfPaymentContainer.querySelector('.proof-payment-error')) {
                            const errorMsg = document.createElement('p');
                            errorMsg.className = 'text-danger proof-payment-error';
                            errorMsg.textContent = 'Proof image not found. The file may be missing on the server. Ensure uploads/proof_of_payment/ exists and contains the image.';
                            proofOfPaymentContainer.appendChild(errorMsg);
                        }
                    };
                    this.src = directUrl;
                }
            };
            proofOfPaymentImage.src = apiUrl;
            
            // Show reject proof button when proof of payment is displayed
            const rejectProofBtn = document.getElementById('rejectProofBtn');
            if (rejectProofBtn) {
                rejectProofBtn.style.display = 'inline-block';
            }
            
            // Add success handler
            proofOfPaymentImage.onload = function() {
                console.log('[Order Details] ✅ Proof of payment image loaded successfully');
                console.log('[Order Details] Image dimensions:', {
                    width: this.naturalWidth,
                    height: this.naturalHeight
                });
            };
        } else {
            // Hide proof of payment container if not GCash or no proof
            console.log('[Order Details] ⚠️ Hiding proof of payment container');
            console.log('[Order Details] Reason:', {
                isGCash: isGCash,
                hasProof: hasProof,
                paymentMethod: paymentMethod,
                transactionPaymentMethod: order.transaction_payment_method,
                proofOfPayment: proofOfPayment
            });
            
            // If it's GCash but no proof, show a message
            // Show for both "Waiting Payment" (Incomplete) and other statuses
            if (hasValidPaymentMethod && isGCash && !hasProof) {
                console.log('[Order Details] GCash payment but no proof of payment uploaded');
                proofOfPaymentContainer.innerHTML = `
                    <label class="proof-label" style="display: block; font-weight: 600; margin-bottom: 10px; color: #2c3e50;">Proof of Payment:</label>
                    <p class="text-warning" style="padding: 10px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px;">
                        <i class="fas fa-exclamation-triangle"></i> No proof of payment uploaded for this GCash order.
                    </p>
                `;
                proofOfPaymentContainer.style.display = 'block';
            } else {
                // Hide proof of payment container if no valid payment method, not GCash, or waiting for payment
                proofOfPaymentContainer.style.display = 'none';
            }
        }
        
        // Final check: Hide proof of payment section entirely if no valid payment method is selected
        // This ensures it's hidden even if the above logic didn't catch it
        if (!hasValidPaymentMethod) {
            if (proofOfPaymentContainer) {
                proofOfPaymentContainer.style.display = 'none';
            }
        }
    } else {
        console.error('[Order Details] ❌ Proof of payment container or image element not found!');
        console.log('[Order Details] Searching for alternative selectors...');
        const altContainer = document.querySelector('.proof-of-payment-container');
        const altImage = document.querySelector('#proofOfPaymentImage');
        console.log('[Order Details] Alternative search results:', {
            containerByClass: !!altContainer,
            imageById: !!altImage
        });
    }
    
    console.log('[Order Details] ===== PROOF OF PAYMENT CHECK END =====');
    
    // Fetch and display proof of delivery (uploaded by driver when completing delivery)
    const proofOfDeliveryContainer = document.getElementById('proofOfDeliveryContainer');
    const proofOfDeliveryImage = document.getElementById('proofOfDeliveryImage');
    if (proofOfDeliveryContainer && proofOfDeliveryImage && order.Order_ID) {
        fetch(`../api/get_delivery_by_order.php?order_id=${order.Order_ID}`, { credentials: 'include' })
            .then(r => r.json())
            .then(deliveryData => {
                if (!proofOfDeliveryContainer) return;
                const deliveryStatus = deliveryData.success && deliveryData.delivery ? (deliveryData.delivery.Delivery_Status || '') : '';
                const isDelivered = deliveryStatus.toLowerCase() === 'delivered';
                let details = null;
                if (deliveryData.success && deliveryData.delivery && deliveryData.delivery.delivery_details) {
                    details = deliveryData.delivery.delivery_details;
                    if (typeof details === 'string') {
                        try { details = JSON.parse(details); } catch (e) { details = {}; }
                    }
                }
                const proofPath = details && details.proof_image ? details.proof_image : null;
                if (proofPath) {
                    let imagePath = String(proofPath).replace(/\\/g, '/');
                    if (imagePath.startsWith('../')) imagePath = imagePath.slice(3);
                    if (imagePath.startsWith('/')) imagePath = imagePath.slice(1);
                    if (!imagePath.startsWith('uploads/')) {
                        imagePath = imagePath.startsWith('delivery_proof/') ? 'uploads/' + imagePath : 'uploads/delivery_proof/' + imagePath.split('/').pop();
                    }
                    const baseUrl = getAppBaseUrl();
                    const imageUrl = `${baseUrl}api/get_delivery_proof_image.php?path=${encodeURIComponent(imagePath)}`;
                    proofOfDeliveryImage.src = imageUrl;
                    proofOfDeliveryImage.alt = 'Proof of Delivery';
                    proofOfDeliveryImage.style.display = '';
                    proofOfDeliveryContainer.querySelector('.proof-delivery-placeholder')?.remove();
                    proofOfDeliveryContainer.style.display = 'block';
                    proofOfDeliveryImage.onerror = function() {
                        proofOfDeliveryImage.style.display = 'none';
                        const placeholder = proofOfDeliveryContainer.querySelector('.proof-delivery-placeholder');
                        if (!placeholder) {
                            const msg = document.createElement('p');
                            msg.className = 'text-muted proof-delivery-placeholder';
                            msg.textContent = 'Proof image could not be loaded.';
                            proofOfDeliveryContainer.appendChild(msg);
                        }
                    };
                } else if (isDelivered) {
                    proofOfDeliveryImage.style.display = 'none';
                    proofOfDeliveryImage.src = '';
                    let placeholder = proofOfDeliveryContainer.querySelector('.proof-delivery-placeholder');
                    if (!placeholder) {
                        placeholder = document.createElement('p');
                        placeholder.className = 'text-muted proof-delivery-placeholder';
                        placeholder.textContent = 'No proof photo uploaded.';
                        proofOfDeliveryContainer.appendChild(placeholder);
                    }
                    proofOfDeliveryContainer.style.display = 'block';
                } else {
                    proofOfDeliveryContainer.style.display = 'none';
                }
            })
            .catch(() => { if (proofOfDeliveryContainer) proofOfDeliveryContainer.style.display = 'none'; });
    }
    
    // Setup action buttons
    setupActionButtons(order);
}

// Check if current user is Delivery Driver (view-only; no order management actions)
function isDeliveryDriverRole() {
    const role = (sessionStorage.getItem('user_role') || window.__MATARIX_USER_ROLE || '').trim();
    return role === 'Delivery Driver';
}

// Setup action buttons
function setupActionButtons(order) {
    const acceptOrderBtn = document.getElementById('acceptOrderBtn');
    const rejectOrderBtn = document.getElementById('rejectOrderBtn');
    const prepareOrderBtn = document.getElementById('prepareOrderBtn');
    const orderStatus = order.status || 'Pending Approval';
    const isPendingApproval = orderStatus === 'Pending Approval';
    const isRejected = orderStatus === 'Rejected';
    const isApproved = !isPendingApproval && !isRejected;
    const isDriver = isDeliveryDriverRole();

    // Delivery Driver: hide all order-management buttons; show only Back to Deliveries link
    if (isDriver) {
        [acceptOrderBtn, rejectOrderBtn, prepareOrderBtn,
         document.getElementById('setProcessingBtn'),
         document.getElementById('readyForDeliveryBtn'),
         document.getElementById('outForDeliveryStatusBtn'),
         document.getElementById('rejectProofBtn')].forEach(btn => { if (btn) btn.style.display = 'none'; });
        const trackDeliveryBtn = document.getElementById('trackDeliveryBtn');
        if (trackDeliveryBtn) {
            trackDeliveryBtn.href = '../Admin/DeliveriesAdmin.html';
            trackDeliveryBtn.innerHTML = '<i class="fas fa-arrow-left mr-2"></i>Back to Deliveries';
            trackDeliveryBtn.style.display = 'inline-block';
        }
        return;
    }
    
    // Approve/Reject removed - orders go directly to payment
    if (acceptOrderBtn) acceptOrderBtn.style.display = 'none';
    if (rejectOrderBtn) rejectOrderBtn.style.display = 'none';
    
    // Show/hide "Accept Payment" button for Waiting Payment orders (incl. legacy Pending Approval)
    const setProcessingBtn = document.getElementById('setProcessingBtn');
    if (setProcessingBtn) {
        const isWaitingPayment = orderStatus === 'Waiting Payment' || orderStatus === 'Pending Approval';
        if (isWaitingPayment) {
            setProcessingBtn.style.display = 'inline-block';
            setProcessingBtn.onclick = function() {
                setOrderStatusToProcessing(order.Order_ID);
            };
        } else {
            setProcessingBtn.style.display = 'none';
        }
    }
    
    // Show/hide "Ready" button for Processing orders
    if (prepareOrderBtn) {
        const isProcessing = orderStatus === 'Processing';
        console.log('[Setup Action Buttons] Order status:', orderStatus, 'isProcessing:', isProcessing);
        
        if (isProcessing) {
            // Set button properties
            prepareOrderBtn.textContent = 'Ready';
            prepareOrderBtn.style.display = 'inline-block';
            prepareOrderBtn.disabled = false;
            prepareOrderBtn.removeAttribute('disabled');
            prepareOrderBtn.style.pointerEvents = 'auto';
            prepareOrderBtn.style.cursor = 'pointer';
            prepareOrderBtn.style.opacity = '1';
            prepareOrderBtn.style.visibility = 'visible';
            prepareOrderBtn.style.position = 'relative';
            prepareOrderBtn.style.zIndex = '10';
            
            console.log('[Setup Action Buttons] Ready button configured:', {
                text: prepareOrderBtn.textContent,
                display: prepareOrderBtn.style.display,
                disabled: prepareOrderBtn.disabled,
                pointerEvents: prepareOrderBtn.style.pointerEvents
            });
            
            // Remove any existing onclick handlers by cloning the button
            const newBtn = prepareOrderBtn.cloneNode(true);
            prepareOrderBtn.parentNode.replaceChild(newBtn, prepareOrderBtn);
            const readyBtn = document.getElementById('prepareOrderBtn');
            
            if (readyBtn) {
                console.log('[Setup Action Buttons] Ready button found after clone, adding event listener');
                
                // Add click event listener
                readyBtn.addEventListener('click', async function(e) {
                    console.log('[Ready Button] Click event triggered');
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Disable button during processing
                    readyBtn.disabled = true;
                    const originalText = readyBtn.textContent;
                    readyBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
                    readyBtn.style.opacity = '0.7';
                    readyBtn.style.cursor = 'not-allowed';
                    
                    try {
                        if (window.AdminNotifications) {
                            const confirmed = await AdminNotifications.confirm(
                                'Mark this order as "Ready"? The order will be moved to the Ready tab.',
                                {
                                    title: 'Mark Order as Ready',
                                    confirmText: 'Mark Ready',
                                    cancelText: 'Cancel'
                                }
                            );
                            
                            if (confirmed) {
                                console.log('[Ready Button] Confirmed, updating status to Ready');
                                
                                // Show loading notification
                                AdminNotifications.info('Updating order status to Ready...', {
                                    title: 'Processing',
                                    duration: 0 // Don't auto-close
                                });
                                
                                await updateOrderStatus(order.Order_ID, 'Ready');
                            } else {
                                // User cancelled - restore button
                                readyBtn.disabled = false;
                                readyBtn.textContent = originalText;
                                readyBtn.style.opacity = '1';
                                readyBtn.style.cursor = 'pointer';
                            }
                        } else {
                            // If AdminNotifications isn't available, fail closed and restore UI
                            readyBtn.disabled = false;
                            readyBtn.textContent = originalText;
                            readyBtn.style.opacity = '1';
                            readyBtn.style.cursor = 'pointer';
                        }
                    } catch (error) {
                        // Restore button on error
                        readyBtn.disabled = false;
                        readyBtn.textContent = originalText;
                        readyBtn.style.opacity = '1';
                        readyBtn.style.cursor = 'pointer';
                        
                        if (window.AdminNotifications) {
                            AdminNotifications.error('An error occurred while updating the order status.', {
                                title: 'Error',
                                duration: 5000
                            });
                        }
                    }
                });
                
                console.log('[Setup Action Buttons] Event listener added successfully');
            } else {
                console.error('[Setup Action Buttons] Ready button not found after clone!');
            }
        } else {
            prepareOrderBtn.style.display = 'none';
            console.log('[Setup Action Buttons] Order is not Processing, hiding button');
        }
    } else {
        console.error('[Setup Action Buttons] prepareOrderBtn element not found!');
    }
    
    // Show/hide "Ready for Delivery" and "Track Delivery" buttons for Ready orders
    const readyForDeliveryBtn = document.getElementById('readyForDeliveryBtn');
    const outForDeliveryStatusBtn = document.getElementById('outForDeliveryStatusBtn');
    const trackDeliveryBtn = document.getElementById('trackDeliveryBtn');
    const isReady = orderStatus === 'Ready';
    
    // Check delivery status to determine if already "Out for Delivery"
    checkDeliveryStatusAndSetupButtons(order.Order_ID, isReady, readyForDeliveryBtn, outForDeliveryStatusBtn, trackDeliveryBtn);
}

// Check delivery status and setup buttons accordingly
async function checkDeliveryStatusAndSetupButtons(orderId, isReady, readyForDeliveryBtn, outForDeliveryStatusBtn, trackDeliveryBtn) {
    if (!isReady) {
        if (readyForDeliveryBtn) readyForDeliveryBtn.style.display = 'none';
        if (outForDeliveryStatusBtn) outForDeliveryStatusBtn.style.display = 'none';
        if (trackDeliveryBtn) trackDeliveryBtn.style.display = 'none';
        return;
    }
    
    try {
        // Fetch delivery status
        const response = await fetch(`../api/get_delivery_by_order.php?order_id=${orderId}`, {
            method: 'GET',
            credentials: 'include'
        });
        
        let deliveryStatus = null;
        let isOutForDelivery = false;
        let isDelivered = false;
        
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.delivery) {
                deliveryStatus = (data.delivery.Delivery_Status || '').trim();
                isOutForDelivery = deliveryStatus === 'Out for Delivery';
                isDelivered = deliveryStatus.toLowerCase() === 'delivered';
            }
        }
        
        // Show appropriate buttons
        if (isDelivered) {
            // Delivery already completed - hide assign/ready buttons, show Track Delivery link only
            if (readyForDeliveryBtn) readyForDeliveryBtn.style.display = 'none';
            if (outForDeliveryStatusBtn) outForDeliveryStatusBtn.style.display = 'none';
            if (trackDeliveryBtn) trackDeliveryBtn.style.display = 'inline-block';
        } else if (isOutForDelivery) {
            // Already out for delivery - show unclickable status button
            if (readyForDeliveryBtn) readyForDeliveryBtn.style.display = 'none';
            if (outForDeliveryStatusBtn) {
                outForDeliveryStatusBtn.style.display = 'inline-block';
                outForDeliveryStatusBtn.disabled = true;
            }
            if (trackDeliveryBtn) trackDeliveryBtn.style.display = 'inline-block';
        } else {
            // Not yet out for delivery - show "Ready for Delivery" button
            if (readyForDeliveryBtn) {
                readyForDeliveryBtn.style.display = 'inline-block';
                readyForDeliveryBtn.onclick = function() {
                    showAssignDriverVehicleModal(orderId);
                };
            }
            if (outForDeliveryStatusBtn) outForDeliveryStatusBtn.style.display = 'none';
            if (trackDeliveryBtn) trackDeliveryBtn.style.display = 'inline-block';
        }
    } catch (error) {
        console.error('[Check Delivery Status] Error:', error);
        // Default: show "Ready for Delivery" button if error
        if (readyForDeliveryBtn) {
            readyForDeliveryBtn.style.display = 'inline-block';
            readyForDeliveryBtn.onclick = function() {
                showAssignDriverVehicleModal(orderId);
            };
        }
        if (outForDeliveryStatusBtn) outForDeliveryStatusBtn.style.display = 'none';
        if (trackDeliveryBtn) trackDeliveryBtn.style.display = 'inline-block';
    }
}

// Show modal for driver and vehicle assignment
async function showAssignDriverVehicleModal(orderId) {
    const modal = document.getElementById('assignDriverVehicleModal');
    const driverSelect = document.getElementById('driverSelect');
    const vehicleSelect = document.getElementById('vehicleSelect');
    const assignError = document.getElementById('assignError');
    const assignLoading = document.getElementById('assignLoading');
    
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
                vehiclesData.vehicles.forEach(vehicle => {
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
    const confirmBtn = document.getElementById('confirmAssignBtn');
    if (confirmBtn) {
        confirmBtn.onclick = async function() {
            await handleDriverVehicleAssignment(orderId, driverSelect.value, vehicleSelect.value);
        };
    }
}

// Handle driver and vehicle assignment
async function handleDriverVehicleAssignment(orderId, driverId, vehicleId) {
    const assignError = document.getElementById('assignError');
    const assignLoading = document.getElementById('assignLoading');
    const confirmBtn = document.getElementById('confirmAssignBtn');
    
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
        
        // Success - close modal and reload order details
        $('#assignDriverVehicleModal').modal('hide');
        
        if (window.AdminNotifications) {
            AdminNotifications.success('Driver and vehicle assigned successfully. Order is now Out for Delivery.', {
                duration: 5000
            });
        }
        
        // Reload order details to update button states
        setTimeout(() => {
            loadOrderDetails();
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

// Set order status to Processing (for Waiting Payment orders)
async function setOrderStatusToProcessing(orderId) {
    const confirmed = await confirmDialog(
        'Are you sure you want to accept payment for this order? This will set the order status to "Processing" and indicate that payment has been received.',
        {
            title: 'Confirm Action',
            confirmText: 'Accept Payment',
            cancelText: 'Cancel'
        }
    );
    if (!confirmed) {
        return;
    }
    
    try {
        const response = await fetch('../api/update_order_status.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                order_id: orderId,
                status: 'Processing'
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            notify('success', 'Payment accepted! Order status updated to "Processing".', { duration: 3000 });
            // Reload order details to reflect changes
            await loadOrderDetails();
        } else {
            notify('error', 'Failed to update order status: ' + (data.message || 'Unknown error'), { duration: 7000 });
        }
    } catch (error) {
        console.error('Error updating order status:', error);
        notify('error', 'Failed to update order status. Please try again.', { duration: 7000 });
    }
}

// Track approval in progress to prevent double-clicks
let approvalInProgress = false;

// Approve order function
async function approveOrder(orderId) {
    // Prevent double-clicks
    if (approvalInProgress) {
        console.warn('Approval already in progress, ignoring duplicate request');
        return;
    }
    
    const confirmed = await confirmDialog(
        'Are you sure you want to approve this order? The customer will be able to proceed with payment.',
        {
            title: 'Confirm Action',
            confirmText: 'Approve',
            cancelText: 'Cancel'
        }
    );
    if (!confirmed) {
        return;
    }
    
    // Set flag and disable buttons
    approvalInProgress = true;
    // Find approve button by multiple selectors
    const acceptOrderBtn = document.querySelector('#accept-order-btn, .accept-order-btn, [id*="accept"][id*="order"]');
    const approveButtons = document.querySelectorAll('.approve-order-btn, .approve-btn, button[onclick*="approveOrder"]');
    
    // Disable accept order button if found
    if (acceptOrderBtn) {
        acceptOrderBtn.disabled = true;
        acceptOrderBtn.style.opacity = '0.6';
        acceptOrderBtn.style.cursor = 'not-allowed';
        const originalHTML = acceptOrderBtn.innerHTML;
        acceptOrderBtn.dataset.originalHTML = originalHTML;
        acceptOrderBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Approving...';
    }
    
    // Disable other approve buttons
    approveButtons.forEach(btn => {
        if (btn.onclick?.toString().includes(String(orderId)) || 
            btn.getAttribute('onclick')?.includes(String(orderId)) ||
            btn.dataset.orderId === String(orderId)) {
            btn.disabled = true;
            btn.style.opacity = '0.6';
            btn.style.cursor = 'not-allowed';
            const originalHTML = btn.innerHTML || btn.textContent;
            btn.dataset.originalHTML = originalHTML;
            if (btn.innerHTML) {
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Approving...';
            } else {
                btn.textContent = 'Approving...';
            }
        }
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
            notify('success', 'Order approved successfully! The customer can now proceed with payment.', { duration: 4000 });
            // Reload order details to reflect changes
            await loadOrderDetails();
        } else {
            // Check if order was already approved (race condition)
            if (data.already_approved || (data.message && data.message.includes('not pending approval'))) {
                notify('warning', 'Order was already approved. Refreshing order details...', { duration: 3000 });
                // Reload to get current status
                await loadOrderDetails();
            } else {
                notify('error', 'Failed to approve order: ' + (data.message || 'Unknown error'), { duration: 7000 });
            }
        }
    } catch (error) {
        console.error('Error approving order:', error);
        notify('error', 'Failed to approve order. Please try again.', { duration: 7000 });
    } finally {
        // Re-enable buttons
        approvalInProgress = false;
        
        // Re-enable accept order button
        const acceptOrderBtn = document.querySelector('#accept-order-btn, .accept-order-btn, [id*="accept"][id*="order"]');
        if (acceptOrderBtn && acceptOrderBtn.dataset.originalHTML) {
            acceptOrderBtn.disabled = false;
            acceptOrderBtn.style.opacity = '';
            acceptOrderBtn.style.cursor = '';
            acceptOrderBtn.innerHTML = acceptOrderBtn.dataset.originalHTML;
        }
        
        // Re-enable other approve buttons
        approveButtons.forEach(btn => {
            if (btn.onclick?.toString().includes(String(orderId)) || 
                btn.getAttribute('onclick')?.includes(String(orderId)) ||
                btn.dataset.orderId === String(orderId)) {
                btn.disabled = false;
                btn.style.opacity = '';
                btn.style.cursor = '';
                if (btn.dataset.originalHTML) {
                    if (btn.innerHTML) {
                        btn.innerHTML = btn.dataset.originalHTML;
                    } else {
                        btn.textContent = btn.dataset.originalHTML;
                    }
                }
            }
        });
    }
}

// Update order status function
async function updateOrderStatus(orderId, status) {
    try {
        // Show loading state
        if (window.AdminNotifications) {
            // Close any previous info notifications
            const notifications = document.querySelectorAll('.admin-notification.info');
            notifications.forEach(n => {
                const closeBtn = n.querySelector('.admin-notification-close');
                if (closeBtn) closeBtn.click();
            });
            
            AdminNotifications.info('Updating order status...', {
                title: 'Processing',
                duration: 0 // Don't auto-close
            });
        }
        
        const response = await fetch('../api/update_order_status.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                order_id: orderId,
                status: status
            })
        });
        
        // Check if response is OK
        if (!response.ok) {
            const errorText = await response.text();
            // Filter out localhost URLs from error messages
            const cleanErrorText = errorText.replace(/https?:\/\/[^\s]+localhost[^\s]*/gi, '').replace(/localhost[^\s]*/gi, '');
            throw new Error(cleanErrorText || `HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Close loading notification
        if (window.AdminNotifications) {
            const notifications = document.querySelectorAll('.admin-notification.info');
            notifications.forEach(n => {
                const closeBtn = n.querySelector('.admin-notification-close');
                if (closeBtn) closeBtn.click();
            });
        }
        
        if (data.success) {
            if (window.AdminNotifications) {
                AdminNotifications.success('Order status updated successfully! The order has been moved to the Ready tab.', {
                    title: 'Success',
                    duration: 4000
                });
            }
            
            // If status changed to Ready, redirect to OrdersAdmin with Ready tab active
            if (status === 'Ready') {
                // Wait a moment for the success notification to show, then redirect
                setTimeout(() => {
                    window.location.href = '../Admin/OrdersAdmin.html?tab=ready';
                }, 2000);
            } else {
                // Reload order details to reflect changes
                await loadOrderDetails();
            }
        } else {
            const errorMessage = (data.message || 'Unknown error').replace(/https?:\/\/[^\s]+localhost[^\s]*/gi, '').replace(/localhost[^\s]*/gi, '');
            if (window.AdminNotifications) {
                AdminNotifications.error('Failed to update order status: ' + errorMessage, {
                    title: 'Error',
                    duration: 5000
                });
            }
        }
    } catch (error) {
        // Close loading notification if it exists
        if (window.AdminNotifications) {
            const notifications = document.querySelectorAll('.admin-notification.info');
            notifications.forEach(n => {
                const closeBtn = n.querySelector('.admin-notification-close');
                if (closeBtn) closeBtn.click();
            });
            
            const errorMessage = error.message ? error.message.replace(/https?:\/\/[^\s]+localhost[^\s]*/gi, '').replace(/localhost[^\s]*/gi, '') : 'Please try again.';
            AdminNotifications.error('Failed to update order status: ' + errorMessage, {
                title: 'Error',
                duration: 5000
            });
        }
    }
}

// Reject order function
async function rejectOrder(orderId, currentStatus = null) {
    orderId = parseInt(orderId);
    
    if (!orderId || isNaN(orderId)) {
        if (window.AdminNotifications) {
            AdminNotifications.warning('Invalid order ID', { duration: 4000 });
        }
        return;
    }
    
    // Use custom prompt dialog for rejection reason - MUST complete before proceeding
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
        // User cancelled the prompt - do not proceed with rejection
        return;
    }
    
    // Build confirmation message based on current status
    let confirmationMessage = `Reject order ORD-${orderId.toString().padStart(4, '0')}?`;
    if (currentStatus && currentStatus !== 'Pending Approval') {
        confirmationMessage += `\n\nCurrent status: ${currentStatus}`;
        if (currentStatus === 'Processing' || currentStatus === 'Ready') {
            confirmationMessage += '\n\n⚠️ Warning: This order is already in progress. Rejecting will cancel the order and reverse any stock changes.';
        }
    }
    confirmationMessage += '\n\nThis action cannot be undone.';
    
    // Use custom confirmation dialog - MUST confirm before proceeding
    const confirmed = await AdminNotifications.confirm(
        confirmationMessage,
        {
            title: 'Confirm Rejection',
            confirmText: 'Reject',
            cancelText: 'Cancel',
            danger: true
        }
    );
    
    if (!confirmed) {
        // User cancelled the confirmation - do not proceed with rejection
        return;
    }
    
    // Only now proceed with the API call to reject the order
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
            if (window.AdminNotifications) {
                AdminNotifications.success('Order rejected successfully.', { duration: 3000 });
            }
            // Reload order details to reflect changes
            await loadOrderDetails();
        } else {
            const errorMessage = (data.message || 'Unknown error').replace(/https?:\/\/[^\s]+localhost[^\s]*/gi, '').replace(/localhost[^\s]*/gi, '');
            if (window.AdminNotifications) {
                AdminNotifications.error('Failed to reject order: ' + errorMessage, {
                    duration: 5000
                });
            }
        }
    } catch (error) {
        console.error('Error rejecting order:', error);
        if (window.AdminNotifications) {
            AdminNotifications.error('Failed to reject order. Please try again.', {
                duration: 5000
            });
        }
    }
}

            // Reject proof of payment
            async function rejectProofOfPayment(orderId) {
                if (!orderId) {
                    console.error('[Reject Proof] Order ID is required');
                    notify('error', 'Order ID not found. Please refresh the page.', { duration: 5000 });
                    return;
                }

                const confirmed = await confirmDialog(
                    `Are you sure you want to reject the proof of payment for order #${orderId}? The customer will be notified to upload a new proof.`,
                    {
                        title: 'Confirm Rejection',
                        confirmText: 'Reject Proof',
                        cancelText: 'Cancel'
                    }
                );
                if (!confirmed) {
                    return;
                }

                try {
                    console.log('[Reject Proof] Rejecting proof for order:', orderId);
                    const response = await fetch('../api/reject_proof_of_payment.php', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ order_id: orderId })
                    });
                    const data = await response.json();
                    if (data.success) {
                        console.log('[Reject Proof] ✅ Success:', data.message);
                        notify('success', 'Proof of payment rejected successfully. Customer has been notified.', { duration: 5000 });
                        // Reload order details to reflect the changes
                        setTimeout(() => {
                            loadOrderDetails();
                        }, 1000);
                    } else {
                        console.error('[Reject Proof] ❌ Error:', data.message);
                        notify('error', data.message || 'Failed to reject proof of payment. Please try again.', { duration: 5000 });
                    }
                } catch (error) {
                    console.error('[Reject Proof] ❌ Error:', error);
                    notify('error', 'Connection error. Please check your internet connection and try again.', { duration: 5000 });
                }
            }

            // Initialize on page load
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', loadOrderDetails);
            } else {
                loadOrderDetails();
            }

// Reject proof of payment
async function rejectProofOfPayment(orderId) {
    if (!orderId) {
        console.error('[Reject Proof] Order ID is required');
        notify('error', 'Order ID not found. Please refresh the page.', { duration: 5000 });
        return;
    }

    const confirmed = await confirmDialog(
        `Are you sure you want to reject the proof of payment for order #${orderId}? The customer will be notified to upload a new proof.`,
        {
            title: 'Confirm Rejection',
            confirmText: 'Reject Proof',
            cancelText: 'Cancel'
        }
    );
    if (!confirmed) {
        return;
    }

    try {
        console.log('[Reject Proof] Rejecting proof for order:', orderId);
        const response = await fetch('../api/reject_proof_of_payment.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ order_id: orderId })
        });
        const data = await response.json();
        if (data.success) {
            console.log('[Reject Proof] ✅ Success:', data.message);
            notify('success', 'Proof of payment rejected successfully. Customer has been notified.', { duration: 5000 });
            // Reload order details to reflect the changes
            setTimeout(() => {
                loadOrderDetails();
            }, 1000);
        } else {
            console.error('[Reject Proof] ❌ Error:', data.message);
            notify('error', data.message || 'Failed to reject proof of payment. Please try again.', { duration: 5000 });
        }
    } catch (error) {
        console.error('[Reject Proof] ❌ Error:', error);
        notify('error', 'Connection error. Please check your internet connection and try again.', { duration: 5000 });
    }
}

// Add click handler for reject proof button (using event delegation for dynamic elements)
document.addEventListener('click', function(e) {
    // Add click handler for reject proof button
    if (e.target && e.target.id === 'rejectProofBtn') {
        e.preventDefault();
        const urlParams = new URLSearchParams(window.location.search);
        const orderId = urlParams.get('order_id');
        if (orderId) {
            rejectProofOfPayment(parseInt(orderId));
        } else {
            console.error('[Reject Proof] Order ID not found in URL');
            notify('error', 'Order ID not found. Please refresh the page.', { duration: 5000 });
        }
    }
});
