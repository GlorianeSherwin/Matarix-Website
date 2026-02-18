/**
 * Authentication Check Script
 * Checks if user is logged in via URL parameter (user_id)
 * and handles protected button clicks
 */

// Debug: Check if script is loading
console.log('auth_check.js loaded');

// Ensure jQuery is loaded before proceeding
if (typeof jQuery === 'undefined') {
    console.error('jQuery is not loaded! auth_check.js requires jQuery.');
} else {
    console.log('jQuery version:', jQuery.fn.jquery);
}

// Wait for jQuery to be ready
(function($) {
    'use strict';
    
    $(document).ready(function() {
        console.log('auth_check.js: Document ready, jQuery loaded');
    
        /**
         * Get user_id from sessionStorage (sessions only, no URL params)
         * Returns user_id if present, null otherwise
         */
        function getUserIdFromSession() {
            const userId = sessionStorage.getItem('user_id');
            console.log('User ID from session:', userId);
            return userId;
        }
        
        /**
         * Check if user is logged in by checking sessionStorage
         * Returns true if user_id is present, false otherwise
         */
        function isUserLoggedIn() {
            const userId = getUserIdFromSession();
            return userId !== null && userId !== '';
        }
        
        /**
         * Add user_id parameter to a URL - DISABLED (returns URL as-is)
         * Sessions handle authentication, no need for URL params
         */
        function addUserIdToUrl(url) {
            // No-op: Sessions handle authentication
            return url;
        }
        
        /**
         * Handle protected button clicks
         * Checks if user_id is in URL and redirects to login if not logged in
         */
        function handleProtectedClick(e, targetUrl) {
            console.log('handleProtectedClick called, targetUrl:', targetUrl);
            
            // Always prevent default first
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            // Check if user is logged in (has user_id in URL)
            const isLoggedIn = isUserLoggedIn();
            console.log('User logged in check result:', isLoggedIn);
            
            if (!isLoggedIn) {
                // Store the intended destination in sessionStorage
                sessionStorage.setItem('redirect_after_login', targetUrl);
                // Redirect to login page
                console.log('Not logged in, redirecting to login page');
                window.location.href = './Login.html';
                return false;
            } else {
                // User is logged in, navigate directly (no user_id in URL needed)
                console.log('Logged in, allowing navigation to:', targetUrl);
                window.location.href = targetUrl;
                return true;
            }
        }
        
        // Handle Add to Cart button clicks - use capture phase to catch early
        $(document).on('click', '.add-to-cart-btn', async function(e) {
            console.log('[Add to Cart] Button clicked - handler fired');
            console.log('[Add to Cart] Button element:', this);
            console.log('[Add to Cart] Event target:', e.target);
            
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            const $button = $(this);
            const targetUrl = $button.attr('href') || './Cart.html';
            
            // Extract product information from URL parameters if available
            const urlParams = new URLSearchParams(targetUrl.split('?')[1] || '');
            const productId = urlParams.get('add') ? urlParams.get('add').replace('product-', '') : null;
            const productName = urlParams.get('name') ? decodeURIComponent(urlParams.get('name')) : null;
            const quantity = urlParams.get('quantity') || '1';
            const price = urlParams.get('price') ? parseFloat(urlParams.get('price')) : null;
            
            // Format price for display
            const formattedPrice = price ? '₱' + price.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }) : '';
            
            // Build confirmation message
            let confirmMessage = 'Are you sure you want to add this item to your cart?';
            let messageDetails = '';
            
            // Add product details if available
            const quantityNum = parseInt(quantity) || 1;
            
            if (productName) {
                confirmMessage = `Add "${productName}" to your cart?`;
            }
            
            // Add quantity and price information if available
            if (quantityNum > 1 || formattedPrice) {
                messageDetails = '<div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e0e0e0; font-size: 14px;">';
                if (quantityNum > 1) {
                    messageDetails += `<div style="margin-bottom: 8px;"><strong>Quantity:</strong> ${quantityNum}</div>`;
                }
                if (formattedPrice) {
                    messageDetails += `<div style="margin-bottom: 8px;"><strong>Price per item:</strong> ${formattedPrice}</div>`;
                    if (quantityNum > 1) {
                        const totalPrice = price * quantityNum;
                        messageDetails += `<div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #e0e0e0; font-size: 16px; font-weight: 600; color: #dc3545;"><strong>Total:</strong> ₱${totalPrice.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                        })}</div>`;
                    }
                }
                messageDetails += '</div>';
            }
            
            // Combine message and details
            const fullMessage = confirmMessage + messageDetails;
            
            // Use custom modal if available, otherwise fallback to browser confirm
            let userConfirmed = false;
            
            console.log('[Add to Cart] Checking for Notifications system:', {
                NotificationsExists: typeof window.Notifications !== 'undefined',
                showConfirmModalExists: typeof window.Notifications !== 'undefined' && typeof window.Notifications.showConfirmModal === 'function'
            });
            
            if (typeof window.Notifications !== 'undefined' && typeof window.Notifications.showConfirmModal === 'function') {
                try {
                    console.log('[Add to Cart] Showing confirmation modal...');
                    userConfirmed = await window.Notifications.showConfirmModal({
                        title: 'Add to Cart',
                        message: fullMessage,
                        icon: 'info',
                        confirmText: 'Yes, Add to Cart',
                        cancelText: 'Cancel',
                        confirmClass: 'btn-primary-red'
                    });
                    console.log('[Add to Cart] Modal result:', userConfirmed);
                } catch (error) {
                    console.error('[Add to Cart] Error showing confirmation modal:', error);
                    // Fallback to browser confirm (strip HTML for plain text)
                    const plainTextMessage = fullMessage.replace(/<[^>]*>/g, '').replace(/\n\s*\n/g, '\n');
                    userConfirmed = confirm(plainTextMessage);
                }
            } else {
                console.warn('[Add to Cart] Notifications system not available, using browser confirm');
                // Fallback to browser confirm if custom modal not available (strip HTML for plain text)
                const plainTextMessage = fullMessage.replace(/<[^>]*>/g, '').replace(/\n\s*\n/g, '\n');
                userConfirmed = confirm(plainTextMessage);
            }
            
            if (userConfirmed) {
                // User confirmed, proceed with adding to cart
                console.log('User confirmed adding to cart');
                handleProtectedClick(e, targetUrl);
            } else {
                // User cancelled
                console.log('User cancelled adding to cart');
            }
            // If user cancels, do nothing (preventDefault already called)
            return false;
        });
        
        // Handle Profile button click
        $(document).on('click', '.login-btn', function(e) {
            console.log('Profile button clicked');
            const targetUrl = $(this).attr('href') || './CustomerProfile.html';
            handleProtectedClick(e, targetUrl);
            return false;
        });
        
        // Handle Cart button click
        $(document).on('click', '.cart-btn', function(e) {
            console.log('Cart button clicked');
            const targetUrl = $(this).attr('href') || './Cart.html';
            handleProtectedClick(e, targetUrl);
            return false;
        });
        
        // Handle Notification button click
        $(document).on('click', '.signin-btn', function(e) {
            console.log('Notification button clicked');
            const targetUrl = $(this).attr('href') || './notifications.html';
            handleProtectedClick(e, targetUrl);
            return false;
        });
        
        // Also handle any link containing CustomerProfile (as backup)
        $(document).on('click', 'a[href*="CustomerProfile"]', function(e) {
            if ($(this).hasClass('login-btn')) {
                return; // Already handled above
            }
            console.log('CustomerProfile link clicked');
            const targetUrl = $(this).attr('href') || './CustomerProfile.html';
            handleProtectedClick(e, targetUrl);
            return false;
        });
        
        // Also handle any link containing Cart.html (as backup)
        $(document).on('click', 'a[href*="Cart.html"]', function(e) {
            if ($(this).hasClass('cart-btn')) {
                return; // Already handled above
            }
            console.log('Cart link clicked');
            const targetUrl = $(this).attr('href') || './Cart.html';
            handleProtectedClick(e, targetUrl);
            return false;
        });
        
        // Also handle any link containing notifications (as backup)
        $(document).on('click', 'a[href*="notifications"]', function(e) {
            if ($(this).hasClass('signin-btn')) {
                return; // Already handled above
            }
            console.log('Notifications link clicked');
            const targetUrl = $(this).attr('href') || './notifications.html';
            handleProtectedClick(e, targetUrl);
            return false;
        });
        
    }); // End of document.ready
    
})(jQuery); // End of jQuery wrapper
