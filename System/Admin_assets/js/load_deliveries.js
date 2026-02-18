/**
 * Load Deliveries for Admin Interface
 * Dynamically loads and displays deliveries from the database
 */

// Format price
function formatPrice(price) {
    return '₱' + parseFloat(price).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
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
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

// Get display text for status
function getStatusDisplayText(status) {
    const statusMap = {
        'Pending': 'Pending',
        'Preparing': 'Preparing',
        'Out for Delivery': 'Out for Delivery',
        'Delivered': 'Delivered',
        'Cancelled': 'Cancelled'
    };
    return statusMap[status] || status;
}

// Get status badge class
function getStatusBadgeClass(status) {
    const classMap = {
        'Pending': 'pending',
        'Preparing': 'processing',
        'Out for Delivery': 'processing',
        'Delivered': 'ready',
        'Cancelled': 'rejected'
    };
    return classMap[status] || 'pending';
}

// Format date
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Format delivery/pickup date: "Today", "Tomorrow", or full date
function formatDeliveryOrPickupDate(dateString) {
    if (!dateString) return '';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return formatDate(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    if (d.getTime() === today.getTime()) return 'Today';
    if (d.getTime() === tomorrow.getTime()) return 'Tomorrow';
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Format datetime
function formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Get status badge class (for order-card styling)
function getStatusBadgeClass(status) {
    // Normalize status (handle old values)
    const normalizedStatus = normalizeStatus(status);
    const statusMap = {
        'Pending': 'pending',
        'Preparing': 'processing',
        'Out for Delivery': 'processing',
        'Delivered': 'ready',
        'Cancelled': 'rejected'
    };
    return statusMap[normalizedStatus] || 'pending';
}

// Get status display text
function getStatusDisplayText(status) {
    const normalizedStatus = normalizeStatus(status);
    const statusMap = {
        'Pending': 'Pending',
        'Preparing': 'Preparing',
        'Out for Delivery': 'Out for Delivery',
        'Delivered': 'Delivered',
        'Cancelled': 'Cancelled'
    };
    return statusMap[normalizedStatus] || normalizedStatus;
}

// Normalize status (convert old values to new standardized values)
function normalizeStatus(status) {
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
    
    // Return as-is if already standardized
    return status;
}

// Complete delivery with confirmation prompt (defined early for use in event handlers)
async function completeDelivery(deliveryId, orderId, customerName) {
    console.log('[Complete Delivery] Function called:', { deliveryId, orderId, customerName });
    
    let confirmationResult;
    try {
        // Show confirmation prompt with optional photo upload
        console.log('[Complete Delivery] Waiting for user confirmation...');
        confirmationResult = await showCompleteDeliveryConfirmation(orderId, customerName);
        console.log('[Complete Delivery] Confirmation received:', confirmationResult);
        
        if (!confirmationResult || !confirmationResult.confirmed) {
            console.log('[Complete Delivery] User cancelled - aborting');
            return;
        }
        
        console.log('[Complete Delivery] User confirmed - proceeding with delivery completion');
    } catch (error) {
        console.error('[Complete Delivery] Error in confirmation step:', error);
        if (window.AdminNotifications) {
            AdminNotifications.error('An error occurred while showing the confirmation dialog. Please try again.', {
                title: 'Error',
                duration: 5000
            });
        } else {
            alert('An error occurred while showing the confirmation dialog. Please try again.');
        }
        return;
    }
    
    // Show loading state
    const btn = document.querySelector(`.delivered-btn[data-order-id="${orderId}"]`);
    let originalHTML = null;
    if (btn) {
        btn.disabled = true;
        originalHTML = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Completing...';
        btn.dataset.originalHTML = originalHTML;
    }
    
    // Helper function to restore button state
    const restoreButtonState = () => {
        if (btn && originalHTML) {
            btn.innerHTML = originalHTML;
            btn.disabled = false;
            // Clear the stored original HTML to prevent stale data
            delete btn.dataset.originalHTML;
        }
    };
    
    // Upload proof photo if provided
    let deliveryProofImagePath = null;
    if (confirmationResult.file) {
        try {
            const formData = new FormData();
            formData.append('image', confirmationResult.file);
            formData.append('delivery_id', deliveryId);
            formData.append('order_id', orderId);
            const uploadRes = await fetch('../api/upload_delivery_proof.php', {
                method: 'POST',
                credentials: 'include',
                body: formData
            });
            const uploadData = await uploadRes.json();
            if (uploadData.success && uploadData.file_path) {
                deliveryProofImagePath = uploadData.file_path;
                console.log('[Complete Delivery] Proof photo uploaded:', deliveryProofImagePath);
            } else {
                if (window.AdminNotifications) {
                    AdminNotifications.warning('Photo upload failed. Completing delivery without proof.', { duration: 4000 });
                } else {
                    console.warn('Photo upload failed:', uploadData.message);
                }
            }
        } catch (uploadErr) {
            console.warn('[Complete Delivery] Proof upload error:', uploadErr);
            if (window.AdminNotifications) {
                AdminNotifications.warning('Could not upload photo. Completing delivery without proof.', { duration: 4000 });
            }
        }
    }

    // Update delivery status to "Delivered"
    try {
        console.log('[Complete Delivery] Sending API request...');
        
        const requestBody = {
            delivery_id: deliveryId,
            order_id: orderId,
            status: 'Delivered'
        };
        if (deliveryProofImagePath) {
            requestBody.delivery_proof_image = deliveryProofImagePath;
        }
        
        // Create AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        let response;
        try {
            response = await fetch('../api/update_delivery_status.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                signal: controller.signal,
                body: JSON.stringify(requestBody)
            });
            clearTimeout(timeoutId);
        } catch (fetchError) {
            clearTimeout(timeoutId);
            
            // Handle timeout specifically
            if (fetchError.name === 'AbortError') {
                console.error('[Complete Delivery] Request timeout after 30 seconds');
                restoreButtonState();
                
                const timeoutMsg = 'Request timeout: The server took too long to respond. Please check your connection and try again.';
                if (window.AdminNotifications) {
                    AdminNotifications.error(timeoutMsg, {
                        title: 'Request Timeout',
                        duration: 7000
                    });
                } else {
                    alert(timeoutMsg);
                }
                return;
            }
            
            // Handle network errors
            if (fetchError.message && fetchError.message.includes('Failed to fetch')) {
                console.error('[Complete Delivery] Network error:', fetchError);
                restoreButtonState();
                
                const networkMsg = 'Network error: Unable to connect to server. Please check your internet connection and try again.';
                if (window.AdminNotifications) {
                    AdminNotifications.error(networkMsg, {
                        title: 'Network Error',
                        duration: 7000
                    });
                } else {
                    alert(networkMsg);
                }
                return;
            }
            
            // Re-throw other errors to be caught by outer catch
            throw fetchError;
        }
        
        console.log('[Complete Delivery] API response status:', response.status);
        
        // Check if response is OK before parsing JSON
        if (!response.ok) {
            // Try to parse error response
            let errorData;
            try {
                const text = await response.text();
                errorData = text ? JSON.parse(text) : { message: `HTTP ${response.status} Error` };
            } catch (e) {
                errorData = { message: `HTTP ${response.status} Error: ${response.statusText || 'Unknown error'}` };
            }
            
            // Restore button state
            restoreButtonState();
            
            // Show specific error message based on status code
            let errorMsg = errorData.message || errorData.details || `Failed to complete delivery (HTTP ${response.status})`;
            
            // Provide helpful message for 403 (permission denied)
            if (response.status === 403) {
                errorMsg = errorData.details || errorData.message || 'This delivery is not assigned to you. Only deliveries assigned to you can be completed.';
            }
            
            console.error('[Complete Delivery] API Error:', errorMsg, errorData);
            
            if (window.AdminNotifications) {
                AdminNotifications.error(
                    errorMsg,
                    {
                        title: response.status === 403 ? 'Permission Denied' : 'Error',
                        duration: 7000
                    }
                );
            } else {
                alert('Error: ' + errorMsg);
            }
            return;
        }
        
        let data;
        try {
            data = await response.json();
        } catch (parseError) {
            console.error('[Complete Delivery] JSON parse error:', parseError);
            restoreButtonState();
            
            const parseMsg = 'Invalid response from server. Please refresh the page and try again.';
            if (window.AdminNotifications) {
                AdminNotifications.error(parseMsg, {
                    title: 'Response Error',
                    duration: 7000
                });
            } else {
                alert(parseMsg);
            }
            return;
        }
        
        console.log('[Complete Delivery] API response data:', data);
        
        if (data.success) {
            // Restore button state BEFORE reloading to prevent stuck state
            restoreButtonState();
            
            // Show success notification
            if (window.AdminNotifications) {
                AdminNotifications.success(
                    `Order #${orderId} has been completed. Customer has been notified.`,
                    {
                        title: 'Delivery Completed',
                        duration: 5000
                    }
                );
            } else {
                alert(`Order #${orderId} has been completed successfully!`);
            }
            
            // Switch to completed deliveries tab and reload (or redirect if on ViewDelivery/ViewOrderAccept)
            setTimeout(() => {
                if (window.location.pathname.includes('ViewDelivery') || window.location.href.includes('ViewDelivery')) {
                    window.location.href = '../Admin/DeliveriesAdmin.html';
                    return;
                }
                if (window.location.pathname.includes('ViewOrderAccept') || window.location.href.includes('ViewOrderAccept')) {
                    window.location.reload();
                    return;
                }
                const completedTab = document.getElementById('completed-delivery-tab');
                if (completedTab) {
                    completedTab.click();
                }
                loadDeliveries();
            }, 1000);
        } else {
            // Restore button state
            restoreButtonState();
            
            // Show error notification
            const errorMsg = data.message || data.details || 'Failed to complete delivery';
            console.error('[Complete Delivery] Error:', errorMsg);
            
            if (window.AdminNotifications) {
                AdminNotifications.error(
                    errorMsg,
                    {
                        title: 'Error',
                        duration: 5000
                    }
                );
            } else {
                alert('Error: ' + errorMsg);
            }
        }
    } catch (error) {
        console.error('[Complete Delivery] Exception:', error);
        
        // Always restore button state on any error
        restoreButtonState();
        
        // Determine error message
        let errorMsg = 'An error occurred while completing the delivery.';
        if (error.message) {
            errorMsg += ' ' + error.message;
        } else {
            errorMsg += ' Please try again.';
        }
        
        if (window.AdminNotifications) {
            AdminNotifications.error(
                errorMsg,
                {
                    title: 'Error',
                    duration: 7000
                }
            );
        } else {
            alert(errorMsg);
        }
    }
}

// Show confirmation prompt for completing delivery with optional photo upload (defined early)
async function showCompleteDeliveryConfirmation(orderId, customerName) {
    let collectCashHtml = '';
    try {
        const res = await fetch(`../api/get_orders.php?order_id=${orderId}`, { method: 'GET', credentials: 'include' });
        if (res.ok) {
            const data = await res.json();
            const order = data.order || (data.orders && data.orders[0]);
            if (order) {
                const pm = String(order.payment_method || order.transaction_payment_method || '').toLowerCase();
                const isCOD = pm.includes('cash on delivery') || pm === 'cod';
                const amount = order.amount != null ? parseFloat(order.amount) : NaN;
                if (isCOD && !isNaN(amount) && amount > 0) {
                    const formatted = '₱' + amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    collectCashHtml = `
                        <div style="margin-top: 12px; padding: 12px; background: #1e3a2f; border: 1px solid #27ae60; border-radius: 8px;">
                            <strong style="color: #2ecc71; font-size: 14px;"><i class="fas fa-money-bill-wave"></i> Collect cash</strong>
                            <p style="color: #bdc3c7; font-size: 18px; font-weight: 700; margin: 8px 0 0 0;">${formatted}</p>
                        </div>`;
                }
            }
        }
    } catch (e) {
        console.warn('[Complete Delivery] Could not fetch order for COD check:', e);
    }

    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'admin-confirm-overlay';
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.5); z-index: 10001;
            display: flex; align-items: center; justify-content: center;
            animation: fadeIn 0.2s ease-out;
        `;
        const modal = document.createElement('div');
        modal.className = 'admin-confirm-modal';
        modal.style.cssText = `
            background: #2c3e50; border-radius: 12px; padding: 0; max-width: 480px; width: 90%;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
            animation: slideDown 0.3s ease-out; overflow: hidden;
        `;
        const safeName = (customerName || 'the customer').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        modal.innerHTML = `
            <div style="padding: 24px 24px 16px;">
                <div style="display: flex; align-items: center; margin-bottom: 16px;">
                    <i class="fas fa-check-circle" style="font-size: 28px; color: #17a2b8; margin-right: 12px;"></i>
                    <h3 style="margin: 0; color: #fff; font-size: 20px; font-weight: 600;">Complete Delivery</h3>
                </div>
                <p style="color: #e0e0e0; font-size: 15px; line-height: 1.5; margin: 0 0 16px 0;">
                    Complete delivery for order #${orderId}? A notification will be sent to ${safeName}.
                </p>
                ${collectCashHtml}
                <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #3d566e;">
                    <label style="display: block; color: #bdc3c7; font-size: 14px; font-weight: 600; margin-bottom: 8px;">
                        <i class="fas fa-camera"></i> Upload proof of delivery (optional)
                    </label>
                    <input type="file" id="deliveryProofInput" accept="image/jpeg,image/jpg,image/png,image/gif,image/webp" 
                           style="width: 100%; padding: 10px; border: 1px dashed #3d566e; border-radius: 6px; background: #34495e; color: #fff; font-size: 13px; cursor: pointer;">
                    <small style="color: #95a5a6; font-size: 12px; display: block; margin-top: 6px;">JPEG, PNG, GIF or WebP. Max 5MB.</small>
                </div>
            </div>
            <div style="padding: 16px 24px; background: #34495e; display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid #3d566e;">
                <button class="admin-confirm-cancel" style="padding: 10px 24px; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; background: #6c757d; color: white;">Cancel</button>
                <button class="admin-confirm-ok" style="padding: 10px 24px; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; background: #007bff; color: white;">Yes, Complete Delivery</button>
            </div>
        `;
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const close = (result) => {
            overlay.style.animation = 'fadeOut 0.2s ease-out';
            modal.style.animation = 'slideUp 0.2s ease-out';
            setTimeout(() => {
                if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            }, 200);
            resolve(result);
        };

        const input = modal.querySelector('#deliveryProofInput');
        modal.querySelector('.admin-confirm-ok').addEventListener('click', () => {
            const file = input && input.files && input.files[0] ? input.files[0] : null;
            close({ confirmed: true, file: file });
        });
        modal.querySelector('.admin-confirm-cancel').addEventListener('click', () => close({ confirmed: false, file: null }));
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close({ confirmed: false, file: null }); });
    });
}

// Export functions immediately when script loads
window.completeDelivery = completeDelivery;
window.showCompleteDeliveryConfirmation = showCompleteDeliveryConfirmation;
console.log('[Load Deliveries] Functions exported at top of file:', {
    completeDelivery: typeof window.completeDelivery,
    showCompleteDeliveryConfirmation: typeof window.showCompleteDeliveryConfirmation
});

function getCurrentUserRole() {
    // Prefer sessionStorage set by admin_auth_check.js, but fall back to role captured from check_session in loadDeliveries()
    return (sessionStorage.getItem('user_role') || window.__MATARIX_USER_ROLE || '').trim();
}

function isDeliveryDriverRole(role) {
    const r = (role ?? getCurrentUserRole()).trim();
    return r === 'Delivery Driver';
}

// Get preferred delivery date from delivery object
function getPreferredDeliveryDate(delivery) {
    // Check availability_slots first (newer format)
    if (delivery.availability_slots && delivery.availability_slots.length > 0) {
        const preferredSlot = delivery.availability_slots.find(s => s.is_preferred) || delivery.availability_slots[0];
        if (preferredSlot && preferredSlot.availability_date) {
            return preferredSlot.availability_date;
        }
    }
    // Fallback to availability_date (older format)
    if (delivery.availability_date) {
        return delivery.availability_date;
    }
    // If no preferred date, return null
    return null;
}

// Format date long: "February 1, 2025" for vertical display
function formatDateLong(dateString) {
    const date = new Date(dateString);
    const month = date.toLocaleDateString('en-US', { month: 'long' });
    const day = date.getDate();
    const year = date.getFullYear();
    return `${month} ${day}, ${year}`;
}

// Group deliveries by preferred delivery date, sorted earliest first
function groupDeliveriesByPreferredDate(deliveries) {
    const map = {};
    for (const delivery of deliveries) {
        const preferredDate = getPreferredDeliveryDate(delivery);
        const dateKey = (preferredDate && String(preferredDate).trim() !== '') 
            ? new Date(preferredDate).toISOString().slice(0, 10) 
            : '__no_date__';
        if (!map[dateKey]) map[dateKey] = [];
        map[dateKey].push(delivery);
    }
    
    const sortedKeys = Object.keys(map).sort((a, b) => {
        if (a === '__no_date__') return 1;
        if (b === '__no_date__') return 1;
        return a.localeCompare(b);
    });
    
    return sortedKeys.map(dateKey => {
        const list = map[dateKey];
        // Sort deliveries within the same date by order ID (or creation time)
        list.sort((a, b) => {
            const orderIdA = a.Order_ID || 0;
            const orderIdB = b.Order_ID || 0;
            return orderIdA - orderIdB;
        });
        const dateLabel = dateKey === '__no_date__' 
            ? 'No preferred date' 
            : formatDateLong(dateKey);
        return { dateKey, dateLabel, deliveries: list };
    });
}

// Create delivery card HTML
async function createDeliveryCard(delivery) {
    // Handle cases where Delivery_ID might be 0 or null (for orders without delivery records yet)
    const deliveryId = delivery.Delivery_ID || delivery.Order_ID || 0;
    const orderId = delivery.Order_ID;
    
    // Use Order_ID for delivery code if Delivery_ID is missing
    const deliveryCode = deliveryId > 0 
        ? `DEL-${deliveryId.toString().padStart(6, '0')}`
        : `ORD-${orderId.toString().padStart(6, '0')}`;
    
    const customerName = delivery.customer_name || 'Unknown Customer';
    
    // Get multiple drivers and vehicles
    const drivers = delivery.drivers || [];
    const vehicles = delivery.vehicles || [];
    
    // For backward compatibility, use single driver/vehicle if arrays are empty
    const driverName = drivers.length > 0 
        ? drivers.map(d => d.driver_name || 'Unknown').join(', ')
        : (delivery.driver_name || 'Unassigned');
    const driverId = drivers.length > 0 ? drivers[0].Driver_ID : (delivery.Driver_ID || null);
    
    const vehicleModel = vehicles.length > 0
        ? vehicles.map(v => v.vehicle_model || 'Unknown').join(', ')
        : (delivery.vehicle_model || null);
    const vehicleId = vehicles.length > 0 ? vehicles[0].Vehicle_ID : (delivery.Vehicle_ID || null);
    const address = delivery.Customer_Address || 'N/A';
    const status = normalizeStatus(delivery.Delivery_Status || 'Pending');
    const orderStatus = delivery.Order_Status || 'Pending Approval';
    const items = delivery.items || [];
    const availabilitySlots = delivery.availability_slots || [];
    
    // No calculation needed - badges will show based on drivers.length and vehicles.length
    
    // Format availability information: Today / Tomorrow / full date
    let availabilityInfo = '';
    if (availabilitySlots.length > 0) {
        const preferredSlot = availabilitySlots.find(s => s.is_preferred) || availabilitySlots[0];
        if (preferredSlot) {
            availabilityInfo = formatDeliveryOrPickupDate(preferredSlot.availability_date);
            if (availabilitySlots.length > 1) {
                availabilityInfo += ` (${availabilitySlots.length} options)`;
            }
        }
    } else if (delivery.availability_date) {
        availabilityInfo = formatDeliveryOrPickupDate(delivery.availability_date);
    }
    
    // Validate required fields
    if (!orderId) {
        console.error('[Create Delivery Card] Missing Order_ID for delivery:', delivery);
        return ''; // Return empty string if critical data is missing
    }
    
    // Build items list
    const itemsList = items.length > 0 
        ? items.map(item => `${item.Product_Name} x${item.Quantity}`).join(', ')
        : 'No items';
    
    // Status dropdown options (standardized)
    const statusOptions = [
        { value: 'Pending', label: 'Pending' },
        { value: 'Preparing', label: 'Preparing' },
        { value: 'Out for Delivery', label: 'Out for Delivery' },
        { value: 'Delivered', label: 'Delivered' },
        { value: 'Cancelled', label: 'Cancelled' }
    ];
    
    // Normalize status for comparison (handle case variations and old values)
    const normalizedStatus = normalizeStatus(status);
    
    const roleForStatusRules = getCurrentUserRole();
    // Cancel option removed for admin and employee; only delivery driver could previously not cancel
    const allowCancelStatus = false;

    // Define status order for forward progression (step-by-step only)
    const statusOrder = ['Pending', 'Preparing', 'Out for Delivery', 'Delivered'];
    const finalStatuses = ['Delivered', 'Cancelled'];
    
    // Helper: only allow the NEXT status (no skipping, no going backward)
    const isNextStatus = (fromStatus, toStatus) => {
        if (toStatus === 'Cancelled') return allowCancelStatus;
        if (finalStatuses.includes(fromStatus)) return false;
        const fromIndex = statusOrder.indexOf(fromStatus);
        const toIndex = statusOrder.indexOf(toStatus);
        if (fromIndex === -1 || toIndex === -1) return true; // safety fallback
        return toIndex === fromIndex + 1;
    };
    
    const isFinalStatus = finalStatuses.includes(normalizedStatus);
    
    // Get allowed next statuses (NEXT status + optional Cancelled)
    const getAllowedNextStatuses = (currentStatus) => {
        const allowed = [];
        const currentIndex = statusOrder.indexOf(currentStatus);

        if (currentIndex >= 0 && currentIndex + 1 < statusOrder.length) {
            allowed.push(statusOrder[currentIndex + 1]);
        }

        if (allowCancelStatus) allowed.push('Cancelled');
        return allowed;
    };
    
    let allowedNextStatuses = getAllowedNextStatuses(normalizedStatus);
    
    // If normalizedStatus doesn't match, try the original status
    if (allowedNextStatuses.length === 0 && status !== normalizedStatus) {
        allowedNextStatuses = getAllowedNextStatuses(status);
    }
    
    // Debug: Log status information to help diagnose issues
    if (deliveryId && (normalizedStatus === 'Out for Delivery' || status === 'Out for Delivery')) {
        console.log('[Create Delivery Card] Status check for delivery', deliveryId, ':', {
            originalStatus: status,
            normalizedStatus: normalizedStatus,
            allowedNextStatuses: allowedNextStatuses,
            shouldAllowDelivered: allowedNextStatuses.includes('Delivered')
        });
    }
    
    // RBAC: Delivery Driver cannot set Cancelled
    const statusOptionsForRole = allowCancelStatus
        ? statusOptions
        : statusOptions.filter(o => o.value !== 'Cancelled');

    // Build dropdown options - step-by-step only
    const statusDropdown = statusOptionsForRole.map(opt => {
        const isSelected = opt.value === normalizedStatus || opt.value === status;
        const isAllowed = isSelected || isNextStatus(normalizedStatus, opt.value) || allowedNextStatuses.includes(opt.value);
        // Disable if it's not allowed AND not selected
        const isDisabled = !isAllowed && !isSelected;
        
        return `<option value="${opt.value}" ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}>${opt.label}</option>`;
    }).join('');
    
    // Determine if dropdown should be disabled
    // Disable if:
    // 1) Final status (Delivered/Cancelled)
    // 2) Order is NOT "Ready" AND delivery is still "Pending" (must be ready before starting delivery flow)
    const isOrderReady = (orderStatus || '').trim() === 'Ready';
    const requiresReadyToStart = normalizedStatus === 'Pending';
    const isBlockedByOrderNotReady = requiresReadyToStart && !isOrderReady;
    const dropdownDisabled = (isFinalStatus || isBlockedByOrderNotReady) ? 'disabled' : '';
    
    // Determine tooltip message
    let dropdownTitle = 'Select next status';
    if (isFinalStatus) {
        dropdownTitle = 'This delivery is in a final state and cannot be changed.';
    } else if (isBlockedByOrderNotReady) {
        dropdownTitle = 'Delivery status can only be changed when order status is "Ready". Current order status: ' + orderStatus;
    }
    
    // Format date for filtering
    const createdDate = delivery.Created_At || delivery.order_date || '';

    // RBAC UI: only Admin/Store Employee can assign drivers/vehicles
    const currentRole = getCurrentUserRole();
    const canAssign = currentRole === 'Admin' || currentRole === 'Store Employee';
    const hasAssignedDriver = (drivers && drivers.length > 0) || !!driverId;
    const assignVehicleLocked = canAssign && !hasAssignedDriver;
    const assignDriverBtnHtml = canAssign ? `
                        <button class="btn btn-sm btn-link assign-driver-btn" data-delivery-id="${deliveryId}" data-order-id="${orderId}" data-current-driver-id="${driverId || ''}" title="Assign Driver(s)">
                            <i class="fas fa-user-plus"></i> ${driverId ? 'Change' : 'Assign'} Driver${drivers.length > 1 ? 's' : ''}
                        </button>
    ` : '';
    const assignVehicleBtnHtml = canAssign ? `
                        <button class="btn btn-sm btn-link assign-vehicle-btn" data-delivery-id="${deliveryId}" data-order-id="${orderId}" data-current-vehicle-id="${vehicleId || ''}" title="${assignVehicleLocked ? 'Assign a driver first' : 'Assign Vehicle(s)'}" ${assignVehicleLocked ? 'disabled' : ''}>
                            <i class="fas ${assignVehicleLocked ? 'fa-lock' : 'fa-truck'}"></i> ${assignVehicleLocked ? 'Assign Driver first' : `${vehicleId ? 'Change' : 'Assign'} Vehicle${vehicles.length > 1 ? 's' : ''}`}
                        </button>
    ` : '';
    
    // Determine status class for styling
    let statusClass = 'pending';
    if (normalizedStatus === 'Out for Delivery') {
        statusClass = 'processing';
    } else if (normalizedStatus === 'Delivered') {
        statusClass = 'ready';
    }
    
    // Format order amount
    const orderAmount = delivery.amount ? formatPrice(delivery.amount) : '₱0.00';
    const orderDate = delivery.order_date ? formatDate(delivery.order_date) : 'N/A';
    
    const isDeliveryDriver = isDeliveryDriverRole(getCurrentUserRole());
    
    // Action buttons - only View link; opens dedicated delivery page for Complete/Cancel
    const actionButtons = `
        <a href="ViewDelivery.html?order_id=${orderId}" class="order-card-btn view-btn" title="View delivery details and complete or cancel" data-delivery-id="${deliveryId}" data-order-id="${orderId}" onclick="event.stopPropagation(); event.stopImmediatePropagation(); return true;">
            <i class="fas fa-eye"></i> View
        </a>
    `;
    
    return `
        <div class="order-card ${statusClass}" data-delivery-id="${deliveryId}" data-order-id="${orderId}" data-status="${normalizedStatus}" data-order-status="${orderStatus}">
            <div class="order-card-header">
                <span class="order-id">ORD-${orderId.toString().padStart(4, '0')}</span>
                <span class="order-amount">${orderAmount}</span>
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
                        <span>Available: ${availabilityInfo || 'N/A'}</span>
                    </div>
                    <div class="order-meta-item">
                        <i class="fas fa-truck"></i>
                        <span>${getStatusDisplayText(normalizedStatus)}</span>
                    </div>
                    ${driverName && driverName !== 'Unassigned' ? `
                    <div class="order-meta-item">
                        <i class="fas fa-user"></i>
                        <span>${escapeHtml(driverName)}</span>
                    </div>
                    ` : ''}
                    ${vehicleModel ? `
                    <div class="order-meta-item">
                        <i class="fas fa-truck"></i>
                        <span>${escapeHtml(vehicleModel)}</span>
                    </div>
                    ` : ''}
                    <div class="order-meta-item">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>${address.length > 20 ? address.substring(0, 20) + '...' : address}</span>
                    </div>
                </div>
            </div>
            <div class="order-card-footer">
                ${actionButtons}
            </div>
        </div>
    `;
}

// Store all active deliveries for filtering by status
let allActiveDeliveries = [];
let currentStatusFilter = 'all';

// Store all history deliveries (Delivered/Cancelled) for filtering in history tab
let allHistoryDeliveries = [];
let currentHistoryFilter = 'all';

// Filter ACTIVE deliveries by status (exported globally)
window.filterDeliveriesByStatus = function(status) {
    currentStatusFilter = status;
    console.log('[Filter Deliveries] Filtering by status:', status);
    
    const container = document.getElementById('active-deliveries-cards');
    if (!container) {
        console.error('[Filter Deliveries] Container not found');
        return;
    }
    
    // Filter deliveries based on selected status
    let filteredDeliveries = [];
    if (status === 'all') {
        filteredDeliveries = [...allActiveDeliveries];
    } else {
        filteredDeliveries = allActiveDeliveries.filter(delivery => {
            const deliveryStatus = normalizeStatus(delivery.Delivery_Status || 'Pending');
            return deliveryStatus === status;
        });
    }
    
    console.log('[Filter Deliveries] Filtered deliveries:', {
        status: status,
        total: allActiveDeliveries.length,
        filtered: filteredDeliveries.length
    });
    
    // Clear container
    container.innerHTML = '';
    
    if (filteredDeliveries.length === 0) {
        container.innerHTML = `
            <div class="text-center py-5">
                <p class="text-muted">No deliveries found with status "${status}".</p>
            </div>
        `;
        return;
    }
    
    // Sort filtered deliveries
    const sorted = [...filteredDeliveries].sort((a, b) => {
        const dateA = new Date(a.order_date || a.Created_At || a.Updated_At || 0);
        const dateB = new Date(b.order_date || b.Created_At || b.Updated_At || 0);
        return dateB - dateA;
    });
    
    // Create and display delivery cards
    const cardPromises = sorted.map(async (delivery) => {
        try {
            return await createDeliveryCard(delivery);
        } catch (error) {
            console.error('[Filter Deliveries] Failed to create card:', error);
            return '';
        }
    });
    
    Promise.all(cardPromises).then(cardHtmls => {
        container.innerHTML = cardHtmls.filter(html => html && html.trim()).join('');
        console.log('[Filter Deliveries] Displayed', cardHtmls.filter(html => html && html.trim()).length, 'delivery cards');
    });
};

// Update ACTIVE status counts in tabs
function updateStatusCounts(activeDeliveries) {
    const counts = {
        all: activeDeliveries.length,
        'Pending': 0,
        'Preparing': 0,
        'Out for Delivery': 0
    };
    
    activeDeliveries.forEach(delivery => {
        const status = normalizeStatus(delivery.Delivery_Status || 'Pending');
        if (counts.hasOwnProperty(status)) {
            counts[status]++;
        }
    });
    
    // Update count displays
    document.getElementById('status-count-all').textContent = counts.all;
    document.getElementById('status-count-pending').textContent = counts['Pending'];
    document.getElementById('status-count-preparing').textContent = counts['Preparing'];
    document.getElementById('status-count-out-for-delivery').textContent = counts['Out for Delivery'];
    
    console.log('[Update Status Counts]', counts);
}

// Update HISTORY status counts in tabs
function updateHistoryStatusCounts(historyDeliveries) {
    const counts = {
        all: historyDeliveries.length,
        'Delivered': 0,
        'Cancelled': 0
    };
    
    historyDeliveries.forEach(delivery => {
        const status = normalizeStatus(delivery.Delivery_Status || 'Delivered');
        if (counts.hasOwnProperty(status)) {
            counts[status]++;
        }
    });
    
    // Update count displays (if elements exist)
    const allEl = document.getElementById('history-status-count-all');
    const deliveredEl = document.getElementById('history-status-count-delivered');
    const cancelledEl = document.getElementById('history-status-count-cancelled');
    
    if (allEl) allEl.textContent = counts.all;
    if (deliveredEl) deliveredEl.textContent = counts['Delivered'];
    if (cancelledEl) cancelledEl.textContent = counts['Cancelled'];
    
    console.log('[Update History Status Counts]', counts);
}

// Filter HISTORY deliveries by status (exported globally)
window.filterHistoryByStatus = function(status) {
    currentHistoryFilter = status;
    console.log('[Filter History Deliveries] Filtering by status:', status);
    
    const container = document.getElementById('delivery-history-cards');
    if (!container) {
        console.error('[Filter History Deliveries] Container not found');
        return;
    }
    
    // If no history deliveries at all
    if (!allHistoryDeliveries || allHistoryDeliveries.length === 0) {
        container.innerHTML = `
            <div class="text-center py-5">
                <p class="text-muted">No delivery history found.</p>
                <p class="text-muted" style="font-size: 12px;">Completed and cancelled deliveries will appear here.</p>
            </div>
        `;
        return;
    }
    
    // Filter deliveries based on selected status
    let filteredDeliveries = [];
    if (status === 'all') {
        filteredDeliveries = [...allHistoryDeliveries];
    } else {
        filteredDeliveries = allHistoryDeliveries.filter(delivery => {
            const deliveryStatus = normalizeStatus(delivery.Delivery_Status || 'Delivered');
            return deliveryStatus === status;
        });
    }
    
    console.log('[Filter History Deliveries] Filtered deliveries:', {
        status: status,
        total: allHistoryDeliveries.length,
        filtered: filteredDeliveries.length
    });
    
    // Clear container
    container.innerHTML = '';
    
    if (filteredDeliveries.length === 0) {
        container.innerHTML = `
            <div class="text-center py-5">
                <p class="text-muted">No deliveries found with status "${status}".</p>
            </div>
        `;
        return;
    }
    
    // Sort filtered deliveries by most recent first
    const sorted = [...filteredDeliveries].sort((a, b) => {
        const dateA = new Date(a.Updated_At || a.Created_At || a.order_date || 0);
        const dateB = new Date(b.Updated_At || b.Created_At || b.order_date || 0);
        return dateB - dateA;
    });
    
    // Create and display delivery cards
    const cardPromises = sorted.map(async (delivery) => {
        try {
            return await createDeliveryCard(delivery);
        } catch (error) {
            console.error('[Filter History Deliveries] Failed to create history card:', error);
            return '';
        }
    });
    
    Promise.all(cardPromises).then(cardHtmls => {
        container.innerHTML = cardHtmls.filter(html => html && html.trim()).join('');
        console.log('[Filter History Deliveries] Displayed', cardHtmls.filter(html => html && html.trim()).length, 'history delivery cards');
    });
};

// Load deliveries
async function loadDeliveries() {
    try {
        console.log('[Load Deliveries] Loading deliveries...');
        
        // First check if user is authenticated
        const sessionCheck = await fetch('../api/check_session.php', {
            method: 'GET',
            credentials: 'include'
        });
        const sessionData = await sessionCheck.json();
        console.log('[Load Deliveries] Session check:', sessionData);
        
        if (!sessionData.logged_in) {
            console.error('[Load Deliveries] ❌ User not logged in');
            const container = document.querySelector('.delivery-cards');
            if (container) {
                container.innerHTML = `
                    <div class="text-center py-5">
                        <p class="text-danger">You are not logged in. Please log in to view deliveries.</p>
                        <button class="btn btn-primary mt-2" onclick="window.location.href='../Customer/Login.html'">Go to Login</button>
                    </div>
                `;
            }
            return;
        }
        
        console.log('[Load Deliveries] User authenticated:', {
            user_id: sessionData.user_id,
            user_role: sessionData.user_role,
            user_name: sessionData.user_name
        });

        // Cache role for other scripts (prevents role detection issues during driver status updates)
        window.__MATARIX_USER_ROLE = sessionData.user_role || window.__MATARIX_USER_ROLE;
        window.__MATARIX_USER_ID = sessionData.user_id || window.__MATARIX_USER_ID;
        if (!sessionStorage.getItem('user_role') && sessionData.user_role) {
            sessionStorage.setItem('user_role', sessionData.user_role);
        }

        // RBAC UI: Delivery Driver - same UI version as admin, with role-appropriate adjustments
        if (isDeliveryDriverRole(sessionData.user_role)) {
            const hideIds = ['fleet-tab', 'filter-btn', 'timetable-btn', 'add-fleet-btn', 'activeDriversStatCard'];
            hideIds.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });
            // Driver-specific page header (same layout, driver-relevant copy)
            const pageTitle = document.getElementById('deliveriesPageTitle');
            const pageSubtitle = document.getElementById('deliveriesPageSubtitle');
            if (pageTitle) pageTitle.textContent = 'My Deliveries';
            if (pageSubtitle) pageSubtitle.textContent = 'Track and complete your assigned deliveries';

            // If currently on a forbidden tab, switch back to Out for Delivery
            const activeTab = document.querySelector('.tab-btn.active');
            const activeName = activeTab ? activeTab.getAttribute('data-tab') : '';
            if (activeName === 'fleet') {
                const safeTab = document.getElementById('out-for-delivery-tab');
                if (safeTab) safeTab.click();
            }
        }
        
        // Check if containers exist
        const outForDeliveryContainer = document.getElementById('outForDeliveryCards');
        const completedContainer = document.getElementById('completedDeliveryCards');
        if (!outForDeliveryContainer || !completedContainer) {
            console.error('[Load Deliveries] ❌ Delivery card containers not found');
            console.error('[Load Deliveries] Available containers:', {
                outForDelivery: !!outForDeliveryContainer,
                completed: !!completedContainer
            });
            return;
        }
        
        // Clear existing cards immediately
        outForDeliveryContainer.innerHTML = '<div class="text-center py-5"><i class="fas fa-spinner fa-spin"></i><p class="text-muted mt-2">Loading deliveries...</p></div>';
        completedContainer.innerHTML = '<div class="text-center py-5"><i class="fas fa-spinner fa-spin"></i><p class="text-muted mt-2">Loading deliveries...</p></div>';
        
        const response = await fetch('../api/load_deliveries_admin.php', {
            method: 'GET',
            credentials: 'include', // Important: include cookies for session
            headers: {
                'Accept': 'application/json'
            }
        });
        
        const data = await response.json();
        console.log('[Load Deliveries] API Response:', data);
        
        if (!response.ok) {
            // Log detailed error information
            console.error('[Load Deliveries] ❌ HTTP Error:', response.status);
            console.error('[Load Deliveries] ❌ Error Message:', data.message);
            console.error('[Load Deliveries] ❌ Debug Info:', data.debug);
            
            // Show more helpful error message
            let errorMessage = `Error loading deliveries: ${data.message || 'HTTP error! status: ' + response.status}`;
            if (response.status === 403) {
                errorMessage = `Access Denied: ${data.message || 'You do not have permission to view deliveries. Your role: ' + (sessionData.user_role || 'not set') + '. Required roles: Admin, Store Employee, or Delivery Driver.'}`;
            } else if (response.status === 401) {
                errorMessage = 'Not Authenticated: Please log in to view deliveries.';
            }
            
            throw new Error(errorMessage);
        }
        
        if (data.success && data.deliveries) {
            console.log('[Load Deliveries] Total deliveries received:', data.deliveries.length);
            console.log('[Load Deliveries] All delivery statuses:', data.deliveries.map(d => ({
                delivery_id: d.Delivery_ID,
                order_id: d.Order_ID,
                status: d.Delivery_Status,
                status_type: typeof d.Delivery_Status
            })));
            
            // Filter deliveries into two categories:
            // 1. "Out for Delivery" - ONLY deliveries with status "Out for Delivery" (in transit)
            // 2. "Completed Delivery" - status is "Delivered" or "Cancelled"
            const outForDeliveryDeliveries = data.deliveries.filter(d => {
                const normalized = normalizeStatus(d.Delivery_Status || 'Pending');
                return normalized === 'Out for Delivery';
            });
            
            const completedDeliveries = data.deliveries.filter(d => {
                const normalized = normalizeStatus(d.Delivery_Status || 'Pending');
                return normalized === 'Delivered' || normalized === 'Cancelled';
            });
            
            // Store all deliveries for delivery driver view access
            // Active deliveries: all non-completed deliveries (Pending, Preparing, Out for Delivery)
            allActiveDeliveries = data.deliveries.filter(d => {
                const normalized = normalizeStatus(d.Delivery_Status || 'Pending');
                return normalized !== 'Delivered' && normalized !== 'Cancelled';
            });
            
            // History deliveries: completed deliveries (Delivered, Cancelled)
            allHistoryDeliveries = completedDeliveries;
            
            console.log('[Load Deliveries] Filtered results:', {
                total: data.deliveries.length,
                outForDelivery: outForDeliveryDeliveries.length,
                completed: completedDeliveries.length,
                active: allActiveDeliveries.length,
                history: allHistoryDeliveries.length
            });
            
            // Update statistics
            updateDeliveryStatistics(data.deliveries, outForDeliveryDeliveries, completedDeliveries);
            
            // Load "Out for Delivery" deliveries
            const outForDeliveryContainer = document.getElementById('outForDeliveryCards');
            if (outForDeliveryContainer) {
                outForDeliveryContainer.innerHTML = '';
                
                if (outForDeliveryDeliveries.length === 0) {
                    outForDeliveryContainer.innerHTML = `
                        <div class="text-center py-5">
                            <p class="text-muted">No deliveries out for delivery</p>
                        </div>
                    `;
                } else {
                    // Group deliveries by preferred delivery date
                    const grouped = groupDeliveriesByPreferredDate(outForDeliveryDeliveries);
                    
                    // Render grouped deliveries with date headers
                    const parts = [];
                    for (const group of grouped) {
                        const cardPromises = group.deliveries.map(async (delivery) => {
                            try {
                                return await createDeliveryCard(delivery);
                            } catch (error) {
                                console.error('[Load Deliveries] ❌ Failed to create card:', error);
                                return '';
                            }
                        });
                        const cardHtmls = await Promise.all(cardPromises);
                        const validCards = cardHtmls.filter(html => html && html.trim());
                        
                        if (validCards.length > 0) {
                            const headerHtml = escapeHtml(group.dateLabel);
                            parts.push(`<div class="order-date-group"><div class="order-date-group-header">${headerHtml}</div><div class="order-date-group-cards">${validCards.join('')}</div></div>`);
                        }
                    }
                    outForDeliveryContainer.innerHTML = parts.join('');
                }
            }
            
            // Load "Completed Delivery" deliveries
            const completedContainer = document.getElementById('completedDeliveryCards');
            if (completedContainer) {
                completedContainer.innerHTML = '';
                
                if (completedDeliveries.length === 0) {
                    completedContainer.innerHTML = `
                        <div class="text-center py-5">
                            <p class="text-muted">No completed deliveries</p>
                        </div>
                    `;
                } else {
                    // Sort by most recent first
                    const sorted = [...completedDeliveries].sort((a, b) => {
                        const dateA = new Date(a.Updated_At || a.Created_At || a.order_date || 0);
                        const dateB = new Date(b.Updated_At || b.Created_At || b.order_date || 0);
                        return dateB - dateA;
                    });
                    
                    // Create delivery cards asynchronously
                    const cardPromises = sorted.map(async (delivery) => {
                        try {
                            return await createDeliveryCard(delivery);
                        } catch (error) {
                            console.error('[Load Deliveries] ❌ Failed to create card:', error);
                            return '';
                        }
                    });
                    const cardHtmls = await Promise.all(cardPromises);
                    const validCards = cardHtmls.filter(html => html && html.trim());
                    // Wrap in order-date-group-cards so completed cards match other cards (same size, grid layout)
                    completedContainer.innerHTML = validCards.length
                        ? `<div class="order-date-group-cards">${validCards.join('')}</div>`
                        : `<div class="text-center py-5"><p class="text-muted">No completed deliveries</p></div>`;
                }
            }
            
            // Update tab counts
            const outForDeliveryCountEl = document.getElementById('outForDeliveryCount');
            const completedDeliveryCountEl = document.getElementById('completedDeliveryCount');
            if (outForDeliveryCountEl) outForDeliveryCountEl.textContent = outForDeliveryDeliveries.length;
            if (completedDeliveryCountEl) completedDeliveryCountEl.textContent = completedDeliveries.length;
            
            // Update statistics
            if (data.statistics) {
                updateStatistics(data.statistics);
            }
            
            // Setup event listeners for status dropdowns
            setupStatusDropdowns();
            
            // Setup event delegation for Complete Delivery buttons
            setupCompleteDeliveryButtons();
            setupViewButtons();
            
            console.log('[Load Deliveries] ✅ Deliveries loaded successfully:', {
                total: data.deliveries.length,
                outForDelivery: outForDeliveryDeliveries.length,
                completed: completedDeliveries.length
            });
        } else {
            console.error('[Load Deliveries] ❌ Failed to load deliveries:', data.message);
            const outForDeliveryContainer = document.getElementById('outForDeliveryCards');
            const completedContainer = document.getElementById('completedDeliveryCards');
            const errorMsg = `<div class="text-center py-5">
                <p class="text-danger">Failed to load deliveries: ${data.message || 'Unknown error'}</p>
                <button class="btn btn-primary mt-2" onclick="loadDeliveries()">Retry</button>
            </div>`;
            if (outForDeliveryContainer) outForDeliveryContainer.innerHTML = errorMsg;
            if (completedContainer) completedContainer.innerHTML = errorMsg;
        }
    } catch (error) {
        console.error('[Load Deliveries] ❌ Error loading deliveries:', error);
        const outForDeliveryContainer = document.getElementById('outForDeliveryCards');
        const completedContainer = document.getElementById('completedDeliveryCards');
        const errorMsg = `<div class="text-center py-5">
            <p class="text-danger">Error loading deliveries: ${error.message || 'Unknown error'}</p>
            <button class="btn btn-primary mt-2" onclick="loadDeliveries()">Retry</button>
        </div>`;
        if (outForDeliveryContainer) outForDeliveryContainer.innerHTML = errorMsg;
        if (completedContainer) completedContainer.innerHTML = errorMsg;
    }
}

// Update delivery statistics
function updateDeliveryStatistics(allDeliveries, outForDeliveryDeliveries, completedDeliveries) {
    const totalDeliveries = allDeliveries.length;
    const outForDeliveryCount = outForDeliveryDeliveries.length;
    const completedCount = completedDeliveries.length;
    
    // Count active drivers (drivers with active deliveries)
    const activeDriverIds = new Set();
    outForDeliveryDeliveries.forEach(d => {
        if (d.drivers && d.drivers.length > 0) {
            d.drivers.forEach(driver => {
                if (driver.Driver_ID) activeDriverIds.add(driver.Driver_ID);
            });
        } else if (d.Driver_ID) {
            activeDriverIds.add(d.Driver_ID);
        }
    });
    const activeDriversCount = activeDriverIds.size;
    
    // Update statistics displays
    const totalDeliveriesStat = document.getElementById('totalDeliveriesStat');
    const outForDeliveryStat = document.getElementById('outForDeliveryStat');
    const completedDeliveriesStat = document.getElementById('completedDeliveriesStat');
    const activeDriversStat = document.getElementById('activeDriversStat');
    
    if (totalDeliveriesStat) totalDeliveriesStat.textContent = totalDeliveries;
    if (outForDeliveryStat) outForDeliveryStat.textContent = outForDeliveryCount;
    if (completedDeliveriesStat) completedDeliveriesStat.textContent = completedCount;
    if (activeDriversStat) activeDriversStat.textContent = activeDriversCount;
    
    console.log('[Update Delivery Statistics] Updated:', {
        total: totalDeliveries,
        outForDelivery: outForDeliveryCount,
        completed: completedCount,
        activeDrivers: activeDriversCount
    });
}

// Update statistics (kept for backward compatibility, but updateDeliveryStatistics is now used)
function updateStatistics(stats) {
    // This function is kept for compatibility but may not be called anymore
    // The new updateDeliveryStatistics function handles statistics updates
    console.log('[Load Deliveries] updateStatistics called (legacy):', stats);
}

// Update statistics immediately after status change (optimistic update)
function updateStatisticsAfterStatusChange(newStatus, oldStatus) {
    // This function is kept for compatibility but statistics are now updated via loadDeliveries
    // Reload deliveries to get accurate counts
    if (typeof loadDeliveries === 'function') {
        setTimeout(() => loadDeliveries(), 500);
    }
    
    // Determine if status change affects active deliveries count
    const activeStatuses = ['Pending', 'Preparing', 'Out for Delivery'];
    const completedStatuses = ['Delivered', 'Cancelled'];
    
    const wasActive = activeStatuses.includes(oldStatus);
    const isActive = activeStatuses.includes(newStatus);
    const wasCompleted = completedStatuses.includes(oldStatus);
    const isCompleted = completedStatuses.includes(newStatus);
    
    // If moving from active to completed, decrease count
    if (wasActive && isCompleted) {
        newActive = Math.max(0, currentActive - 1);
    }
    // If moving from completed to active, increase count
    else if (wasCompleted && isActive) {
        newActive = currentActive + 1;
    }
    // If moving between active statuses, count stays the same
    // If moving between completed statuses, count stays the same
    
    if (newActive !== currentActive) {
        activeEl.textContent = newActive;
        console.log('[Update Statistics] Active deliveries updated:', {
            old: currentActive,
            new: newActive,
            status_change: `${oldStatus} -> ${newStatus}`
        });
    }
}

// Setup event delegation for Complete Delivery buttons
function setupCompleteDeliveryButtons() {
    // Remove any existing listeners first to prevent duplicates
    const existingHandler = window._completeDeliveryHandler;
    if (existingHandler) {
        document.removeEventListener('click', existingHandler, true);
    }
    
    // Create new handler - use bubbling phase (not capture) to avoid conflicts
    window._completeDeliveryHandler = function(e) {
        // IMPORTANT: Only handle .delivered-btn clicks - allow View buttons and other links to work normally
        // Check if the click is on a View button (link or button) or other link - if so, let it through
        const clickedLink = e.target.closest('a.view-btn, a.order-card-btn');
        const clickedViewButton = e.target.closest('button.view-btn');
        if ((clickedLink && !clickedLink.classList.contains('delivered-btn')) || clickedViewButton) {
            return; // Allow View button (link or button) and other links to work normally
        }
        
        // Find the button - check if click is on button or its child elements
        const btn = e.target.closest('.delivered-btn');
        if (!btn || btn.disabled) {
            return; // Not our button, let it bubble normally
        }
        
        // Prevent all default behaviors and propagation ONLY for Complete Delivery button
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        const deliveryId = parseInt(btn.getAttribute('data-delivery-id')) || 0;
        const orderId = parseInt(btn.getAttribute('data-order-id'));
        const customerName = btn.getAttribute('data-customer-name') || 'the customer';
        
        console.log('[Complete Delivery Button] Clicked:', { deliveryId, orderId, customerName });
        
        // Check if function exists
        if (typeof window.completeDelivery !== 'function') {
            console.error('[Setup Complete Delivery] completeDelivery function not available');
            if (window.AdminNotifications) {
                AdminNotifications.error('Complete delivery function not loaded. Please refresh the page.', {
                    duration: 5000
                });
            } else {
                alert('Complete delivery function not loaded. Please refresh the page.');
            }
            return false;
        }
        
        if (!orderId) {
            console.error('[Setup Complete Delivery] Missing order ID');
            if (window.AdminNotifications) {
                AdminNotifications.error('Missing order information. Please refresh the page.', {
                    duration: 5000
                });
            } else {
                alert('Missing order information. Please refresh the page.');
            }
            return false;
        }
        
        // Call the function
        try {
            window.completeDelivery(deliveryId, orderId, customerName);
        } catch (error) {
            console.error('[Setup Complete Delivery] Error calling function:', error);
            if (window.AdminNotifications) {
                AdminNotifications.error('An error occurred: ' + (error.message || 'Unknown error'), {
                    duration: 5000
                });
            } else {
                alert('An error occurred: ' + (error.message || 'Unknown error'));
            }
        }
        
        return false;
    };
    
    // Use event delegation with BUBBLING phase (not capture) to avoid interfering with other handlers
    document.addEventListener('click', window._completeDeliveryHandler, false);
    
    // Setup Cancel Delivery button handler
    setupCancelDeliveryButtons();
    console.log('[Setup Complete Delivery] Event handler attached');
}

// Setup event delegation for View buttons (when they're buttons for delivery drivers)
function setupViewButtons() {
    // Remove any existing listeners first to prevent duplicates
    const existingHandler = window._viewButtonHandler;
    if (existingHandler) {
        document.removeEventListener('click', existingHandler, false);
    }
    
    // Create new handler for View buttons that are buttons (not links)
    window._viewButtonHandler = function(e) {
        // Only handle button.view-btn clicks (not link.view-btn)
        const btn = e.target.closest('button.view-btn');
        if (!btn || btn.disabled) {
            return; // Not our button, let it bubble normally
        }
        
        // Prevent default and stop propagation
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        const deliveryId = parseInt(btn.getAttribute('data-delivery-id')) || 0;
        const orderId = parseInt(btn.getAttribute('data-order-id'));
        
        console.log('[View Button] Clicked (button):', { deliveryId, orderId });
        
        // Check if function exists
        if (typeof window.viewDeliveryDetails !== 'function') {
            console.error('[Setup View Button] viewDeliveryDetails function not available');
            if (window.AdminNotifications) {
                AdminNotifications.error('View delivery details function not loaded. Please refresh the page.', {
                    duration: 5000
                });
            } else {
                alert('View delivery details function not loaded. Please refresh the page.');
            }
            return false;
        }
        
        if (!deliveryId && !orderId) {
            console.error('[Setup View Button] Missing delivery ID or order ID');
            if (window.AdminNotifications) {
                AdminNotifications.error('Missing delivery information. Please refresh the page.', {
                    duration: 5000
                });
            } else {
                alert('Missing delivery information. Please refresh the page.');
            }
            return false;
        }
        
        // Call the function
        try {
            if (deliveryId) {
                window.viewDeliveryDetails(deliveryId);
            } else {
                console.error('[Setup View Button] Delivery ID not found, cannot open modal');
            }
        } catch (error) {
            console.error('[Setup View Button] Error calling function:', error);
            if (window.AdminNotifications) {
                AdminNotifications.error('An error occurred: ' + (error.message || 'Unknown error'), {
                    duration: 5000
                });
            } else {
                alert('An error occurred: ' + (error.message || 'Unknown error'));
            }
        }
        
        return false;
    };
    
    // Use event delegation with BUBBLING phase
    document.addEventListener('click', window._viewButtonHandler, false);
    console.log('[Setup View Button] Event handler attached');
}

// Setup status dropdown event listeners (for both active deliveries and history tabs)
function setupStatusDropdowns() {
    // Check if status update is in progress - if so, skip setup to prevent glitching
    if (isStatusUpdateInProgress) {
        console.log('[Setup Status Dropdowns] Skipping setup - status update in progress');
        return;
    }
    
    // Remove existing listeners by cloning nodes (removes all event listeners)
    // BUT: Preserve the current value and disabled state to prevent glitching
    document.querySelectorAll('.delivery-status-dropdown').forEach(dropdown => {
        const currentValue = dropdown.value;
        const isDisabled = dropdown.disabled;
        const previousValue = dropdown.getAttribute('data-previous-value') || currentValue;
        
        const newDropdown = dropdown.cloneNode(true);
        // Restore the value and state immediately
        newDropdown.value = currentValue;
        newDropdown.disabled = isDisabled;
        newDropdown.setAttribute('data-previous-value', previousValue);
        
        dropdown.parentNode.replaceChild(newDropdown, dropdown);
    });
    
    // Add event listeners to all dropdowns (in both tabs)
    document.querySelectorAll('.delivery-status-dropdown').forEach(dropdown => {
        // Get the actual current status from the dropdown's selected option
        const selectedOption = dropdown.options[dropdown.selectedIndex];
        const currentStatus = selectedOption ? selectedOption.value : dropdown.value;
        
        // Store the current status as the previous value
        dropdown.setAttribute('data-previous-value', currentStatus);
        dropdown.value = currentStatus; // Ensure value matches stored value
        
        // Get order status from dropdown data attribute or delivery card (now order-card)
        const orderStatus = dropdown.getAttribute('data-order-status') || 
                           (dropdown.closest('.order-card')?.getAttribute('data-order-status')) || 
                           'Pending Approval';
        
        // Disable dropdown if: 1) Final status (Delivered/Cancelled), OR 2) Order status is not "Ready"
        const finalStatuses = ['Delivered', 'Cancelled'];
        const normalizedCurrentStatus = normalizeStatus(currentStatus);
        const isOrderReady = orderStatus === 'Ready';
        
        if (finalStatuses.includes(normalizedCurrentStatus)) {
            dropdown.disabled = true;
            dropdown.setAttribute('data-final-status', 'true');
            dropdown.title = 'This delivery is in a final state and cannot be changed.';
        } else if (!isOrderReady) {
            dropdown.disabled = true;
            dropdown.removeAttribute('data-final-status');
            dropdown.setAttribute('data-order-not-ready', 'true');
            dropdown.title = 'Delivery status can only be changed when order status is "Ready". Current order status: ' + orderStatus;
        } else {
            // Ensure dropdown is enabled for non-final statuses when order is Ready
            dropdown.disabled = false;
            dropdown.removeAttribute('data-final-status');
            dropdown.removeAttribute('data-order-not-ready');
            dropdown.title = 'Select next status';
        }
        
        // Use a single event listener with proper event handling
        dropdown.addEventListener('change', async function(e) {
            e.stopPropagation(); // Prevent event bubbling
            
            // Prevent multiple simultaneous confirmations
            if (isConfirmationShowing) {
                console.log('[Status Dropdown] Confirmation already showing, ignoring duplicate change');
                const previousValue = this.getAttribute('data-previous-value') || this.value;
                this.value = previousValue;
                this.selectedIndex = Array.from(this.options).findIndex(opt => opt.value === previousValue);
                return;
            }
            
            // Prevent changes during status update
            if (isStatusUpdateInProgress) {
                console.log('[Status Dropdown] Status update in progress, ignoring change');
                const previousValue = this.getAttribute('data-previous-value') || this.value;
                this.value = previousValue;
                this.selectedIndex = Array.from(this.options).findIndex(opt => opt.value === previousValue);
                return;
            }
            
            const deliveryId = parseInt(this.getAttribute('data-delivery-id'));
            const orderId = parseInt(this.getAttribute('data-order-id'));
            const newStatus = this.value;
            
            // Get previous value from attribute (should be set when dropdown was created)
            let previousValue = this.getAttribute('data-previous-value');
            
            // If previous value is not set, use the current value before change
            if (!previousValue) {
                // Try to find the previously selected option
                const options = Array.from(this.options);
                const previouslySelected = options.find(opt => opt.hasAttribute('data-was-selected'));
                if (previouslySelected) {
                    previousValue = previouslySelected.value;
                } else {
                    // Fallback: use the first non-disabled option that's not the new status
                    const otherOption = options.find(opt => !opt.disabled && opt.value !== newStatus);
                    previousValue = otherOption ? otherOption.value : this.value;
                }
            }
            
            // Only proceed if status actually changed
            if (newStatus === previousValue) {
                console.log('[Status Dropdown] No change detected, ignoring');
                return;
            }
            
            console.log('[Status Dropdown] Status change detected:', {
                deliveryId,
                from: previousValue,
                to: newStatus,
                storedPrevious: this.getAttribute('data-previous-value')
            });
            
            // Temporarily disable dropdown to prevent multiple clicks
            this.disabled = true;
            
            // IMMEDIATELY reset dropdown to previous value to prevent visual change
            // We'll update it after confirmation
            this.value = previousValue;
            this.selectedIndex = Array.from(this.options).findIndex(opt => opt.value === previousValue);
            
            // Show confirmation popup BEFORE proceeding
            isConfirmationShowing = true;
            let confirmed = false;
            
            try {
                // Try both window.AdminNotifications and AdminNotifications for compatibility
                const AdminNotif = window.AdminNotifications || (typeof AdminNotifications !== 'undefined' ? AdminNotifications : null);
                
                if (AdminNotif && typeof AdminNotif.confirm === 'function') {
                    console.log('[Status Dropdown] Showing confirmation popup');
                    confirmed = await AdminNotif.confirm(
                        `Are you sure you want to change the delivery status from "${previousValue}" to "${newStatus}"?`,
                        {
                            title: 'Confirm Status Change',
                            confirmText: 'Yes, Change Status',
                            cancelText: 'Cancel'
                        }
                    );
                    console.log('[Status Dropdown] Confirmation result:', confirmed);
                } else {
                    console.warn('[Status Dropdown] AdminNotifications not available. AdminNotif:', AdminNotif);
                    console.log('[Status Dropdown] Using browser confirm as fallback');
                    confirmed = confirm(`Are you sure you want to change the delivery status from "${previousValue}" to "${newStatus}"?`);
                }
            } catch (error) {
                console.error('[Status Dropdown] Confirmation error:', error);
                confirmed = false;
            } finally {
                isConfirmationShowing = false;
            }
            
            // If user cancelled, keep dropdown at previous value and re-enable it
            if (!confirmed) {
                console.log('[Status Dropdown] User cancelled status change');
                this.value = previousValue;
                this.selectedIndex = Array.from(this.options).findIndex(opt => opt.value === previousValue);
                this.disabled = false;
                return;
            }
            
            // User confirmed - now update the dropdown to show the new value
            this.value = newStatus;
            this.selectedIndex = Array.from(this.options).findIndex(opt => opt.value === newStatus);
            
            // Mark the previous option for future reference
            Array.from(this.options).forEach(opt => {
                opt.removeAttribute('data-was-selected');
                if (opt.value === previousValue) {
                    opt.setAttribute('data-was-selected', 'true');
                }
            });
            
            // Update the stored previous value to the current value before making the change
            // This ensures we have the correct previous value if the update fails
            this.setAttribute('data-previous-value', previousValue);
            
            // Now proceed with the status update
            updateDeliveryStatus(deliveryId, orderId, newStatus, previousValue, this);
        }, { once: false, passive: false }); // Changed passive to false to allow preventDefault
    });
    
    console.log('[Setup Status Dropdowns] ✅ Event listeners attached to', document.querySelectorAll('.delivery-status-dropdown').length, 'dropdowns');
}

// Track if status update is in progress to prevent auto-refresh interference
let isStatusUpdateInProgress = false;
let statusUpdateDeliveryIds = new Set();
// Track if confirmation dialog is showing to prevent multiple popups
let isConfirmationShowing = false;

// Update delivery status
async function updateDeliveryStatus(deliveryId, orderId, newStatus, previousValue, dropdownElement) {
    console.log('[Update Delivery Status] Updating:', { deliveryId, orderId, newStatus });
    
    // Prevent multiple simultaneous updates for the same delivery
    if (statusUpdateDeliveryIds.has(deliveryId)) {
        console.log('[Update Delivery Status] Update already in progress for delivery:', deliveryId);
        // Reset dropdown to previous value (don't default to 'Pending')
        const storedPrevious = dropdownElement.getAttribute('data-previous-value');
        const resetValue = previousValue || storedPrevious || dropdownElement.value;
        dropdownElement.value = resetValue;
        dropdownElement.selectedIndex = Array.from(dropdownElement.options).findIndex(opt => opt.value === resetValue);
        return;
    }
    
    // Mark update as in progress
    isStatusUpdateInProgress = true;
    statusUpdateDeliveryIds.add(deliveryId);
    
    // Dropdown should already be disabled from the change handler, but ensure it's disabled
    dropdownElement.disabled = true;
    
    // Validate status progression on frontend before API call
    const roleForStatusRules = getCurrentUserRole();
    const allowCancelStatus = false; // Cancel option removed for admin and employee
    const finalStatuses = ['Delivered', 'Cancelled'];
    const statusOrder = ['Pending', 'Preparing', 'Out for Delivery', 'Delivered'];
    
    // Helper: step-by-step only (no skipping, no going backward)
    const isNextStatus = (fromStatus, toStatus) => {
        if (toStatus === 'Cancelled') return allowCancelStatus;
        if (finalStatuses.includes(fromStatus)) return false;
        const fromIndex = statusOrder.indexOf(fromStatus);
        const toIndex = statusOrder.indexOf(toStatus);
        if (fromIndex === -1 || toIndex === -1) return true; // safety fallback
        return toIndex === fromIndex + 1;
    };
    
    // Get current status - use previousValue if provided, otherwise get from dropdown attribute or current value
    let currentStatus = previousValue;
    if (!currentStatus) {
        currentStatus = dropdownElement.getAttribute('data-previous-value');
    }
    if (!currentStatus) {
        // Get from the dropdown's current selected value (before it was changed)
        const selectedOption = dropdownElement.options[dropdownElement.selectedIndex];
        currentStatus = selectedOption ? selectedOption.value : dropdownElement.value;
    }
    // Only default to 'Pending' as absolute last resort
    if (!currentStatus) {
        currentStatus = 'Pending';
    }
    
    const normalizedCurrentStatus = normalizeStatus(currentStatus);
    
    console.log('[Update Delivery Status] Current status check:', {
        previousValue,
        storedPrevious: dropdownElement.getAttribute('data-previous-value'),
        currentStatus,
        normalizedCurrentStatus,
        newStatus
    });
    
    // Check if current status is final
    if (finalStatuses.includes(normalizedCurrentStatus)) {
        if (window.AdminNotifications) {
            AdminNotifications.warning(`Cannot update delivery status. Delivery is already ${normalizedCurrentStatus}. Final statuses cannot be changed.`, {
                duration: 5000,
                title: 'Status Update Blocked'
            });
        } else {
            if (typeof AdminNotifications !== 'undefined') {
                AdminNotifications.warning(`Cannot update delivery status. Delivery is already ${normalizedCurrentStatus}. Final statuses cannot be changed.`, {
                    duration: 4000
                });
            } else {
                console.warn(`Cannot update delivery status. Delivery is already ${normalizedCurrentStatus}. Final statuses cannot be changed.`);
            }
        }
        // Reset dropdown to previous value
        dropdownElement.value = previousValue || normalizedCurrentStatus;
        dropdownElement.disabled = false;
        isConfirmationShowing = false; // Reset confirmation flag
        statusUpdateDeliveryIds.delete(deliveryId);
        isStatusUpdateInProgress = false;
        return;
    }
    
    // Check if status change is valid (step-by-step only)
    if (newStatus !== normalizedCurrentStatus && !isNextStatus(normalizedCurrentStatus, newStatus)) {
        const fromIndex = statusOrder.indexOf(normalizedCurrentStatus);
        const next = (fromIndex >= 0 && fromIndex + 1 < statusOrder.length) ? statusOrder[fromIndex + 1] : null;
        const allowedStatuses = [];
        if (next) allowedStatuses.push(next);
        if (allowCancelStatus) allowedStatuses.push('Cancelled');
        
        if (window.AdminNotifications) {
            AdminNotifications.warning(`Invalid status change. Cannot change from '${normalizedCurrentStatus}' to '${newStatus}'. Status must move step-by-step. Valid statuses: ${allowedStatuses.join(', ') || 'N/A'}`, {
                duration: 5000,
                title: 'Invalid Status Change'
            });
        } else {
            console.warn(`Invalid status change. Cannot change from '${normalizedCurrentStatus}' to '${newStatus}'. Status must move step-by-step. Valid statuses: ${allowedStatuses.join(', ') || 'N/A'}`);
        }
        // Reset dropdown to previous value
        dropdownElement.value = previousValue || normalizedCurrentStatus;
        dropdownElement.disabled = false;
        isConfirmationShowing = false; // Reset confirmation flag
        statusUpdateDeliveryIds.delete(deliveryId);
        isStatusUpdateInProgress = false;
        return;
    }
    
    // Only require order to be "Ready" before the FIRST status change off Pending.
    // Delivery Driver: do NOT call admin-only order APIs here.
    const mustBeReadyForThisChange = normalizedCurrentStatus === 'Pending' && newStatus !== 'Pending';
    if (roleForStatusRules === 'Delivery Driver') {
        // Let the backend validate (assigned delivery, approved order, etc.)
    } else if (orderId && mustBeReadyForThisChange) {
        try {
            const orderResponse = await fetch(`../api/get_orders.php?order_id=${orderId}`, {
                method: 'GET',
                credentials: 'include'
            });
            
            if (orderResponse.ok) {
                const orderData = await orderResponse.json();
                // API returns single order object when order_id is provided
                const order = orderData.success && orderData.order ? orderData.order : 
                            (orderData.success && orderData.orders && orderData.orders.length > 0 ? orderData.orders[0] : null);
                
                if (order) {
                    // Prevent status update if order status is not "Ready"
                    if (order.status !== 'Ready') {
                        console.error('[Update Delivery Status] ❌ Order status is not "Ready". Cannot update delivery status. Current status:', order.status);
                        // Reset dropdown to previous value
                        if (dropdownElement && previousValue) {
                            dropdownElement.value = previousValue;
                        }
                        
                        if (typeof AdminNotifications !== 'undefined') {
                            AdminNotifications.warning(
                                'Delivery status can only be changed when order status is "Ready". Current order status: ' + order.status,
                                { duration: 5000, title: 'Cannot Change Delivery Status' }
                            );
                        } else {
                            if (typeof AdminNotifications !== 'undefined') {
                                AdminNotifications.warning('Delivery status can only be changed when order status is "Ready". Current order status: ' + order.status, {
                                    duration: 5000,
                                    title: 'Cannot Change Delivery Status'
                                });
                            } else {
                                console.warn('Delivery status can only be changed when order status is "Ready". Current order status: ' + order.status);
                            }
                        }
                        return;
                    }
                }
            }
        } catch (error) {
            console.warn('[Update Delivery Status] Could not verify order status:', error);
            // Continue with update attempt - API will also check
        }
    }
    
    // Confirmation is now handled in the dropdown change event handler
    // Proceed directly with status update
    try {
        console.log('[Update Delivery Status] Sending request:', {
            delivery_id: deliveryId,
            order_id: orderId,
            status: newStatus
        });
        
        const response = await fetch('../api/update_delivery_status.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                delivery_id: deliveryId,
                order_id: orderId,
                status: newStatus
            })
        });
        
        console.log('[Update Delivery Status] Response status:', response.status, response.statusText);
        
        if (!response.ok) {
            // Try to get error message from response
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.message || `HTTP error! status: ${response.status}`;
            console.error('[Update Delivery Status] ❌ Error response:', errorData);
            throw new Error(errorMessage);
        }
        
        const data = await response.json();
        console.log('[Update Delivery Status] Response:', data);
        
        // Check if the update actually succeeded
        if (!data.success) {
            console.error('[Update Delivery Status] ❌ Update failed:', data.message);
            // Don't proceed with dropdown update if API call failed
            throw new Error(data.message || 'Status update failed');
        }
        
        if (data.success) {
            console.log('[Update Delivery Status] ✅ Status updated successfully');
            console.log('[Update Delivery Status] Updated delivery:', data.delivery);
            
            // Update the dropdown's previous value to the actual saved status
            const savedStatus = data.delivery?.Delivery_Status || data.saved_status || newStatus;
            const normalizedSavedStatus = normalizeStatus(savedStatus);
            
            console.log('[Update Delivery Status] Status update response:', {
                savedStatus,
                normalizedSavedStatus,
                newStatus,
                deliveryData: data.delivery
            });
            
            // CRITICAL: Update dropdown value immediately and persist it
            dropdownElement.setAttribute('data-previous-value', normalizedSavedStatus);
            dropdownElement.value = normalizedSavedStatus; // Set the value to match saved status
            
            // Force the dropdown to show the correct value (prevent browser from reverting)
            const optionIndex = Array.from(dropdownElement.options).findIndex(opt => opt.value === normalizedSavedStatus);
            if (optionIndex >= 0) {
                dropdownElement.selectedIndex = optionIndex;
            } else {
                console.error('[Update Delivery Status] ⚠️ Could not find option for status:', normalizedSavedStatus);
                // Try to find by case-insensitive match
                const caseInsensitiveIndex = Array.from(dropdownElement.options).findIndex(opt => 
                    opt.value.toLowerCase() === normalizedSavedStatus.toLowerCase()
                );
                if (caseInsensitiveIndex >= 0) {
                    dropdownElement.selectedIndex = caseInsensitiveIndex;
                    console.log('[Update Delivery Status] Found case-insensitive match at index:', caseInsensitiveIndex);
                }
            }
            
            // If status is now final, disable the dropdown permanently
            const finalStatuses = ['Delivered', 'Cancelled'];
            if (finalStatuses.includes(normalizedSavedStatus)) {
                dropdownElement.disabled = true;
                dropdownElement.setAttribute('data-final-status', 'true');
                dropdownElement.title = 'This delivery is in a final state and cannot be changed.';
            } else {
                // Re-enable dropdown if not final status
                dropdownElement.disabled = false;
                dropdownElement.removeAttribute('data-final-status');
            }
            
            // Update statistics immediately based on the new status (if function exists)
            if (typeof updateStatisticsAfterStatusChange === 'function') {
                updateStatisticsAfterStatusChange(normalizedSavedStatus, previousValue);
            }
            
            // Show success popup
            console.log('[Update Delivery Status] Showing success popup for status:', normalizedSavedStatus);
            const AdminNotif = window.AdminNotifications || (typeof AdminNotifications !== 'undefined' ? AdminNotifications : null);
            
            if (AdminNotif && typeof AdminNotif.success === 'function') {
                console.log('[Update Delivery Status] Using AdminNotifications.success');
                AdminNotif.success(
                    `Delivery status successfully changed to "${normalizedSavedStatus}"`,
                    {
                        title: 'Status Updated',
                        duration: 4000
                    }
                );
            } else {
                console.warn('[Update Delivery Status] AdminNotifications not available. AdminNotif:', AdminNotif);
                console.log('[Update Delivery Status] ✅ Status changed from "' + previousValue + '" to "' + normalizedSavedStatus + '"');
            }
            
            // Verify the dropdown value is correct after setting it
            if (dropdownElement.value !== normalizedSavedStatus) {
                console.error('[Update Delivery Status] ⚠️ Dropdown value mismatch! Expected:', normalizedSavedStatus, 'Got:', dropdownElement.value);
                // Force set again
                dropdownElement.value = normalizedSavedStatus;
                const retryIndex = Array.from(dropdownElement.options).findIndex(opt => opt.value === normalizedSavedStatus);
                if (retryIndex >= 0) {
                    dropdownElement.selectedIndex = retryIndex;
                }
            }
            
            // Add smooth visual feedback to the dropdown (temporary highlight with transition)
            dropdownElement.style.transition = 'background-color 0.3s ease';
            dropdownElement.style.backgroundColor = '#d4edda';
            setTimeout(() => {
                dropdownElement.style.backgroundColor = '';
            }, 1500);
            
            // Determine if card needs to move to a different tab
            // Use normalized status for accurate comparison
            const activeStatuses = ['Pending', 'Preparing', 'Out for Delivery'];
            const completedStatuses = ['Delivered', 'Cancelled'];
            const normalizedPreviousValue = normalizeStatus(previousValue);
            const wasActive = activeStatuses.includes(normalizedPreviousValue);
            const isActive = activeStatuses.includes(normalizedSavedStatus);
            const wasCompleted = completedStatuses.includes(normalizedPreviousValue);
            const isCompleted = completedStatuses.includes(normalizedSavedStatus);
            
            // Only reload if the card needs to move between Active and History tabs
            const needsTabMove = (wasActive && isCompleted) || (wasCompleted && isActive);
            
            if (needsTabMove) {
                console.log('[Update Delivery Status] Card needs to move to different tab. Reloading...');
                // Mark that we're about to reload, so auto-refresh doesn't interfere
                isStatusUpdateInProgress = true;
                
                // Card needs to move to a different tab - reload after a delay to ensure DB is updated
                // Add fade-out animation to the card
                const deliveryCard = dropdownElement.closest('.order-card');
                if (deliveryCard) {
                    deliveryCard.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                    deliveryCard.style.opacity = '0.5';
                    deliveryCard.style.transform = 'scale(0.98)';
                }
                
                // Wait for database commit before reloading
                setTimeout(async () => {
                    console.log('[Update Delivery Status] Reloading to move delivery to appropriate tab...');
                    await loadDeliveries();
                    
                    // Switch to completed delivery tab if delivery was marked as "Delivered" or "Cancelled"
                    if (normalizedSavedStatus === 'Delivered' || normalizedSavedStatus === 'Cancelled') {
                        const completedTab = document.getElementById('completed-delivery-tab');
                        if (completedTab) {
                            // Switch to completed tab after a brief delay to let cards load
                            setTimeout(() => {
                                completedTab.click();
                            }, 500);
                        }
                    }
                    
                    // Clear the update flag after reload completes
                    setTimeout(() => {
                        isStatusUpdateInProgress = false;
                        statusUpdateDeliveryIds.delete(deliveryId);
                    }, 1000);
                }, 2000); // Wait 2 seconds to ensure DB commit and order status update
            } else {
                // Status change stays in the same tab - just reload to refresh the view
                console.log('[Update Delivery Status] Status change stays in same tab. Reloading...');
                setTimeout(async () => {
                    await loadDeliveries();
                    isStatusUpdateInProgress = false;
                    statusUpdateDeliveryIds.delete(deliveryId);
                }, 1000);
            }
        } else {
            console.error('[Update Delivery Status] ❌ Failed:', data.message);
            // Reset dropdown to previous value
            dropdownElement.value = previousValue;
            // Show visual error feedback
            dropdownElement.style.backgroundColor = '#f8d7da';
            setTimeout(() => {
                dropdownElement.style.backgroundColor = '';
            }, 2000);
            
            // Show user-friendly error notification
            const errorMessage = data.message || 'Failed to update delivery status';
            
            // Use AdminNotifications if available, otherwise show alert
            if (window.AdminNotifications) {
                AdminNotifications.error(errorMessage, {
                    duration: 5000,
                    title: 'Cannot Update Status'
                });
            } else {
                // Fallback notification
                const errorMsg = document.createElement('div');
                errorMsg.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #f8d7da; color: #721c24; padding: 15px; border-radius: 5px; z-index: 10000; max-width: 400px; box-shadow: 0 2px 10px rgba(0,0,0,0.2);';
                errorMsg.innerHTML = `
                    <strong>Error</strong><br>
                    ${errorMessage}
                `;
                document.body.appendChild(errorMsg);
                setTimeout(() => errorMsg.remove(), 5000);
            }
            
            // If it's an enum error, show a helpful message
            if (data.fix_url || data.message?.includes('not valid in the database')) {
                console.error('[Update Delivery Status] ⚠️ Database enum needs to be updated!');
                console.error('[Update Delivery Status] Please run:', data.fix_url || 'http://localhost/MatarixWEBs/api/fix_delivery_status_enum.php');
                // Show a non-blocking notification
                const errorMsg = document.createElement('div');
                errorMsg.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #f8d7da; color: #721c24; padding: 15px; border-radius: 5px; z-index: 10000; max-width: 400px; box-shadow: 0 2px 10px rgba(0,0,0,0.2);';
                errorMsg.innerHTML = `
                    <strong>Database Update Required</strong><br>
                    The database needs to be updated to support new statuses.<br>
                    <a href="${data.fix_url || 'http://localhost/MatarixWEBs/api/fix_delivery_status_enum.php'}" target="_blank" style="color: #721c24; text-decoration: underline;">Click here to fix</a>
                `;
                document.body.appendChild(errorMsg);
                setTimeout(() => errorMsg.remove(), 10000);
            }
        }
    } catch (error) {
        console.error('[Update Delivery Status] ❌ Error:', error);
        console.error('[Update Delivery Status] ❌ Error details:', {
            message: error.message,
            stack: error.stack,
            deliveryId,
            orderId,
            newStatus
        });
        // Reset dropdown to previous value and ensure it's set correctly
        const previousStatus = previousValue || dropdownElement.getAttribute('data-previous-value') || 'Pending';
        dropdownElement.value = previousStatus;
        const optionIndex = Array.from(dropdownElement.options).findIndex(opt => opt.value === previousStatus);
        if (optionIndex >= 0) {
            dropdownElement.selectedIndex = optionIndex;
        }
        dropdownElement.disabled = false; // Re-enable dropdown on error
        
        // Show visual error feedback
        dropdownElement.style.backgroundColor = '#f8d7da';
        setTimeout(() => {
            dropdownElement.style.backgroundColor = '';
        }, 2000);
        
        // Show user-friendly error notification
        const errorMessage = error.message || 'Failed to update delivery status. Please try again.';
        
        // Use AdminNotifications if available, otherwise show alert
        if (window.AdminNotifications) {
            AdminNotifications.error(errorMessage, {
                duration: 5000,
                title: 'Update Failed'
            });
        } else {
            // Fallback notification
            const errorMsg = document.createElement('div');
            errorMsg.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #f8d7da; color: #721c24; padding: 15px; border-radius: 5px; z-index: 10000; max-width: 400px; box-shadow: 0 2px 10px rgba(0,0,0,0.2);';
            errorMsg.innerHTML = `
                <strong>Error</strong><br>
                ${errorMessage}
            `;
            document.body.appendChild(errorMsg);
            setTimeout(() => errorMsg.remove(), 5000);
        }
    } finally {
        // Always clear the update flag
        statusUpdateDeliveryIds.delete(deliveryId);
        
        // Only clear isStatusUpdateInProgress if we're not doing a tab move reload
        // (The success block handles clearing it after reload if needed)
        // Re-enable dropdown if not final status (unless it's being disabled for final status)
        const finalStatuses = ['Delivered', 'Cancelled'];
        const currentStatus = dropdownElement.value;
        
        // If status is not final and dropdown is disabled (from error), re-enable it
        if (!finalStatuses.includes(currentStatus) && dropdownElement.disabled && !dropdownElement.hasAttribute('data-final-status')) {
            dropdownElement.disabled = false;
        }
    }
}

// View delivery details
async function viewDeliveryDetails(deliveryId) {
    console.log('[View Delivery Details] Opening modal for Delivery ID:', deliveryId);
    
    // Show loading state
    $('#deliveryDetailsLoading').show();
    $('#deliveryDetailsContent').hide();
    $('#deliveryDetailsError').hide();
    
    // Show the modal
    $('#deliveryDetailsModal').modal('show');
    
    try {
        // Get order ID from the delivery card data attribute
        const deliveryCard = document.querySelector(`[data-delivery-id="${deliveryId}"]`);
        let orderId = null;
        
        if (deliveryCard) {
            orderId = deliveryCard.getAttribute('data-order-id');
        }
        
        if (!orderId || orderId === 'null' || orderId === '0') {
            throw new Error('Order ID not found for this delivery. Please refresh the page and try again.');
        }

        const role = getCurrentUserRole();

        // Delivery Driver: show details without calling admin-only order APIs
        if (role === 'Delivery Driver') {
            const allLoaded = ([]).concat(allActiveDeliveries || [], allHistoryDeliveries || []);
            console.log('[View Delivery Details] Searching for delivery:', { deliveryId, orderId, totalLoaded: allLoaded.length });
            
            // Try to match by Delivery_ID first, then by Order_ID
            let matched = allLoaded.find(d => {
                const dDeliveryId = d.Delivery_ID || d.delivery_id || 0;
                return String(dDeliveryId) === String(deliveryId);
            });
            
            // If not found by Delivery_ID, try Order_ID
            if (!matched) {
                matched = allLoaded.find(d => String(d.Order_ID) === String(orderId) || String(d.order_id) === String(orderId));
            }
            
            if (!matched) {
                console.error('[View Delivery Details] Delivery not found in loaded data:', {
                    deliveryId,
                    orderId,
                    allActiveCount: allActiveDeliveries.length,
                    allHistoryCount: allHistoryDeliveries.length,
                    sampleIds: allLoaded.slice(0, 3).map(d => ({
                        Delivery_ID: d.Delivery_ID,
                        Order_ID: d.Order_ID
                    }))
                });
                throw new Error('Delivery details are not available yet. Please refresh and try again.');
            }
            
            console.log('[View Delivery Details] Found delivery:', {
                Delivery_ID: matched.Delivery_ID,
                Order_ID: matched.Order_ID,
                Status: matched.Delivery_Status
            });

            const deliveryIdForLabel = (matched.Delivery_ID && Number(matched.Delivery_ID) > 0) ? matched.Delivery_ID : deliveryId;
            const deliveryIdFormatted = `DEL-${String(deliveryIdForLabel).padStart(6, '0')}`;
            const orderIdFormatted = `ORD-${String(orderId).padStart(6, '0')}`;

            $('#modal-delivery-id').text(deliveryIdFormatted);
            $('#modal-order-id').text(orderIdFormatted);
            $('#modal-customer-name').text((matched.customer_name || '').trim() || 'N/A');
            $('#modal-delivery-address').text(matched.Customer_Address || 'N/A');

            const deliveryStatus = normalizeStatus(matched.Delivery_Status || 'Pending');
            const statusEl = $('#modal-progress-status');
            statusEl.text(deliveryStatus);
            statusEl.removeClass('status-pending status-preparing status-out-for-delivery status-delivered status-cancelled');

            const statusLower = String(deliveryStatus).toLowerCase();
            if (statusLower.includes('pending')) {
                statusEl.addClass('status-pending');
            } else if (statusLower.includes('preparing')) {
                statusEl.addClass('status-preparing');
            } else if (statusLower.includes('out for delivery') || statusLower.includes('delivery')) {
                statusEl.addClass('status-out-for-delivery');
            } else if (statusLower.includes('delivered')) {
                statusEl.addClass('status-delivered');
            } else if (statusLower.includes('cancelled') || statusLower.includes('canceled')) {
                statusEl.addClass('status-cancelled');
            }

            const productsContainer = $('#modal-ordered-products');
            productsContainer.empty();

            const items = Array.isArray(matched.items) ? matched.items : [];
            if (items.length > 0) {
                let productsHTML = '<table class="table table-bordered table-sm" style="margin-top: 10px;">';
                productsHTML += '<thead class="thead-light"><tr><th>Product</th><th>Quantity</th><th>Unit Price</th><th>Total</th></tr></thead><tbody>';

                let totalAmount = 0;
                items.forEach(item => {
                    const productName = item.Product_Name || `Product (ID: ${item.Product_ID || 'N/A'})`;
                    const quantity = Number(item.Quantity || 0);
                    const price = Number(item.Price || 0);
                    const itemTotal = quantity * price;
                    totalAmount += itemTotal;

                    productsHTML += '<tr>';
                    productsHTML += `<td>${productName}</td>`;
                    productsHTML += `<td>${quantity}</td>`;
                    productsHTML += `<td>₱${price.toFixed(2)}</td>`;
                    productsHTML += `<td>₱${itemTotal.toFixed(2)}</td>`;
                    productsHTML += '</tr>';
                });

                productsHTML += '</tbody>';
                productsHTML += `<tfoot class="table-info"><tr><th colspan="3" class="text-right">Total Amount:</th><th>₱${totalAmount.toFixed(2)}</th></tr></tfoot>`;
                productsHTML += '</table>';

                productsContainer.html(productsHTML);
            } else {
                productsContainer.html('<p class="text-muted">No products found for this order.</p>');
            }

            $('#deliveryDetailsLoading').hide();
            $('#deliveryDetailsContent').show();
            return;
        }
        
        // Fetch order details with products
        console.log(`[View Delivery Details] Fetching order ${orderId} from: ../api/get_orders.php`);
        
        // Create AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        let orderResponse;
        try {
            orderResponse = await fetch(`../api/get_orders.php?order_id=${orderId}`, {
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
            console.error('[View Delivery Details] Fetch error:', error);
            if (error.name === 'AbortError') {
                throw new Error('Request timeout: Server took too long to respond. Please try again.');
            } else if (error.message.includes('Failed to fetch')) {
                throw new Error('Network error: Unable to connect to server. Please check if the server is running and try again.');
            } else {
                throw new Error(`Network error: ${error.message || 'Failed to connect to server'}`);
            }
        }
        
        console.log(`[View Delivery Details] Response status: ${orderResponse.status} ${orderResponse.statusText}`);
        
        // Check if response has content
        const contentType = orderResponse.headers.get('content-type') || '';
        console.log(`[View Delivery Details] Response content-type: ${contentType}`);
        
        if (!orderResponse.ok) {
            // Try to parse error response
            let errorData;
            try {
                const text = await orderResponse.text();
                errorData = text ? JSON.parse(text) : { message: `HTTP ${orderResponse.status} Error` };
            } catch (e) {
                errorData = { message: `HTTP ${orderResponse.status} Error: ${orderResponse.statusText || 'Unknown error'}` };
            }
            
            if (orderResponse.status === 403) {
                throw new Error(errorData.details || errorData.message || 'You do not have permission to view this order.');
            }
            throw new Error(errorData.message || `HTTP error! status: ${orderResponse.status}`);
        }
        
        // Check if response is actually JSON
        if (!contentType.includes('application/json')) {
            const text = await orderResponse.text();
            console.error('[View Delivery Details] Non-JSON response:', text.substring(0, 200));
            throw new Error('Server returned non-JSON response. Please check server logs.');
        }
        
        const orderData = await orderResponse.json();
        
        if (!orderData.success || !orderData.order) {
            throw new Error(orderData.message || 'Failed to load order details');
        }
        
        const order = orderData.order;
        
        // Format delivery ID
        const deliveryIdFormatted = `DEL-${String(deliveryId).padStart(6, '0')}`;
        
        // Format order ID
        const orderIdFormatted = `ORD-${String(order.Order_ID).padStart(6, '0')}`;
        
        // Populate delivery and order information
        $('#modal-delivery-id').text(deliveryIdFormatted);
        $('#modal-order-id').text(orderIdFormatted);
        $('#modal-customer-name').text(`${order.First_Name || ''} ${order.Last_Name || ''}`.trim() || 'N/A');
        $('#modal-delivery-address').text(order.address || 'N/A');
        
        // Set status with appropriate styling
        const status = order.status || 'Pending';
        const statusEl = $('#modal-progress-status');
        statusEl.text(status);
        statusEl.removeClass('status-pending status-preparing status-out-for-delivery status-delivered status-cancelled');
        
        const statusLower = status.toLowerCase();
        if (statusLower.includes('pending')) {
            statusEl.addClass('status-pending');
        } else if (statusLower.includes('preparing')) {
            statusEl.addClass('status-preparing');
        } else if (statusLower.includes('out for delivery') || statusLower.includes('delivery')) {
            statusEl.addClass('status-out-for-delivery');
        } else if (statusLower.includes('delivered')) {
            statusEl.addClass('status-delivered');
        } else if (statusLower.includes('cancelled') || statusLower.includes('canceled')) {
            statusEl.addClass('status-cancelled');
        }
        
        // Populate ordered products
        const productsContainer = $('#modal-ordered-products');
        productsContainer.empty();
        
        if (order.items && order.items.length > 0) {
            // Check if any item has a variation
            const hasVariations = order.items.some(item => item.variation && item.variation.trim() !== '');
            
            let productsHTML = '<table class="table table-bordered table-sm" style="margin-top: 10px;">';
            productsHTML += '<thead class="thead-light"><tr><th>Product</th><th>Quantity</th><th>Unit Price</th><th>Total</th><th>Dimensions</th><th>Weight</th>';
            
            // Add Variation column header only if at least one item has a variation
            if (hasVariations) {
                productsHTML += '<th>Variation</th>';
            }
            
            productsHTML += '</tr></thead><tbody>';
            
            let totalAmount = 0;
            
            order.items.forEach(item => {
                const productName = item.Product_Name || `Deleted Product (ID: ${item.Product_ID})`;
                const quantity = item.Quantity || 0;
                const price = parseFloat(item.Price || 0);
                const itemTotal = quantity * price;
                totalAmount += itemTotal;
                
                // Format dimensions
                let dimensions = 'N/A';
                if (item.length && item.Width && item.Unit) {
                    dimensions = `${item.length} x ${item.Width} ${item.Unit}`;
                } else if (item.length && item.Width) {
                    dimensions = `${item.length} x ${item.Width}`;
                }
                
                // Format weight
                let weight = 'N/A';
                if (item.weight) {
                    weight = `${item.weight} ${item.weight_unit || 'kg'}`;
                }
                
                // Format variation
                const variation = item.variation && item.variation.trim() !== '' ? item.variation : 'N/A';
                
                productsHTML += '<tr>';
                productsHTML += `<td>${productName}</td>`;
                productsHTML += `<td>${quantity}</td>`;
                productsHTML += `<td>₱${price.toFixed(2)}</td>`;
                productsHTML += `<td>₱${itemTotal.toFixed(2)}</td>`;
                productsHTML += `<td>${dimensions}</td>`;
                productsHTML += `<td>${weight}</td>`;
                
                // Add Variation column only if at least one item has a variation
                if (hasVariations) {
                    productsHTML += `<td>${variation}</td>`;
                }
                
                productsHTML += '</tr>';
            });
            
            productsHTML += '</tbody>';
            
            // Calculate colspan for footer based on whether variation column is shown
            const colspan = hasVariations ? 7 : 6;
            productsHTML += `<tfoot class="table-info"><tr><th colspan="${colspan - 3}" class="text-right">Total Amount:</th><th colspan="3">₱${totalAmount.toFixed(2)}</th></tr></tfoot>`;
            productsHTML += '</table>';
            
            productsContainer.html(productsHTML);
        } else {
            productsContainer.html('<p class="text-muted">No products found for this order.</p>');
        }
        
        // Hide loading, show content
        $('#deliveryDetailsLoading').hide();
        $('#deliveryDetailsContent').show();
        
    } catch (error) {
        console.error('[View Delivery Details] Error:', error);
        $('#deliveryDetailsLoading').hide();
        $('#deliveryDetailsError').text('Failed to load delivery details: ' + error.message).show();
    }
}

// View driver details
async function viewDriverDetails(driverId) {
    try {
        // Fetch driver information
        const response = await fetch('../api/get_delivery_drivers.php', {
            method: 'GET',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Failed to load driver information');
        }
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.message || 'Failed to load driver information');
        }
        
        // Find the specific driver
        const driver = data.drivers.find(d => d.user_id === driverId);
        
        if (!driver) {
            if (typeof AdminNotifications !== 'undefined') {
                AdminNotifications.error('Driver not found', {
                    duration: 4000
                });
            } else {
                if (AdminNotifications) {
                    AdminNotifications.error('Driver not found', { duration: 4000 });
                } else {
                    console.error('Driver not found');
                }
            }
            return;
        }
        
        // Get driver's active deliveries to show current delivery info
        const deliveriesResponse = await fetch('../api/load_deliveries_admin.php', {
            method: 'GET',
            credentials: 'include'
        });
        
        let currentDelivery = null;
        let deliveryAddress = 'N/A';
        
        if (deliveriesResponse.ok) {
            const deliveriesData = await deliveriesResponse.json();
            if (deliveriesData.success && deliveriesData.deliveries) {
                // Find active delivery for this driver
                const activeDelivery = deliveriesData.deliveries.find(d => 
                    d.Driver_ID == driverId && 
                    d.Delivery_Status && 
                    !['Delivered', 'Cancelled'].includes(d.Delivery_Status)
                );
                
                if (activeDelivery) {
                    currentDelivery = activeDelivery;
                    deliveryAddress = activeDelivery.Customer_Address || 'N/A';
                }
            }
        }
        
        // Format phone number
        const phoneNumber = driver.phone_number 
            ? (driver.phone_number.toString().length > 10 
                ? `+63 ${driver.phone_number}` 
                : driver.phone_number)
            : 'No phone number';
        
        // Populate modal with driver data
        $('#modal-driver-profile-name').text(driver.full_name || 'N/A');
        $('#modal-driver-phone').text(phoneNumber);
        $('#modal-driver-vehicle').text(driver.vehicle_model || 'Unassigned');
        $('#modal-driver-delivery').text(
            currentDelivery 
                ? `DEL-${currentDelivery.Delivery_ID.toString().padStart(6, '0')}` 
                : 'No active delivery'
        );
        $('#modal-driver-location').text(deliveryAddress);
        
        // Show driver profile modal
        $('#driverProfileModal').modal('show');
        
    } catch (error) {
        console.error('[View Driver Details] Error:', error);
        if (typeof AdminNotifications !== 'undefined') {
            AdminNotifications.error('Failed to load driver details: ' + error.message, {
                duration: 5000
            });
        } else {
            if (AdminNotifications) {
                AdminNotifications.error('Failed to load driver details: ' + error.message, { duration: 5000 });
            } else {
                console.error('Failed to load driver details: ' + error.message);
            }
        }
    }
}

// Load drivers from database
async function loadDrivers() {
    const tbody = document.getElementById('driversTableBody');
    if (!tbody) {
        console.error('[Load Drivers] Drivers table body not found');
        return;
    }

    // Wait briefly for role to be set by admin_auth_check.js
    if (!getCurrentUserRole()) {
        setTimeout(loadDrivers, 150);
        return;
    }

    // RBAC UI: Delivery Driver should not view the drivers roster
    if (isDeliveryDriverRole()) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center py-5">
                    <p class="text-muted">Access Denied: This action is not available for your role.</p>
                </td>
            </tr>
        `;
        return;
    }
    
    try {
        // Show loading state
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center py-5">
                    <p class="text-muted"><i class="fas fa-spinner fa-spin"></i> Loading drivers...</p>
                </td>
            </tr>
        `;
        
        const response = await fetch('../api/get_delivery_drivers.php', {
            method: 'GET',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.message || 'Failed to load drivers');
        }
        
        // Clear loading state
        tbody.innerHTML = '';
        
        if (data.drivers && data.drivers.length > 0) {
            data.drivers.forEach(driver => {
                const statusClass = driver.status === 'Available' ? 'status-available' : 'status-busy';
                const statusBadge = driver.status === 'Available' 
                    ? '<span class="status-badge status-available">Available</span>'
                    : `<span class="status-badge status-busy">Busy (${driver.active_deliveries} deliveries)</span>`;
                
                const row = `
                    <tr class="driver-row" data-driver-id="${driver.user_id}">
                        <td>
                            <div class="driver-info">
                                <div class="driver-avatar">
                                    <i class="fas fa-user-circle"></i>
                                </div>
                                <div class="driver-details">
                                    <strong class="driver-name">${driver.full_name}</strong>
                                    <small class="driver-email text-muted d-block">${driver.email}</small>
                                    <small class="driver-phone text-muted d-block">${driver.phone_number || 'No phone'}</small>
                                </div>
                            </div>
                        </td>
                        <td>
                            ${statusBadge}
                        </td>
                        <td>
                            <div class="action-buttons" style="display: flex; gap: 8px; align-items: center;">
                                <button class="action-btn view-btn" data-driver-id="${driver.user_id}" title="View Driver Details" onclick="viewDriverDetails(${driver.user_id})">
                                    <i class="fas fa-eye"></i>
                                </button>
                                <button class="action-btn remove-btn" data-driver-id="${driver.user_id}" title="Remove Driver" onclick="removeDriver(${driver.user_id}, '${driver.full_name.replace(/'/g, "\\'")}')">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
                tbody.insertAdjacentHTML('beforeend', row);
            });
            
            console.log('[Load Drivers] ✅ Loaded', data.drivers.length, 'drivers');
        } else {
            tbody.innerHTML = `
                <tr>
                    <td colspan="3" class="text-center py-5">
                        <p class="text-muted">No delivery drivers found.</p>
                        <p class="text-muted" style="font-size: 12px;">Add drivers through User Management.</p>
                    </td>
                </tr>
            `;
        }
    } catch (error) {
        console.error('[Load Drivers] ❌ Error loading drivers:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="3" class="text-center py-5">
                    <p class="text-danger">Error loading drivers: ${error.message}</p>
                    <button class="btn btn-sm btn-primary mt-2" onclick="loadDrivers()">Retry</button>
                </td>
            </tr>
        `;
    }
}

// Load fleet from database
async function loadFleet() {
    const tbody = document.getElementById('fleetTableBody');
    if (!tbody) {
        console.error('[Load Fleet] Fleet table body not found');
        return;
    }

    // Wait briefly for role to be set by admin_auth_check.js
    if (!getCurrentUserRole()) {
        setTimeout(loadFleet, 150);
        return;
    }

    // RBAC UI: Delivery Driver should not view fleet management
    if (isDeliveryDriverRole()) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center py-5">
                    <p class="text-muted">Access Denied: This action is not available for your role.</p>
                </td>
            </tr>
        `;
        return;
    }
    
    try {
        // Show loading state
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center py-5">
                    <p class="text-muted"><i class="fas fa-spinner fa-spin"></i> Loading fleet...</p>
                </td>
            </tr>
        `;
        
        const response = await fetch('../api/get_fleet.php', {
            method: 'GET',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.message || 'Failed to load fleet');
        }
        
        // Clear loading state
        tbody.innerHTML = '';
        
        if (data.vehicles && data.vehicles.length > 0) {
            data.vehicles.forEach(vehicle => {
                const statusClass = vehicle.status === 'Available' ? 'status-available' : 'status-busy';
                const statusBadge = vehicle.status === 'Available' 
                    ? '<span class="status-badge status-available">Available</span>'
                    : vehicle.status === 'Unavailable'
                    ? '<span class="status-badge status-unavailable">Unavailable</span>'
                    : `<span class="status-badge status-busy">In Use${vehicle.active_deliveries > 0 ? ` (${vehicle.active_deliveries} deliveries)` : ''}</span>`;
                
                // Format capacity display
                const capacityDisplay = vehicle.capacity !== null && vehicle.capacity !== undefined
                    ? `${parseFloat(vehicle.capacity).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ${vehicle.capacity_unit || 'kg'}`
                    : '<span class="text-muted">Not set</span>';
                
                const row = `
                    <tr class="fleet-row" data-vehicle-id="${vehicle.vehicle_id}">
                        <td>
                            <div class="vehicle-info">
                                <strong class="vehicle-model">${vehicle.vehicle_model}</strong>
                                <small class="text-muted d-block">ID: ${vehicle.vehicle_id}</small>
                            </div>
                        </td>
                        <td>
                            ${statusBadge}
                        </td>
                        <td>
                            ${capacityDisplay}
                        </td>
                        <td>
                            <div class="action-buttons" style="display: flex; gap: 8px; align-items: center;">
                                <button class="action-btn edit-btn" data-vehicle-id="${vehicle.vehicle_id}" title="Edit Vehicle" onclick="editFleetVehicle(${vehicle.vehicle_id}, '${vehicle.vehicle_model.replace(/'/g, "\\'")}', '${vehicle.status}', ${vehicle.capacity !== null ? vehicle.capacity : 'null'}, '${vehicle.capacity_unit || 'kg'}')">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="action-btn remove-btn" data-vehicle-id="${vehicle.vehicle_id}" title="Remove Vehicle" onclick="removeFleetVehicle(${vehicle.vehicle_id}, '${vehicle.vehicle_model.replace(/'/g, "\\'")}')">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
                tbody.insertAdjacentHTML('beforeend', row);
            });
            
            console.log('[Load Fleet] ✅ Loaded', data.vehicles.length, 'vehicles');
        } else {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center py-5">
                        <p class="text-muted">No fleet vehicles found.</p>
                        <p class="text-muted" style="font-size: 12px;">Click "Add Fleet" to add vehicles.</p>
                    </td>
                </tr>
            `;
        }
    } catch (error) {
        console.error('[Load Fleet] ❌ Error loading fleet:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center py-5">
                    <p class="text-danger">Error loading fleet: ${error.message}</p>
                    <button class="btn btn-sm btn-primary mt-2" onclick="loadFleet()">Retry</button>
                </td>
            </tr>
        `;
    }
}

// Initialize on page load
console.log('[Load Deliveries] Script loaded, initializing...');

// Wait for DOM and jQuery to be ready
function initializeDeliveries() {
    console.log('[Load Deliveries] DOM ready, starting initialization...');
    
    // Functions are already exported at the top of the file
    // Re-export to ensure they're still available
    if (typeof completeDelivery !== 'undefined') {
        window.completeDelivery = completeDelivery;
    }
    if (typeof showCompleteDeliveryConfirmation !== 'undefined') {
        window.showCompleteDeliveryConfirmation = showCompleteDeliveryConfirmation;
    }
    console.log('[Load Deliveries] Functions re-exported in initializeDeliveries:', {
        completeDelivery: typeof window.completeDelivery,
        showCompleteDeliveryConfirmation: typeof window.showCompleteDeliveryConfirmation
    });
    
    // Attach Complete/Cancel delivery handlers (works on both DeliveriesAdmin and ViewOrderAccept)
    if (typeof setupCompleteDeliveryButtons === 'function') {
        setupCompleteDeliveryButtons();
    }
    
    // Wait a bit for other scripts to load
    setTimeout(() => {
        // RBAC UI: hide admin-only tabs/buttons early if role is Delivery Driver
        if (isDeliveryDriverRole()) {
            const hideIds = ['fleet-tab', 'filter-btn', 'timetable-btn', 'add-fleet-btn', 'activeDriversStatCard'];
            hideIds.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });
        }

        // Load deliveries for Active Deliveries tab
        loadDeliveries();
        
        // Load fleet when fleet tab is clicked
        const fleetTab = document.getElementById('fleet-tab');
        if (fleetTab && !isDeliveryDriverRole()) {
            fleetTab.addEventListener('click', function() {
                loadFleet();
            });
        }
        
        // Load fleet initially if fleet tab is active
        if (!isDeliveryDriverRole() && document.querySelector('#fleet-tab.active')) {
            loadFleet();
        }
        
        // Auto-refresh every 15 seconds (only for active deliveries and history tabs)
        if (window.deliveriesRefreshInterval) {
            clearInterval(window.deliveriesRefreshInterval);
        }
        window.deliveriesRefreshInterval = setInterval(() => {
            // Skip auto-refresh if status update is in progress to prevent glitching
            if (isStatusUpdateInProgress) {
                console.log('[Auto-Refresh] Skipping refresh - status update in progress');
                return;
            }
            
            // Refresh based on active tab
            const activeTab = document.querySelector('.tab-btn.active');
            const activeTabName = activeTab ? activeTab.getAttribute('data-tab') : '';
            if (activeTabName === 'out-for-delivery' || activeTabName === 'completed-delivery') {
                loadDeliveries();
            } else if (activeTabName === 'fleet' && !isDeliveryDriverRole()) {
                // Refresh fleet tab
                if (typeof loadFleet === 'function') {
                    loadFleet();
                }
            }
        }, 15000); // Refresh every 15 seconds
    }, 500);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeDeliveries);
} else {
    // DOM already loaded
    if (typeof $ !== 'undefined' && $.isReady) {
        initializeDeliveries();
    } else {
        // Wait for jQuery
        $(document).ready(initializeDeliveries);
    }
}

// Assign driver to delivery
async function assignDriverToDelivery(deliveryId, orderId, currentDriverId) {
    try {
        // Wait briefly for role to be set by admin_auth_check.js
        if (!getCurrentUserRole()) {
            setTimeout(() => assignDriverToDelivery(deliveryId, orderId, currentDriverId), 150);
            return;
        }
        if (isDeliveryDriverRole()) {
            if (window.AdminNotifications) {
                AdminNotifications.warning('Access Denied: This action is not available for your role', { duration: 4000 });
            } else {
                console.warn('Access Denied: This action is not available for your role');
            }
            return;
        }
        // Load drivers for dropdown
        const driversResponse = await fetch('../api/get_delivery_drivers.php', {
            method: 'GET',
            credentials: 'include'
        });
        
        if (!driversResponse.ok) {
            throw new Error('Failed to load drivers');
        }
        
        const driversData = await driversResponse.json();
        
        if (!driversData.success) {
            throw new Error(driversData.message || 'Failed to load drivers');
        }
        
        // Get delivery info for display
        const deliveryCard = document.querySelector(`[data-delivery-id="${deliveryId}"]`);
        const deliveryCode = deliveryCard ? deliveryCard.querySelector('.delivery-code')?.textContent : `DEL-${deliveryId}`;
        const customerName = deliveryCard ? deliveryCard.querySelector('.customer-name')?.textContent : 'Unknown';
        
        // Populate modal
        $('#assignDriverDeliveryCode').text(deliveryCode);
        $('#assignDriverCustomerName').text(customerName);
        
        // Get currently assigned drivers for this delivery
        let currentDriverIds = [];
        if (deliveryCard) {
            const driverElements = deliveryCard.querySelectorAll('.driver-name[data-driver-id]');
            currentDriverIds = Array.from(driverElements)
                .map(el => parseInt(el.getAttribute('data-driver-id')))
                .filter(id => !isNaN(id) && id > 0);
        }
        if (currentDriverIds.length === 0 && currentDriverId) {
            currentDriverIds = [currentDriverId];
        }
        
        // Populate driver checkboxes
        const driverCheckboxesContainer = document.getElementById('driverCheckboxes');
        driverCheckboxesContainer.innerHTML = '';
        
        if (driversData.drivers && driversData.drivers.length > 0) {
            driversData.drivers.forEach(driver => {
                const checkboxDiv = document.createElement('div');
                checkboxDiv.className = 'form-check mb-2';
                
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'form-check-input driver-checkbox';
                checkbox.id = `driver-checkbox-${driver.user_id}`;
                checkbox.value = driver.user_id;
                checkbox.checked = currentDriverIds.includes(driver.user_id);
                
                const label = document.createElement('label');
                label.className = 'form-check-label';
                label.htmlFor = `driver-checkbox-${driver.user_id}`;
                label.textContent = `${driver.full_name} ${driver.status === 'Available' ? '(Available)' : '(Busy)'}`;
                
                checkboxDiv.appendChild(checkbox);
                checkboxDiv.appendChild(label);
                driverCheckboxesContainer.appendChild(checkboxDiv);
            });
        } else {
            driverCheckboxesContainer.innerHTML = '<p class="text-muted">No drivers available.</p>';
        }
        
        // Store delivery info in modal for use in confirm button
        $('#assignDriverModal').data('delivery-id', deliveryId);
        $('#assignDriverModal').data('order-id', orderId);
        
        // Show modal
        $('#assignDriverModal').modal('show');
        
    } catch (error) {
        console.error('[Assign Driver] Error:', error);
        if (typeof AdminNotifications !== 'undefined') {
            AdminNotifications.error('Failed to load drivers: ' + error.message, {
                duration: 5000
            });
        } else {
            if (AdminNotifications) {
                AdminNotifications.error('Failed to load drivers: ' + error.message, { duration: 5000 });
            } else {
                console.error('Failed to load drivers: ' + error.message);
            }
        }
    }
}

// Handle assign driver button clicks
$(document).on('click', '.assign-driver-btn', function() {
    const deliveryId = parseInt($(this).data('delivery-id'));
    const orderId = parseInt($(this).data('order-id'));
    const currentDriverId = $(this).data('current-driver-id') || null;
    
    assignDriverToDelivery(deliveryId, orderId, currentDriverId);
});

// Handle confirm assign driver button
$('#confirmAssignDriverBtn').on('click', async function() {
    const deliveryId = $('#assignDriverModal').data('delivery-id');
    const orderId = $('#assignDriverModal').data('order-id');
    
    // Get all selected driver IDs from checkboxes
    const selectedDriverIds = [];
    document.querySelectorAll('.driver-checkbox:checked').forEach(checkbox => {
        selectedDriverIds.push(parseInt(checkbox.value));
    });
    
    const driverIds = selectedDriverIds.length > 0 ? selectedDriverIds : null;
    
    if (!deliveryId) {
        if (typeof AdminNotifications !== 'undefined') {
            AdminNotifications.error('Delivery ID is missing', {
                duration: 4000
            });
        } else {
            if (AdminNotifications) {
                AdminNotifications.error('Delivery ID is missing', { duration: 4000 });
            } else {
                console.error('Delivery ID is missing');
            }
        }
        return;
    }
    
    // Show loading
    $('#assignDriverLoading').show();
    $('#confirmAssignDriverBtn').prop('disabled', true);
    
    try {
        const response = await fetch('../api/assign_driver_to_delivery.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                delivery_id: deliveryId,
                driver_ids: driverIds
            })
        });
        
        const data = await response.json();
        
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Failed to assign driver');
        }
        
        if (typeof AdminNotifications !== 'undefined') {
            AdminNotifications.success(data.message || 'Driver assigned successfully!', {
                duration: 3000
            });
        } else {
            if (AdminNotifications) {
                AdminNotifications.success(data.message || 'Driver assigned successfully!', { duration: 4000 });
            } else {
                console.log(data.message || 'Driver assigned successfully!');
            }
        }
        
        // Close modal
        $('#assignDriverModal').modal('hide');
        
        // Reload deliveries to show updated driver assignment
        await loadDeliveries();

        // Workflow: after assigning driver(s), proceed to assign vehicle(s)
        if (Array.isArray(driverIds) && driverIds.length > 0) {
            // Pull latest vehicle assignment (if any) for preselection
            const updatedCard = document.querySelector(`[data-delivery-id="${deliveryId}"]`);
            const currentVehicleId = updatedCard ? (updatedCard.getAttribute('data-vehicle-id') || null) : null;
            assignVehicleToDelivery(deliveryId, orderId, currentVehicleId);
        }
        
    } catch (error) {
        console.error('[Assign Driver] Error:', error);
        if (typeof AdminNotifications !== 'undefined') {
            AdminNotifications.error('Failed to assign driver: ' + error.message, {
                duration: 5000
            });
        } else {
            if (AdminNotifications) {
                AdminNotifications.error('Failed to assign driver: ' + error.message, { duration: 5000 });
            } else {
                console.error('Failed to assign driver: ' + error.message);
            }
        }
    } finally {
        $('#assignDriverLoading').hide();
        $('#confirmAssignDriverBtn').prop('disabled', false);
    }
});

// Convert weight to kilograms
function convertWeightToKg(weight, unit) {
    if (!weight || weight === 0) return 0;
    const weightValue = parseFloat(weight);
    if (isNaN(weightValue)) return 0;
    switch (unit?.toLowerCase()) {
        case 'kg': return weightValue;
        case 'g': return weightValue / 1000;
        case 'lb': return weightValue * 0.453592;
        case 'oz': return weightValue * 0.0283495;
        case 'ton': return weightValue * 1000;
        default: return weightValue;
    }
}

// Global cache for vehicle capacities
let vehicleCapacitiesCache = null;

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
                vehicleCapacitiesCache = data.vehicles.map(vehicle => {
                    let capacityKg = parseFloat(vehicle.capacity) || 0;
                    const unit = vehicle.capacity_unit || 'kg';
                    
                    // Convert to kg
                    capacityKg = convertWeightToKg(capacityKg, unit);
                    
                    return {
                        id: vehicle.vehicle_id || vehicle.Vehicle_ID,
                        model: vehicle.vehicle_model,
                        capacity: capacityKg,
                        status: vehicle.status
                    };
                }).filter(v => v.status === 'Available' || v.status === 'In Use');
                
                return vehicleCapacitiesCache;
            }
        }
    } catch (error) {
        console.error('Error loading vehicle capacities:', error);
    }
    
    // Return default if API fails
    return [{ id: 1, model: 'Default Truck', capacity: 1700, status: 'Available' }];
}

// Calculate trucks needed for a delivery order
async function calculateTrucksNeededForDelivery(orderWeightKg) {
    try {
        const vehicles = await loadVehicleCapacities();
        
        if (!vehicles || vehicles.length === 0) {
            return { trucks: 1, vehicles: [] };
        }
        
        const orderWeight = parseFloat(orderWeightKg) || 0;
        if (orderWeight <= 0) {
            // If no weight, default to 1 truck
            return { trucks: 1, vehicles: [] };
        }
        
        let remainingWeight = orderWeight;
        let trucksNeeded = 0;
        const vehiclesUsed = [];
        
        // Use largest vehicles first
        const sortedVehicles = [...vehicles].sort((a, b) => b.capacity - a.capacity);
        
        for (const vehicle of sortedVehicles) {
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
        
        // Ensure at least 1 truck
        if (trucksNeeded === 0) {
            trucksNeeded = 1;
        }
        
        return {
            trucks: trucksNeeded,
            vehicles: vehiclesUsed
        };
    } catch (error) {
        console.error('[Calculate Trucks] Error:', error);
        // Return default on error
        return { trucks: 1, vehicles: [] };
    }
}

// Calculate order weight from order items
async function calculateOrderWeight(orderId) {
    try {
        // Get order details
        const response = await fetch(`../api/get_orders.php?order_id=${orderId}`, {
            credentials: 'include'
        });
        const data = await response.json();
        
        if (!data.success) {
            // Try with orders array format
            if (data.order && data.order.items) {
                const order = data.order;
                let totalWeightKg = 0;
                
                if (order.items && order.items.length > 0) {
                    for (const item of order.items) {
                        if (item.weight) {
                            const weightKg = convertWeightToKg(item.weight, item.weight_unit);
                            totalWeightKg += weightKg * item.quantity;
                        }
                    }
                }
                
                return totalWeightKg > 0 ? totalWeightKg : null;
            }
            return null;
        }
        
        // Handle both single order and orders array formats
        const order = data.order || (data.orders && data.orders.length > 0 ? data.orders[0] : null);
        if (!order) {
            return null;
        }
        
        let totalWeightKg = 0;
        
        // Calculate weight from order items (weight is now included in the API response)
        if (order.items && order.items.length > 0) {
            for (const item of order.items) {
                if (item.weight) {
                    const weightKg = convertWeightToKg(item.weight, item.weight_unit);
                    totalWeightKg += weightKg * item.quantity;
                }
            }
        }
        
        return totalWeightKg > 0 ? totalWeightKg : null;
    } catch (error) {
        console.error('Error calculating order weight:', error);
        return null;
    }
}

// Assign vehicle to delivery
async function assignVehicleToDelivery(deliveryId, orderId, currentVehicleId) {
    try {
        // Wait briefly for role to be set by admin_auth_check.js
        if (!getCurrentUserRole()) {
            setTimeout(() => assignVehicleToDelivery(deliveryId, orderId, currentVehicleId), 150);
            return;
        }
        if (isDeliveryDriverRole()) {
            if (window.AdminNotifications) {
                AdminNotifications.warning('Access Denied: This action is not available for your role', { duration: 4000 });
            } else {
                console.warn('Access Denied: This action is not available for your role');
            }
            return;
        }

        // Enforce workflow: staff must assign driver first, then assign vehicle
        const deliveryCard = document.querySelector(`[data-delivery-id="${deliveryId}"]`);
        const hasAssignedDriver =
            !!deliveryCard?.querySelector('.driver-name[data-driver-id]') ||
            (!!deliveryCard?.getAttribute('data-driver-id') && deliveryCard.getAttribute('data-driver-id') !== '0');

        if (!hasAssignedDriver) {
            if (window.AdminNotifications) {
                AdminNotifications.warning('Please assign a driver first, then assign a vehicle.', { duration: 5000, title: 'Assignment Required' });
            } else {
                console.warn('Please assign a driver first, then assign a vehicle.');
            }
            return;
        }

        // Load vehicles and order weight in parallel
        const [vehiclesResponse, orderWeightKg] = await Promise.all([
            fetch('../api/get_fleet.php', {
                method: 'GET',
                credentials: 'include'
            }),
            calculateOrderWeight(orderId)
        ]);
        
        if (!vehiclesResponse.ok) {
            throw new Error('Failed to load vehicles');
        }
        
        const vehiclesData = await vehiclesResponse.json();
        
        if (!vehiclesData.success) {
            throw new Error(vehiclesData.message || 'Failed to load vehicles');
        }
        
        // Get delivery info for display (re-use existing deliveryCard variable)
        const deliveryCode = deliveryCard ? deliveryCard.querySelector('.delivery-code')?.textContent : `DEL-${deliveryId}`;
        const customerName = deliveryCard ? deliveryCard.querySelector('.customer-name')?.textContent : 'Unknown';
        
        // Populate modal
        $('#assignVehicleDeliveryCode').text(deliveryCode);
        $('#assignVehicleCustomerName').text(customerName);
        
        // Show order weight if available
        const orderWeightDisplay = document.getElementById('assignVehicleOrderWeight');
        if (orderWeightDisplay) {
            if (orderWeightKg !== null && orderWeightKg > 0) {
                orderWeightDisplay.textContent = `${orderWeightKg.toFixed(2)} kg`;
                orderWeightDisplay.closest('.form-group')?.style.setProperty('display', 'block');
            } else {
                orderWeightDisplay.closest('.form-group')?.style.setProperty('display', 'none');
            }
        }
        
        // Get currently assigned vehicles for this delivery
        let currentVehicleIds = [];
        if (deliveryCard) {
            const vehicleElements = deliveryCard.querySelectorAll('.vehicle-name[data-vehicle-id]');
            currentVehicleIds = Array.from(vehicleElements)
                .map(el => parseInt(el.getAttribute('data-vehicle-id')))
                .filter(id => !isNaN(id) && id > 0);
        }
        if (currentVehicleIds.length === 0 && currentVehicleId) {
            currentVehicleIds = [currentVehicleId];
        }
        
        // Populate vehicle checkboxes with capacity matching
        const vehicleCheckboxesContainer = document.getElementById('vehicleCheckboxes');
        const capacitySuggestions = document.getElementById('capacitySuggestions');
        
        vehicleCheckboxesContainer.innerHTML = '';
        
        if (capacitySuggestions) {
            capacitySuggestions.innerHTML = '';
        }
        
        if (vehiclesData.vehicles && vehiclesData.vehicles.length > 0) {
            // Exclude Unavailable vehicles (they cannot be assigned)
            let sortedVehicles = vehiclesData.vehicles.filter(v => v.status !== 'Unavailable');
            
            if (orderWeightKg !== null && orderWeightKg > 0) {
                sortedVehicles.sort((a, b) => {
                    const capacityA = convertWeightToKg(a.capacity || 0, a.capacity_unit || 'kg');
                    const capacityB = convertWeightToKg(b.capacity || 0, b.capacity_unit || 'kg');
                    
                    // Prioritize vehicles that can handle the weight
                    const canHandleA = capacityA >= orderWeightKg;
                    const canHandleB = capacityB >= orderWeightKg;
                    
                    if (canHandleA && !canHandleB) return -1;
                    if (!canHandleA && canHandleB) return 1;
                    
                    // Among vehicles that can/can't handle, sort by capacity (closest first)
                    if (canHandleA && canHandleB) {
                        return capacityA - capacityB; // Smallest suitable first
                    } else {
                        return capacityB - capacityA; // Largest unsuitable first
                    }
                });
            }
            
            sortedVehicles.forEach(vehicle => {
                const checkboxDiv = document.createElement('div');
                checkboxDiv.className = 'form-check mb-2';
                
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'form-check-input vehicle-checkbox';
                checkbox.id = `vehicle-checkbox-${vehicle.vehicle_id}`;
                checkbox.value = vehicle.vehicle_id;
                checkbox.checked = currentVehicleIds.includes(vehicle.vehicle_id);
                
                const capacityKg = convertWeightToKg(vehicle.capacity || 0, vehicle.capacity_unit || 'kg');
                const capacityDisplay = vehicle.capacity ? `${vehicle.capacity} ${vehicle.capacity_unit || 'kg'}` : 'N/A';
                
                let labelText = `${vehicle.vehicle_model} (${capacityDisplay})`;
                
                // Add status indicator
                if (vehicle.status === 'Available') {
                    labelText += ' - Available';
                } else if (vehicle.status === 'In Use') {
                    labelText += ' - In Use';
                } else {
                    labelText += ' - Unavailable';
                }
                
                // Add capacity match indicator if order weight is known
                if (orderWeightKg !== null && orderWeightKg > 0 && capacityKg > 0) {
                    if (capacityKg >= orderWeightKg) {
                        const utilization = ((orderWeightKg / capacityKg) * 100).toFixed(1);
                        labelText += ` ✓ (${utilization}% capacity)`;
                    } else {
                        const shortage = (orderWeightKg - capacityKg).toFixed(2);
                        labelText += ` ⚠ (${shortage} kg over capacity)`;
                    }
                }
                
                const label = document.createElement('label');
                label.className = 'form-check-label';
                label.htmlFor = `vehicle-checkbox-${vehicle.vehicle_id}`;
                label.textContent = labelText;
                
                checkboxDiv.appendChild(checkbox);
                checkboxDiv.appendChild(label);
                vehicleCheckboxesContainer.appendChild(checkboxDiv);
            });
            
            // Show capacity suggestions
            if (capacitySuggestions && orderWeightKg !== null && orderWeightKg > 0) {
                const suitableVehicles = sortedVehicles.filter(v => {
                    const cap = convertWeightToKg(v.capacity || 0, v.capacity_unit || 'kg');
                    return cap >= orderWeightKg && v.status === 'Available';
                });
                
                const unsuitableVehicles = sortedVehicles.filter(v => {
                    const cap = convertWeightToKg(v.capacity || 0, v.capacity_unit || 'kg');
                    return cap < orderWeightKg && v.status === 'Available';
                });
                
                if (suitableVehicles.length > 0) {
                    const suggestionsDiv = document.createElement('div');
                    suggestionsDiv.className = 'alert alert-success';
                    suggestionsDiv.innerHTML = `
                        <strong><i class="fas fa-check-circle"></i> Recommended Vehicles:</strong>
                        <ul class="mb-0 mt-2">
                            ${suitableVehicles.slice(0, 3).map(v => {
                                const cap = convertWeightToKg(v.capacity || 0, v.capacity_unit || 'kg');
                                const utilization = ((orderWeightKg / cap) * 100).toFixed(1);
                                return `<li>${v.vehicle_model} - ${v.capacity} ${v.capacity_unit || 'kg'} capacity (${utilization}% utilization)</li>`;
                            }).join('')}
                        </ul>
                    `;
                    capacitySuggestions.appendChild(suggestionsDiv);
                } else if (unsuitableVehicles.length > 0) {
                    const warningDiv = document.createElement('div');
                    warningDiv.className = 'alert alert-warning';
                    warningDiv.innerHTML = `
                        <strong><i class="fas fa-exclamation-triangle"></i> No vehicles can handle this order weight.</strong>
                        <p class="mb-0 mt-2">Order weight: ${orderWeightKg.toFixed(2)} kg</p>
                        <p class="mb-0">Largest available vehicle: ${unsuitableVehicles[0].vehicle_model} (${unsuitableVehicles[0].capacity} ${unsuitableVehicles[0].capacity_unit || 'kg'})</p>
                    `;
                    capacitySuggestions.appendChild(warningDiv);
                }
            }
        }
        
        // Store delivery info in modal for use in confirm button
        $('#assignVehicleModal').data('delivery-id', deliveryId);
        $('#assignVehicleModal').data('order-id', orderId);
        $('#assignVehicleModal').data('previous-vehicle-id', currentVehicleId || null);
        $('#assignVehicleModal').data('order-weight', orderWeightKg);
        
        // Show modal
        $('#assignVehicleModal').modal('show');
        
    } catch (error) {
        console.error('[Assign Vehicle] Error:', error);
        if (typeof AdminNotifications !== 'undefined') {
            AdminNotifications.error('Failed to load vehicles: ' + error.message, {
                duration: 5000
            });
        } else {
            if (AdminNotifications) {
                AdminNotifications.error('Failed to load vehicles: ' + error.message, { duration: 5000 });
            } else {
                console.error('Failed to load vehicles: ' + error.message);
            }
        }
    }
}

// Handle assign vehicle button clicks
$(document).on('click', '.assign-vehicle-btn', function() {
    if (this.disabled) return;
    const deliveryId = parseInt($(this).data('delivery-id'));
    const orderId = parseInt($(this).data('order-id'));
    const currentVehicleId = $(this).data('current-vehicle-id') || null;
    
    assignVehicleToDelivery(deliveryId, orderId, currentVehicleId);
});

// Handle confirm assign vehicle button
$('#confirmAssignVehicleBtn').on('click', async function() {
    const deliveryId = $('#assignVehicleModal').data('delivery-id');
    const orderId = $('#assignVehicleModal').data('order-id');
    const previousVehicleId = $('#assignVehicleModal').data('previous-vehicle-id');
    
    // Get all selected vehicle IDs from checkboxes
    const selectedVehicleIds = [];
    document.querySelectorAll('.vehicle-checkbox:checked').forEach(checkbox => {
        selectedVehicleIds.push(parseInt(checkbox.value));
    });
    
    const vehicleIds = selectedVehicleIds.length > 0 ? selectedVehicleIds : null;
    
    if (!deliveryId) {
        if (typeof AdminNotifications !== 'undefined') {
            AdminNotifications.error('Delivery ID is missing', {
                duration: 4000
            });
        } else {
            if (AdminNotifications) {
                AdminNotifications.error('Delivery ID is missing', { duration: 4000 });
            } else {
                console.error('Delivery ID is missing');
            }
        }
        return;
    }
    
    // Show loading
    $('#assignVehicleLoading').show();
    $('#confirmAssignVehicleBtn').prop('disabled', true);
    
    try {
        const response = await fetch('../api/assign_vehicle.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                delivery_id: deliveryId,
                vehicle_ids: vehicleIds
            })
        });
        
        const data = await response.json();
        
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Failed to assign vehicle');
        }
        
        if (typeof AdminNotifications !== 'undefined') {
            AdminNotifications.success(data.message || 'Vehicle assigned successfully!', {
                duration: 3000
            });
        } else {
            if (AdminNotifications) {
                AdminNotifications.success(data.message || 'Vehicle assigned successfully!', { duration: 4000 });
            } else {
                console.log(data.message || 'Vehicle assigned successfully!');
            }
        }
        
        // Close modal
        $('#assignVehicleModal').modal('hide');
        
        // Reload deliveries to show updated vehicle assignment
        await loadDeliveries();
        
    } catch (error) {
        console.error('[Assign Vehicle] Error:', error);
        if (typeof AdminNotifications !== 'undefined') {
            AdminNotifications.error('Failed to assign vehicle: ' + error.message, {
                duration: 5000
            });
        } else {
            if (AdminNotifications) {
                AdminNotifications.error('Failed to assign vehicle: ' + error.message, { duration: 5000 });
            } else {
                console.error('Failed to assign vehicle: ' + error.message);
            }
        }
    } finally {
        $('#assignVehicleLoading').hide();
        $('#confirmAssignVehicleBtn').prop('disabled', false);
    }
});

// Add Driver - Opens modal
function addDriver() {
    // Reset form
    $('#addDriverForm')[0].reset();
    $('#addDriverError').hide().text('');
    $('#addDriverLoading').hide();
    
    // Show modal
    $('#addDriverModal').modal('show');
}

// Handle confirm add driver button
$('#confirmAddDriverBtn').on('click', async function() {
    const firstName = $('#driverFirstName').val().trim();
    const lastName = $('#driverLastName').val().trim();
    const middleName = $('#driverMiddleName').val().trim() || null;
    const email = $('#driverEmail').val().trim();
    const password = $('#driverPassword').val();
    const phoneNumber = $('#driverPhone').val().trim();
    
    // Validate required fields
    if (!firstName || !lastName || !email || !password || !phoneNumber) {
        $('#addDriverError').text('Please fill in all required fields.').show();
        return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        $('#addDriverError').text('Please enter a valid email address.').show();
        return;
    }
    
    // Show loading
    $('#addDriverLoading').show();
    $('#addDriverError').hide();
    $('#confirmAddDriverBtn').prop('disabled', true);
    
    try {
        const response = await fetch('../api/add_driver.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                first_name: firstName,
                last_name: lastName,
                middle_name: middleName,
                email: email,
                password: password,
                phone_number: phoneNumber
            })
        });
        
        const data = await response.json();
        
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Failed to add driver');
        }
        
        if (typeof AdminNotifications !== 'undefined') {
            AdminNotifications.success('Driver added successfully!', {
                duration: 3000
            });
        } else {
            if (AdminNotifications) {
                AdminNotifications.success('Driver added successfully!', { duration: 4000 });
            } else {
                console.log('Driver added successfully!');
            }
        }
        
        // Close modal
        $('#addDriverModal').modal('hide');
        
        // Reload drivers
        await loadDrivers();
        
    } catch (error) {
        console.error('[Add Driver] Error:', error);
        $('#addDriverError').text(error.message || 'Failed to add driver').show();
    } finally {
        $('#addDriverLoading').hide();
        $('#confirmAddDriverBtn').prop('disabled', false);
    }
});

// Remove Driver
async function removeDriver(driverId, driverName) {
    // Use AdminNotifications (always available on admin pages)
    let confirmed = false;
    if (typeof AdminNotifications !== 'undefined') {
        confirmed = await AdminNotifications.confirm(
            `Are you sure you want to remove driver "${driverName}"?\n\nThis will unassign them from active deliveries and change their role to Customer.`,
            {
                title: 'Remove Driver',
                confirmText: 'Remove',
                cancelText: 'Cancel',
                danger: true
            }
        );
    } else {
        // Last resort fallback (should not happen on admin pages)
        console.warn('AdminNotifications not available, using browser confirm');
        confirmed = confirm(`Are you sure you want to remove driver "${driverName}"?\n\nThis will unassign them from active deliveries and change their role to Customer.`);
    }
    
    if (!confirmed) {
        return;
    }
    
    try {
        const response = await fetch('../api/remove_driver.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                driver_id: driverId
            })
        });
        
        const data = await response.json();
        
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Failed to remove driver');
        }
        
        if (typeof AdminNotifications !== 'undefined') {
            AdminNotifications.success(data.message || 'Driver removed successfully!', {
                duration: 4000
            });
        } else {
            if (AdminNotifications) {
                AdminNotifications.success(data.message || 'Driver removed successfully!', { duration: 4000 });
            } else {
                console.log(data.message || 'Driver removed successfully!');
            }
        }
        await loadDrivers();
        
    } catch (error) {
        console.error('[Remove Driver] Error:', error);
        if (typeof AdminNotifications !== 'undefined') {
            AdminNotifications.error('Failed to remove driver: ' + error.message, {
                duration: 5000
            });
        } else {
            if (AdminNotifications) {
                AdminNotifications.error('Failed to remove driver: ' + error.message, { duration: 5000 });
            } else {
                console.error('Failed to remove driver: ' + error.message);
            }
        }
    }
}

// Add Fleet Vehicle - Opens modal
function addFleetVehicle() {
    // Reset form
    $('#addFleetForm')[0].reset();
    $('#vehicleStatus').val('Available'); // Set default
    $('#vehicleCapacityUnit').val('kg'); // Set default capacity unit
    $('#addFleetError').hide().text('');
    $('#addFleetLoading').hide();
    
    // Show modal
    $('#addFleetModal').modal('show');
}

// Handle confirm add fleet button
$('#confirmAddFleetBtn').on('click', async function() {
    const vehicleModel = $('#vehicleModel').val().trim();
    const status = $('#vehicleStatus').val();
    const capacity = parseFloat($('#vehicleCapacity').val());
    const capacityUnit = $('#vehicleCapacityUnit').val();
    
    // Validate required fields
    if (!vehicleModel) {
        $('#addFleetError').text('Please enter a vehicle model.').show();
        return;
    }
    
    if (isNaN(capacity) || capacity <= 0) {
        $('#addFleetError').text('Please enter a valid capacity greater than 0.').show();
        return;
    }
    
    // Show loading
    $('#addFleetLoading').show();
    $('#addFleetError').hide();
    $('#confirmAddFleetBtn').prop('disabled', true);
    
    try {
        const response = await fetch('../api/add_fleet_vehicle.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                vehicle_model: vehicleModel,
                status: status,
                capacity: capacity,
                capacity_unit: capacityUnit
            })
        });
        
        const data = await response.json();
        
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Failed to add vehicle');
        }
        
        if (typeof AdminNotifications !== 'undefined') {
            AdminNotifications.success('Vehicle added successfully!', {
                duration: 3000
            });
        } else {
            if (AdminNotifications) {
                AdminNotifications.success('Vehicle added successfully!', { duration: 4000 });
            } else {
                console.log('Vehicle added successfully!');
            }
        }
        
        // Close modal
        $('#addFleetModal').modal('hide');
        
        // Reload fleet
        await loadFleet();
        
    } catch (error) {
        console.error('[Add Fleet Vehicle] Error:', error);
        $('#addFleetError').text(error.message || 'Failed to add vehicle').show();
    } finally {
        $('#addFleetLoading').hide();
        $('#confirmAddFleetBtn').prop('disabled', false);
    }
});

// Edit Fleet Vehicle
async function editFleetVehicle(vehicleId, currentModel, currentStatus, currentCapacity = null, currentCapacityUnit = 'kg') {
    // Populate edit modal with current values
    $('#editVehicleId').val(vehicleId);
    $('#editVehicleModel').val(currentModel || '');
    $('#editVehicleStatus').val(currentStatus || 'Available');
    $('#editVehicleCapacity').val(currentCapacity !== null ? currentCapacity : '');
    $('#editVehicleCapacityUnit').val(currentCapacityUnit || 'kg');
    
    // Reset error and loading states
    $('#editFleetError').hide().text('');
    $('#editFleetLoading').hide();
    
    // Show modal
    $('#editFleetModal').modal('show');
}

// Remove Fleet Vehicle
async function removeFleetVehicle(vehicleId, vehicleModel) {
    // Use AdminNotifications (always available on admin pages)
    let confirmed = false;
    if (typeof AdminNotifications !== 'undefined') {
        confirmed = await AdminNotifications.confirm(
            `Are you sure you want to remove vehicle "${vehicleModel}"?\n\nThis will unassign it from active deliveries.`,
            {
                title: 'Remove Vehicle',
                confirmText: 'Remove',
                cancelText: 'Cancel',
                danger: true
            }
        );
    } else {
        // Last resort fallback (should not happen on admin pages)
        console.warn('AdminNotifications not available, using browser confirm');
        confirmed = confirm(`Are you sure you want to remove vehicle "${vehicleModel}"?\n\nThis will unassign it from active deliveries.`);
    }
    
    if (!confirmed) {
        return;
    }
    
    try {
        const response = await fetch('../api/remove_fleet_vehicle.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                vehicle_id: vehicleId
            })
        });
        
        const data = await response.json();
        
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Failed to remove vehicle');
        }
        
        // Use AdminNotifications (always available on admin pages)
        if (typeof AdminNotifications !== 'undefined') {
            AdminNotifications.success(data.message || 'Vehicle removed successfully. Active deliveries have been unassigned.', {
                duration: 4000
            });
        } else {
            // Fallback only if AdminNotifications somehow not available
            console.error('AdminNotifications not available');
        }
        await loadFleet();
        
    } catch (error) {
        console.error('[Remove Fleet Vehicle] Error:', error);
        // Use AdminNotifications (always available on admin pages)
        if (typeof AdminNotifications !== 'undefined') {
            AdminNotifications.error('Failed to remove vehicle: ' + error.message, {
                duration: 5000
            });
        } else {
            // Fallback only if AdminNotifications somehow not available
            console.error('Failed to remove vehicle:', error.message);
        }
    }
}

// Reset add driver modal when closed
$('#addDriverModal').on('hidden.bs.modal', function() {
    $('#addDriverForm')[0].reset();
    $('#addDriverError').hide().text('');
    $('#addDriverLoading').hide();
    $('#confirmAddDriverBtn').prop('disabled', false);
});

// Handle confirm edit fleet button
$('#confirmEditFleetBtn').on('click', async function() {
    const vehicleId = parseInt($('#editVehicleId').val());
    const vehicleModel = $('#editVehicleModel').val().trim();
    const status = $('#editVehicleStatus').val();
    const capacity = parseFloat($('#editVehicleCapacity').val());
    const capacityUnit = $('#editVehicleCapacityUnit').val();
    
    // Validate required fields
    if (!vehicleId) {
        $('#editFleetError').text('Vehicle ID is missing.').show();
        return;
    }
    
    if (!vehicleModel) {
        $('#editFleetError').text('Please enter a vehicle model.').show();
        return;
    }
    
    if (isNaN(capacity) || capacity <= 0) {
        $('#editFleetError').text('Please enter a valid capacity greater than 0.').show();
        return;
    }
    
    // Show loading
    $('#editFleetLoading').show();
    $('#editFleetError').hide();
    $('#confirmEditFleetBtn').prop('disabled', true);
    
    try {
        const response = await fetch('../api/update_fleet_vehicle.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                vehicle_id: vehicleId,
                vehicle_model: vehicleModel,
                status: status,
                capacity: capacity,
                capacity_unit: capacityUnit
            })
        });
        
        const data = await response.json();
        
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Failed to update vehicle');
        }
        
        if (typeof AdminNotifications !== 'undefined') {
            AdminNotifications.success('Vehicle updated successfully!', {
                duration: 3000
            });
        } else {
            if (AdminNotifications) {
                AdminNotifications.success('Vehicle updated successfully!', { duration: 4000 });
            } else {
                console.log('Vehicle updated successfully!');
            }
        }
        
        // Close modal
        $('#editFleetModal').modal('hide');
        
        // Reload fleet
        await loadFleet();
        
    } catch (error) {
        console.error('[Edit Fleet Vehicle] Error:', error);
        $('#editFleetError').text(error.message || 'Failed to update vehicle').show();
    } finally {
        $('#editFleetLoading').hide();
        $('#confirmEditFleetBtn').prop('disabled', false);
    }
});

// Reset add fleet modal when closed
$('#addFleetModal').on('hidden.bs.modal', function() {
    $('#addFleetForm')[0].reset();
    $('#vehicleStatus').val('Available');
    $('#vehicleCapacityUnit').val('kg');
    $('#addFleetError').hide().text('');
    $('#addFleetLoading').hide();
    $('#confirmAddFleetBtn').prop('disabled', false);
});

// Reset edit fleet modal when closed
$('#editFleetModal').on('hidden.bs.modal', function() {
    $('#editFleetForm')[0].reset();
    $('#editVehicleId').val('');
    $('#editVehicleStatus').val('Available');
    $('#editVehicleCapacityUnit').val('kg');
    $('#editFleetError').hide().text('');
    $('#editFleetLoading').hide();
    $('#confirmEditFleetBtn').prop('disabled', false);
});

// Setup event delegation for Cancel Delivery buttons
function setupCancelDeliveryButtons() {
    // Remove any existing listeners first to prevent duplicates
    const existingHandler = window._cancelDeliveryHandler;
    if (existingHandler) {
        document.removeEventListener('click', existingHandler, false);
    }
    
    // Create new handler
    window._cancelDeliveryHandler = function(e) {
        const btn = e.target.closest('.cancel-delivery-btn');
        if (!btn || btn.disabled) {
            return; // Not our button, let it bubble normally
        }
        
        // Prevent default and stop propagation
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        const deliveryId = parseInt(btn.getAttribute('data-delivery-id')) || 0;
        const orderId = parseInt(btn.getAttribute('data-order-id'));
        const customerName = btn.getAttribute('data-customer-name') || 'the customer';
        
        console.log('[Cancel Delivery Button] Clicked:', { deliveryId, orderId, customerName });
        
        if (!orderId) {
            console.error('[Setup Cancel Delivery] Missing order ID');
            if (window.AdminNotifications) {
                AdminNotifications.error('Missing order information. Please refresh the page.', {
                    duration: 5000
                });
            } else {
                alert('Missing order information. Please refresh the page.');
            }
            return false;
        }
        
        // Call the function
        try {
            showCancelDeliveryModal(deliveryId, orderId, customerName);
        } catch (error) {
            console.error('[Setup Cancel Delivery] Error calling function:', error);
            if (window.AdminNotifications) {
                AdminNotifications.error('An error occurred: ' + (error.message || 'Unknown error'), {
                    duration: 5000
                });
            } else {
                alert('An error occurred: ' + (error.message || 'Unknown error'));
            }
        }
        
        return false;
    };
    
    // Use event delegation
    document.addEventListener('click', window._cancelDeliveryHandler, false);
    console.log('[Setup Cancel Delivery] Event handler attached');
}

// Show cancel delivery modal
async function showCancelDeliveryModal(deliveryId, orderId, customerName) {
    // Check if modal exists, if not create it
    let modal = document.getElementById('cancelDeliveryModal');
    if (!modal) {
        // Create modal HTML
        const modalHTML = `
            <div class="modal fade" id="cancelDeliveryModal" tabindex="-1" role="dialog" aria-labelledby="cancelDeliveryModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered" role="document">
                    <div class="modal-content">
                        <div class="modal-header" style="background-color: #dc3545; color: white;">
                            <h5 class="modal-title" id="cancelDeliveryModalLabel">
                                <i class="fas fa-times-circle mr-2"></i>Cancel Delivery
                            </h5>
                            <button type="button" class="close" data-dismiss="modal" aria-label="Close" style="color: white;">
                                <span aria-hidden="true">&times;</span>
                            </button>
                        </div>
                        <div class="modal-body">
                            <div id="cancelDeliveryError" class="alert alert-danger" style="display: none;"></div>
                            <p><strong>Order ID:</strong> #${orderId}</p>
                            <p><strong>Customer:</strong> ${escapeHtml(customerName)}</p>
                            <div class="form-group">
                                <label for="cancellationReason"><strong>Cancellation Reason <span class="text-danger">*</span></strong></label>
                                <select class="form-control" id="cancellationReason" required>
                                    <option value="">Select a reason...</option>
                                    <option value="Customer Request">Customer Request</option>
                                    <option value="Address Unavailable">Address Unavailable</option>
                                    <option value="Weather Conditions">Weather Conditions</option>
                                    <option value="Vehicle Breakdown">Vehicle Breakdown</option>
                                    <option value="Driver Unavailable">Driver Unavailable</option>
                                    <option value="Order Issue">Order Issue</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="internalNotes"><strong>Internal Notes (Optional)</strong></label>
                                <textarea class="form-control" id="internalNotes" rows="3" placeholder="Add any internal notes for staff reference..."></textarea>
                            </div>
                            <div class="alert alert-warning">
                                <i class="fas fa-exclamation-triangle mr-2"></i>
                                <strong>Warning:</strong> This action will cancel the delivery and notify the customer. The customer will be able to reschedule.
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-danger" id="confirmCancelDeliveryBtn">
                                <i class="fas fa-times-circle mr-2"></i>Cancel Delivery
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        modal = document.getElementById('cancelDeliveryModal');
        
        // Setup confirm button handler
        document.getElementById('confirmCancelDeliveryBtn').addEventListener('click', async function() {
            await handleCancelDelivery(deliveryId, orderId);
        });
    }
    
    // Reset form
    document.getElementById('cancellationReason').value = '';
    document.getElementById('internalNotes').value = '';
    document.getElementById('cancelDeliveryError').style.display = 'none';
    
    // Show modal
    $(modal).modal('show');
}

// Handle cancel delivery
async function handleCancelDelivery(deliveryId, orderId) {
    const reason = document.getElementById('cancellationReason').value.trim();
    const internalNotes = document.getElementById('internalNotes').value.trim();
    const errorEl = document.getElementById('cancelDeliveryError');
    const confirmBtn = document.getElementById('confirmCancelDeliveryBtn');
    
    // Validate
    if (!reason) {
        errorEl.textContent = 'Please select a cancellation reason.';
        errorEl.style.display = 'block';
        return;
    }
    
    // Disable button and show loading
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Cancelling...';
    errorEl.style.display = 'none';
    
    try {
        const response = await fetch('../api/cancel_delivery.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                delivery_id: deliveryId,
                order_id: orderId,
                cancellation_reason: reason,
                internal_notes: internalNotes || null
            })
        });
        
        const data = await response.json();
        
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Failed to cancel delivery');
        }
        
        // Success
        if (window.AdminNotifications) {
            AdminNotifications.success('Delivery cancelled successfully. Customer has been notified.', {
                duration: 5000
            });
        } else {
            alert('Delivery cancelled successfully. Customer has been notified.');
        }
        
        // Close modal
        $('#cancelDeliveryModal').modal('hide');
        
        // Reload deliveries or redirect (if on ViewDelivery)
        if (window.location.pathname.includes('ViewDelivery') || window.location.href.includes('ViewDelivery')) {
            window.location.href = '../Admin/DeliveriesAdmin.html';
        } else if (window.location.pathname.includes('ViewOrderAccept') || window.location.href.includes('ViewOrderAccept')) {
            window.location.reload();
        } else {
            await loadDeliveries();
        }
        
    } catch (error) {
        console.error('[Cancel Delivery] Error:', error);
        errorEl.textContent = error.message || 'Failed to cancel delivery. Please try again.';
        errorEl.style.display = 'block';
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '<i class="fas fa-times-circle mr-2"></i>Cancel Delivery';
    }
}

// Functions are already defined at the top of the file
// Re-export to ensure they're available (including for ViewOrderAccept page)
window.completeDelivery = completeDelivery;
window.showCompleteDeliveryConfirmation = showCompleteDeliveryConfirmation;
window.viewDeliveryDetails = viewDeliveryDetails;
window.showCancelDeliveryModal = showCancelDeliveryModal;
window.handleCancelDelivery = handleCancelDelivery;
window.setupCompleteDeliveryButtons = setupCompleteDeliveryButtons;
window.loadDrivers = loadDrivers;
window.loadFleet = loadFleet;
window.assignDriverToDelivery = assignDriverToDelivery;
window.assignVehicleToDelivery = assignVehicleToDelivery;
window.addDriver = addDriver;
window.removeDriver = removeDriver;
window.viewDriverDetails = viewDriverDetails;
window.addFleetVehicle = addFleetVehicle;
window.editFleetVehicle = editFleetVehicle;
window.removeFleetVehicle = removeFleetVehicle;

