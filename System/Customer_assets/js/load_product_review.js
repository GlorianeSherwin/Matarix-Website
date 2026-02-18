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

// Display order for review (service & experience focus)
function displayOrderForReview(order) {
    console.log('[Product Review] displayOrderForReview called with order:', order);
    
    const reviewCard = document.querySelector('.review-card');
    if (!reviewCard) {
        console.error('[Product Review] reviewCard not found');
        return;
    }
    
    const orderId = order.Order_ID;
    const orderNumber = `ORD-${orderId.toString().padStart(4, '0')}`;
    const totalAmount = formatPrice(order.amount);
    const itemCount = order.items ? order.items.length : 0;
    const itemNames = order.items ? order.items.map(item => escapeHtml(item.Product_Name)).join(', ') : 'No items';
    
    // Card: order summary row, then full-width experience rating + feedback
    reviewCard.innerHTML = `
        <div class="order-item">
            <div class="item-image">🔩</div>
            <div class="item-details">
                <div class="item-name">Order # ${orderNumber}</div>
                <div class="item-description">${itemCount} items · ${itemNames}</div>
                <div class="item-description">Estimated delivery: ${order.availability_date ? formatDate(order.availability_date) : 'TBD'}</div>
                <div class="item-price">${totalAmount}</div>
            </div>
        </div>
        <div class="experience-block">
            <div class="rating-section">
                <div class="star-rating" id="starRating" data-item="overall">
                    <span class="star" data-rating="1">★</span>
                    <span class="star" data-rating="2">★</span>
                    <span class="star" data-rating="3">★</span>
                    <span class="star" data-rating="4">★</span>
                    <span class="star" data-rating="5">★</span>
                </div>
                <p class="rating-text">Rate your experience</p>
            </div>
            <div class="inline-feedback">
                <label for="inlineFeedbackText" class="feedback-label">Your feedback (optional)</label>
                <textarea id="inlineFeedbackText" class="feedback-textarea" rows="8" placeholder="How was your experience with our service, delivery, support, and product quality?"></textarea>
                <label class="anonymous-option">
                    <input type="checkbox" id="inlineAnonymousFeedback" value="1">
                    <span>Submit as Anonymous</span>
                </label>
            </div>
        </div>
    `;
    
    initializeStarRatings();
}

// Initialize star ratings (overall experience only)
function initializeStarRatings() {
    $('.star-rating .star').off('click mouseenter');
    $('.star-rating').off('mouseleave');
    
    $('#starRating .star').on('click', function() {
        const rating = parseInt($(this).data('rating'));
        setRating($('#starRating'), rating, 'overall');
        currentRatings.overall = rating;
    });
    
    $('.star-rating .star').on('mouseenter', function() {
        const rating = parseInt($(this).data('rating'));
        const container = $(this).parent();
        highlightStars(container, rating);
    });
    
    $('#starRating').on('mouseleave', function() {
        highlightStars($(this), currentRatings.overall);
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

// Load existing experience feedback
async function loadExistingReviews(orderId) {
    try {
        const response = await fetch(`../api/get_order_reviews.php?order_id=${orderId}`, {
            method: 'GET',
            credentials: 'include'
        });
        
        if (!response.ok) {
            console.warn('[Product Review] Could not load existing feedback');
            return;
        }
        
        const data = await response.json();
        
        if (data.success && data.overall_feedback) {
            currentRatings.overall = data.overall_feedback.rating;
            currentFeedback.overall = data.overall_feedback.message || '';
            setRating($('#starRating'), currentRatings.overall, 'overall');
            const $inline = $('#inlineFeedbackText');
            if ($inline.length) $inline.val(currentFeedback.overall);
            if (data.overall_feedback.is_anonymous) {
                $('#inlineAnonymousFeedback').prop('checked', true);
                isAnonymous = true;
            }
        }
    } catch (error) {
        console.error('[Product Review] Error loading existing feedback:', error);
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

// Submit experience feedback
async function submitReview() {
    if (!currentOrderId) {
        alert('No order selected.');
        return;
    }
    
    if (currentRatings.overall === 0) {
        alert('Please rate your experience (1–5 stars) before submitting.');
        return;
    }
    
    const inlineText = document.getElementById('inlineFeedbackText');
    const inlineAnonymous = document.getElementById('inlineAnonymousFeedback');
    const overallFeedback = (inlineText && inlineText.value) ? inlineText.value.trim() : currentFeedback.overall;
    const anonymous = (inlineAnonymous && inlineAnonymous.checked) || isAnonymous;
    
    const reviewData = {
        order_id: currentOrderId,
        overall_rating: currentRatings.overall,
        overall_feedback: overallFeedback,
        product_ratings: [],
        is_anonymous: anonymous
    };
    
    try {
        const response = await fetch('../api/submit_review.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(reviewData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('Thank you! Your feedback helps us improve our service.');
            const returnUrl = sessionStorage.getItem('productReviewReturnUrl');
            setTimeout(() => {
                if (returnUrl) {
                    sessionStorage.removeItem('productReviewReturnUrl');
                    window.location.href = returnUrl;
                } else {
                    window.location.href = 'OrderSummary.html';
                }
            }, 1200);
        } else {
            throw new Error(data.message || 'Failed to submit feedback');
        }
    } catch (error) {
        console.error('[Product Review] Error submitting feedback:', error);
        alert('Failed to submit feedback: ' + error.message);
    }
}

// Display no order message
function displayNoOrder() {
    const reviewCard = document.querySelector('.review-card');
    const reviewActions = document.querySelector('.review-actions');
    const experienceNote = document.querySelector('.experience-note');
    
    if (reviewCard) {
        reviewCard.innerHTML = `
            <div class="order-item">
                <div class="item-details" style="width: 100%; text-align: center; padding: 40px;">
                    <div class="item-name" style="color: var(--matarix-text-muted);">
                        <i class="fas fa-inbox" style="font-size: 3rem; margin-bottom: 20px; display: block; opacity: 0.5;"></i>
                        No Order Available for Feedback
                    </div>
                    <div class="item-description" style="margin-top: 10px;">
                        You don't have any completed orders to rate yet.
                    </div>
                </div>
            </div>
        `;
    }
    if (experienceNote) experienceNote.style.display = 'none';
    if (reviewActions) reviewActions.style.display = 'none';
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
window.saveFeedback = saveFeedback;
window.submitReview = submitReview;

// Back button - go to previous page in browser history
(function initBackButton() {
    const backBtn = document.getElementById('productReviewBackBtn');
    if (backBtn) {
        backBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (window.history.length > 1) {
                window.history.back();
            } else {
                window.location.href = 'OrderSummary.html?sub_tab=completed';
            }
        });
    }
})();

