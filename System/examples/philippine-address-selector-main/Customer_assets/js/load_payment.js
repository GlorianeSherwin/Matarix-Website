/**
 * Load Payment Page
 * Loads order details for payment.html based on order_id from URL
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

// Get product image
function getProductImage(category, productName) {
    return '../Customer_assets/images/PreviewMain.png';
}

// Load order details
async function loadPaymentOrder() {
    const urlParams = new URLSearchParams(window.location.search);
    const isNewOrder = urlParams.get('new_order') === 'true';
    let orderId = urlParams.get('order_id');
    const sessionUserId = sessionStorage.getItem('user_id');
    
    console.log(`[Payment] Initial load - New Order: ${isNewOrder}, URL Order ID: ${orderId}, Session User ID: ${sessionUserId}`);
    
    // Verify session first
    if (!sessionUserId) {
        console.error('[Payment] No user ID in session, redirecting to login');
        window.location.href = '../Customer/Login.html';
        return;
    }
    
    // Note: New order flow removed - orders are created in Checkout.html first,
    // then admin approves, then customer selects payment method here
    
    // If no order_id in URL, try to get from sessionStorage or fetch latest order
    if (!orderId) {
        console.log('[Payment] No order_id in URL, fetching latest order for user');
        try {
            const response = await fetch(`../api/get_customer_orders.php`, {
                method: 'GET',
                credentials: 'include'
            });
            const data = await response.json();
            if (data.success && data.orders && data.orders.length > 0) {
                // Get the first active order (not delivered)
                for (const ord of data.orders) {
                    const deliveryResponse = await fetch(`../api/get_delivery_status.php?order_id=${ord.Order_ID}`, {
                        method: 'GET',
                        credentials: 'include'
                    });
                    const deliveryData = await deliveryResponse.json();
                    if (!deliveryData.success || !deliveryData.delivery || deliveryData.delivery.Delivery_Status !== 'Delivered') {
                        orderId = ord.Order_ID;
                        console.log(`[Payment] Selected latest order: ${orderId}`);
                        break;
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching latest order:', error);
        }
    } else {
        console.log(`[Payment] Order ID from URL: ${orderId}, verifying ownership...`);
    }
    
    if (!orderId) {
        console.error('No order_id available');
        const orderCard = document.getElementById('orderCard');
        if (orderCard) {
            orderCard.innerHTML = `
                <div class="order-item">
                    <div class="item-details">
                        <div class="item-name text-danger">Error: No order ID available</div>
                        <div class="item-description">Please go back to Order Summary and select an order.</div>
                    </div>
                </div>
            `;
        }
        return;
    }
    
    try {
        const response = await fetch(`../api/get_customer_orders.php?order_id=${orderId}`, {
            method: 'GET',
            credentials: 'include'
        });
        
        if (!response.ok) {
            if (response.status === 403 || response.status === 404) {
                console.error('[Payment] Order access denied or not found');
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
                    window.location.href = 'OrderSummary.html';
                }, 2000);
                return;
            }
        }
        
        const data = await response.json();
        
        console.log(`[Payment] API Response:`, data);
        
        if (data.success && data.order) {
            // Verify the order belongs to the logged-in user
            const sessionUserId = sessionStorage.getItem('user_id');
            const apiSessionUserId = data.session_user_id; // From PHP session
            
            console.log(`[Payment] Frontend Session User ID: ${sessionUserId}, API Session User ID: ${apiSessionUserId}, Order User ID: ${data.order.User_ID}`);
            
            // CRITICAL: Check if PHP session matches frontend session
            if (apiSessionUserId && parseInt(apiSessionUserId) !== parseInt(sessionUserId)) {
                console.error(`[Payment] CRITICAL: PHP Session User ID (${apiSessionUserId}) does not match Frontend Session User ID (${sessionUserId})`);
                if (typeof window.Notifications !== 'undefined') {
                    window.Notifications.showToast('Session Mismatch: Your session has changed. Please log out and log back in.', 'error', 5000);
                } else {
                    console.error('Session Mismatch: Your session has changed. Please log out and log back in.');
                }
                window.location.href = '../Customer/Login.html';
                return;
            }
            
            // Additional verification: Check if order has User_ID field (if API returns it)
            if (data.order.User_ID && parseInt(data.order.User_ID) !== parseInt(sessionUserId)) {
                console.error(`[Payment] SECURITY WARNING: Order User_ID (${data.order.User_ID}) does not match Session User_ID (${sessionUserId})`);
                if (typeof window.Notifications !== 'undefined') {
                    window.Notifications.showToast('Security Error: This order does not belong to you. Redirecting...', 'error', 4000);
                } else {
                    console.error('Security Error: This order does not belong to you. Redirecting...');
                }
                window.location.href = 'OrderSummary.html';
                return;
            }
            
            console.log(`[Payment] Order ID: ${data.order.Order_ID}, Order loaded successfully`);
            console.log('[Payment] Order data received:', data.order);
            console.log('[Payment] Order items:', data.order.items);
            console.log('[Payment] Order items count:', data.order.items ? data.order.items.length : 0);
            await displayPaymentOrder(data.order);
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
            } else {
                if (typeof window.Notifications !== 'undefined') {
                    window.Notifications.showToast(data.message || 'Failed to load order details. This order may not belong to you.', 'error', 5000);
                } else {
                    console.error('Failed to load order details:', data.message || 'This order may not belong to you.');
                }
            }
        }
    } catch (error) {
        console.error('Error loading order:', error);
        if (typeof window.Notifications !== 'undefined') {
            window.Notifications.showToast('Error loading order details. Please try again.', 'error', 5000);
        } else {
            console.error('Error loading order details. Please try again.');
        }
    }
}


// Display order details
async function displayPaymentOrder(order) {
    const orderCard = document.getElementById('orderCard');
    if (!orderCard) return;
    
    const orderId = order.Order_ID;
    const orderNumber = `ORD-${orderId.toString().padStart(4, '0')}`;
    const totalAmount = formatPrice(order.amount);
    const itemCount = order.items ? order.items.length : 0;
    const itemNames = order.items ? order.items.map(item => item.Product_Name).join(', ') : 'No items';
    
    
    // Check payment status and order approval status
    const paymentStatus = order.payment || 'To Pay';
    const orderStatus = order.status || 'Pending Approval';
    // Get payment method - ONLY check order.payment_method (from orders table), NOT transaction_payment_method
    // The transaction table might have old data, but we need to check if the order itself has a payment method set
    // IMPORTANT: Check for null, undefined, empty string, or 'null' string
    let paymentMethod = null;
    if (order.status && order.status !== 'Rejected') {
        // ONLY use order.payment_method, ignore transaction_payment_method for payment method selection logic
        const rawPaymentMethod = order.payment_method;
        // Only set paymentMethod if it's a valid non-empty value (not null, undefined, empty string, or string "null")
        if (rawPaymentMethod && 
            rawPaymentMethod !== 'null' && 
            rawPaymentMethod !== 'NULL' && 
            rawPaymentMethod !== '' && 
            rawPaymentMethod !== null && 
            rawPaymentMethod !== undefined) {
            paymentMethod = rawPaymentMethod;
        } else {
            paymentMethod = null; // Explicitly set to null if invalid
        }
    }
    const paymentNotice = document.getElementById('paymentNotice');
    
    console.log('[Payment] Payment Status:', paymentStatus, 'Order Status:', orderStatus, 'Payment Method:', paymentMethod);
    console.log('[Payment] Raw payment_method (from orders table):', order.payment_method, 'Raw transaction_payment_method (ignored for selection):', order.transaction_payment_method);
    console.log('[Payment] Using ONLY order.payment_method for payment method selection logic');
    
    // No approval step - treat Pending Approval as approved (legacy orders can pay immediately)
    const isRejected = orderStatus === 'Rejected';
    const isApproved = !isRejected;
    // Payment method is needed if order is approved, no payment method selected, and payment status is "To Pay" or order status is "Waiting Payment"
    // Use strict check - paymentMethod must be a valid non-empty value (not null, undefined, empty string, or string "null")
    const hasPaymentMethod = paymentMethod !== null && 
                             paymentMethod !== undefined && 
                             paymentMethod !== '' && 
                             paymentMethod !== 'null' && 
                             paymentMethod !== 'NULL' &&
                             String(paymentMethod).trim() !== '';
    const needsPaymentMethod = isApproved && !hasPaymentMethod && (paymentStatus === 'To Pay' || orderStatus === 'Waiting Payment' || orderStatus === 'Pending Approval');
    
    console.log('[Payment] isApproved:', isApproved, 'hasPaymentMethod:', hasPaymentMethod, 'needsPaymentMethod:', needsPaymentMethod, 'paymentStatus:', paymentStatus, 'orderStatus:', orderStatus);
    console.log('[Payment] paymentMethod type:', typeof paymentMethod, 'paymentMethod value:', JSON.stringify(paymentMethod));
    
    // Show payment notice if payment is "To Pay" and order is approved
    if (paymentNotice) {
        if (isRejected) {
            paymentNotice.innerHTML = `
                <i class="fas fa-times-circle"></i>
                <div class="payment-notice-text">
                    This order has been rejected. ${order.rejection_reason ? 'Reason: ' + order.rejection_reason : ''}
                </div>
            `;
            paymentNotice.style.display = 'flex';
        } else if (paymentStatus === 'To Pay' && needsPaymentMethod) {
            paymentNotice.innerHTML = `
                <i class="fas fa-exclamation-triangle"></i>
                <div class="payment-notice-text">
                    Payment Required: Please select a payment method to continue.
                </div>
            `;
            paymentNotice.style.display = 'flex';
        } else if (paymentStatus === 'To Pay') {
            paymentNotice.innerHTML = `
                <i class="fas fa-exclamation-triangle"></i>
                <div class="payment-notice-text">
                    Payment Required: Please complete your payment to continue order processing.
                </div>
            `;
            paymentNotice.style.display = 'flex';
        } else {
            paymentNotice.style.display = 'none';
        }
    } else {
        console.warn('[Payment] Payment notice element not found!');
    }
    
    // Update order card header - make sure it's clickable
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
                <i class="fas fa-receipt" style="color: var(--matarix-red-light); font-size: 1.5rem;"></i>
                <i class="fas fa-chevron-right expand-icon"></i>
            </div>
        `;
    }
    
    // Make sure the card is clickable
    orderCard.style.cursor = 'pointer';
    
    // Auto-expand the card if payment method selection is needed
    // But preserve expanded state if user already expanded it
    const wasExpanded = orderCard.classList.contains('expanded');
    if (needsPaymentMethod && !wasExpanded) {
        orderCard.classList.add('expanded');
        const expandIcon = orderCard.querySelector('.expand-icon');
        if (expandIcon) {
            expandIcon.style.transform = 'rotate(90deg)';
        }
    } else if (wasExpanded) {
        // Preserve expanded state
        orderCard.classList.add('expanded');
        const expandIcon = orderCard.querySelector('.expand-icon');
        if (expandIcon) {
            expandIcon.style.transform = 'rotate(90deg)';
        }
    }
    
    // Define toggleOrderDetails function globally
    window.toggleOrderDetails = function(event) {
        if (event) {
            event.stopPropagation();
        }
        
        const orderCard = document.getElementById('orderCard');
        if (orderCard) {
            const isExpanded = orderCard.classList.contains('expanded');
            orderCard.classList.toggle('expanded');
            
            // Rotate chevron icon
            const expandIcon = orderCard.querySelector('.expand-icon');
            if (expandIcon) {
                if (!isExpanded) {
                    expandIcon.style.transform = 'rotate(90deg)';
                } else {
                    expandIcon.style.transform = 'rotate(0deg)';
                }
            }
            
            console.log('[Payment] Order card toggled, expanded:', !isExpanded);
            const orderDetails = orderCard.querySelector('.order-details');
            console.log('[Payment] Order details element exists:', !!orderDetails);
            if (orderDetails) {
                console.log('[Payment] Order details has content:', orderDetails.innerHTML.length > 0);
                console.log('[Payment] Order details innerHTML preview:', orderDetails.innerHTML.substring(0, 200));
            }
        }
    };
    
    // Add click handler that doesn't interfere with payment options
    // Remove any existing handlers first by cloning without event listeners
    orderCard.addEventListener('click', function(event) {
        // Don't toggle if clicking on payment options, buttons, or inputs inside
        if (event.target.closest('.payment-option') || 
            event.target.closest('button') || 
            event.target.closest('input[type="radio"]') ||
            event.target.closest('label')) {
            return;
        }
        // Use the global toggleOrderDetails function
        if (typeof window.toggleOrderDetails === 'function') {
            window.toggleOrderDetails(event);
        }
    });
    
    // Update order details section - populate with order items
    const orderDetails = orderCard.querySelector('.order-details');
    console.log('[Payment] Order details element:', orderDetails);
    console.log('[Payment] Order items:', order.items);
    console.log('[Payment] Order items length:', order.items ? order.items.length : 0);
    
    if (orderDetails) {
        if (order.items && order.items.length > 0) {
            console.log('[Payment] Populating order details with', order.items.length, 'items');
            let itemsHTML = '';
            let subtotal = 0;
        
        order.items.forEach((item, index) => {
            const itemTotal = item.Price * item.Quantity;
            subtotal += itemTotal;
            
            // Build dimensions string
            let dimensions = '';
            if (item.length && item.Width && item.Unit) {
                dimensions = `${item.length}${item.Unit} x ${item.Width}${item.Unit}`;
            } else if (item.length && item.Width) {
                dimensions = `${item.length} x ${item.Width}`;
            } else if (item.length && item.Unit) {
                dimensions = `${item.length}${item.Unit}`;
            } else if (item.length) {
                dimensions = `${item.length}`;
            } else if (item.Width && item.Unit) {
                dimensions = `${item.Width}${item.Unit}`;
            } else if (item.Width) {
                dimensions = `${item.Width}`;
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
                <div class="summary-item">
                    <div class="summary-item-image">📦</div>
                    <div class="summary-item-details">
                        <div class="summary-item-name">${escapeHtml(item.Product_Name || 'Unknown Product')}</div>
                        <div class="summary-item-specs">${escapeHtml(specsText)}</div>
                    </div>
                    <div class="summary-item-price">${formatPrice(itemTotal)}</div>
                </div>
            `;
        });
        
        // Build payment method selection section
        let paymentMethodSection = '';
        if (isRejected) {
            // Order was rejected
            paymentMethodSection = `
                <div class="payment-status-info">
                    <div class="alert alert-danger" style="margin-top: 20px;">
                        <i class="fas fa-times-circle mr-2"></i>
                        <strong>Order Rejected</strong><br>
                        This order has been rejected. ${order.rejection_reason ? 'Reason: ' + order.rejection_reason : ''}
                    </div>
                </div>
            `;
        } else if (needsPaymentMethod) {
            // Order is approved but payment method not selected - show options based on delivery method
            // Pick Up: On-Site + GCash  |  Standard Delivery: Cash on Delivery (COD) + GCash
            const deliveryMethod = String(order.delivery_method || 'Standard Delivery').trim().toLowerCase();
            const isPickUp = deliveryMethod === 'pick up';
            console.log('[Payment] Delivery method:', order.delivery_method, '→ normalized:', deliveryMethod, '→ isPickUp:', isPickUp, '→ showing:', isPickUp ? 'On-Site + GCash' : 'COD + GCash');
            
            const onsiteOption = isPickUp ? `
                        <div class="payment-method-option" onclick="selectPaymentMethod('On-Site', ${orderId})" id="payment-option-onsite-${orderId}">
                            <div class="payment-icon onsite">
                                <i class="fas fa-handshake"></i>
                            </div>
                            <div class="payment-details">
                                <h6>Pay On-Site</h6>
                                <p>Pay when you pick up your order</p>
                            </div>
                            <input type="radio" name="payment-${orderId}" value="On-Site" id="payment-onsite-${orderId}" style="display: none;">
                        </div>
            ` : '';
            
            const codOption = !isPickUp ? `
                        <div class="payment-method-option" onclick="selectPaymentMethod('Cash on Delivery', ${orderId})" id="payment-option-cashondelivery-${orderId}">
                            <div class="payment-icon cod">
                                <i class="fas fa-money-bill-wave"></i>
                            </div>
                            <div class="payment-details">
                                <h6>Cash on Delivery (COD)</h6>
                                <p>Pay in cash when your order is delivered</p>
                            </div>
                            <input type="radio" name="payment-${orderId}" value="Cash on Delivery" id="payment-cod-${orderId}" style="display: none;">
                        </div>
            ` : '';
            
            paymentMethodSection = `
                <div class="payment-method-selection">
                    <div class="payment-header">Select Payment Method</div>
                    <div class="payment-methods">
                        ${onsiteOption}
                        ${codOption}
                        <div class="payment-method-option" onclick="selectPaymentMethod('GCash', ${orderId})" id="payment-option-gcash-${orderId}">
                            <div class="payment-icon gcash">
                                <i class="fab fa-google-pay"></i>
                            </div>
                            <div class="payment-details">
                                <h6>GCash (Online Payment)</h6>
                                <p>Pay instantly via GCash QR code or mobile number</p>
                            </div>
                            <input type="radio" name="payment-${orderId}" value="GCash" id="payment-gcash-${orderId}" style="display: none;">
                        </div>
                    </div>
                    <button class="btn btn-primary mt-3" id="confirmPaymentBtn-${orderId}" onclick="if(typeof confirmPaymentMethod === 'function') { confirmPaymentMethod(${orderId}); } else { console.error('confirmPaymentMethod function not available'); if(typeof window.Notifications !== 'undefined') { window.Notifications.showToast('Payment function not loaded. Please refresh the page.', 'error', 5000); } else { alert('Payment function not loaded. Please refresh the page.'); } }" disabled style="width: 100%; padding: 12px; font-size: 1rem; font-weight: 600; border-radius: 25px;">
                        <i class="fas fa-check-circle mr-2"></i>Confirm Payment Method
                    </button>
                </div>
            `;
        } else if (isApproved && paymentMethod && 
                   paymentMethod !== 'null' && 
                   paymentMethod !== 'NULL' && 
                   paymentMethod !== '' && 
                   paymentMethod !== null && 
                   paymentMethod !== undefined) {
            // Show current payment method and status (payment method already selected)
            // If GCash and status is "Waiting Payment" with "To Pay", allow reupload
            const canReupload = paymentMethod === 'GCash' && orderStatus === 'Waiting Payment' && paymentStatus === 'To Pay';
            
            paymentMethodSection = `
                <div class="payment-status-info">
                    <div class="payment-status-header">Payment Method:</div>
                    <div class="payment-method-display">
                        <i class="fas fa-${paymentMethod === 'GCash' ? 'credit-card' : 'money-bill-wave'}"></i>
                        <span>${paymentMethod === 'GCash' ? 'GCash' : (paymentMethod === 'On-Site' ? 'On-Site' : (paymentMethod === 'Cash on Delivery' ? 'Cash on Delivery (COD)' : paymentMethod))}</span>
                    </div>
                    <div class="payment-status-header" style="margin-top: 15px;">Payment Status:</div>
                    <div class="payment-status-badge ${paymentStatus === 'Paid' ? 'status-paid' : 'status-pending'}">
                        <i class="fas fa-${paymentStatus === 'Paid' ? 'check-circle' : 'clock'}"></i>
                        ${paymentStatus === 'Paid' ? 'Paid' : 'Pending Payment'}
                    </div>
                    ${canReupload ? `
                        <div style="margin-top: 20px; padding: 15px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px;">
                            <p style="margin: 0 0 10px 0; font-weight: 600; color: #856404;">
                                <i class="fas fa-exclamation-triangle"></i> Action Required
                            </p>
                            <p style="margin: 0 0 15px 0; color: #856404; font-size: 0.9rem;">
                                Please upload or reupload your proof of payment.
                            </p>
                            <button class="btn btn-warning btn-sm" onclick="showQRPopupForOrder(${orderId})" style="width: 100%;">
                                <i class="fas fa-upload mr-2"></i>Upload Proof of Payment
                            </button>
                        </div>
                    ` : ''}
                </div>
            `;
        } else {
            // Approved but no payment method selected (shouldn't happen, but handle it)
            paymentMethodSection = `
                <div class="payment-status-info">
                    <div class="alert alert-warning" style="margin-top: 20px;">
                        <i class="fas fa-exclamation-triangle mr-2"></i>
                        Please select a payment method to continue.
                    </div>
                </div>
            `;
        }
        
        // Get discount information if available
        const discountAmount = parseFloat(order.Discount || 0);
        const transactionSubtotal = parseFloat(order.Subtotal || subtotal);
        const finalAmount = parseFloat(order.Transaction_Total || order.amount || subtotal);
        const discountPercentage = discountAmount > 0 && transactionSubtotal > 0 
            ? Math.round((discountAmount / transactionSubtotal) * 100) 
            : 0;
        
        let discountHTML = '';
        if (discountAmount > 0) {
            discountHTML = `
                <div class="summary-discount" style="color: #28a745;">
                    <span>Volume Discount (${discountPercentage}%):</span>
                    <span>-${formatPrice(discountAmount)}</span>
                </div>
            `;
        }
        
        // Build receipt link section - show for all approved orders
        let receiptLinkSection = '';
        if (isApproved) {
            const receiptUrl = `receipt.html?order_id=${orderId}`;
            receiptLinkSection = `
                <div class="receipt-link-section" style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #dee2e6;">
                    <a href="${receiptUrl}" class="receipt-link" style="display: inline-block; font-size: 16px; font-weight: 600; color: #007bff; text-decoration: none; cursor: pointer; transition: color 0.2s ease;">
                        <i class="fas fa-receipt" style="margin-right: 8px;"></i>View Receipt
                    </a>
                </div>
            `;
        }
        
        orderDetails.innerHTML = `
            <div class="order-summary">
                <div class="summary-header">Order Summary</div>
                ${itemsHTML}
                <div class="summary-subtotal">
                    <span>Subtotal:</span>
                    <span>${formatPrice(transactionSubtotal || subtotal)}</span>
                </div>
                ${discountHTML}
                <div class="summary-delivery-fee" style="display: flex; justify-content: space-between; padding: 10px 0; border-top: 1px solid #dee2e6; margin-top: 10px;">
                    <span>Delivery Fee:</span>
                    <span style="color: #28a745; font-weight: 600;">Free Delivery</span>
                </div>
                <div class="summary-total">
                    <span class="total-label">TOTAL:</span>
                    <span class="total-amount">${formatPrice(finalAmount)}</span>
                </div>
            </div>
            ${paymentMethodSection}
            ${receiptLinkSection}
        `;
        } else {
            // No items found
            console.warn('[Payment] Order has no items!');
            
            // Build receipt link section for approved orders even if no items
            let receiptLinkSection = '';
            if (isApproved) {
                const receiptUrl = `receipt.html?order_id=${orderId}`;
                receiptLinkSection = `
                    <div class="receipt-link-section" style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #dee2e6;">
                        <a href="${receiptUrl}" class="receipt-link" style="display: inline-block; font-size: 16px; font-weight: 600; color: #007bff; text-decoration: none; cursor: pointer; transition: color 0.2s ease;">
                            <i class="fas fa-receipt" style="margin-right: 8px;"></i>View Receipt
                        </a>
                    </div>
                `;
            }
            
            orderDetails.innerHTML = `
                <div class="order-summary">
                    <div class="summary-header">Order Summary</div>
                    <div class="no-items-message">No items found in this order.</div>
                </div>
                ${paymentMethodSection}
                ${receiptLinkSection}
            `;
        }
    } else {
        console.error('[Payment] Order details element not found!');
    }
    
    // Store order data for navigation tracker - make sure status is preserved
    window.currentOrderData = {
        ...order,
        status: order.status || 'Pending Approval' // Ensure status is always set, default to Pending Approval
    };
    
    console.log(`[Payment] Order loaded - Status: "${window.currentOrderData.status}", Order ID: ${order.Order_ID}`);
    console.log(`[Payment] Payment Method: "${window.currentOrderData.payment_method}", Payment Status: "${window.currentOrderData.payment}"`);
    console.log(`[Payment] Full order data stored:`, window.currentOrderData);
    
    // Update progress tracker after order data is loaded
    // Try multiple times to ensure tracker is ready
    let attempts = 0;
    const maxAttempts = 10;
    const updateTracker = () => {
        attempts++;
        const tracker = document.querySelector('.progress-tracker-container');
        if (tracker) {
            console.log(`[Payment] Tracker found, updating (attempt ${attempts})`);
            // Regenerate tracker to ensure it shows correct steps
            if (window.MatarixNavigation && window.MatarixNavigation.regenerateTracker) {
                window.MatarixNavigation.regenerateTracker();
            } else {
                updateProgressTracker();
            }
        } else if (attempts < maxAttempts) {
            console.log(`[Payment] Tracker not found yet, retrying (attempt ${attempts}/${maxAttempts})`);
            setTimeout(updateTracker, 200);
        } else {
            console.warn(`[Payment] Tracker not found after ${maxAttempts} attempts`);
        }
    };
    
    // Start trying to update after a short delay
    setTimeout(updateTracker, 600);
    
    // Set up periodic refresh to get latest order status from database
    // Only refresh payment notice, not the entire order card to avoid disrupting user interaction
    if (window.paymentOrderRefreshInterval) {
        clearInterval(window.paymentOrderRefreshInterval);
    }
    
    window.paymentOrderRefreshInterval = setInterval(async () => {
        // Only refresh if user is not actively interacting (no popup open, no file input active)
        const qrPopup = document.getElementById('qrPaymentPopup');
        const isPopupOpen = qrPopup && qrPopup.style.display !== 'none' && qrPopup.classList.contains('show');
        const isFileInputActive = document.activeElement && document.activeElement.type === 'file';
        
        if (!isPopupOpen && !isFileInputActive) {
            await refreshOrderData(order.Order_ID);
        }
    }, 15000); // Refresh every 15 seconds (less frequent to avoid disrupting user)
    
    // Don't call initMatarixNavigation here - navigation.js handles it on page load
    // The tracker will update automatically when getCurrentStep() is called
}

// Refresh order data from database
async function refreshOrderData(orderId) {
    try {
        const response = await fetch(`../api/get_customer_orders.php?order_id=${orderId}`, {
            method: 'GET',
            credentials: 'include'
        });
        
        if (!response.ok) {
            if (response.status === 403 || response.status === 404) {
                console.error('[Refresh] Order access denied or not found');
                // Order doesn't belong to user or doesn't exist - stop refreshing
                if (window.paymentOrderRefreshInterval) {
                    clearInterval(window.paymentOrderRefreshInterval);
                }
                // Redirect to OrderSummary
                if (typeof window.Notifications !== 'undefined') {
                    window.Notifications.showToast('This order does not belong to you. Redirecting to Order Summary...', 'warning', 3000);
                } else {
                    console.warn('This order does not belong to you. Redirecting to Order Summary...');
                }
                window.location.href = 'OrderSummary.html';
                return;
            }
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
            
            // Preserve expanded state of order card
            const orderCard = document.getElementById('orderCard');
            const wasExpanded = orderCard && orderCard.classList.contains('expanded');
            
            // Update payment notice visibility if status changed (lightweight update only)
            const paymentStatus = data.order.payment || 'To Pay';
            const orderStatus = data.order.status || 'Pending Approval';
            // Get payment method - ONLY from orders table, not transaction table
            let paymentMethod = null;
            if (orderStatus && orderStatus !== 'Pending Approval' && orderStatus !== 'Rejected') {
                const rawPaymentMethod = data.order.payment_method;
                if (rawPaymentMethod && 
                    rawPaymentMethod !== 'null' && 
                    rawPaymentMethod !== 'NULL' && 
                    rawPaymentMethod !== '' && 
                    rawPaymentMethod !== null && 
                    rawPaymentMethod !== undefined) {
                    paymentMethod = rawPaymentMethod;
                }
            }
            const paymentNotice = document.getElementById('paymentNotice');
            
            // Check approval status
            const isRejected = orderStatus === 'Rejected';
            const isApproved = !isRejected;
            
            // Only update payment notice, don't re-render entire order card
            if (paymentNotice) {
                if (isRejected) {
                    paymentNotice.innerHTML = `
                        <i class="fas fa-times-circle"></i>
                        <div class="payment-notice-text">
                            This order has been rejected. ${data.order.rejection_reason ? 'Reason: ' + data.order.rejection_reason : ''}
                        </div>
                    `;
                    paymentNotice.style.display = 'flex';
                } else if (paymentStatus === 'To Pay' && isApproved && !paymentMethod) {
                    paymentNotice.innerHTML = `
                        <i class="fas fa-exclamation-triangle"></i>
                        <div class="payment-notice-text">
                            Payment Required: Please select a payment method to continue.
                        </div>
                    `;
                    paymentNotice.style.display = 'flex';
                } else if (paymentStatus === 'To Pay') {
                    paymentNotice.innerHTML = `
                        <i class="fas fa-exclamation-triangle"></i>
                        <div class="payment-notice-text">
                            Payment Required: Please complete your payment to continue order processing.
                        </div>
                    `;
                    paymentNotice.style.display = 'flex';
                } else {
                    paymentNotice.style.display = 'none';
                }
            } else {
                console.warn('[Refresh] Payment notice element not found!');
            }
            
            // Always update the progress tracker to ensure it reflects current state
            // This handles cases where status might have changed externally
            if (oldStatus !== newStatus && oldStatus !== 'Unknown') {
                console.log(`Order status changed: ${oldStatus} -> ${newStatus}`);
                // Re-display order to update UI
                await displayPaymentOrder(data.order);
            } else {
                // Even if status didn't change, update payment method display if it changed
                const oldPaymentMethod = window.currentOrderData?.payment_method;
                const newPaymentMethod = paymentMethod;
                if (oldPaymentMethod !== newPaymentMethod) {
                    console.log(`Payment method changed: ${oldPaymentMethod} -> ${newPaymentMethod}`);
                    await displayPaymentOrder(data.order);
                }
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
    if (window.paymentOrderRefreshInterval) {
        clearInterval(window.paymentOrderRefreshInterval);
    }
});
// Payment method selection functions
let selectedPaymentMethod = null;

function selectPaymentMethod(method, orderId) {
    console.log('[Payment] selectPaymentMethod called:', method, orderId);
    
    // Validate inputs
    if (!method) {
        console.error('[Payment] No payment method provided');
        return;
    }
    if (!orderId) {
        console.error('[Payment] No orderId provided');
        return;
    }
    
    selectedPaymentMethod = method;
    console.log('[Payment] selectedPaymentMethod set to:', selectedPaymentMethod);
    
    // Update UI - find all payment method options for this order
    const orderDetails = document.querySelector('.order-details');
    if (orderDetails) {
        // Remove selected class from all payment method options
        orderDetails.querySelectorAll('.payment-method-option').forEach(option => {
            option.classList.remove('selected');
        });
        
        // Find the clicked option by method value
        const methodLower = method.toLowerCase().replace(/\s+/g, ''); // Remove spaces and convert to lowercase
        const optionId = `payment-option-${methodLower}-${orderId}`;
        console.log('[Payment] Looking for option with ID:', optionId);
        const selectedOption = document.getElementById(optionId);
        
        if (selectedOption) {
            console.log('[Payment] Found option, selecting it');
            selectedOption.classList.add('selected');
            const radio = selectedOption.querySelector('input[type="radio"]');
            if (radio) {
                radio.checked = true;
                console.log('[Payment] Radio button checked:', radio.value);
            }
        } else {
            console.warn('[Payment] Option not found with ID:', optionId);
            // Fallback: try to find by onclick attribute or data attribute
            const allOptions = orderDetails.querySelectorAll('.payment-method-option');
            let found = false;
            allOptions.forEach(option => {
                const onclickAttr = option.getAttribute('onclick') || '';
                if (onclickAttr.includes(method)) {
                    option.classList.add('selected');
                    const radio = option.querySelector('input[type="radio"]');
                    if (radio) {
                        radio.checked = true;
                        found = true;
                    }
                }
            });
            if (!found) {
                console.error('[Payment] Could not find payment option for method:', method);
            }
        }
    } else {
        console.warn('[Payment] Order details element not found');
    }
    
    // Enable confirm button
    const confirmBtn = document.getElementById(`confirmPaymentBtn-${orderId}`);
    if (confirmBtn) {
        confirmBtn.disabled = false;
        console.log('[Payment] Confirm button enabled for order:', orderId);
    } else {
        console.warn('[Payment] Confirm button not found:', `confirmPaymentBtn-${orderId}`);
        // Try to find button without orderId suffix as fallback
        const fallbackBtn = document.querySelector('[id^="confirmPaymentBtn"]');
        if (fallbackBtn) {
            fallbackBtn.disabled = false;
            console.log('[Payment] Found fallback confirm button and enabled it');
        }
    }
}

// Store current order ID for QR popup
let currentOrderIdForPayment = null;
let uploadedProofOfPayment = null;

async function confirmPaymentMethod(orderId) {
    console.log('[Confirm Payment Method] Function called with orderId:', orderId);
    console.log('[Confirm Payment Method] selectedPaymentMethod:', selectedPaymentMethod);
    
    // Validate orderId
    if (!orderId) {
        console.error('[Confirm Payment Method] No orderId provided');
        if (typeof window.Notifications !== 'undefined') {
            window.Notifications.showToast('Order ID is missing. Please refresh the page.', 'error', 5000);
        } else {
            alert('Order ID is missing. Please refresh the page.');
        }
        return;
    }
    
    // Check if payment method is selected
    if (!selectedPaymentMethod) {
        console.warn('[Confirm Payment Method] No payment method selected');
        // Try to get selected payment method from radio button as fallback
        const orderDetails = document.querySelector('.order-details');
        if (orderDetails) {
            const selectedRadio = orderDetails.querySelector(`input[name="payment-${orderId}"]:checked`);
            if (selectedRadio) {
                selectedPaymentMethod = selectedRadio.value;
                console.log('[Confirm Payment Method] Found payment method from radio:', selectedPaymentMethod);
            }
        }
        
        if (!selectedPaymentMethod) {
            if (typeof window.Notifications !== 'undefined') {
                window.Notifications.showToast('Please select a payment method first.', 'warning', 4000);
            } else {
                console.warn('Please select a payment method first.');
                alert('Please select a payment method first.');
            }
            return;
        }
    }
    
    console.log('[Confirm Payment Method] Proceeding with payment method:', selectedPaymentMethod);
    currentOrderIdForPayment = orderId;
    
    // Disable button to prevent double-clicking
    const confirmBtn = document.getElementById(`confirmPaymentBtn-${orderId}`);
    const originalButtonText = confirmBtn ? confirmBtn.innerHTML : null;
    
    if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Processing...';
    }
    
    try {
        // If GCash, show QR code popup
        if (selectedPaymentMethod === 'GCash') {
            // Use the helper function that handles calculation
            await showQRPopupForOrder(orderId);
            // Restore button since user needs to interact with QR popup first
            // The actual payment processing happens when they click "Confirm Payment" in the popup
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.innerHTML = originalButtonText || '<i class="fas fa-check-circle mr-2"></i>Confirm Payment Method';
            }
        } else {
            // For On-Site or Cash on Delivery, process directly (no QR popup)
            // processPayment will restore the button
            await processPayment(orderId, selectedPaymentMethod, null);
        }
    } catch (error) {
        console.error('[Confirm Payment Method] Error:', error);
        // Re-enable button on error
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = originalButtonText || '<i class="fas fa-check-circle mr-2"></i>Confirm Payment Method';
        }
        if (typeof window.Notifications !== 'undefined') {
            window.Notifications.showToast('An error occurred. Please try again.', 'error', 5000);
        } else {
            alert('An error occurred. Please try again.');
        }
    }
}

// Show QR Code Popup for a specific order (calculates final amount)
async function showQRPopupForOrder(orderId) {
    console.log('[QR Popup] showQRPopupForOrder called for orderId:', orderId);
    
    try {
        // First, try to get the amount from the displayed order summary
        const displayedTotalElement = document.querySelector('.summary-total .total-amount');
        if (displayedTotalElement) {
            const displayedTotalText = displayedTotalElement.textContent || displayedTotalElement.innerText;
            // Extract number from formatted price (e.g., "₱2,975.00" -> 2975.00)
            const extractedAmount = parseFloat(displayedTotalText.replace(/[₱,]/g, '').trim());
            if (!isNaN(extractedAmount) && extractedAmount > 0) {
                console.log('[QR Popup] Using displayed total amount:', extractedAmount);
                showQRPopup(extractedAmount);
                return;
            }
        }
        
        // Fallback: Try to use already loaded order data
        let order = window.currentOrderData;
        
        // If not available or order ID doesn't match, fetch from API
        if (!order || parseInt(order.Order_ID) !== parseInt(orderId)) {
            console.log('[QR Popup] Fetching order data from API for order ID:', orderId);
            order = await getOrderData(orderId);
        }
        
        if (order) {
            console.log('[QR Popup] Using order data:', order);
            
            // Calculate subtotal from items
            let subtotal = 0;
            if (order.items && order.items.length > 0) {
                order.items.forEach(item => {
                    const itemPrice = parseFloat(item.Price || item.price || 0);
                    const itemQty = parseInt(item.Quantity || item.quantity || 0);
                    subtotal += itemPrice * itemQty;
                });
            }
            
            // Get discount information
            const discountAmount = parseFloat(order.Discount || order.discount || 0);
            const transactionSubtotal = parseFloat(order.Subtotal || order.subtotal || subtotal);
            
            // Calculate final amount (subtotal - discount + delivery fee)
            // Delivery fee is always 0 (free delivery)
            const deliveryFee = 0;
            let finalAmount = transactionSubtotal - discountAmount + deliveryFee;
            
            // If finalAmount is 0 or invalid, try to get from order.amount or Transaction_Total
            if (finalAmount <= 0 || isNaN(finalAmount)) {
                finalAmount = parseFloat(order.Transaction_Total || order.transaction_total || order.amount || 0);
            }
            
            console.log('[QR Popup] Calculation:', {
                subtotal,
                transactionSubtotal,
                discountAmount,
                deliveryFee,
                calculatedFinalAmount: transactionSubtotal - discountAmount + deliveryFee,
                finalAmount,
                orderAmount: order.amount,
                transactionTotal: order.Transaction_Total
            });
            
            if (finalAmount > 0) {
                showQRPopup(finalAmount);
            } else {
                console.error('[QR Popup] Final amount is 0 or invalid. Order data:', order);
                showQRPopup(0);
            }
        } else {
            console.error('[QR Popup] Order data not found for order ID:', orderId);
            showQRPopup(0);
        }
    } catch (error) {
        console.error('[QR Popup] Error in showQRPopupForOrder:', error);
        throw error; // Re-throw so confirmPaymentMethod can handle it
    }
}

// Show QR Code Popup
function showQRPopup(amount) {
    console.log('[QR Popup] showQRPopup called with amount:', amount);
    
    const popup = document.getElementById('qrPaymentPopup');
    const qrAmount = document.getElementById('qrAmount');
    
    if (!popup) {
        console.error('[QR Popup] QR popup element not found!');
        if (typeof window.Notifications !== 'undefined') {
            window.Notifications.showToast('QR popup element not found. Please refresh the page.', 'error', 5000);
        }
        return;
    }
    
    if (qrAmount) {
        qrAmount.textContent = formatPrice(amount);
    }
    
    // Generate QR code (using a simple placeholder or QR code library)
    try {
        generateQRCode(amount);
    } catch (error) {
        console.error('[QR Popup] Error generating QR code:', error);
    }
    
    // Reset proof upload
    uploadedProofOfPayment = null;
    const proofPreview = document.getElementById('proofPreview');
    const proofPreviewImg = document.getElementById('proofPreviewImg');
    const confirmBtn = document.getElementById('confirmGCashPaymentBtn');
    
    if (proofPreview) {
        proofPreview.style.display = 'none';
    }
    if (proofPreviewImg) {
        proofPreviewImg.src = '';
    }
    if (confirmBtn) {
        confirmBtn.disabled = true;
    }
    
    // Show popup
    console.log('[QR Popup] Showing popup');
    popup.style.display = 'flex';
    popup.style.opacity = '0';
    popup.style.visibility = 'visible';
    popup.style.pointerEvents = 'auto'; // Enable pointer events for the overlay
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    
    // Ensure popup content can receive clicks
    const popupContent = popup.querySelector('.popup-content');
    if (popupContent) {
        popupContent.style.pointerEvents = 'auto';
    }
    
    // Use requestAnimationFrame for smooth transition
    requestAnimationFrame(() => {
        setTimeout(() => {
            popup.classList.add('show');
            popup.style.opacity = '1';
            popup.style.pointerEvents = 'auto'; // Ensure pointer events are enabled
            console.log('[QR Popup] Popup shown successfully');
            
            // Setup upload button click handler after popup is shown
            setupProofUploadButton();
        }, 10);
    });
}

// Setup Proof Upload Button Click Handler
function setupProofUploadButton() {
    console.log('[Upload] Setting up proof upload button');
    
    const uploadLabel = document.querySelector('label[for="proofOfPaymentInput"]');
    const fileInput = document.getElementById('proofOfPaymentInput');
    
    if (!fileInput) {
        console.error('[Upload] File input not found!');
        return;
    }
    
    if (!uploadLabel) {
        console.error('[Upload] Upload label not found!');
        return;
    }
    
    console.log('[Upload] Found file input and label');
    
    // Remove any existing click handlers to avoid duplicates
    const newLabel = uploadLabel.cloneNode(true);
    uploadLabel.parentNode.replaceChild(newLabel, uploadLabel);
    
    // Add click handler to label
    newLabel.addEventListener('click', function(e) {
        console.log('[Upload] Label clicked');
        e.preventDefault();
        e.stopPropagation();
        
        if (fileInput) {
            console.log('[Upload] Triggering file input click');
            fileInput.click();
        } else {
            console.error('[Upload] File input not found when trying to click');
        }
    });
    
    // Ensure change event is properly attached
    if (fileInput) {
        // Remove existing change handler to avoid duplicates
        const newInput = fileInput.cloneNode(true);
        fileInput.parentNode.replaceChild(newInput, fileInput);
        
        newInput.addEventListener('change', function(e) {
            console.log('[Upload] File input change event fired');
            console.log('[Upload] Selected file:', e.target.files[0] ? e.target.files[0].name : 'none');
            
            if (typeof handleProofUpload === 'function') {
                console.log('[Upload] Calling handleProofUpload');
                handleProofUpload(e);
            } else {
                console.error('[Upload] handleProofUpload function not found!');
                if (typeof window.handleProofUpload === 'function') {
                    console.log('[Upload] Using window.handleProofUpload');
                    window.handleProofUpload(e);
                } else {
                    console.error('[Upload] window.handleProofUpload also not found!');
                    alert('Upload function not available. Please refresh the page.');
                }
            }
        });
        
        console.log('[Upload] File input change handler attached');
    }
}

// Close QR Code Popup
function closeQRPopup() {
    const popup = document.getElementById('qrPaymentPopup');
    if (popup) {
        popup.classList.remove('show');
        popup.style.pointerEvents = 'none'; // Disable pointer events when closing
        // Restore body scroll
        document.body.style.overflow = '';
        setTimeout(() => {
            popup.style.display = 'none';
            popup.style.visibility = 'hidden';
        }, 300);
    }
    
    // Reset proof upload
    uploadedProofOfPayment = null;
    const proofInput = document.getElementById('proofOfPaymentInput');
    const proofPreview = document.getElementById('proofPreview');
    const proofPreviewImg = document.getElementById('proofPreviewImg');
    const confirmBtn = document.getElementById('confirmGCashPaymentBtn');
    
    if (proofInput) {
        proofInput.value = '';
    }
    if (proofPreview) {
        proofPreview.style.display = 'none';
    }
    if (proofPreviewImg) {
        proofPreviewImg.src = '';
    }
    if (confirmBtn) {
        confirmBtn.disabled = true;
    }
}

// Generate QR Code (display actual QR code image)
function generateQRCode(amount) {
    const qrContainer = document.getElementById('qrCodeContainer');
    if (!qrContainer) return;
    
    // Display the actual QR code image
    qrContainer.innerHTML = `
        <img src="../QRCode.jpg" alt="GCash QR Code" id="qrCodeImage" style="width: 200px; height: 200px; object-fit: contain; border-radius: 10px; margin: 0 auto; display: block; border: 2px solid #dee2e6;">
    `;
}

// Handle Proof of Payment Upload
async function handleProofUpload(event) {
    console.log('[handleProofUpload] Function called');
    console.log('[handleProofUpload] Event:', event);
    console.log('[handleProofUpload] Event target:', event.target);
    
    const file = event.target.files[0];
    console.log('[handleProofUpload] Selected file:', file ? file.name : 'none');
    
    if (!file) {
        console.warn('[handleProofUpload] No file selected');
        return;
    }
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
        if (typeof window.Notifications !== 'undefined') {
            window.Notifications.showToast('Please upload an image file.', 'warning', 4000);
        } else {
            console.warn('Please upload an image file.');
        }
        return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        if (typeof window.Notifications !== 'undefined') {
            window.Notifications.showToast('File size must be less than 5MB.', 'warning', 4000);
        } else {
            console.warn('File size must be less than 5MB.');
        }
        return;
    }
    
    // Show preview
    const reader = new FileReader();
    reader.onload = function(e) {
        const proofPreview = document.getElementById('proofPreview');
        const proofPreviewImg = document.getElementById('proofPreviewImg');
        const confirmBtn = document.getElementById('confirmGCashPaymentBtn');
        
        if (proofPreviewImg) {
            proofPreviewImg.src = e.target.result;
        }
        if (proofPreview) {
            proofPreview.style.display = 'block';
        }
        if (confirmBtn) {
            confirmBtn.disabled = false;
        }
    };
    reader.readAsDataURL(file);
    
    // Upload file to server
    const formData = new FormData();
    formData.append('image', file);
    formData.append('type', 'proof_of_payment');
    
    try {
        const uploadResponse = await fetch('../api/upload_image.php', {
            method: 'POST',
            credentials: 'include',
            body: formData
        });
        
        const uploadData = await uploadResponse.json();
        
        if (uploadData.success) {
            // Handle escaped slashes in the file path
            let filePath = uploadData.file_path;
            if (typeof filePath === 'string') {
                // Remove escaped slashes if present
                filePath = filePath.replace(/\\\//g, '/');
            }
            
            uploadedProofOfPayment = filePath;
            console.log('✅ [handleProofUpload] Proof of payment uploaded successfully');
            console.log('✅ [handleProofUpload] Original file_path from API:', uploadData.file_path);
            console.log('✅ [handleProofUpload] Cleaned file_path stored:', uploadedProofOfPayment);
            console.log('✅ [handleProofUpload] Variable type:', typeof uploadedProofOfPayment);
            console.log('✅ [handleProofUpload] Variable value:', uploadedProofOfPayment);
        } else {
            if (typeof window.Notifications !== 'undefined') {
                window.Notifications.showToast('Failed to upload receipt: ' + uploadData.message, 'error', 5000);
            } else {
                console.error('Failed to upload receipt:', uploadData.message);
            }
            // Reset preview
            const proofInput = document.getElementById('proofOfPaymentInput');
            const proofPreview = document.getElementById('proofPreview');
            const proofPreviewImg = document.getElementById('proofPreviewImg');
            const confirmBtn = document.getElementById('confirmGCashPaymentBtn');
            
            if (proofInput) {
                proofInput.value = '';
            }
            if (proofPreview) {
                proofPreview.style.display = 'none';
            }
            if (proofPreviewImg) {
                proofPreviewImg.src = '';
            }
            if (confirmBtn) {
                confirmBtn.disabled = true;
            }
        }
    } catch (error) {
        console.error('Upload error:', error);
        if (typeof window.Notifications !== 'undefined') {
            window.Notifications.showToast('Failed to upload receipt. Please try again.', 'error', 5000);
        } else {
            console.error('Failed to upload receipt. Please try again.');
        }
    }
}

// Remove Proof Upload
function removeProofUpload() {
    uploadedProofOfPayment = null;
    const proofInput = document.getElementById('proofOfPaymentInput');
    const proofPreview = document.getElementById('proofPreview');
    const proofPreviewImg = document.getElementById('proofPreviewImg');
    const confirmBtn = document.getElementById('confirmGCashPaymentBtn');
    
    if (proofInput) {
        proofInput.value = '';
    }
    if (proofPreview) {
        proofPreview.style.display = 'none';
    }
    if (proofPreviewImg) {
        proofPreviewImg.src = '';
    }
    if (confirmBtn) {
        confirmBtn.disabled = true;
    }
}

// Confirm GCash Payment
async function confirmGCashPayment() {
    console.log('🔵 [confirmGCashPayment] Function called');
    console.log('🔵 [confirmGCashPayment] currentOrderIdForPayment:', currentOrderIdForPayment);
    console.log('🔵 [confirmGCashPayment] uploadedProofOfPayment BEFORE save:', uploadedProofOfPayment);
    
    // If currentOrderIdForPayment is not set, try to get it from URL
    if (!currentOrderIdForPayment) {
        const urlParams = new URLSearchParams(window.location.search);
        const orderIdFromUrl = urlParams.get('order_id');
        if (orderIdFromUrl) {
            console.log('[Payment] Order ID not set, but found in URL:', orderIdFromUrl);
            currentOrderIdForPayment = parseInt(orderIdFromUrl);
        } else {
            if (typeof window.Notifications !== 'undefined') {
                window.Notifications.showToast('Order ID not found. Please try again.', 'error', 4000);
            } else {
                console.error('Order ID not found. Please try again.');
            }
            return;
        }
    }
    
    // Save proof of payment value BEFORE closing popup (closeQRPopup resets it)
    const proofOfPaymentPath = uploadedProofOfPayment;
    const orderId = currentOrderIdForPayment;
    
    console.log('💾 [confirmGCashPayment] Saving proof of payment before closing popup:', proofOfPaymentPath);
    console.log('💾 [confirmGCashPayment] Order ID:', orderId);
    console.log('💾 [confirmGCashPayment] Proof path type:', typeof proofOfPaymentPath);
    console.log('💾 [confirmGCashPayment] Proof path value:', proofOfPaymentPath);
    
    // Close popup (this will reset uploadedProofOfPayment, but we saved it above)
    closeQRPopup();
    
    // Verify the saved value is still there after closing popup
    console.log('✅ [confirmGCashPayment] Proof path after closeQRPopup:', proofOfPaymentPath);
    console.log('✅ [confirmGCashPayment] uploadedProofOfPayment after closeQRPopup (should be null):', uploadedProofOfPayment);
    
    // Process payment with the saved proof of payment path
    console.log('🔄 [confirmGCashPayment] Calling processPayment with:', {
        orderId: orderId,
        paymentMethod: 'GCash',
        proofOfPayment: proofOfPaymentPath
    });
    
    try {
        await processPayment(orderId, 'GCash', proofOfPaymentPath);
    } catch (error) {
        console.error('❌ [confirmGCashPayment] Error in processPayment:', error);
        // Error handling is done in processPayment, but we still reset here
    }
    
    // Reset
    currentOrderIdForPayment = null;
    uploadedProofOfPayment = null;
    
    console.log('✅ [confirmGCashPayment] Function completed');
}

// Helper function to get order data
async function getOrderData(orderId) {
    try {
        const response = await fetch(`../api/get_customer_orders.php?order_id=${orderId}`, {
            credentials: 'include'
        });
        const data = await response.json();
        // API can return either data.orders (array) or data.order (single object)
        if (data.success) {
            if (data.orders && data.orders.length > 0) {
                return data.orders[0];
            } else if (data.order) {
                return data.order;
            }
        }
        return null;
    } catch (error) {
        console.error('Error fetching order data:', error);
        return null;
    }
}

async function processPayment(orderId, paymentMethod, proofOfPayment) {
    console.log('🔄 [processPayment] Function called');
    console.log('🔄 [processPayment] Parameters received:', {
        orderId: orderId,
        paymentMethod: paymentMethod,
        proofOfPayment: proofOfPayment,
        proofOfPaymentType: typeof proofOfPayment,
        proofOfPaymentIsNull: proofOfPayment === null,
        proofOfPaymentIsUndefined: proofOfPayment === undefined
    });
    
    // Get the confirm button to restore it on error
    const confirmBtn = document.getElementById(`confirmPaymentBtn-${orderId}`);
    const originalButtonText = confirmBtn ? confirmBtn.innerHTML : null;
    
    try {
        const requestBody = {
            order_id: orderId,
            payment_method: paymentMethod,
            proof_of_payment: proofOfPayment
        };
        
        console.log('📤 [processPayment] Request body being sent:', JSON.stringify(requestBody, null, 2));
        console.log('📤 [processPayment] proof_of_payment in request body:', requestBody.proof_of_payment);
        
        // Add timeout to prevent infinite loading
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        let response;
        try {
            response = await fetch('../api/process_payment.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
        } catch (fetchError) {
            clearTimeout(timeoutId);
            if (fetchError.name === 'AbortError') {
                throw new Error('Request timeout. Please check your connection and try again.');
            }
            throw fetchError;
        }
        
        console.log('📥 [processPayment] Response status:', response.status);
        console.log('📥 [processPayment] Response ok:', response.ok);
        
        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('📥 [processPayment] Non-JSON response:', text.substring(0, 500));
            throw new Error('Server returned invalid response. Please try again.');
        }
        
        let data;
        try {
            data = await response.json();
        } catch (jsonError) {
            const text = await response.text();
            console.error('📥 [processPayment] JSON parse error:', jsonError);
            console.error('📥 [processPayment] Response text:', text.substring(0, 500));
            throw new Error('Invalid response from server. Please try again.');
        }
        
        if (data.success) {
            // Use custom notification system instead of browser alert
            if (typeof window.Notifications !== 'undefined') {
                const message = 'Payment method confirmed! ' + (data.payment_status === 'Paid' ? 'Payment received.' : 'Please complete payment.');
                window.Notifications.showToast(message, 'success', 5000);
            } else {
                console.log('Payment method confirmed! ' + (data.payment_status === 'Paid' ? 'Payment received.' : 'Please complete payment.'));
            }
            // Reload order data
            await refreshOrderData(orderId);
            // Reload full order display
            await loadPaymentOrder();
        } else {
            if (typeof window.Notifications !== 'undefined') {
                window.Notifications.showToast('Failed to process payment: ' + (data.message || 'Unknown error'), 'error', 7000);
            } else {
                console.error('Failed to process payment:', data.message || 'Unknown error');
            }
        }
    } catch (error) {
        console.error('❌ [processPayment] Error processing payment:', error);
        
        // Restore button state on error
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = originalButtonText || '<i class="fas fa-check-circle mr-2"></i>Confirm Payment Method';
        }
        
        const errorMessage = error.message || 'Failed to process payment. Please try again.';
        if (typeof window.Notifications !== 'undefined') {
            window.Notifications.showToast(errorMessage, 'error', 7000);
        } else {
            console.error('Failed to process payment:', errorMessage);
            alert(errorMessage);
        }
    }
}

// Make functions globally available
window.selectPaymentMethod = selectPaymentMethod;
window.confirmPaymentMethod = confirmPaymentMethod;
window.closeQRPopup = closeQRPopup;
window.handleProofUpload = handleProofUpload;
window.removeProofUpload = removeProofUpload;
window.confirmGCashPayment = confirmGCashPayment;

// Export setupProofUploadButton globally
window.setupProofUploadButton = setupProofUploadButton;

// Safety check: Clear any stuck overlays on page load
function clearStuckOverlays() {
    // Clear modal overlay if stuck
    const modalOverlay = document.getElementById('modal-overlay');
    if (modalOverlay && !modalOverlay.classList.contains('show')) {
        modalOverlay.style.opacity = '0';
        modalOverlay.style.visibility = 'hidden';
        modalOverlay.style.pointerEvents = 'none';
        document.body.style.overflow = '';
    }
    
    // Clear QR popup overlay if stuck
    const qrPopup = document.getElementById('qrPaymentPopup');
    if (qrPopup && !qrPopup.classList.contains('show')) {
        qrPopup.style.display = 'none';
        qrPopup.style.opacity = '0';
        qrPopup.style.visibility = 'hidden';
        qrPopup.style.pointerEvents = 'none';
        document.body.style.overflow = '';
    }
}

// Setup event delegation for confirm payment buttons (backup for onclick)
function setupConfirmPaymentButtons() {
    // Use event delegation to handle clicks on confirm payment buttons
    document.addEventListener('click', function(e) {
        const btn = e.target.closest('[id^="confirmPaymentBtn-"]');
        if (btn && !btn.disabled) {
            e.preventDefault();
            e.stopPropagation();
            
            // Extract orderId from button ID
            const buttonId = btn.id;
            const orderIdMatch = buttonId.match(/confirmPaymentBtn-(\d+)/);
            if (orderIdMatch) {
                const orderId = parseInt(orderIdMatch[1]);
                console.log('[Payment] Confirm button clicked via event delegation, orderId:', orderId);
                
                // Call the function
                if (typeof confirmPaymentMethod === 'function') {
                    confirmPaymentMethod(orderId);
                } else {
                    console.error('[Payment] confirmPaymentMethod function not available');
                    if (typeof window.Notifications !== 'undefined') {
                        window.Notifications.showToast('Payment function not loaded. Please refresh the page.', 'error', 5000);
                    } else {
                        alert('Payment function not loaded. Please refresh the page.');
                    }
                }
            } else {
                console.error('[Payment] Could not extract orderId from button ID:', buttonId);
            }
        }
    });
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        clearStuckOverlays();
        setupConfirmPaymentButtons();
        loadPaymentOrder();
    });
} else {
    clearStuckOverlays();
    setupConfirmPaymentButtons();
    loadPaymentOrder();
}

