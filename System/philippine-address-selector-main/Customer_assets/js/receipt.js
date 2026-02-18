$(document).ready(function() {
    
    // ========== SMART NAVIGATION ==========
    // Back button goes to previous page (history.back), with fallback to Orders
    function setupSmartNavigation() {
        const urlParams = new URLSearchParams(window.location.search);
        const fromPage = urlParams.get('from');
        const backBtn = document.getElementById('smartBackBtn');
        const backBtnText = document.getElementById('backButtonText');
        
        if (!backBtn) return;
        
        backBtn.onclick = function(e) {
            e.preventDefault();
            if (window.history.length > 1) {
                window.history.back();
            } else {
                // No history - fallback based on source
                if (fromPage === 'transaction-history') {
                    window.location.href = 'TransactionHistory.html';
                } else {
                    window.location.href = 'OrderSummary.html';
                }
            }
        };
        
        if (backBtnText) {
            backBtnText.textContent = 'Back';
        }
    }
    
    // Initialize smart navigation on page load
    setupSmartNavigation();

    // ========== SIDEBAR TOGGLE FUNCTIONALITY ==========
    $('#sidebarToggle').click(function() {
        $('#sidebar').toggleClass('show');
        $('body').toggleClass('sidebar-open');
    });
    
    // Sidebar overlay click to close
    $('#sidebarOverlay').click(function() {
        $('#sidebar').removeClass('show');
        $('body').removeClass('sidebar-open');
    });
    
    // Close sidebar on window resize if large screen
    $(window).resize(function() {
        if ($(window).width() >= 992) {
            $('#sidebar').removeClass('show');
            $('body').removeClass('sidebar-open');
        }
    });

    // ========== DOWNLOAD RECEIPT FUNCTIONALITY ==========
    $('#downloadReceiptBtn').click(function() {
        const btn = $(this);
        const originalHTML = btn.html();
        
        // Check if receipt data is loaded
        const orderNumber = $('.info-section .info-value').eq(0).text();
        if (!orderNumber || orderNumber === 'Loading...' || orderNumber === 'ORD-2025-001234') {
            alert('Please wait for the receipt to load completely before downloading.');
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
            alert('Receipt content not found. Please wait for the receipt to load.');
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
            })
            .catch(function(error) {
                // Error - show message and reset button
                console.error('PDF generation error:', error);
                alert('Failed to generate PDF. Please try again or use the Print function.');
                btn.html(originalHTML);
                btn.prop('disabled', false);
            });
    });

    // ========== PRINT RECEIPT FUNCTIONALITY ==========
    $('#printReceiptBtn').click(function() {
        // Trigger browser print dialog
        window.print();
    });

    

    // ========== HEADER ICONS FUNCTIONALITY ==========
    $('#notificationIcon').click(function(e) {
        e.preventDefault();
        // In production, this would show notifications dropdown
        console.log('Notifications clicked');
    });

    $('#cartIcon').click(function(e) {
        e.preventDefault();
        window.location.href = 'cart.html';
    });

    $('#userIcon').click(function(e) {
        e.preventDefault();
        window.location.href = 'profile.html';
    });

    // ========== FORMAT CURRENCY ==========
    // Function to format currency values (if needed for dynamic content)
    function formatCurrency(amount) {
        return '₱' + amount.toLocaleString('en-PH', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    // ========== DYNAMIC RECEIPT DATA LOADING ==========
    // Load receipt data from API
    async function loadReceiptData(orderId) {
        if (!orderId) {
            console.error('No order ID provided');
            return;
        }
        
        try {
            console.log('[Receipt] Loading receipt data for order:', orderId);
            
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
                    alert('Receipt not found. This order may not belong to you.');
                    window.location.href = 'OrderSummary.html';
                    return;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                console.log('[Receipt] Receipt data loaded:', data);
                updateReceiptContent(data);
            } else {
                console.error('[Receipt] Failed to load receipt:', data.message);
                alert('Failed to load receipt: ' + (data.message || 'Unknown error'));
            }
        } catch (error) {
            console.error('[Receipt] Error loading receipt:', error);
            alert('Failed to load receipt data. Please try again.');
        }
    }

    // ========== UPDATE RECEIPT CONTENT ==========
    function updateReceiptContent(data) {
        console.log('[Receipt] Updating receipt content with data:', data);
        
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
        
        // Delivery fee row: hide for Pick Up, show for Standard Delivery (free or amount)
        const deliveryFeeRow = $('#deliveryFeeRow');
        if (deliveryFeeRow.length) {
            const deliveryMethod = data.deliveryMethod || 'Standard Delivery';
            if (deliveryMethod === 'Pick Up') {
                deliveryFeeRow.hide();
            } else {
                deliveryFeeRow.show();
                const fee = parseFloat(data.deliveryFee || 0);
                deliveryFeeRow.find('.summary-value')
                    .text(fee <= 0 ? 'Free Delivery' : formatCurrency(fee))
                    .attr('style', fee <= 0 ? 'color: #28a745; font-weight: 600;' : '');
            }
        }
        
        // Update payment badge based on status
        if (data.status === 'COMPLETED') {
            $('.payment-badge').html('<i class="fas fa-check-circle"></i> Payment Confirmed');
        } else {
            $('.payment-badge').html('<i class="fas fa-clock"></i> Payment Pending');
        }
    }
    
    // Helper function to escape HTML
    function escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return String(text).replace(/[&<>"']/g, function(m) { return map[m]; });
    }

    // ========== CHECK FOR ORDER ID IN URL ==========
    // Check if there's an order ID in the URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('order_id') || urlParams.get('orderId'); // Support both formats
    
    if (orderId) {
        // Load receipt data for this order
        loadReceiptData(orderId);
    } else {
        // No order ID - show error or redirect
        console.warn('[Receipt] No order ID in URL');
        $('.receipt-wrapper').html(`
            <div class="text-center py-5">
                <i class="fas fa-exclamation-triangle text-warning" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                <h3>No Order Selected</h3>
                <p class="text-muted">Please select an order to view its receipt.</p>
                <a href="OrderSummary.html" class="btn btn-primary mt-3">Go to Orders</a>
            </div>
        `);
    }

    // ========== ANIMATE ON SCROLL ==========
    // Add fade-in animation when page loads
    $('.receipt-wrapper').hide().fadeIn(600);

    // ========== COPY TRANSACTION ID FUNCTIONALITY ==========
    // Add click-to-copy functionality for transaction IDs
    $('.info-value').on('click', function() {
        const text = $(this).text();
        
        // Check if text looks like a transaction ID
        if (text.includes('-') || text.includes('ORD') || text.includes('GC')) {
            // Copy to clipboard
            navigator.clipboard.writeText(text).then(function() {
                // Show temporary success message
                const original = $(this);
                const originalText = original.text();
                
                original.css('color', '#28a745');
                original.text('✓ Copied!');
                
                setTimeout(function() {
                    original.css('color', '');
                    original.text(originalText);
                }, 1500);
            }).catch(function(err) {
                console.error('Failed to copy text: ', err);
            });
        }
    });

    // ========== RECEIPT STATUS BADGE ANIMATION ==========
    // Animate the payment confirmed badge
    setTimeout(function() {
        $('.payment-badge').addClass('animate-badge');
    }, 500);

    // ========== SMOOTH SCROLL TO TOP ==========
    function scrollToTop() {
        $('html, body').animate({
            scrollTop: 0
        }, 400);
    }

    // ========== EXPORT FUNCTIONS ==========
    // Make functions available globally if needed
    window.receiptFunctions = {
        loadReceiptData: loadReceiptData,
        updateReceiptContent: updateReceiptContent,
        formatCurrency: formatCurrency,
        scrollToTop: scrollToTop
    };

    // ========== LOG PAGE LOAD ==========
    console.log('Receipt page loaded successfully');
    console.log('Receipt ID:', orderId || 'Not specified');
    
});