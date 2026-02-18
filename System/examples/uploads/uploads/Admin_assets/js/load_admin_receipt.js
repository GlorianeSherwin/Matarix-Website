/**
 * Load Receipt for Admin View
 * Loads receipt data from API based on order_id in URL
 */

// Format currency
function formatCurrency(amount) {
    return '₱' + parseFloat(amount).toLocaleString('en-US', {
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
    return String(text).replace(/[&<>"']/g, function(m) { return map[m]; });
}

// Go back to order details
function goBack() {
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('order_id');
    if (orderId) {
        window.location.href = `ViewOrderAccept.html?order_id=${orderId}`;
    } else {
        window.location.href = 'OrdersAdmin.html';
    }
}

// Load receipt data
async function loadReceiptData() {
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('order_id');
    
    if (!orderId) {
        console.error('No order ID provided');
        alert('No order ID provided. Redirecting to Orders page...');
        window.location.href = 'OrdersAdmin.html';
        return;
    }
    
    console.log('[Admin Receipt] Loading receipt data for order:', orderId);
    
    try {
        const response = await fetch(`../api/get_receipt.php?order_id=${orderId}`, {
            method: 'GET',
            credentials: 'include'
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                alert('Please log in to view receipt');
                window.location.href = '../Customer/Login.html';
                return;
            } else if (response.status === 404) {
                alert('Receipt not found');
                goBack();
                return;
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            console.log('[Admin Receipt] Receipt data loaded:', data);
            updateReceiptContent(data);
        } else {
            console.error('[Admin Receipt] Failed to load receipt:', data.message);
            // Show error message in the receipt area instead of alert
            const receiptWrapper = document.querySelector('.receipt-wrapper');
            if (receiptWrapper) {
                receiptWrapper.innerHTML = `
                    <div class="alert alert-danger text-center" style="margin: 20px;">
                        <h4>Failed to Load Receipt</h4>
                        <p>${data.message || 'Unknown error'}</p>
                        <button class="btn btn-primary mt-3" onclick="goBack()">Go Back</button>
                    </div>
                `;
            } else {
                alert('Failed to load receipt: ' + (data.message || 'Unknown error'));
            }
        }
    } catch (error) {
        console.error('[Admin Receipt] Error loading receipt:', error);
        // Show error message in the receipt area instead of alert
        const receiptWrapper = document.querySelector('.receipt-wrapper');
        if (receiptWrapper) {
            receiptWrapper.innerHTML = `
                <div class="alert alert-danger text-center" style="margin: 20px;">
                    <h4>Error Loading Receipt</h4>
                    <p>${error.message || 'Failed to load receipt data. Please try again.'}</p>
                    <button class="btn btn-primary mt-3" onclick="goBack()">Go Back</button>
                </div>
            `;
        } else {
            alert('Failed to load receipt data. Please try again.');
        }
    }
}

// Update receipt content
function updateReceiptContent(data) {
    console.log('[Admin Receipt] Updating receipt content with data:', data);
    
    // Update transaction information (left column)
    const infoValues = $('.info-section .info-value');
    if (infoValues.length >= 5) {
        if (data.orderNumber) {
            infoValues.eq(0).text(data.orderNumber);
        }
        if (data.transactionId) {
            infoValues.eq(1).text(data.transactionId);
        }
        if (data.referenceNumber) {
            infoValues.eq(2).text(data.referenceNumber);
        }
        if (data.paymentMethod) {
            infoValues.eq(3).text(data.paymentMethod);
        }
        if (data.accountNumber) {
            infoValues.eq(4).text(data.accountNumber);
        }
    }
    
    // Update payment details (right column)
    const paymentInfoValues = $('.info-section .info-column').eq(1).find('.info-value');
    if (paymentInfoValues.length >= 4) {
        if (data.transactionDate) {
            paymentInfoValues.eq(0).text(data.transactionDate);
        }
        if (data.transactionTime) {
            paymentInfoValues.eq(1).text(data.transactionTime);
        }
        if (data.status) {
            const statusEl = paymentInfoValues.eq(2);
            statusEl.text(data.status);
            // Update status class
            statusEl.removeClass('status-completed status-pending');
            if (data.status === 'COMPLETED') {
                statusEl.addClass('status-completed');
            } else {
                statusEl.addClass('status-pending');
            }
        }
        if (data.amountPaid !== undefined) {
            paymentInfoValues.eq(3).text(formatCurrency(data.amountPaid));
        }
    }
    
    // Update customer details
    if (data.customerName) {
        $('.customer-name').text(data.customerName);
    }
    if (data.customerPhone) {
        $('.customer-phone').text('Phone Number: ' + data.customerPhone);
    }
    if (data.customerAddress) {
        $('.customer-address').text(data.customerAddress);
    }
    
    // Update order items
    if (data.items && data.items.length > 0) {
        const tbody = $('.items-table tbody');
        tbody.empty();
        
        data.items.forEach(function(item) {
            const row = `
                <tr>
                    <td>${escapeHtml(item.name)}</td>
                    <td>${escapeHtml(item.variation)}</td>
                    <td class="text-center">${item.quantity}</td>
                    <td class="text-right">${formatCurrency(item.unitPrice)}</td>
                    <td class="text-right total-price">${formatCurrency(item.total)}</td>
                </tr>
            `;
            tbody.append(row);
        });
    } else {
        // Show message if no items
        $('.items-table tbody').html('<tr><td colspan="5" class="text-center text-muted">No items found</td></tr>');
    }
    
    // Update payment summary
    const summaryRows = $('.summary-row');
    if (summaryRows.length > 0 && data.subtotal !== undefined) {
        summaryRows.first().find('.summary-value').text(formatCurrency(data.subtotal));
    }
    if (data.total !== undefined) {
        $('.total-amount').text(formatCurrency(data.total));
        // Also update amount-paid if it exists
        $('.amount-paid').text(formatCurrency(data.total));
    }
    
    // Update payment badge based on status
    if (data.status === 'COMPLETED') {
        $('.payment-badge').html('<i class="fas fa-check-circle"></i> Payment Confirmed');
    } else {
        $('.payment-badge').html('<i class="fas fa-clock"></i> Payment Pending');
    }
}

// Download receipt functionality
$('#downloadReceiptBtn').click(function() {
    const btn = $(this);
    const originalHTML = btn.html();
    
    // Check if receipt data is loaded
    const orderNumber = $('.info-section .info-value').eq(0).text();
    if (!orderNumber || orderNumber === 'Loading...') {
        const errorMsg = 'Please wait for the receipt to load completely before downloading.';
        if (window.AdminNotifications) {
            AdminNotifications.warning(errorMsg, {
                title: 'Receipt Not Ready',
                duration: 3000
            });
        } else {
            alert(errorMsg);
        }
        return;
    }
    
    // Change button to show downloading state
    btn.html('<i class="fas fa-spinner fa-spin"></i> <span>Downloading...</span>');
    btn.prop('disabled', true);
    
    // Get order number for filename (sanitize for filename)
    const sanitizedOrderNumber = orderNumber.replace(/[^a-zA-Z0-9-]/g, '_');
    const filename = `${sanitizedOrderNumber}_Receipt.pdf`;
    
    // Get the receipt wrapper element
    const receiptElement = document.querySelector('.receipt-wrapper');
    
    if (!receiptElement) {
        const errorMsg = 'Receipt content not found. Please wait for the receipt to load.';
        if (window.AdminNotifications) {
            AdminNotifications.error(errorMsg, {
                title: 'Download Error',
                duration: 3000
            });
        } else {
            alert(errorMsg);
        }
        btn.html(originalHTML);
        btn.prop('disabled', false);
        return;
    }
    
    // Configure PDF options
    const opt = {
        margin: [10, 10, 10, 10],
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
            scale: 2,
            useCORS: true,
            logging: false,
            letterRendering: true,
            backgroundColor: '#ffffff'
        },
        jsPDF: { 
            unit: 'mm', 
            format: 'a4', 
            orientation: 'portrait',
            compress: true
        },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };
    
    // Generate and download PDF
    html2pdf()
        .set(opt)
        .from(receiptElement)
        .save()
        .then(function() {
            // Success - reset button
            btn.html('<i class="fas fa-check"></i> <span>Downloaded</span>');
            setTimeout(function() {
                btn.html(originalHTML);
                btn.prop('disabled', false);
            }, 2000);
            
            // Show success notification if available
            if (window.AdminNotifications) {
                AdminNotifications.success('Receipt downloaded successfully!', {
                    title: 'Download Complete',
                    duration: 3000
                });
            }
        })
        .catch(function(error) {
            // Error - show message and reset button
            console.error('PDF generation error:', error);
            const errorMsg = 'Failed to generate PDF. Please try again or use the Print function.';
            if (window.AdminNotifications) {
                AdminNotifications.error(errorMsg, {
                    title: 'Download Error',
                    duration: 4000
                });
            } else {
                alert(errorMsg);
            }
            btn.html(originalHTML);
            btn.prop('disabled', false);
        });
});

// Print receipt functionality
$('#printReceiptBtn').click(function() {
    window.print();
});

// Initialize on page load
$(document).ready(function() {
    loadReceiptData();
    
    // Animate receipt wrapper
    $('.receipt-wrapper').hide().fadeIn(600);
    
    // Animate payment badge
    setTimeout(function() {
        $('.payment-badge').addClass('animate-badge');
    }, 500);
});

