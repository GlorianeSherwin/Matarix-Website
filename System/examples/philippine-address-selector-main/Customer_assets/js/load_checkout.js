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

// Load cart items into checkout
async function loadCheckoutItems() {
    // Get checked items from sessionStorage (set by cart page)
    let checkedItems = [];
    try {
        const checkedItemsData = sessionStorage.getItem('matarix_checked_cart_items');
        if (checkedItemsData) {
            checkedItems = JSON.parse(checkedItemsData);
        }
    } catch (e) {
        console.error('Error reading checked items from sessionStorage:', e);
    }
    
    // If no checked items, fall back to full cart (for backward compatibility)
    let cart = [];
    if (checkedItems.length === 0) {
        cart = window.CartManager ? window.CartManager.getCart() : [];
        
        if (cart.length === 0) {
            try {
                const cartData = localStorage.getItem('matarix_cart');
                if (cartData) {
                    cart = JSON.parse(cartData);
                }
            } catch (e) {
                console.error('Error reading cart from localStorage:', e);
            }
        }
        
        // Convert cart to checked items format
        checkedItems = cart.map(item => ({
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
        updateOrderSummary([]);
        return;
    }
    
    // Get full cart to get product details
    const fullCart = window.CartManager ? window.CartManager.getCart() : [];
    
    // Clear existing items
    tbody.innerHTML = '';
    
    // Load product details and create rows for checked items only
    let subtotal = 0;
    
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
    
    // Update order summary with checked items
    updateOrderSummary(checkedItems, subtotal);
}

// Update order summary (also updates GCash inline amount if that section is visible)
// deliveryFee: from sessionStorage (set by Cart when Standard Delivery + below min)
function updateOrderSummary(cart, subtotal = 0) {
    if (cart.length === 0) {
        document.querySelector('.summary-value').textContent = formatPrice(0);
        const totalValue = document.querySelector('.total-row .summary-value');
        if (totalValue) {
            totalValue.textContent = formatPrice(0);
        }
        const deliveryFeeRow = document.getElementById('deliveryFeeRow');
        if (deliveryFeeRow) deliveryFeeRow.style.display = 'none';
        return;
    }
    
    const selectedDeliveryMethod = sessionStorage.getItem('matarix_delivery_method') || 'Standard Delivery';
    let deliveryFee = 0;
    if (selectedDeliveryMethod === 'Standard Delivery') {
        const storedFee = sessionStorage.getItem('matarix_delivery_fee');
        deliveryFee = parseFloat(storedFee || '0') || 0;
    }
    const total = subtotal + deliveryFee;
    
    // Update subtotal
    const subtotalElement = document.querySelector('.summary-row:first-of-type .summary-value');
    if (subtotalElement) {
        subtotalElement.textContent = formatPrice(subtotal);
    }
    
    // Update delivery fee row
    const deliveryFeeRow = document.getElementById('deliveryFeeRow');
    const deliveryFeeValueEl = deliveryFeeRow ? deliveryFeeRow.querySelector('.summary-value') : null;
    if (deliveryFeeRow) {
        deliveryFeeRow.style.display = selectedDeliveryMethod === 'Pick Up' ? 'none' : '';
        if (deliveryFeeValueEl) {
            deliveryFeeValueEl.textContent = deliveryFee > 0 ? formatPrice(deliveryFee) : 'Free';
            deliveryFeeValueEl.className = deliveryFee > 0 ? 'summary-value' : 'summary-value text-success';
        }
    }
    
    // Update total
    const totalElement = document.querySelector('.total-row .summary-value');
    if (totalElement) {
        totalElement.textContent = formatPrice(total);
    }
    
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

