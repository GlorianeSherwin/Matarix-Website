/**
 * Load Checkout Data
 * Loads cart items and customer details into the checkout page
 */

// Format price
function formatPrice(price) {
    return '₱' + parseFloat(price).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// Fetch order settings (same source as Cart - ensures delivery fee matches)
async function getCheckoutOrderSettings() {
    try {
        const response = await fetch('../api/get_order_settings.php?t=' + Date.now(), { credentials: 'include' });
        const data = await response.json();
        if (data.success && data.settings) return data.settings;
    } catch (e) {
        console.error('Checkout: Error fetching order settings', e);
    }
    return {
        min_order_weight_kg: 200,
        min_order_value: 0,
        disable_minimum_weight: false,
        disable_minimum_order_value: false,
        premium_delivery_fee: 500,
        allow_heavy_single_items: true
    };
}

// Convert weight to kg (match Cart logic)
function checkoutWeightToKg(weight, unit) {
    if (weight == null || isNaN(parseFloat(weight))) return 0;
    const w = parseFloat(weight);
    const u = (unit || '').toString().toLowerCase();
    if (u === 'kg' || u === 'kilo' || u === '') return w;
    if (u === 'g' || u === 'gram') return w / 1000;
    if (u === 'lb' || u === 'lbs') return w * 0.453592;
    if (u === 'oz') return w * 0.0283495;
    if (u === 'ton') return w * 1000;
    return w;
}

// Check if order meets minimum (same logic as Cart - value OR weight, single heavy item)
function checkCheckoutMinOrder(settings, cartItems, productDetailsMap, totalWeightKg, subtotal) {
    const disableMinWeight = settings.disable_minimum_weight === true || settings.disable_minimum_weight === '1';
    const disableMinValue = settings.disable_minimum_order_value === true || settings.disable_minimum_order_value === '1';
    const minWeight = disableMinWeight ? 0 : (parseFloat(settings.min_order_weight_kg) || 0);
    const minValue = disableMinValue ? 0 : (parseFloat(settings.min_order_value) || 0);
    const allowHeavySingle = settings.allow_heavy_single_items !== false;
    if (disableMinWeight && disableMinValue) {
        return { meetsMinimum: true };
    }
    if (!disableMinWeight && allowHeavySingle && cartItems.length === 1) {
        const item = cartItems[0];
        const pd = productDetailsMap.get(item.product_id);
        if (pd && pd.weight) {
            const itemKg = checkoutWeightToKg(pd.weight, pd.weight_unit) * (item.quantity || 1);
            if (itemKg >= minWeight) return { meetsMinimum: true };
        }
    }
    const weightOk = minWeight <= 0 || totalWeightKg >= minWeight;
    const valueOk = minValue <= 0 || subtotal >= minValue;
    const meetsMinimum = (minWeight > 0 && totalWeightKg >= minWeight) || (minValue > 0 && subtotal >= minValue);
    return { meetsMinimum: !!meetsMinimum, minWeight, minValue };
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

// Load customer details
async function loadCustomerDetails() {
    try {
        const response = await fetch('../api/get_profile.php', {
            method: 'GET',
            credentials: 'include'
        });
        
        // Check for 401 Unauthorized
        if (response.status === 401) {
            console.error('Authentication failed - redirecting to login');
            alert('Your session has expired. Please log in again.');
            sessionStorage.clear();
            window.location.href = '../Customer/Login.html';
            return;
        }
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.user) {
            const user = data.user;
            const customerName = user.full_name || (user.first_name + ' ' + user.last_name).trim() || 'Customer';
            const customerAddress = user.address || 'No address provided';
            const customerPhone = user.phone_number || 'No phone number';
            
            // Update delivery information
            const nameElement = document.querySelector('.customer-name');
            const addressElement = document.querySelector('.customer-address');
            const phoneElement = document.querySelector('.customer-phone');
            
            if (nameElement) {
                nameElement.textContent = customerName;
            }
            if (addressElement) {
                addressElement.textContent = customerAddress;
            }
            if (phoneElement) {
                phoneElement.innerHTML = `<i class="fas fa-phone mr-2"></i>${customerPhone}`;
            }
        } else {
            // Check if it's an authentication error
            if (data.message && data.message.toLowerCase().includes('not authenticated')) {
                console.error('Authentication failed - redirecting to login');
                alert('Your session has expired. Please log in again.');
                sessionStorage.clear();
                window.location.href = '../Customer/Login.html';
                return;
            }
            
            // Fallback to sessionStorage
            const userName = sessionStorage.getItem('user_name');
            const userEmail = sessionStorage.getItem('user_email');
            
            const nameElement = document.querySelector('.customer-name');
            if (nameElement && userName) {
                nameElement.textContent = userName;
            }
        }
    } catch (error) {
        console.error('Error loading customer details:', error);
        // Fallback to sessionStorage
        const userName = sessionStorage.getItem('user_name');
        const userEmail = sessionStorage.getItem('user_email');
        
        const nameElement = document.querySelector('.customer-name');
        if (nameElement && userName) {
            nameElement.textContent = userName;
        }
    }
}

// Create order item row HTML
function createOrderItemRow(item, productDetails = null) {
    const productName = productDetails ? productDetails.product_name : item.product_name || `Product ${item.product_id}`;
    const productSpecs = productDetails ? 
        (productDetails.length && productDetails.width ? 
            `${productDetails.length}${productDetails.unit || ''} x ${productDetails.width}${productDetails.unit || ''}` : 
            productDetails.category || '') : 
        item.category || '';
    // Use image_path from productDetails, fallback to item.image, then default
    const imagePath = productDetails?.image_path || item.image || null;
    const image = getProductImage(imagePath);
    const price = formatPrice(item.price);
    const total = formatPrice(item.price * item.quantity);
    
    // Build variation display string
    let variationText = '';
    if (item.variations && Object.keys(item.variations).length > 0) {
        const variationParts = Object.entries(item.variations).map(([name, data]) => {
            return `${name}: ${data.variation_value || data}`;
        });
        variationText = `<br><small class="text-muted" style="color: #dc3545 !important; font-weight: 500;">
            <i class="fas fa-tag" style="margin-right: 3px;"></i>${variationParts.join(', ')}
        </small>`;
    }
    
    return `
        <tr>
            <td>
                <div class="d-flex align-items-center">
                    <img src="${image}" alt="${productName}" class="mr-3" style="width: 50px; height: 50px; object-fit: cover; border-radius: 5px;">
                    <div>
                        <h6 class="mb-0">${productName}</h6>
                        <small class="text-muted">${productSpecs}</small>
                        ${variationText}
                    </div>
                </div>
            </td>
            <td class="text-center">${item.quantity}</td>
            <td class="text-center">${price}</td>
            <td class="text-center font-weight-bold">${total}</td>
        </tr>
    `;
}

// Build item_key for a cart item (must match Cart page logic so we filter correctly)
function getItemKeyForCartItem(item) {
    const productId = item.product_id;
    const variations = item.variations || {};
    if (Object.keys(variations).length > 0) {
        const variationKey = JSON.stringify(variations);
        const b64 = typeof btoa !== 'undefined' ? btoa(variationKey).replace(/[^a-zA-Z0-9]/g, '') : '';
        return `${productId}_${b64}`;
    }
    return String(productId);
}

// Load cart items into checkout — use checked items when available; otherwise show cart so checkout works
async function loadCheckoutItems() {
    let checkedItems = [];
    let cart = window.CartManager ? window.CartManager.getCart() : [];
    if (cart.length === 0) {
        try {
            const cartData = localStorage.getItem('matarix_cart');
            if (cartData) cart = JSON.parse(cartData);
        } catch (e) {
            console.error('Error reading cart from localStorage', e);
        }
    }
    // 1) Use sessionStorage first: set when user clicks "Proceed to Checkout" = exact checked list
    try {
        const checkedItemsData = sessionStorage.getItem('matarix_checked_cart_items');
        if (checkedItemsData) {
            const parsed = JSON.parse(checkedItemsData);
            if (Array.isArray(parsed) && parsed.length > 0) checkedItems = parsed;
        }
    } catch (e) {
        console.error('Error reading checked items from sessionStorage', e);
    }
    // 2) If none, use localStorage checked keys to filter cart (Cart checkboxes persisted)
    if (checkedItems.length === 0 && cart.length > 0) {
        try {
            const checkedKeysJson = localStorage.getItem('matarix_checked_item_keys');
            if (checkedKeysJson) {
                const checkedKeys = JSON.parse(checkedKeysJson);
                if (Array.isArray(checkedKeys) && checkedKeys.length > 0) {
                    const keySet = new Set(checkedKeys.map(String));
                    checkedItems = cart
                        .filter(item => keySet.has(getItemKeyForCartItem(item)))
                        .map(item => ({
                            item_key: getItemKeyForCartItem(item),
                            product_id: item.product_id,
                            quantity: item.quantity,
                            price: item.price,
                            variations: item.variations || null
                        }));
                }
            }
        } catch (e) {
            console.warn('Error reading checked item keys from localStorage', e);
        }
    }
    // 3) If still none but cart has items, use full cart so checkout page works (e.g. opened via nav or new tab)
    if (checkedItems.length === 0 && cart.length > 0) {
        checkedItems = cart.map(item => ({
            item_key: getItemKeyForCartItem(item),
            product_id: item.product_id,
            quantity: item.quantity,
            price: item.price,
            variations: item.variations || null
        }));
    }
    
    const tbody = document.querySelector('.table tbody');
    
    if (!tbody) {
        console.error('Order items table body not found');
        return;
    }
    
    if (checkedItems.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center">
                    <p class="text-muted">No items selected for checkout. <a href="Cart.html">Go to cart</a></p>
                </td>
            </tr>
        `;
        await updateOrderSummary([]);
        return;
    }
    
    // Get full cart to get product details
    const fullCart = window.CartManager ? window.CartManager.getCart() : [];
    
    // Clear existing items
    tbody.innerHTML = '';
    
    // Load product details and create rows for checked items only; compute subtotal and totalWeightKg (same as Cart)
    let subtotal = 0;
    let totalWeightKg = 0;
    const productDetailsMap = new Map();
    
    for (const checkedItem of checkedItems) {
        // Find the full item details from cart
        const fullItem = fullCart.find(item => {
            if (item.product_id !== checkedItem.product_id) return false;
            
            // Check variations match
            const itemVariations = item.variations || {};
            const checkedVariations = checkedItem.variations || {};
            
            if (Object.keys(itemVariations).length !== Object.keys(checkedVariations).length) {
                return false;
            }
            
            for (const key in itemVariations) {
                const itemVal = itemVariations[key]?.variation_value || itemVariations[key];
                const checkedVal = checkedVariations[key]?.variation_value || checkedVariations[key];
                if (itemVal !== checkedVal) return false;
            }
            
            return true;
        }) || checkedItem;
        
        const productDetails = await getProductDetails(checkedItem.product_id);
        if (productDetails) {
            productDetailsMap.set(checkedItem.product_id, productDetails);
            if (productDetails.weight != null) {
                totalWeightKg += checkoutWeightToKg(productDetails.weight, productDetails.weight_unit) * (checkedItem.quantity || 1);
            }
        }
        const itemForDisplay = {
            product_id: checkedItem.product_id,
            quantity: checkedItem.quantity,
            price: checkedItem.price,
            variations: checkedItem.variations,
            product_name: fullItem.product_name,
            category: fullItem.category,
            image: fullItem.image
        };
        
        tbody.insertAdjacentHTML('beforeend', createOrderItemRow(itemForDisplay, productDetails));
        subtotal += checkedItem.price * checkedItem.quantity;
    }
    
    // Update order summary with same delivery-fee logic as Cart (aligns shipping and total)
    await updateOrderSummary(checkedItems, subtotal, totalWeightKg, productDetailsMap);
}

// Update order summary (same delivery-fee logic as Cart so shipping and total align)
// Computes delivery fee from get_order_settings + min check instead of only sessionStorage
async function updateOrderSummary(cart, subtotal = 0, totalWeightKg = 0, productDetailsMap = null) {
    const subtotalEl = document.querySelector('.summary-row:first-of-type .summary-value');
    const totalEl = document.querySelector('.total-row .summary-value');
    const deliveryFeeRow = document.getElementById('deliveryFeeRow');
    const deliveryFeeValueEl = deliveryFeeRow ? deliveryFeeRow.querySelector('.summary-value') : null;

    if (cart.length === 0) {
        if (subtotalEl) subtotalEl.textContent = formatPrice(0);
        if (totalEl) totalEl.textContent = formatPrice(0);
        if (deliveryFeeRow) deliveryFeeRow.style.display = 'none';
        sessionStorage.setItem('matarix_delivery_fee', '0');
        return;
    }

    const selectedDeliveryMethod = sessionStorage.getItem('matarix_delivery_method') || 'Standard Delivery';
    let deliveryFee = 0;
    if (selectedDeliveryMethod === 'Standard Delivery') {
        const settings = await getCheckoutOrderSettings();
        const premiumFee = parseFloat(settings.premium_delivery_fee) || 500;
        const productMap = productDetailsMap || new Map();
        const minCheck = checkCheckoutMinOrder(settings, cart, productMap, totalWeightKg, subtotal);
        if (!minCheck.meetsMinimum) {
            deliveryFee = premiumFee;
        }
        sessionStorage.setItem('matarix_delivery_fee', String(deliveryFee));
    } else {
        sessionStorage.setItem('matarix_delivery_fee', '0');
    }

    const total = subtotal + deliveryFee;
    
    // Update subtotal
    if (subtotalEl) subtotalEl.textContent = formatPrice(subtotal);

    // Update delivery fee row
    if (deliveryFeeRow) {
        deliveryFeeRow.style.display = selectedDeliveryMethod === 'Pick Up' ? 'none' : '';
        if (deliveryFeeValueEl) {
            deliveryFeeValueEl.textContent = deliveryFee > 0 ? formatPrice(deliveryFee) : 'Free';
            deliveryFeeValueEl.className = deliveryFee > 0 ? 'summary-value' : 'summary-value text-success';
        }
    }

    // Update total
    if (totalEl) totalEl.textContent = formatPrice(total);
    
    // Update QR code amount if popup exists
    const qrAmount = document.querySelector('.qr-amount');
    if (qrAmount) {
        qrAmount.textContent = formatPrice(total);
    }

    // Update GCash modal amount on Checkout page if present
    if (typeof window.updateGcashModalAmount === 'function') {
        window.updateGcashModalAmount();
    }
}

// Setup edit button
function setupEditButton() {
    const editButton = document.getElementById('editProfileBtn') || document.querySelector('.btn-outline-danger.btn-sm');
    if (editButton) {
        editButton.addEventListener('click', function(e) {
            e.preventDefault();
            // Get user_id from URL or sessionStorage
            const urlParams = new URLSearchParams(window.location.search);
            let userId = sessionStorage.getItem('user_id');
            
            if (!userId) {
                userId = sessionStorage.getItem('user_id');
            }
            
            // Redirect to profile page (session handles auth)
            window.location.href = 'CustomerProfile.html';
        });
    }
}

// Initialize checkout page
async function initCheckout() {
    // Load customer details
    await loadCustomerDetails();
    
    // Load cart items
    await loadCheckoutItems();
    
    // Setup edit button
    setupEditButton();
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        // Wait for CartManager to be available
        if (window.CartManager) {
            initCheckout();
        } else {
            // Wait a bit for CartManager to load
            setTimeout(initCheckout, 100);
        }
    });
} else {
    if (window.CartManager) {
        initCheckout();
    } else {
        setTimeout(initCheckout, 100);
    }
}

