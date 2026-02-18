/**
 * Cart Manager
 * Handles adding, removing, and managing cart items
 * Uses localStorage to persist cart data
 */

const CART_STORAGE_KEY = 'matarix_cart';

/**
 * Get cart from localStorage
 */
function getCart() {
    const cartJson = localStorage.getItem(CART_STORAGE_KEY);
    return cartJson ? JSON.parse(cartJson) : [];
}

/**
 * Save cart to localStorage
 */
function saveCart(cart) {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
}

/**
 * Add product to cart
 * @param {number} productId - Product ID
 * @param {string} productName - Product name
 * @param {number} price - Product price
 * @param {number} quantity - Quantity to add
 * @param {string} image - Product image URL
 * @param {string} category - Product category
 * @param {object} variations - Product variations (optional)
 * @returns {boolean} - True if added successfully
 */
function addToCart(productId, productName, price, quantity = 1, image = '', category = '', variations = null) {
    const cart = getCart();
    
    // Create a unique key for items with variations
    const variationKey = variations && Object.keys(variations).length > 0
        ? JSON.stringify(variations)
        : '';
    
    // Check if product with same variations already exists in cart
    const existingItemIndex = cart.findIndex(item => {
        if (item.product_id !== productId) return false;
        const itemVariationKey = item.variations && Object.keys(item.variations).length > 0
            ? JSON.stringify(item.variations)
            : '';
        return itemVariationKey === variationKey;
    });
    
    if (existingItemIndex > -1) {
        // Update quantity if product with same variations already exists
        cart[existingItemIndex].quantity += quantity;
    } else {
        // Add new item to cart
        const cartItem = {
            product_id: productId,
            product_name: productName,
            price: parseFloat(price),
            quantity: parseInt(quantity),
            image: image,
            category: category,
            added_at: new Date().toISOString()
        };
        
        // Add variations if provided
        if (variations && Object.keys(variations).length > 0) {
            cartItem.variations = variations;
        }
        
        cart.push(cartItem);
    }
    
    saveCart(cart);
    updateCartBadge();
    return true;
}

/**
 * Remove product from cart
 * @param {number} productId - Product ID to remove
 * @param {object} variations - Product variations (optional, for removing specific variation)
 */
function removeFromCart(productId, variations = null) {
    const cart = getCart();
    let filteredCart;
    
    if (variations && Object.keys(variations).length > 0) {
        // Remove specific item with variations
        const variationKey = JSON.stringify(variations);
        filteredCart = cart.filter(item => {
            if (item.product_id !== productId) return true;
            const itemVariationKey = item.variations && Object.keys(item.variations).length > 0
                ? JSON.stringify(item.variations)
                : '';
            return itemVariationKey !== variationKey;
        });
    } else {
        // Remove all items with this product_id (no variations specified)
        filteredCart = cart.filter(item => item.product_id !== productId);
    }
    
    saveCart(filteredCart);
    updateCartBadge();
}

/**
 * Update product quantity in cart
 * @param {number} productId - Product ID
 * @param {number} quantity - New quantity
 * @param {object} variations - Product variations (optional, for updating specific variation)
 */
function updateCartQuantity(productId, quantity, variations = null) {
    const cart = getCart();
    
    let item = null;
    if (variations && Object.keys(variations).length > 0) {
        // Find item with specific variations
        const variationKey = JSON.stringify(variations);
        item = cart.find(item => {
            if (item.product_id !== productId) return false;
            const itemVariationKey = item.variations && Object.keys(item.variations).length > 0
                ? JSON.stringify(item.variations)
                : '';
            return itemVariationKey === variationKey;
        });
    } else {
        // Find item without variations
        item = cart.find(item => 
            item.product_id === productId && 
            (!item.variations || Object.keys(item.variations).length === 0)
        );
    }
    
    if (item) {
        if (quantity <= 0) {
            removeFromCart(productId, variations);
        } else {
            item.quantity = parseInt(quantity);
            saveCart(cart);
        }
    }
    
    updateCartBadge();
}

/**
 * Clear entire cart
 */
function clearCart() {
    localStorage.removeItem(CART_STORAGE_KEY);
    updateCartBadge();
}

/**
 * Get cart item count
 */
function getCartItemCount() {
    const cart = getCart();
    return cart.length;
}

/**
 * Get cart total
 */
function getCartTotal() {
    const cart = getCart();
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
}

/**
 * Update cart badge in header and mobile bottom nav
 */
function updateCartBadge() {
    const badges = document.querySelectorAll('.cart-badge, .mobile-bottom-nav .cart-badge, .mobile-bottom-nav .nav-badge.cart-badge');
    const count = getCartItemCount();
    
    badges.forEach(badge => {
        if (badge) {
            badge.textContent = count;
            badge.style.display = count > 0 ? 'inline' : 'none';
        }
    });
}

/**
 * Handle add to cart from URL parameters
 * Called when user is redirected from ProductDetails with ?add=product-X&price=Y&quantity=Z
 */
function handleAddToCartFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const addParam = urlParams.get('add');
    
    if (addParam && addParam.startsWith('product-')) {
        const productId = parseInt(addParam.replace('product-', ''));
        const price = urlParams.get('price');
        const quantity = urlParams.get('quantity') || 1;
        const productName = decodeURIComponent(urlParams.get('name') || `Product ${productId}`);
        const image = decodeURIComponent(urlParams.get('image') || '');
        const category = decodeURIComponent(urlParams.get('category') || '');
        
        // Get variations from URL parameters
        // First, try to get variations as JSON (for all variation types)
        let variations = {};
        const variationsParam = urlParams.get('variations');
        
        if (variationsParam) {
            try {
                variations = JSON.parse(decodeURIComponent(variationsParam));
            } catch (e) {
                console.error('Error parsing variations JSON:', e);
                variations = {};
            }
        }
        
        // Fallback to individual parameters for backward compatibility (size, length)
        if (Object.keys(variations).length === 0) {
            const size = urlParams.get('size');
            const length = urlParams.get('length');
            
            if (size) {
                variations['Size'] = {
                    variation_value: decodeURIComponent(size)
                };
            }
            if (length) {
                variations['Length'] = {
                    variation_value: decodeURIComponent(length)
                };
            }
        }
        
        const variationsToAdd = Object.keys(variations).length > 0 ? variations : null;
        
        if (productId && price) {
            addToCart(productId, productName, price, parseInt(quantity), image, category, variationsToAdd);
            
            // Remove parameters from URL
            const newUrl = window.location.pathname;
            window.history.replaceState({}, '', newUrl);
            
            // Show success message
            showCartNotification('Product added to cart!');
            
            // Reload cart if we're on the cart page
            if (window.loadCartItems) {
                setTimeout(() => window.loadCartItems(), 100);
            }
        }
    }
}

/**
 * Show cart notification
 */
function showCartNotification(message) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'cart-notification';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4CAF50;
        color: white;
        padding: 15px 20px;
        border-radius: 5px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Initialize cart badge on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        updateCartBadge();
        handleAddToCartFromURL();
    });
} else {
    updateCartBadge();
    handleAddToCartFromURL();
}

// Export functions for global access
window.CartManager = {
    addToCart: addToCart,
    removeFromCart: removeFromCart,
    updateCartQuantity: updateCartQuantity,
    clearCart: clearCart,
    getCart: getCart,
    saveCart: saveCart,
    getCartItemCount: getCartItemCount,
    getCartTotal: getCartTotal,
    updateCartBadge: updateCartBadge,
    handleAddToCartFromURL: handleAddToCartFromURL
};

