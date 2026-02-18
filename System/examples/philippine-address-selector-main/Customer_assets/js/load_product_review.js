/**
 * Load Product Review Page
 * Loads order data for review and handles review submission
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

// Get item icon based on category
function getItemIcon(category) {
    const iconMap = {
        'Hollow Blocks': '🧱',
        'Steel': '⚙️',
        'Mild Steel': '⚙️',
        'Concrete': '🔩',
        'Cement': '🏗️',
        'default': '📦'
    };
    return iconMap[category] || iconMap['default'];
}

// Global variables
let currentOrderId = null;
let currentOrder = null;
let currentRatings = {
    overall: 0,
    products: {} // Will store product_id as key
};
let currentFeedback = {
    overall: '',
    products: {} // Will store product_id as key
};
let isAnonymous = false;

// Load order for review
async function loadOrderForReview() {
    console.log('[Product Review] loadOrderForReview called');
    
    const sessionUserId = sessionStorage.getItem('user_id');
    
    if (!sessionUserId) {
        console.error('[Product Review] No user ID in session, redirecting to login');
        window.location.href = 'Login.html';
        return;
    }
    
    // Get order_id from URL
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('order_id');
    
    console.log('[Product Review] Order ID from URL:', orderId);
    
    if (!orderId) {
        // Try to get the most recent delivered order
        console.log('[Product Review] No order_id in URL, fetching most recent delivered order');
        try {
            const response = await fetch('../api/get_customer_orders.php', {
                method: 'GET',
                credentials: 'include',
                cache: 'no-cache'
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('[Product Review] Orders fetched:', data);
                
                if (data.success && data.orders && data.orders.length > 0) {
                    // Find a delivered order
                    for (const order of data.orders) {
                        try {
                            const deliveryResponse = await fetch(`../api/get_delivery_status.php?order_id=${order.Order_ID}`, {
                                method: 'GET',
                                credentials: 'include',
                                cache: 'no-cache'
                            });
                            
                            if (deliveryResponse.ok) {
                                const deliveryData = await deliveryResponse.json();
                                console.log('[Product Review] Delivery status for order', order.Order_ID, ':', deliveryData);
                                
                                if (deliveryData.success && deliveryData.delivery && 
                                    deliveryData.delivery.Delivery_Status === 'Delivered') {
                                    // Load this order
                                    console.log('[Product Review] Found delivered order:', order.Order_ID);
                                    await loadOrderDetails(order.Order_ID);
                                    return;
                                }
                            }
                        } catch (error) {
                            console.error(`[Product Review] Error checking delivery for order ${order.Order_ID}:`, error);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('[Product Review] Error fetching orders:', error);
        }
        
        // No order found
        console.log('[Product Review] No delivered order found');
        displayNoOrder();
        return;
    }
    
    console.log('[Product Review] Loading order details for:', orderId);
    await loadOrderDetails(orderId);
}

// Load order details
async function loadOrderDetails(orderId) {
    try {
        console.log('[Product Review] Loading order details for:', orderId);
        
        const response = await fetch(`../api/get_customer_orders.php?order_id=${orderId}`, {
            method: 'GET',
            credentials: 'include',
            cache: 'no-cache'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('[Product Review] Order data received:', data);
        
        if (data.success && data.order) {
            console.log('[Product Review] Order loaded successfully:', data.order);
            console.log('[Product Review] Order items:', data.order.items);
            
            currentOrderId = orderId;
            currentOrder = data.order;
            displayOrderForReview(data.order);
            
            // Load existing reviews if any
            await loadExistingReviews(orderId);
        } else {
            console.error('[Product Review] Failed to load order:', data.message);
            displayNoOrder();
        }
    } catch (error) {
        console.error('[Product Review] Error loading order:', error);
        console.error('[Product Review] Error stack:', error.stack);
        alert('Failed to load order details. Please try again.');
        displayNoOrder();
    }
}

// Display order for review
function displayOrderForReview(order) {
    console.log('[Product Review] displayOrderForReview called with order:', order);
    
    const reviewCard = document.querySelector('.review-card');
    const itemReviewsSection = document.querySelector('.item-reviews-section');
    
    console.log('[Product Review] reviewCard found:', !!reviewCard);
    console.log('[Product Review] itemReviewsSection found:', !!itemReviewsSection);
    
    if (!reviewCard || !itemReviewsSection) {
        console.error('[Product Review] Required elements not found - reviewCard:', !!reviewCard, 'itemReviewsSection:', !!itemReviewsSection);
        return;
    }
    
    const orderId = order.Order_ID;
    const orderNumber = `ORD-${orderId.toString().padStart(4, '0')}`;
    const totalAmount = formatPrice(order.amount);
    const itemCount = order.items ? order.items.length : 0;
    const itemNames = order.items ? order.items.map(item => escapeHtml(item.Product_Name)).join(', ') : 'No items';
    
    // Update review card
    const orderItem = reviewCard.querySelector('.order-item');
    if (orderItem) {
        orderItem.innerHTML = `
            <div class="item-image">🔩</div>
            <div class="item-details">
                <div class="item-name">Order # ${orderNumber}</div>
                <div class="item-description">${itemCount} items • ${itemNames}</div>
                <div class="item-description">Estimated delivery: ${order.availability_date ? formatDate(order.availability_date) : 'TBD'}</div>
                <div class="item-price">${totalAmount}</div>
            </div>
            <div class="rating-section">
                <div class="star-rating" id="starRating" data-item="overall">
                    <span class="star" data-rating="1">★</span>
                    <span class="star" data-rating="2">★</span>
                    <span class="star" data-rating="3">★</span>
                    <span class="star" data-rating="4">★</span>
                    <span class="star" data-rating="5">★</span>
                </div>
                <div class="rating-text">Rate Order</div>
                <button class="btn btn-feedback" onclick="openFeedbackModal()">Write Feedback</button>
            </div>
        `;
    }
    
    // Update item reviews section
    if (order.items && order.items.length > 0) {
        let itemsHTML = '<h6 class="section-title">Rate Individual Items</h6>';
        
        order.items.forEach((item) => {
            const productId = item.Product_ID;
            const productName = escapeHtml(item.Product_Name || 'Unknown Product');
            const category = item.category || '';
            
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
            
            const itemIcon = getItemIcon(category);
            const itemKey = `product-${productId}`;
            
            itemsHTML += `
                <div class="item-review-card" data-product-id="${productId}">
                    <div class="item-info">
                        <div class="item-image">${itemIcon}</div>
                        <div class="item-details">
                            <div class="item-name">${productName}</div>
                            <div class="item-specs">${escapeHtml(variation)} • x${item.Quantity}</div>
                        </div>
                    </div>
                    <div class="item-rating">
                        <div class="star-rating" data-item="${itemKey}" data-product-id="${productId}">
                            <span class="star" data-rating="1">★</span>
                            <span class="star" data-rating="2">★</span>
                            <span class="star" data-rating="3">★</span>
                            <span class="star" data-rating="4">★</span>
                            <span class="star" data-rating="5">★</span>
                        </div>
                        <button class="btn btn-item-feedback" onclick="openItemFeedback(${productId}, '${escapeHtml(productName)}')">
                            <i class="fas fa-comment"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        
        itemReviewsSection.innerHTML = itemsHTML;
        
        // Re-initialize star ratings after adding items
        initializeStarRatings();
    } else {
        itemReviewsSection.innerHTML = '<h6 class="section-title">Rate Individual Items</h6><p class="text-muted">No items found in this order.</p>';
    }
}

// Initialize star ratings
function initializeStarRatings() {
    // Remove existing event listeners by cloning
    $('.star-rating .star').off('click mouseenter');
    $('.star-rating').off('mouseleave');
    
    // Overall rating
    $('#starRating .star').on('click', function() {
        const rating = parseInt($(this).data('rating'));
        setRating($('#starRating'), rating, 'overall');
        currentRatings.overall = rating;
    });
    
    // Product ratings
    $('.star-rating[data-product-id] .star').on('click', function() {
        const rating = parseInt($(this).data('rating'));
        const container = $(this).parent();
        const productId = parseInt(container.data('product-id'));
        setRating(container, rating, `product-${productId}`);
        currentRatings.products[productId] = rating;
    });
    
    // Hover effects
    $('.star-rating .star').on('mouseenter', function() {
        const rating = parseInt($(this).data('rating'));
        const container = $(this).parent();
        highlightStars(container, rating);
    });
    
    $('.star-rating').on('mouseleave', function() {
        const itemType = $(this).data('item');
        let currentRating = 0;
        
        if (itemType === 'overall') {
            currentRating = currentRatings.overall;
        } else if (itemType && itemType.startsWith('product-')) {
            const productId = parseInt($(this).data('product-id'));
            currentRating = currentRatings.products[productId] || 0;
        }
        
        highlightStars($(this), currentRating);
    });
}

// Set rating
function setRating(container, rating, itemType) {
    container.find('.star').each(function(index) {
        if (index < rating) {
            $(this).addClass('filled');
        } else {
            $(this).removeClass('filled');
        }
    });
}

// Highlight stars on hover
function highlightStars(container, rating) {
    container.find('.star').each(function(index) {
        if (index < rating) {
            $(this).addClass('hover');
        } else {
            $(this).removeClass('hover');
        }
    });
}

// Load existing reviews
async function loadExistingReviews(orderId) {
    try {
        const response = await fetch(`../api/get_order_reviews.php?order_id=${orderId}`, {
            method: 'GET',
            credentials: 'include'
        });
        
        if (!response.ok) {
            console.warn('[Product Review] Could not load existing reviews');
            return;
        }
        
        const data = await response.json();
        
        if (data.success) {
            // Load overall feedback
            if (data.overall_feedback) {
                currentRatings.overall = data.overall_feedback.rating;
                currentFeedback.overall = data.overall_feedback.message || '';
                setRating($('#starRating'), currentRatings.overall, 'overall');
            }
            
            // Load product reviews
            if (data.product_reviews && data.product_reviews.length > 0) {
                data.product_reviews.forEach(review => {
                    const productId = review.product_id;
                    currentRatings.products[productId] = review.rating;
                    currentFeedback.products[productId] = review.review_text || '';
                    
                    const container = $(`.star-rating[data-product-id="${productId}"]`);
                    if (container.length) {
                        setRating(container, review.rating, `product-${productId}`);
                    }
                });
            }
        }
    } catch (error) {
        console.error('[Product Review] Error loading existing reviews:', error);
    }
}

// Open feedback modal
function openFeedbackModal() {
    // Set current overall rating in modal
    if (currentRatings.overall > 0) {
        setRating($('#modalRating'), currentRatings.overall, 'overall');
    }
    
    // Set existing feedback text
    $('#feedbackText').val(currentFeedback.overall);
    
    // Set anonymous checkbox state
    $('#anonymousFeedback').prop('checked', isAnonymous);
    
    $('#feedbackModal').modal('show');
}

// Open item feedback modal
function openItemFeedback(productId, productName) {
    // Store current product being reviewed
    window.currentItemProductId = productId;
    window.currentItemProductName = productName;
    
    // Update modal title
    $('#itemFeedbackModalTitle').text(`Write Feedback for ${productName}`);
    
    // Set existing rating and feedback if any
    const existingRating = currentRatings.products[productId] || 0;
    const existingFeedback = currentFeedback.products[productId] || '';
    
    // Clear and set rating
    $('#itemFeedbackModalRating .star').removeClass('filled');
    if (existingRating > 0) {
        $('#itemFeedbackModalRating .star').each(function(index) {
            if (index < existingRating) {
                $(this).addClass('filled');
            }
        });
    }
    
    $('#itemFeedbackText').val(existingFeedback);
    $('#itemFeedbackModal').modal('show');
}

// Save overall feedback
function saveFeedback() {
    const feedback = $('#feedbackText').val().trim();
    const modalRating = $('#modalRating .star.filled').length;
    
    if (modalRating === 0) {
        alert('Please provide a rating before saving feedback.');
        return;
    }
    
    currentRatings.overall = modalRating;
    currentFeedback.overall = feedback;
    isAnonymous = $('#anonymousFeedback').is(':checked');
    
    // Update the main rating display
    setRating($('#starRating'), currentRatings.overall, 'overall');
    
    alert('Feedback saved successfully!');
    $('#feedbackModal').modal('hide');
}

// Save item feedback
function saveItemFeedback() {
    const productId = window.currentItemProductId;
    if (!productId) {
        alert('Error: Product ID not found.');
        return;
    }
    
    const feedback = $('#itemFeedbackText').val().trim();
    const modalRating = $('#itemFeedbackModalRating .star.filled').length;
    
    if (modalRating === 0) {
        alert('Please provide a rating before saving feedback.');
        return;
    }
    
    currentRatings.products[productId] = modalRating;
    currentFeedback.products[productId] = feedback;
    
    // Update the product rating display
    const container = $(`.star-rating[data-product-id="${productId}"]`);
    if (container.length) {
        setRating(container, modalRating, `product-${productId}`);
    }
    
    alert('Item feedback saved successfully!');
    $('#itemFeedbackModal').modal('hide');
}

// Submit review
async function submitReview() {
    if (!currentOrderId) {
        alert('No order selected for review.');
        return;
    }
    
    if (currentRatings.overall === 0) {
        alert('Please provide an overall rating before submitting.');
        return;
    }
    
    // Prepare review data
    const productRatings = [];
    
    if (currentOrder && currentOrder.items) {
        currentOrder.items.forEach(item => {
            const productId = item.Product_ID;
            const rating = currentRatings.products[productId];
            const reviewText = currentFeedback.products[productId] || '';
            
            if (rating && rating > 0) {
                productRatings.push({
                    product_id: productId,
                    rating: rating,
                    review_text: reviewText
                });
            }
        });
    }
    
    const reviewData = {
        order_id: currentOrderId,
        overall_rating: currentRatings.overall,
        overall_feedback: currentFeedback.overall,
        product_ratings: productRatings,
        is_anonymous: isAnonymous
    };
    
    console.log('[Product Review] Submitting review:', reviewData);
    
    try {
        const response = await fetch('../api/submit_review.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(reviewData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('Thank you for your review! Your feedback has been submitted successfully.');
            
            // Redirect to transaction history
            setTimeout(() => {
                window.location.href = 'TransactionHistory.html';
            }, 1500);
        } else {
            throw new Error(data.message || 'Failed to submit review');
        }
    } catch (error) {
        console.error('[Product Review] Error submitting review:', error);
        alert('Failed to submit review: ' + error.message);
    }
}

// Display no order message
function displayNoOrder() {
    const reviewCard = document.querySelector('.review-card');
    const itemReviewsSection = document.querySelector('.item-reviews-section');
    const reviewActions = document.querySelector('.review-actions');
    
    if (reviewCard) {
        reviewCard.innerHTML = `
            <div class="order-item">
                <div class="item-details" style="width: 100%; text-align: center; padding: 40px;">
                    <div class="item-name" style="color: var(--matarix-text-muted);">
                        <i class="fas fa-inbox" style="font-size: 3rem; margin-bottom: 20px; display: block; opacity: 0.5;"></i>
                        No Order Available for Review
                    </div>
                    <div class="item-description" style="margin-top: 10px;">
                        You don't have any delivered orders to review yet.
                    </div>
                </div>
            </div>
        `;
    }
    
    if (itemReviewsSection) {
        itemReviewsSection.innerHTML = '';
    }
    
    if (reviewActions) {
        reviewActions.style.display = 'none';
    }
}

// Initialize on page load
(function() {
    console.log('[Product Review] Script loaded, document.readyState:', document.readyState);
    
    if (document.readyState === 'loading') {
        // DOM is still loading, wait for DOMContentLoaded
        console.log('[Product Review] DOM is still loading, waiting for DOMContentLoaded...');
        document.addEventListener('DOMContentLoaded', function() {
            console.log('[Product Review] DOMContentLoaded fired, loading order...');
            loadOrderForReview();
        });
    } else {
        // DOM is already ready
        console.log('[Product Review] DOM is already ready, loading immediately...');
        loadOrderForReview();
    }
})();

// Make functions globally available
window.openFeedbackModal = openFeedbackModal;
window.openItemFeedback = openItemFeedback;
window.saveFeedback = saveFeedback;
window.saveItemFeedback = saveItemFeedback;
window.submitReview = submitReview;

// Back button - go to previous page (OrderSummary, delivery-tracking, etc.)
(function initBackButton() {
    const backBtn = document.getElementById('productReviewBackBtn');
    if (backBtn) {
        backBtn.addEventListener('click', function(e) {
            e.preventDefault();
            const orderId = new URLSearchParams(window.location.search).get('order_id');
            const returnUrl = sessionStorage.getItem('productReviewReturnUrl');
            if (returnUrl) {
                sessionStorage.removeItem('productReviewReturnUrl');
                window.location.href = returnUrl;
            } else if (window.history.length > 1) {
                window.history.back();
            } else if ((document.referrer || '').toLowerCase().includes('delivery-tracking')) {
                window.location.href = orderId ? `delivery-tracking.html?order_id=${orderId}` : 'delivery-tracking.html';
            } else {
                window.location.href = orderId ? `OrderSummary.html?order_id=${orderId}` : 'OrderSummary.html';
            }
        });
    }
})();

