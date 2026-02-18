/**
 * Load Cart Items
 * Dynamically loads and displays cart items from localStorage
 */

// Get product details from API
async function getProductDetails(productId) {
    try {
        const response = await fetch(`../api/get_product_customer.php?product_id=${productId}`);
        const data = await response.json();
        return data.success ? data.product : null;
    } catch (error) {
        console.error('Error fetching product details:', error);
        return null;
    }
}

// Format price
function formatPrice(price) {
    return '₱' + parseFloat(price).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// Convert weight to kilograms
function convertToKg(weight, unit) {
    if (!weight || weight === 0) return 0;
    
    const weightValue = parseFloat(weight);
    if (isNaN(weightValue)) return 0;
    
    switch (unit?.toLowerCase()) {
        case 'kg':
            return weightValue;
        case 'g':
            return weightValue / 1000; // 1 kg = 1000 g
        case 'lb':
            return weightValue * 0.453592; // 1 lb = 0.453592 kg
        case 'oz':
            return weightValue * 0.0283495; // 1 oz = 0.0283495 kg
        case 'ton':
            return weightValue * 1000; // 1 ton = 1000 kg
        default:
            // If unit is not specified or unknown, assume it's already in kg
            return weightValue;
    }
}

// Format weight
function formatWeight(weightInKg) {
    return parseFloat(weightInKg).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }) + ' kg';
}

// Get product image (use database image_path or fallback to default)
function getProductImage(imagePath) {
    if (imagePath && imagePath.trim() !== '') {
        // If image_path is relative, prepend ../
        if (imagePath.startsWith('uploads/')) {
            return '../' + imagePath;
        }
        // If it's already a full path, use as is
        return imagePath;
    }
    // Fallback to default image
    return '../Customer_assets/images/PreviewMain.png';
}

// Create cart item HTML
function createCartItemHTML(item, productDetails = null) {
    const productName = productDetails ? productDetails.product_name : item.product_name || `Product ${item.product_id}`;
    const description = productDetails ? (productDetails.description || '').substring(0, 100) + '...' : 'Product description';
    const category = productDetails ? productDetails.category : item.category || '';
    const stockStatus = productDetails ? productDetails.stock_status : 'In Stock';
    const stockLevel = productDetails ? productDetails.stock_level : 999;
    // Use image_path from productDetails, fallback to item.image, then default
    const imagePath = productDetails?.image_path || item.image || null;
    const image = getProductImage(imagePath);
    
    const stockIcon = stockStatus === 'In Stock' 
        ? '<i class="fas fa-check-circle text-success"></i>' 
        : stockStatus === 'Low Stock'
        ? '<i class="fas fa-exclamation-triangle text-warning"></i>'
        : '<i class="fas fa-times-circle text-danger"></i>';
    
    const stockText = stockStatus === 'In Stock' 
        ? 'In Stock' 
        : stockStatus === 'Low Stock'
        ? `Low Stock (${stockLevel} available)`
        : 'Out of Stock';
    
    const maxQuantity = Math.min(stockLevel, 9999);
    const itemTotal = item.price * item.quantity;
    
    // Build variation display string
    let variationText = '';
    let variationKey = '';
    if (item.variations && Object.keys(item.variations).length > 0) {
        const variationParts = Object.entries(item.variations).map(([name, data]) => {
            return `${name}: ${data.variation_value || data}`;
        });
        variationText = `<div class="item-variation" style="font-size: 0.9rem; color: #666; margin-top: 5px; font-weight: 500;">
            <i class="fas fa-tag" style="margin-right: 5px;"></i>${variationParts.join(', ')}
        </div>`;
        variationKey = JSON.stringify(item.variations);
    }
    
    // Create unique identifier for cart items (product_id + variations)
    const itemKey = variationKey ? `${item.product_id}_${btoa(variationKey).replace(/[^a-zA-Z0-9]/g, '')}` : item.product_id;
    
    const atMaxQuantity = item.quantity >= maxQuantity;
    return `
        <div class="cart-item" data-product-id="${item.product_id}" data-item-key="${itemKey}" data-price="${item.price}" data-max-quantity="${maxQuantity}">
            <div class="item-checkbox">
                <input type="checkbox" 
                       class="cart-item-checkbox" 
                       data-item-key="${itemKey}"
                       data-product-id="${item.product_id}"
                       data-quantity="${item.quantity}"
                       data-price="${item.price}"
                       checked
                       onchange="handleItemCheckboxChange(this)">
            </div>
            <div class="item-image">
                <img src="${image}" alt="${productName}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 5px;">
            </div>
            <div class="item-details">
                <h4 class="item-name">${productName}</h4>
                <p class="item-description">${description}</p>
                <div class="item-specs">
                    <span class="spec">${category}</span>
                </div>
                ${variationText}
                <div class="item-price">${formatPrice(item.price)} <span class="price-unit">per unit</span></div>
                <div class="item-stock">
                    ${stockIcon}
                    <span>${stockText}</span>
                </div>
            </div>
            <div class="item-controls">
                <div class="quantity-controls">
                    <label>Quantity:</label>
                    <div class="quantity-selector">
                        <button type="button" class="btn-quantity btn-decrement" data-item-key="${itemKey}" onclick="updateCartItemQuantity('${itemKey}', -1)">-</button>
                        <input type="number" class="quantity-input" value="${item.quantity}" min="1" max="${maxQuantity}" data-item-key="${itemKey}" onchange="updateCartItemQuantity('${itemKey}', this.value)" onblur="this.value = Math.max(1, Math.min(${maxQuantity}, parseInt(this.value) || 1))">
                        <button type="button" class="btn-quantity btn-increment" data-item-key="${itemKey}" data-max="${maxQuantity}" onclick="updateCartItemQuantity('${itemKey}', 1)" ${atMaxQuantity ? 'disabled' : ''}>+</button>
                    </div>
                    <div class="quantity-max-message" data-item-key="${itemKey}" style="display: ${atMaxQuantity ? 'block' : 'none'};">Max: ${maxQuantity} available</div>
                </div>
                <div class="item-total">
                    <span class="total-label">Total:</span>
                    <span class="total-amount">${formatPrice(itemTotal)}</span>
                </div>
                <button class="btn btn-remove" onclick="removeCartItem('${itemKey}')">
                    <i class="fas fa-trash"></i> Remove
                </button>
            </div>
        </div>
    `;
}

// Load and display cart items
// Refresh minimum order settings when page loads or becomes visible
async function refreshMinOrderSettingsOnLoad() {
    // Clear cache and fetch fresh settings when page loads
    clearMinOrderSettingsCache();
    const settings = await getMinOrderSettings(true);
    console.log('Settings refreshed on page load:', settings);
    
    // After refreshing settings, update the cart summary to reflect new minimum requirements
    const cart = window.CartManager ? window.CartManager.getCart() : [];
    if (cart.length > 0) {
        // Force update cart summary with fresh settings
        // Get product details map first
        const productDetailsMap = new Map();
        for (const item of cart) {
            try {
                const productDetails = await getProductDetails(item.product_id);
                if (productDetails) {
                    productDetailsMap.set(item.product_id, productDetails);
                }
            } catch (error) {
                console.error(`Error fetching product details for ${item.product_id}:`, error);
            }
        }
        await updateCartSummary(cart, productDetailsMap);
    }
}

// Listen for page visibility changes to refresh settings when user returns to tab
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        // Page became visible, refresh settings
        refreshMinOrderSettingsOnLoad();
    }
});

// Periodically refresh minimum order settings while page is active
// This ensures cart updates when admin changes settings
let settingsRefreshInterval = null;
function startPeriodicSettingsRefresh() {
    // Clear any existing interval
    if (settingsRefreshInterval) {
        clearInterval(settingsRefreshInterval);
    }
    
    // Refresh settings every 10 seconds when page is visible
    settingsRefreshInterval = setInterval(async () => {
        if (!document.hidden) {
            // Clear cache and fetch fresh settings
            clearMinOrderSettingsCache();
            const settings = await getMinOrderSettings(true);
            console.log('Periodic settings refresh:', settings);
            
            // Update cart summary if cart has items
            const cart = window.CartManager ? window.CartManager.getCart() : [];
            if (cart.length > 0) {
                // Get product details map
                const productDetailsMap = new Map();
                for (const item of cart) {
                    try {
                        const productDetails = await getProductDetails(item.product_id);
                        if (productDetails) {
                            productDetailsMap.set(item.product_id, productDetails);
                        }
                    } catch (error) {
                        console.error(`Error fetching product details for ${item.product_id}:`, error);
                    }
                }
                await updateCartSummary(cart, productDetailsMap);
            }
        }
    }, 10000); // Refresh every 10 seconds
}

// Stop periodic refresh when page is hidden
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        if (settingsRefreshInterval) {
            clearInterval(settingsRefreshInterval);
            settingsRefreshInterval = null;
        }
    } else {
        startPeriodicSettingsRefresh();
    }
});

async function loadCartItems() {
    const cart = window.CartManager ? window.CartManager.getCart() : [];
    const cartItemsContainer = document.getElementById('cartItemsContainer');
    
    if (!cartItemsContainer) {
        console.error('Cart container not found');
        return;
    }
    
    if (cart.length === 0) {
        // Show empty cart
        cartItemsContainer.innerHTML = `
            <div class="empty-cart" id="emptyCart">
                <div class="empty-cart-icon">
                    <i class="fas fa-shopping-cart"></i>
                </div>
                <h3>Your cart is empty</h3>
                <p>Add some materials to get started with your order</p>
                <button class="btn btn-custom" onclick="continueShopping()">
                    <i class="fas fa-cubes"></i> Browse Materials
                </button>
            </div>
        `;
        updateCartSummary([]).catch(error => {
            console.error('Error updating cart summary:', error);
        });
        
        // Update cart header
        const cartHeader = document.querySelector('.cart-header h3');
        if (cartHeader) {
            cartHeader.textContent = 'Cart Items (0)';
        }
        return;
    }
    
    // Clear existing items
    cartItemsContainer.innerHTML = '';
    
    // Load product details and create cart items
    let cartHTML = '';
    const productDetailsMap = new Map(); // Store product details for weight calculation
    
    for (const item of cart) {
        const productDetails = await getProductDetails(item.product_id);
        if (productDetails) {
            productDetailsMap.set(item.product_id, productDetails);
        }
        cartHTML += createCartItemHTML(item, productDetails);
    }
    
    cartItemsContainer.innerHTML = cartHTML;
    
    // Update cart header
    const cartHeader = document.querySelector('.cart-header h3');
    const cartItemCountEl = document.getElementById('cartItemCount');
    if (cartHeader || cartItemCountEl) {
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        if (cartItemCountEl) {
            cartItemCountEl.textContent = totalItems;
        } else if (cartHeader) {
            cartHeader.textContent = `Cart Items (${totalItems})`;
        }
    }
    
    // Initialize checkboxes after rendering
    initializeCartCheckboxes();
    
    // Update summary with product details for weight calculation (will be updated by checkbox handler)
    updateCartSummaryForCheckedItems().catch(error => {
        console.error('Error updating cart summary:', error);
    });
}

// Update increment button and max message visibility (used when quantity change is rejected)
function updateQuantityButtonStates(itemKey, currentQty, max) {
    const cartItem = document.querySelector(`.cart-item[data-item-key="${itemKey}"]`);
    if (!cartItem) return;
    const incBtn = cartItem.querySelector('.btn-increment');
    const maxMsg = cartItem.querySelector('.quantity-max-message');
    const qtyInput = cartItem.querySelector('.quantity-input');
    const atMax = currentQty >= max;
    if (incBtn) incBtn.disabled = atMax;
    if (maxMsg) maxMsg.style.display = atMax ? 'block' : 'none';
    if (qtyInput) qtyInput.value = currentQty;
}

// Update cart item quantity
function updateCartItemQuantity(itemKey, change) {
    const cart = window.CartManager.getCart();
    
    // Ensure itemKey is a string
    itemKey = String(itemKey);
    
    // Find item by matching product_id and variations
    let item = null;
    let itemIndex = -1;
    
    if (itemKey.includes('_')) {
        // Item has variations - extract product_id and variation key
        const parts = itemKey.split('_');
        const productId = parseInt(parts[0]);
        const variationKeyB64 = parts.slice(1).join('_');
        
        // Find item with matching product_id and variations
        cart.forEach((cartItem, index) => {
            if (cartItem.product_id === productId) {
                const cartItemVariationKey = cartItem.variations && Object.keys(cartItem.variations).length > 0
                    ? btoa(JSON.stringify(cartItem.variations)).replace(/[^a-zA-Z0-9]/g, '')
                    : '';
                if (cartItemVariationKey === variationKeyB64) {
                    item = cartItem;
                    itemIndex = index;
                }
            }
        });
    } else {
        // Item without variations - find by product_id only (no variations)
        const productId = parseInt(itemKey);
        cart.forEach((cartItem, index) => {
            if (cartItem.product_id === productId && (!cartItem.variations || Object.keys(cartItem.variations).length === 0)) {
                item = cartItem;
                itemIndex = index;
            }
        });
    }
    
    if (!item) return;
    
    let newQuantity;
    
    // Get the input element to read the current value
    const quantityInput = document.querySelector(`.cart-item[data-item-key="${itemKey}"] .quantity-input`);
    
    if (typeof change === 'number' && (change === 1 || change === -1)) {
        // Change is a delta (+1 or -1) from button clicks
        newQuantity = item.quantity + change;
    } else {
        // Change is the new quantity value (from input field)
        // If change is a string/number from input, parse it
        // Otherwise, read directly from the input field
        if (quantityInput) {
            newQuantity = parseInt(quantityInput.value) || 1;
        } else {
            newQuantity = parseInt(change) || 1;
        }
    }
    
    // Validate and constrain the quantity
    const max = parseInt(quantityInput?.getAttribute('max') || document.querySelector(`.cart-item[data-item-key="${itemKey}"]`)?.getAttribute('data-max-quantity') || '9999') || 9999;
    const min = parseInt(quantityInput?.getAttribute('min') || '1') || 1;
    
    if (newQuantity > max) {
        // Show error - cannot exceed stock
        if (typeof window.Notifications !== 'undefined' && typeof window.Notifications.showToast === 'function') {
            window.Notifications.showToast(`Only ${max} available. You cannot exceed the stock limit.`, 'error', 4000);
        } else {
            alert(`Only ${max} available. You cannot exceed the stock limit.`);
        }
        if (quantityInput) quantityInput.value = item.quantity;
        updateQuantityButtonStates(itemKey, item.quantity, max);
        return;
    }
    
    if (quantityInput) {
        if (newQuantity < min) newQuantity = min;
        if (newQuantity > max) newQuantity = max;
        quantityInput.value = newQuantity;
    }
    
    if (newQuantity < 1) {
        removeCartItem(itemKey);
    } else {
        // Only update if the quantity actually changed
        if (item.quantity !== newQuantity) {
            // Update the specific item in cart
            const cart = window.CartManager.getCart();
            cart[itemIndex].quantity = newQuantity;
            window.CartManager.saveCart(cart);
            loadCartItems(); // Reload to update display (buttons get correct state from createCartItemHTML)
        } else {
            // Even if quantity didn't change, update summary if checkbox is checked
            const checkbox = document.querySelector(`.cart-item-checkbox[data-item-key="${itemKey}"]`);
            if (checkbox && checkbox.checked) {
                updateCartSummaryForCheckedItems();
            }
        }
    }
}

// Remove cart item
async function removeCartItem(itemKey) {
    // Get item details for confirmation message
    const cart = window.CartManager.getCart();
    itemKey = String(itemKey);
    
    let itemToRemove = null;
    let itemIndex = -1;
    
    // Find the item first to get its name
    if (itemKey.includes('_')) {
        // Item has variations
        const parts = itemKey.split('_');
        const productId = parseInt(parts[0]);
        const variationKeyB64 = parts.slice(1).join('_');
        
        cart.forEach((cartItem, index) => {
            if (cartItem.product_id === productId) {
                const cartItemVariationKey = cartItem.variations && Object.keys(cartItem.variations).length > 0
                    ? btoa(JSON.stringify(cartItem.variations)).replace(/[^a-zA-Z0-9]/g, '')
                    : '';
                if (cartItemVariationKey === variationKeyB64) {
                    itemIndex = index;
                    itemToRemove = cartItem;
                }
            }
        });
    } else {
        // Item without variations
        const productId = parseInt(itemKey);
        cart.forEach((cartItem, index) => {
            if (cartItem.product_id === productId && (!cartItem.variations || Object.keys(cartItem.variations).length === 0)) {
                itemIndex = index;
                itemToRemove = cartItem;
            }
        });
    }
    
    if (!itemToRemove) {
        console.error('[Remove Cart Item] Item not found:', itemKey);
        return;
    }
    
    // Build confirmation message
    const productName = itemToRemove.product_name || 'this item';
    const quantity = itemToRemove.quantity || 1;
    let confirmMessage = `Remove "${productName}" from your cart?`;
    
    if (quantity > 1) {
        confirmMessage += `<div style="margin-top: 8px; font-size: 14px; color: #666;">Quantity: ${quantity}</div>`;
    }
    
    // Use custom modal if available, otherwise fallback to browser confirm
    let userConfirmed = false;
    
    if (typeof window.Notifications !== 'undefined' && typeof window.Notifications.showConfirmModal === 'function') {
        try {
            userConfirmed = await window.Notifications.showConfirmModal({
                title: 'Remove Item',
                message: confirmMessage,
                icon: 'warning',
                confirmText: 'Yes, Remove',
                cancelText: 'Cancel',
                confirmClass: 'btn-danger'
            });
        } catch (error) {
            console.error('Error showing confirmation modal:', error);
            // Fallback to browser confirm
            userConfirmed = confirm(confirmMessage.replace(/<[^>]*>/g, ''));
        }
    } else {
        // Fallback to browser confirm if custom modal not available
        userConfirmed = confirm(confirmMessage.replace(/<[^>]*>/g, ''));
    }
    
    if (userConfirmed) {
        // Ensure modal is closed before proceeding
        if (typeof window.Notifications !== 'undefined' && typeof window.Notifications.closeModal === 'function') {
            window.Notifications.closeModal();
        }
        
        // Remove the item
        if (itemIndex > -1) {
            cart.splice(itemIndex, 1);
            window.CartManager.saveCart(cart);
            loadCartItems(); // Reload to update display
            
            // Show success message
            if (typeof window.Notifications !== 'undefined' && typeof window.Notifications.showToast === 'function') {
                window.Notifications.showToast(`"${productName}" removed from cart`, 'success', 3000);
            }
        }
    } else {
        // User cancelled - ensure modal is closed
        if (typeof window.Notifications !== 'undefined' && typeof window.Notifications.closeModal === 'function') {
            window.Notifications.closeModal();
        }
    }
}

// Get minimum order settings
let minOrderSettings = null;
let minOrderSettingsCacheTime = null;
const MIN_ORDER_SETTINGS_CACHE_DURATION = 2000; // Cache for 2 seconds so admin changes apply quickly

async function getMinOrderSettings(forceRefresh = false) {
    // Check if cache is still valid (not expired and not forcing refresh)
    const now = Date.now();
    if (!forceRefresh && minOrderSettings && minOrderSettingsCacheTime) {
        const cacheAge = now - minOrderSettingsCacheTime;
        if (cacheAge < MIN_ORDER_SETTINGS_CACHE_DURATION) {
            return minOrderSettings;
        }
    }
    
    try {
        // Aggressive cache-busting to ensure fresh data (hosted sites may cache aggressively)
        const cacheBuster = forceRefresh ? Date.now() : Math.floor(now / MIN_ORDER_SETTINGS_CACHE_DURATION) * MIN_ORDER_SETTINGS_CACHE_DURATION;
        const response = await fetch(`../api/get_order_settings.php?t=${cacheBuster}&r=${Math.random()}`, {
            credentials: 'include',
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
        });
        const data = await response.json();
        if (data.success) {
            minOrderSettings = data.settings;
            minOrderSettingsCacheTime = now;
            console.log('Minimum order settings refreshed:', minOrderSettings);
            console.log('Calculated min_weight_kg:', minOrderSettings.min_order_weight_kg, 
                       'from percentage:', minOrderSettings.min_order_weight_percentage,
                       'auto_calculate:', minOrderSettings.auto_calculate_from_fleet);
            return minOrderSettings;
        } else {
            console.error('Failed to get order settings:', data.message);
        }
    } catch (error) {
        console.error('Error fetching minimum order settings:', error);
    }
    
    // Return cached value if available, even if expired, rather than default
    if (minOrderSettings) {
        return minOrderSettings;
    }
    
    // Return default if API fails and no cache exists
    return {
        min_order_weight_kg: 200,
        min_order_value: 0,
        allow_below_minimum_with_fee: false,
        premium_delivery_fee: 500,
        allow_heavy_single_items: true
    };
}

// Function to clear minimum order settings cache (call this when settings might have changed)
function clearMinOrderSettingsCache() {
    minOrderSettings = null;
    minOrderSettingsCacheTime = null;
    console.log('Minimum order settings cache cleared');
}

// Check if order meets minimum requirements
async function checkMinOrderRequirements(cart, productDetailsMap, totalWeightKg, totalAmount) {
    // Always check cache age - if expired, fetch fresh settings
    const settings = await getMinOrderSettings(false); // Will auto-refresh if cache expired
    const disableMinWeight = settings.disable_minimum_weight === true || settings.disable_minimum_weight === '1';
    const disableMinValue = settings.disable_minimum_order_value === true || settings.disable_minimum_order_value === '1';
    // Use ?? not || so that 0 (when disabled) is not replaced by 200
    const minWeight = disableMinWeight ? 0 : (settings.min_order_weight_kg ?? 200);
    
    // Debug logging
    console.log('Order requirements check:', {
        minWeight: minWeight,
        disableMinWeight: disableMinWeight,
        disableMinValue: disableMinValue,
        percentage: settings.min_order_weight_percentage,
        autoCalculate: settings.auto_calculate_from_fleet,
        currentWeight: totalWeightKg,
        currentValue: totalAmount
    });
    const minValue = disableMinValue ? 0 : (settings.min_order_value ?? 0);
    const allowHeavySingleItems = settings.allow_heavy_single_items !== false;
    
    // If both minimums are disabled, order always meets requirement
    if (disableMinWeight && disableMinValue) {
        return {
            meetsMinimum: true,
            meetsWeight: true,
            meetsValue: true,
            currentWeight: totalWeightKg,
            minWeight: 0,
            minValue: 0,
            neededWeight: 0,
            neededValue: 0
        };
    }
    
    // Check if single item exceeds minimum (if allowed and weight is enforced)
    if (!disableMinWeight && allowHeavySingleItems && cart.length === 1) {
        const item = cart[0];
        const productDetails = productDetailsMap.get(item.product_id);
        if (productDetails && productDetails.weight) {
            const rawMinWeight = settings.min_order_weight_kg ?? 200;
            const itemWeightKg = convertToKg(productDetails.weight, productDetails.weight_unit) * item.quantity;
            if (itemWeightKg >= rawMinWeight) {
                return { meetsMinimum: true, reason: 'heavy_single_item', meetsWeight: true, meetsValue: true, currentWeight: totalWeightKg, minWeight: rawMinWeight, minValue: minValue, neededWeight: 0, neededValue: 0 };
            }
        }
    }
    
    // Check weight requirement (only when weight is enforced)
    const weightActive = minWeight > 0;
    const meetsWeight = !weightActive || (totalWeightKg >= minWeight);
    
    // Check value requirement (only when value is enforced)
    const valueActive = minValue > 0;
    const meetsValue = !valueActive || (totalAmount >= minValue);
    
    // Order meets minimum if it meets at least one ACTIVE requirement (OR logic)
    const meetsMinimum = (weightActive && totalWeightKg >= minWeight) || (valueActive && totalAmount >= minValue);
    
    return {
        meetsMinimum: meetsMinimum,
        meetsWeight: meetsWeight,
        meetsValue: meetsValue,
        currentWeight: totalWeightKg,
        minWeight: minWeight,
        minValue: minValue,
        neededWeight: Math.max(0, minWeight - totalWeightKg),
        neededValue: minValue > 0 ? Math.max(0, minValue - totalAmount) : 0
    };
}

// Calculate volume discount
async function calculateVolumeDiscount(totalQuantity, subtotal) {
    try {
        // Get discount settings
        const settings = await getMinOrderSettings();
        
        console.log('[Discount] Settings:', settings);
        console.log('[Discount] Total Quantity:', totalQuantity, 'Subtotal:', subtotal);
        
        // Get discount tier settings (default values if not set)
        const discountTier1Min = parseInt(settings.volume_discount_tier1_min || 20);
        const discountTier1Percent = parseFloat(settings.volume_discount_tier1_percent || 5);
        const discountTier2Min = parseInt(settings.volume_discount_tier2_min || 50);
        const discountTier2Percent = parseFloat(settings.volume_discount_tier2_percent || 10);
        const discountTier3Min = parseInt(settings.volume_discount_tier3_min || 100);
        const discountTier3Percent = parseFloat(settings.volume_discount_tier3_percent || 15);
        const discountTier4Min = parseInt(settings.volume_discount_tier4_min || 200);
        const discountTier4Percent = parseFloat(settings.volume_discount_tier4_percent || 20);
        
        console.log('[Discount] Tier thresholds:', {
            tier1: { min: discountTier1Min, percent: discountTier1Percent },
            tier2: { min: discountTier2Min, percent: discountTier2Percent },
            tier3: { min: discountTier3Min, percent: discountTier3Percent },
            tier4: { min: discountTier4Min, percent: discountTier4Percent }
        });
        
        // Determine which discount tier applies (highest tier that customer qualifies for)
        let discountPercentage = 0;
        if (totalQuantity >= discountTier4Min) {
            discountPercentage = discountTier4Percent;
            console.log('[Discount] Applied Tier 4:', discountTier4Percent + '%');
        } else if (totalQuantity >= discountTier3Min) {
            discountPercentage = discountTier3Percent;
            console.log('[Discount] Applied Tier 3:', discountTier3Percent + '%');
        } else if (totalQuantity >= discountTier2Min) {
            discountPercentage = discountTier2Percent;
            console.log('[Discount] Applied Tier 2:', discountTier2Percent + '%');
        } else if (totalQuantity >= discountTier1Min) {
            discountPercentage = discountTier1Percent;
            console.log('[Discount] Applied Tier 1:', discountTier1Percent + '%');
        } else {
            console.log('[Discount] No discount applied - quantity below Tier 1 minimum');
        }
        
        // Calculate discount amount
        const discountAmount = discountPercentage > 0 ? subtotal * (discountPercentage / 100) : 0;
        
        console.log('[Discount] Result:', {
            percentage: discountPercentage,
            amount: discountAmount,
            finalAmount: subtotal - discountAmount
        });
        
        return {
            percentage: discountPercentage,
            amount: discountAmount,
            finalAmount: subtotal - discountAmount
        };
    } catch (error) {
        console.error('Error calculating volume discount:', error);
        return {
            percentage: 0,
            amount: 0,
            finalAmount: subtotal
        };
    }
}

// Update cart summary
async function updateCartSummary(cart, productDetailsMap = null) {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);
    
    // Calculate volume discount
    const discount = await calculateVolumeDiscount(totalQuantity, subtotal);
    const grandTotal = discount.finalAmount; // Final amount after discount
    
    // Calculate total weight
    let totalWeightKg = 0;
    
    // If cart is empty, set weight to 0
    if (cart.length === 0) {
        const subtotalEl = document.getElementById('subtotal');
        const grandTotalEl = document.getElementById('grandTotal');
        const totalWeightEl = document.getElementById('totalWeight');
        const totalWeightRow = document.getElementById('totalWeightRow');
        const shippingRow = document.getElementById('shippingRow');
        const settings = await getMinOrderSettings(false);
        const disableMinWeight = settings?.disable_minimum_weight === true || settings?.disable_minimum_weight === '1';
        
        if (subtotalEl) subtotalEl.textContent = formatPrice(0);
        if (grandTotalEl) grandTotalEl.textContent = formatPrice(0);
        if (totalWeightEl) totalWeightEl.textContent = formatWeight(0);
        if (totalWeightRow) totalWeightRow.style.display = disableMinWeight ? 'none' : '';
        if (shippingRow) shippingRow.style.display = getSelectedDeliveryMethod() === 'Pick Up' ? 'none' : '';
        
        // Hide minimum order indicators
        const minOrderRow = document.getElementById('minOrderWeightRow');
        const minOrderProgressRow = document.getElementById('minOrderProgressRow');
        const minOrderWarning = document.getElementById('minOrderWarning');
        const checkoutBtn = document.getElementById('checkoutBtn');
        const checkoutDisabledBtn = document.getElementById('checkoutDisabledBtn');
        
        if (minOrderRow) minOrderRow.style.display = 'none';
        if (minOrderProgressRow) minOrderProgressRow.style.display = 'none';
        if (minOrderWarning) minOrderWarning.style.display = 'none';
        if (checkoutBtn) {
            checkoutBtn.style.display = 'block';
            // Ensure onclick handler is set
            checkoutBtn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                if (typeof proceedToCheckoutWithSelection === 'function') {
                    proceedToCheckoutWithSelection();
                }
                return false;
            };
        }
        if (checkoutDisabledBtn) checkoutDisabledBtn.style.display = 'none';
        
        return;
    }
    
    // If productDetailsMap is not provided, fetch product details
    if (!productDetailsMap) {
        productDetailsMap = new Map();
        for (const item of cart) {
            try {
                const productDetails = await getProductDetails(item.product_id);
                if (productDetails) {
                    productDetailsMap.set(item.product_id, productDetails);
                }
            } catch (error) {
                console.error(`Error fetching product details for ${item.product_id}:`, error);
            }
        }
    }
    
    // Calculate total weight for all items
    for (const item of cart) {
        const productDetails = productDetailsMap.get(item.product_id);
        if (productDetails && productDetails.weight !== null && productDetails.weight !== undefined) {
            // Convert weight to kg
            const weightInKg = convertToKg(productDetails.weight, productDetails.weight_unit);
            // Multiply by quantity
            const itemTotalWeight = weightInKg * item.quantity;
            totalWeightKg += itemTotalWeight;
        }
    }
    
    const subtotalEl = document.getElementById('subtotal');
    const grandTotalEl = document.getElementById('grandTotal');
    const totalWeightEl = document.getElementById('totalWeight');
    const discountRow = document.getElementById('discountRow');
    const discountAmountEl = document.getElementById('discountAmount');
    const discountPercentEl = document.getElementById('discountPercent');
    
    if (subtotalEl) {
        subtotalEl.textContent = formatPrice(subtotal);
    }
    
    // Show/hide discount row
    if (discountRow) {
        if (discount.percentage > 0) {
            discountRow.style.display = 'flex'; // Use flex to match other summary rows
            if (discountAmountEl) {
                discountAmountEl.textContent = '-' + formatPrice(discount.amount);
            }
            if (discountPercentEl) {
                discountPercentEl.textContent = `${discount.percentage}%`;
            }
        } else {
            discountRow.style.display = 'none';
        }
    }
    
    // Check minimum order requirements and delivery fee (Standard Delivery only)
    const minOrderCheck = await checkMinOrderRequirements(cart, productDetailsMap, totalWeightKg, subtotal);
    console.log('Minimum order check result:', minOrderCheck);
    
    const settings = await getMinOrderSettings(false);
    const premiumDeliveryFee = parseFloat(settings?.premium_delivery_fee ?? 500) || 500;
    const isStandardDelivery = getSelectedDeliveryMethod() === 'Standard Delivery';
    const deliveryFee = (isStandardDelivery && !minOrderCheck.meetsMinimum) ? premiumDeliveryFee : 0;
    const grandTotalWithFee = discount.finalAmount + deliveryFee;
    
    // Update shipping row (Standard Delivery only; Pick Up hides it)
    const shippingRow = document.getElementById('shippingRow');
    const shippingValue = document.getElementById('shippingValue');
    if (shippingRow && shippingValue) {
        if (isStandardDelivery) {
            shippingRow.style.display = '';
            shippingValue.textContent = deliveryFee > 0 ? formatPrice(deliveryFee) : 'Free';
            shippingValue.className = deliveryFee > 0 ? '' : 'text-success';
        } else {
            shippingRow.style.display = 'none';
        }
    }
    
    if (grandTotalEl) {
        grandTotalEl.textContent = formatPrice(grandTotalWithFee);
    }
    
    // Total Weight row: only show when minimum order weight is enabled
    const totalWeightRow = document.getElementById('totalWeightRow');
    const disableMinWeight = settings?.disable_minimum_weight === true || settings?.disable_minimum_weight === '1';
    if (totalWeightRow) {
        totalWeightRow.style.display = disableMinWeight ? 'none' : '';
    }
    if (totalWeightEl) {
        totalWeightEl.textContent = formatWeight(totalWeightKg);
    }
    
    updateMinOrderIndicator(minOrderCheck, totalWeightKg, subtotal, deliveryFee, grandTotalWithFee);
}

// Refresh minimum order settings when cart is loaded or updated
// This ensures we get the latest settings from the server
async function refreshMinOrderSettings() {
    clearMinOrderSettingsCache();
    return await getMinOrderSettings(true);
}

// Get selected delivery method (Standard Delivery | Pick Up). Pick Up has no minimum order.
function getSelectedDeliveryMethod() {
    const hidden = document.getElementById('cartDeliveryMethodValue');
    if (hidden && hidden.value) return hidden.value;
    const saved = sessionStorage.getItem('matarix_delivery_method');
    return (saved === 'Pick Up' || saved === 'Standard Delivery') ? saved : 'Standard Delivery';
}

// Update minimum order indicator (Standard Delivery: always allow checkout; if below min, delivery fee applies)
function updateMinOrderIndicator(minOrderCheck, currentWeight, currentValue, deliveryFee, grandTotalWithFee) {
    const minOrderRow = document.getElementById('minOrderWeightRow');
    const minOrderWeightEl = document.getElementById('minOrderWeight');
    const minOrderProgressRow = document.getElementById('minOrderProgressRow');
    const minOrderProgressBar = document.getElementById('minOrderProgressBar');
    const minOrderProgressText = document.getElementById('minOrderProgressText');
    const minOrderWarning = document.getElementById('minOrderWarning');
    const minOrderWarningText = document.getElementById('minOrderWarningText');
    const checkoutBtn = document.getElementById('checkoutBtn');
    const checkoutDisabledBtn = document.getElementById('checkoutDisabledBtn');
    
    // Pick Up: no minimum order; hide shipping (not applicable); always show checkout button
    if (getSelectedDeliveryMethod() === 'Pick Up') {
        const shippingRow = document.getElementById('shippingRow');
        if (shippingRow) shippingRow.style.display = 'none';
        if (minOrderRow) minOrderRow.style.display = 'none';
        if (minOrderProgressRow) minOrderProgressRow.style.display = 'none';
        if (minOrderWarning) minOrderWarning.style.display = 'none';
        if (checkoutBtn) {
            checkoutBtn.style.display = 'block';
            checkoutBtn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                if (typeof proceedToCheckout === 'function') {
                    proceedToCheckout();
                }
                return false;
            };
        }
        if (checkoutDisabledBtn) checkoutDisabledBtn.style.display = 'none';
        return;
    }
    
    // Hide indicators only when BOTH weight and value minimums are disabled/met
    const hasWeightReq = minOrderCheck && minOrderCheck.minWeight > 0;
    const hasValueReq = minOrderCheck && minOrderCheck.minValue > 0;
    const hasAnyMinReq = hasWeightReq || hasValueReq;
    
    // Standard Delivery: show shipping row
    const shippingRow = document.getElementById('shippingRow');
    if (shippingRow) shippingRow.style.display = '';
    if (!minOrderCheck || !hasAnyMinReq) {
        // No minimum requirements - hide indicators and enable checkout
        if (minOrderRow) minOrderRow.style.display = 'none';
        if (minOrderProgressRow) minOrderProgressRow.style.display = 'none';
        if (minOrderWarning) minOrderWarning.style.display = 'none';
        if (checkoutBtn) {
            checkoutBtn.style.display = 'block';
            checkoutBtn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                if (typeof proceedToCheckout === 'function') {
                    proceedToCheckout();
                }
                return false;
            };
        }
        if (checkoutDisabledBtn) checkoutDisabledBtn.style.display = 'none';
        return;
    }
    
    // Show minimum requirement (weight, value, or both)
    const isValueOnly = !hasWeightReq && hasValueReq;
    const isWeightOnly = hasWeightReq && !hasValueReq;
    const isBoth = hasWeightReq && hasValueReq;
    
    if (minOrderRow) {
        minOrderRow.style.display = 'flex';
        if (minOrderWeightEl) {
            if (isValueOnly) {
                minOrderWeightEl.textContent = '₱' + minOrderCheck.minValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            } else if (isWeightOnly) {
                minOrderWeightEl.textContent = formatWeight(minOrderCheck.minWeight);
            } else {
                minOrderWeightEl.textContent = formatWeight(minOrderCheck.minWeight) + ' or ₱' + minOrderCheck.minValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            }
        }
    }
    
    // Calculate progress: use value when value-only, weight when weight-only, or the better of the two when both
    let progressPercent;
    if (isValueOnly) {
        progressPercent = minOrderCheck.minValue > 0 ? Math.min(100, (currentValue / minOrderCheck.minValue) * 100) : 100;
    } else if (isWeightOnly) {
        progressPercent = minOrderCheck.minWeight > 0 ? Math.min(100, (currentWeight / minOrderCheck.minWeight) * 100) : 100;
    } else {
        const weightPct = minOrderCheck.minWeight > 0 ? (currentWeight / minOrderCheck.minWeight) * 100 : 100;
        const valuePct = minOrderCheck.minValue > 0 ? (currentValue / minOrderCheck.minValue) * 100 : 100;
        progressPercent = Math.min(100, Math.max(weightPct, valuePct));
    }
    
    if (minOrderProgressRow) {
        minOrderProgressRow.style.display = 'block';
        if (minOrderProgressBar) {
            minOrderProgressBar.style.width = progressPercent + '%';
            if (progressPercent >= 100) {
                minOrderProgressBar.style.backgroundColor = '#28a745';
            } else if (progressPercent >= 75) {
                minOrderProgressBar.style.backgroundColor = '#ffc107';
            } else {
                minOrderProgressBar.style.backgroundColor = '#dc3545';
            }
        }
        if (minOrderProgressText) {
            if (minOrderCheck.meetsMinimum) {
                minOrderProgressText.textContent = '✓ Minimum order requirement met!';
                minOrderProgressText.className = 'text-success';
            } else {
                minOrderProgressText.textContent = 'Below minimum — delivery fee will be applied';
                minOrderProgressText.className = 'text-warning';
            }
        }
    }
    
    // Show/hide warning (below min = delivery fee applies; user can still proceed)
    if (minOrderWarning) {
        if (!minOrderCheck.meetsMinimum) {
            minOrderWarning.style.display = 'flex';
            let warningMsg = 'Order is below minimum. ';
            if (hasWeightReq) {
                warningMsg += `Minimum weight is ${formatWeight(minOrderCheck.minWeight)}. `;
            }
            if (hasValueReq) {
                warningMsg += `Minimum value is ₱${minOrderCheck.minValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}. `;
            }
            warningMsg += 'A delivery fee will be applied.';
            if (minOrderWarningText) {
                minOrderWarningText.textContent = warningMsg;
            }
        } else {
            minOrderWarning.style.display = 'none';
        }
    }
    
    // Always enable checkout button for Standard Delivery (below min = delivery fee applies)
    if (checkoutBtn && checkoutDisabledBtn) {
        checkoutBtn.style.display = 'block';
        checkoutDisabledBtn.style.display = 'none';
        checkoutBtn.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (typeof proceedToCheckout === 'function') {
                proceedToCheckout();
            }
            return false;
        };
    }
}

// Clear all cart items
async function clearCart() {
    const cart = window.CartManager.getCart();
    const itemCount = cart.length;
    
    if (itemCount === 0) {
        if (typeof window.Notifications !== 'undefined' && typeof window.Notifications.showToast === 'function') {
            window.Notifications.showToast('Your cart is already empty', 'info', 3000);
        } else {
            alert('Your cart is already empty');
        }
        return;
    }
    
    // Use custom modal if available, otherwise fallback to browser confirm
    let userConfirmed = false;
    
    if (typeof window.Notifications !== 'undefined' && typeof window.Notifications.showConfirmModal === 'function') {
        try {
            userConfirmed = await window.Notifications.showConfirmModal({
                title: 'Clear Cart',
                message: `Are you sure you want to remove all ${itemCount} item(s) from your cart?<br><br><span style="color: #dc3545; font-weight: 600;">This action cannot be undone.</span>`,
                icon: 'warning',
                confirmText: 'Yes, Clear All',
                cancelText: 'Cancel',
                confirmClass: 'btn-danger'
            });
        } catch (error) {
            console.error('Error showing confirmation modal:', error);
            // Fallback to browser confirm
            userConfirmed = confirm(`Are you sure you want to remove all ${itemCount} item(s) from your cart?`);
        }
    } else {
        // Fallback to browser confirm if custom modal not available
        userConfirmed = confirm(`Are you sure you want to remove all ${itemCount} item(s) from your cart?`);
    }
    
    if (userConfirmed) {
        // Ensure modal is closed before proceeding
        if (typeof window.Notifications !== 'undefined' && typeof window.Notifications.closeModal === 'function') {
            window.Notifications.closeModal();
        }
        
        window.CartManager.clearCart();
        loadCartItems();
        
        // Show success message
        if (typeof window.Notifications !== 'undefined' && typeof window.Notifications.showToast === 'function') {
            window.Notifications.showToast('All items removed from cart', 'success', 3000);
        }
    } else {
        // User cancelled - ensure modal is closed
        if (typeof window.Notifications !== 'undefined' && typeof window.Notifications.closeModal === 'function') {
            window.Notifications.closeModal();
        }
    }
}

// Continue shopping
function continueShopping() {
    window.location.href = 'MainPage.html';
}

// Initialize cart on page load
// Initialize: Refresh minimum order settings on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async function() {
        // Handle add to cart from URL first
        if (window.CartManager) {
            window.CartManager.handleAddToCartFromURL();
        }
        initializeDeliveryMethodSelection();
        // Refresh minimum order settings when page loads (this will also update cart summary)
        await refreshMinOrderSettingsOnLoad();
        loadCartItems();
        // Start periodic refresh of settings
        startPeriodicSettingsRefresh();
    });
} else {
    // Handle add to cart from URL first
    if (window.CartManager) {
        window.CartManager.handleAddToCartFromURL();
    }
    initializeDeliveryMethodSelection();
    // Refresh minimum order settings when page is already loaded (this will also update cart summary)
    refreshMinOrderSettingsOnLoad();
    loadCartItems();
    // Start periodic refresh of settings
    startPeriodicSettingsRefresh();
}

// Initialize inline delivery method selection (Cart): restore from sessionStorage, sync with radios
function initializeDeliveryMethodSelection() {
    var saved = sessionStorage.getItem('matarix_delivery_method');
    if (saved === 'Pick Up' || saved === 'Standard Delivery') {
        var hidden = document.getElementById('cartDeliveryMethodValue');
        if (hidden) hidden.value = saved;
        var radio = document.querySelector('input[name="cartDeliveryMethod"][value="' + saved + '"]');
        if (radio) radio.checked = true;
    }
    // Sync inline radio selection with hidden input and sessionStorage; update min-order UI
    document.querySelectorAll('input[name="cartDeliveryMethod"]').forEach(function(radio) {
        radio.addEventListener('change', function() {
            var method = this.value;
            var hidden = document.getElementById('cartDeliveryMethodValue');
            if (hidden) hidden.value = method;
            sessionStorage.setItem('matarix_delivery_method', method);
            updateCartSummaryForCheckedItems(); // Re-run summary to refresh min-order indicator
        });
    });
}

// Validate minimum order for Standard Delivery when proceeding from modal
async function validateMinOrderForCheckout() {
    var checkedItems = getCheckedCartItems();
    var cart = window.CartManager ? window.CartManager.getCart() : [];
    var checkedCartItems = checkedItems.map(function(c) {
        return findCartItemByKey(cart, c.item_key);
    }).filter(function(item) { return item !== undefined; });
    if (checkedCartItems.length === 0) return true;
    var productDetailsMap = new Map();
    var totalWeightKg = 0;
    var totalAmount = 0;
    for (var i = 0; i < checkedCartItems.length; i++) {
        var item = checkedCartItems[i];
        totalAmount += item.price * item.quantity;
        try {
            var product = await getProductDetails(item.product_id);
            if (product) {
                productDetailsMap.set(item.product_id, product);
                if (product.weight) {
                    var weightKg = convertToKg(product.weight, product.weight_unit);
                    totalWeightKg += weightKg * item.quantity;
                }
            }
        } catch (e) { console.error('Error fetching product:', e); }
    }
    var minCheck = await checkMinOrderRequirements(checkedCartItems, productDetailsMap, totalWeightKg, totalAmount);
    if (!minCheck.meetsMinimum) {
        var errMsg = 'Minimum order requirement not met for delivery. ';
        if (minCheck.neededWeight > 0) errMsg += 'Add ' + formatWeight(minCheck.neededWeight) + ' more. ';
        if (minCheck.neededValue > 0) errMsg += 'Or add ₱' + minCheck.neededValue.toLocaleString('en-US', { minimumFractionDigits: 2 }) + ' more.';
        if (typeof window.Notifications !== 'undefined' && window.Notifications.showToast) {
            window.Notifications.showToast(errMsg, 'error', 6000);
        } else {
            alert(errMsg);
        }
        return false;
    }
    return true;
}

// Get all checked cart items
function getCheckedCartItems() {
    const checkboxes = document.querySelectorAll('.cart-item-checkbox:checked');
    const cart = window.CartManager ? window.CartManager.getCart() : [];
    const checkedItems = [];
    
    checkboxes.forEach(checkbox => {
        const itemKey = checkbox.getAttribute('data-item-key');
        const cartItem = findCartItemByKey(cart, itemKey);
        if (cartItem) {
            checkedItems.push({
                item_key: itemKey,
                product_id: cartItem.product_id,
                quantity: cartItem.quantity,
                price: cartItem.price,
                variations: cartItem.variations || null
            });
        }
    });
    
    return checkedItems;
}

// Find cart item by item key
function findCartItemByKey(cart, itemKey) {
    const itemKeyStr = String(itemKey);
    
    if (itemKeyStr.includes('_')) {
        const parts = itemKeyStr.split('_');
        const productId = parseInt(parts[0]);
        const variationKeyB64 = parts.slice(1).join('_');
        
        return cart.find(item => {
            if (item.product_id !== productId) return false;
            const itemVariationKey = item.variations && Object.keys(item.variations).length > 0
                ? btoa(JSON.stringify(item.variations)).replace(/[^a-zA-Z0-9]/g, '')
                : '';
            return itemVariationKey === variationKeyB64;
        });
    } else {
        const productId = parseInt(itemKeyStr);
        return cart.find(item => 
            item.product_id === productId && 
            (!item.variations || Object.keys(item.variations).length === 0)
        );
    }
}

// Handle individual item checkbox change
function handleItemCheckboxChange(checkbox) {
    updateSelectAllCheckbox();
    updateDeleteSelectedButton();
    updateCartSummaryForCheckedItems();
}

// Update "Select All" checkbox state
function updateSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    if (!selectAllCheckbox) return;
    
    const allCheckboxes = document.querySelectorAll('.cart-item-checkbox');
    const checkedCheckboxes = document.querySelectorAll('.cart-item-checkbox:checked');
    
    if (allCheckboxes.length === 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
        return;
    }
    
    if (checkedCheckboxes.length === 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
    } else if (checkedCheckboxes.length === allCheckboxes.length) {
        selectAllCheckbox.checked = true;
        selectAllCheckbox.indeterminate = false;
    } else {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = true;
    }
}

// Handle "Select All" checkbox change
function handleSelectAllChange(checkbox) {
    const isChecked = checkbox.checked;
    const itemCheckboxes = document.querySelectorAll('.cart-item-checkbox');
    
    itemCheckboxes.forEach(itemCheckbox => {
        itemCheckbox.checked = isChecked;
    });
    
    updateDeleteSelectedButton();
    updateCartSummaryForCheckedItems();
}

// Update "Delete Selected" button visibility
function updateDeleteSelectedButton() {
    const deleteBtn = document.getElementById('deleteSelectedBtn');
    const checkedCount = document.querySelectorAll('.cart-item-checkbox:checked').length;
    
    if (deleteBtn) {
        if (checkedCount > 0) {
            deleteBtn.style.display = 'inline-block';
            deleteBtn.innerHTML = `<i class="fas fa-trash"></i> Delete Selected (${checkedCount})`;
        } else {
            deleteBtn.style.display = 'none';
        }
    }
}

// Delete selected items
async function deleteSelectedItems() {
    const checkedItems = getCheckedCartItems();
    
    if (checkedItems.length === 0) {
        if (typeof window.Notifications !== 'undefined' && typeof window.Notifications.showToast === 'function') {
            window.Notifications.showToast('Please select items to delete', 'warning', 3000);
        } else {
            alert('Please select items to delete.');
        }
        return;
    }
    
    // Use custom modal if available, otherwise fallback to browser confirm
    let userConfirmed = false;
    const itemCount = checkedItems.length;
    const itemNames = checkedItems.map(item => item.product_name || 'item').slice(0, 3);
    let message = `Are you sure you want to remove ${itemCount} item(s) from your cart?`;
    
    if (itemNames.length > 0 && itemNames.length <= 3) {
        message += '<div style="margin-top: 8px; font-size: 14px; color: #666;">';
        message += itemNames.join(', ');
        if (itemCount > 3) {
            message += ` and ${itemCount - 3} more`;
        }
        message += '</div>';
    }
    
    if (typeof window.Notifications !== 'undefined' && typeof window.Notifications.showConfirmModal === 'function') {
        try {
            userConfirmed = await window.Notifications.showConfirmModal({
                title: 'Delete Selected Items',
                message: message,
                icon: 'warning',
                confirmText: 'Yes, Delete',
                cancelText: 'Cancel',
                confirmClass: 'btn-danger'
            });
        } catch (error) {
            console.error('Error showing confirmation modal:', error);
            // Fallback to browser confirm
            userConfirmed = confirm(message.replace(/<[^>]*>/g, ''));
        }
    } else {
        // Fallback to browser confirm if custom modal not available
        userConfirmed = confirm(message.replace(/<[^>]*>/g, ''));
    }
    
    if (!userConfirmed) {
        // User cancelled - ensure modal is closed
        if (typeof window.Notifications !== 'undefined' && typeof window.Notifications.closeModal === 'function') {
            window.Notifications.closeModal();
        }
        return;
    }
    
    // Ensure modal is closed before proceeding
    if (typeof window.Notifications !== 'undefined' && typeof window.Notifications.closeModal === 'function') {
        window.Notifications.closeModal();
    }
    
    const cart = window.CartManager ? window.CartManager.getCart() : [];
    const itemKeysToDelete = checkedItems.map(item => item.item_key);
    
    // Remove items from cart
    const updatedCart = cart.filter(item => {
        const itemKey = item.variations && Object.keys(item.variations).length > 0
            ? `${item.product_id}_${btoa(JSON.stringify(item.variations)).replace(/[^a-zA-Z0-9]/g, '')}`
            : String(item.product_id);
        return !itemKeysToDelete.includes(itemKey);
    });
    
    window.CartManager.saveCart(updatedCart);
    loadCartItems(); // Reload to update display
    
    // Show success message
    if (typeof window.Notifications !== 'undefined' && typeof window.Notifications.showToast === 'function') {
        window.Notifications.showToast(`${itemCount} item(s) removed from cart`, 'success', 3000);
    }
}

// Update cart summary to only include checked items
async function updateCartSummaryForCheckedItems() {
    const checkedItems = getCheckedCartItems();
    
    if (checkedItems.length === 0) {
        // If no items checked, show zero totals
        const subtotalEl = document.getElementById('subtotal');
        const grandTotalEl = document.getElementById('grandTotal');
        const totalWeightEl = document.getElementById('totalWeight');
        
        if (subtotalEl) subtotalEl.textContent = formatPrice(0);
        if (grandTotalEl) grandTotalEl.textContent = formatPrice(0);
        if (totalWeightEl) totalWeightEl.textContent = formatWeight(0);
        
        // Hide minimum order indicators
        const minOrderRow = document.getElementById('minOrderWeightRow');
        const minOrderProgressRow = document.getElementById('minOrderProgressRow');
        const minOrderWarning = document.getElementById('minOrderWarning');
        const checkoutBtn = document.getElementById('checkoutBtn');
        const checkoutDisabledBtn = document.getElementById('checkoutDisabledBtn');
        
        if (minOrderRow) minOrderRow.style.display = 'none';
        if (minOrderProgressRow) minOrderProgressRow.style.display = 'none';
        if (minOrderWarning) minOrderWarning.style.display = 'none';
        if (checkoutBtn) {
            checkoutBtn.style.display = 'block';
            // Ensure onclick handler is set
            checkoutBtn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                if (typeof proceedToCheckout === 'function') {
                    proceedToCheckout();
                }
                return false;
            };
        }
        if (checkoutDisabledBtn) checkoutDisabledBtn.style.display = 'none';
        
        return;
    }
    
    // Convert checked items to cart format for summary calculation
    const cart = window.CartManager ? window.CartManager.getCart() : [];
    const checkedCartItems = checkedItems.map(checkedItem => {
        return findCartItemByKey(cart, checkedItem.item_key);
    }).filter(item => item !== undefined);
    
    // Fetch product details for weight calculation
    const productDetailsMap = new Map();
    for (const item of checkedCartItems) {
        try {
            const productDetails = await getProductDetails(item.product_id);
            if (productDetails) {
                productDetailsMap.set(item.product_id, productDetails);
            }
        } catch (error) {
            console.error(`Error fetching product details for ${item.product_id}:`, error);
        }
    }
    
    // Update summary with checked items only
    await updateCartSummary(checkedCartItems, productDetailsMap);
}

// Proceed to checkout using selected delivery method (inline selection on Cart)
// Standard Delivery: always allowed; if below min, delivery fee is applied (stored for Checkout)
async function proceedToCheckout() {
    const checkedItems = getCheckedCartItems();
    if (checkedItems.length === 0) {
        if (typeof window.Notifications !== 'undefined' && typeof window.Notifications.showToast === 'function') {
            window.Notifications.showToast('Please select at least one item to checkout.', 'warning', 3000);
        } else {
            alert('Please select at least one item to checkout.');
        }
        return;
    }
    var deliveryMethod = getSelectedDeliveryMethod();
    var deliveryFee = 0;
    if (deliveryMethod === 'Standard Delivery') {
        var cart = window.CartManager ? window.CartManager.getCart() : [];
        var checkedCartItems = checkedItems.map(function(c) { return findCartItemByKey(cart, c.item_key); }).filter(function(i) { return i; });
        var productDetailsMap = new Map();
        var totalWeightKg = 0, totalAmount = 0;
        for (var i = 0; i < checkedCartItems.length; i++) {
            var item = checkedCartItems[i];
            totalAmount += item.price * item.quantity;
            try {
                var pd = await getProductDetails(item.product_id);
                if (pd) {
                    productDetailsMap.set(item.product_id, pd);
                    if (pd.weight) totalWeightKg += convertToKg(pd.weight, pd.weight_unit) * item.quantity;
                }
            } catch (e) {}
        }
        var minCheck = await checkMinOrderRequirements(checkedCartItems, productDetailsMap, totalWeightKg, totalAmount);
        var settings = await getMinOrderSettings(false);
        var premiumFee = parseFloat(settings?.premium_delivery_fee ?? 500) || 500;
        if (!minCheck.meetsMinimum) deliveryFee = premiumFee;
    }
    sessionStorage.setItem('matarix_delivery_fee', String(deliveryFee));
    proceedToCheckoutWithSelection();
}

// Proceed to checkout with only checked items (called after delivery method is selected from modal)
function proceedToCheckoutWithSelection() {
    const checkedItems = getCheckedCartItems();
    if (checkedItems.length === 0) return;
    
    const deliveryMethod = getSelectedDeliveryMethod();
    sessionStorage.setItem('matarix_checked_cart_items', JSON.stringify(checkedItems));
    sessionStorage.setItem('matarix_delivery_method', deliveryMethod);
    window.location.href = 'Checkout.html';
}

// Initialize checkbox event listeners
function initializeCartCheckboxes() {
    // Set up "Select All" checkbox
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    if (selectAllCheckbox) {
        selectAllCheckbox.onchange = function() {
            handleSelectAllChange(this);
        };
        // Set initial state to checked (since all items are checked by default)
        selectAllCheckbox.checked = true;
    }
    
    // All items are checked by default, so update state
    updateSelectAllCheckbox();
    updateDeleteSelectedButton();
    updateCartSummaryForCheckedItems();
}

// Export functions for global access
window.updateCartItemQuantity = updateCartItemQuantity;
window.removeCartItem = removeCartItem;
window.clearCart = clearCart;
window.continueShopping = continueShopping;
window.loadCartItems = loadCartItems;
window.handleItemCheckboxChange = handleItemCheckboxChange;
window.deleteSelectedItems = deleteSelectedItems;
window.proceedToCheckoutWithSelection = proceedToCheckoutWithSelection;
window.proceedToCheckout = proceedToCheckout;
window.getCheckedCartItems = getCheckedCartItems;

