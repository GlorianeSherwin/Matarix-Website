// CUSTOMER FEEDBACK PAGE JAVASCRIPT

$(document).ready(function() {
    // Global variables
    let currentRatingFilter = '';
    let currentTimeFilter = '';
    
    // Initialize: Load feedback data
    loadFeedback();
    
    /**
     * Load feedback data
     */
    async function loadFeedback() {
        try {
            const params = new URLSearchParams();
            if (currentRatingFilter) {
                params.append('rating', currentRatingFilter);
            }
            if (currentTimeFilter) {
                params.append('time', currentTimeFilter);
            }
            
            const response = await fetch(`../api/get_all_feedback.php?${params}`, {
                method: 'GET',
                credentials: 'include' // Include cookies for session
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                } catch (e) {
                    errorData = { message: errorText || `HTTP error! status: ${response.status}` };
                }
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                updateStatistics(data.statistics);
                displayReviews(data.reviews);
            } else {
                showError(data.message || 'Failed to load feedback');
                displayEmptyState();
            }
        } catch (error) {
            console.error('Load feedback error:', error);
            showError('Failed to load feedback: ' + error.message);
            displayEmptyState();
        }
    }
    
    /**
     * Update statistics cards
     */
    function updateStatistics(stats) {
        // Average Rating
        $('#average-rating').text(stats.average_rating.toFixed(1));
        const avgRatingStars = generateStars(stats.average_rating);
        $('#average-rating-stars').html(avgRatingStars);
        
        // Total Reviews
        $('#total-reviews').text(number_format(stats.total_reviews, 0));
        
        // Satisfaction Rate
        $('#satisfaction-rate').text(stats.satisfaction_rate.toFixed(1) + '%');
    }
    
    /**
     * Generate star HTML
     */
    function generateStars(rating) {
        const fullStars = Math.floor(rating);
        const hasHalfStar = (rating % 1) >= 0.5;
        let starsHTML = '';
        
        for (let i = 0; i < 5; i++) {
            if (i < fullStars) {
                starsHTML += '<i class="fas fa-star filled-star"></i>';
            } else if (i === fullStars && hasHalfStar) {
                starsHTML += '<i class="fas fa-star-half-alt filled-star"></i>';
            } else {
                starsHTML += '<i class="far fa-star"></i>';
            }
        }
        
        return starsHTML;
    }
    
    /**
     * Display reviews
     */
    function displayReviews(reviews) {
        const reviewsSection = $('#reviews-section');
        reviewsSection.empty();
        
        if (reviews.length === 0) {
            reviewsSection.html(`
                <div class="text-center py-5">
                    <i class="fas fa-comment-slash" style="font-size: 48px; color: #ccc; margin-bottom: 15px;"></i>
                    <p class="text-muted">No experience feedback yet</p>
                    <small class="text-muted">Try adjusting your filters or wait for customers to rate their experience.</small>
                </div>
            `);
            return;
        }
        
        reviews.forEach(review => {
            const reviewDate = new Date(review.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            
            const orderDate = new Date(review.order_date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            
            const starsHTML = generateStars(review.rating);
            
            // Customer feedback is overall order feedback, not product-specific
            // Hide customer name if anonymous
            const displayName = review.is_anonymous ? 'Anonymous' : escapeHtml(review.customer_name);
            const reviewCard = `
                <div class="review-card">
                    <div class="review-header">
                        <div class="customer-info">
                            <div class="customer-icon">
                                <i class="fas fa-user-circle"></i>
                            </div>
                            <div class="customer-details">
                                <h4 class="customer-name">${displayName}</h4>
                                <div class="review-meta">
                                    <span class="order-id">Order #INV${review.order_id}</span>
                                    <span class="order-total">Total: ₱${number_format(review.order_total, 2)}</span>
                                    <span class="order-date">Order Date: ${orderDate}</span>
                                    <span class="review-date">Rated: ${reviewDate}</span>
                                    ${review.is_anonymous ? '<span class="badge badge-secondary">Anonymous</span>' : ''}
                                </div>
                            </div>
                        </div>
                        <div class="review-rating">
                            <div class="stars">
                                ${starsHTML}
                            </div>
                            <span class="rating-number">${review.rating.toFixed(1)}</span>
                        </div>
                    </div>
                    <div class="review-body">
                        <div class="review-text">
                            <p>${escapeHtml(review.review_text || 'No comment provided.')}</p>
                        </div>
                    </div>
                </div>
            `;
            
            reviewsSection.append(reviewCard);
        });
    }
    
    /**
     * Display empty state
     */
    function displayEmptyState() {
        $('#reviews-section').html(`
            <div class="text-center py-5">
                <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: #BC3131; margin-bottom: 15px;"></i>
                <p class="text-muted">Failed to load feedback</p>
            </div>
        `);
    }
    
    /**
     * Format number with commas
     */
    function number_format(number, decimals = 2) {
        return parseFloat(number).toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }
    
    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(text) {
        if (text === null || text === undefined) return '';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return String(text).replace(/[&<>"']/g, m => map[m]);
    }
    
    /**
     * Show error message
     */
    function showError(message) {
        console.error('Error:', message);
        // You can add a toast notification here if needed
    }
    
    // Filter functionality
    $('#ratings-filter, #time-filter').on('change', function() {
        currentRatingFilter = $('#ratings-filter').val();
        currentTimeFilter = $('#time-filter').val();
        
        // Show loading
        $('#reviews-section').html(`
            <div class="text-center py-5">
                <div class="spinner-border" role="status" style="color: #BC3131;">
                    <span class="sr-only">Loading...</span>
                </div>
                <p class="mt-3">Loading feedback...</p>
            </div>
        `);
        
        loadFeedback();
    });
    
    // Header action buttons
    $('#messages-btn').on('click', function() {
        console.log('Messages button clicked');
    });
    
    console.log('Customer Feedback JavaScript initialized successfully');
});
