/**
 * MATARIX Search System
 * Shows suggestions while typing, filters only on submit
 */

// ========== SEARCH FUNCTIONALITY ==========

// Show search suggestions without filtering
function showSearchSuggestions(query) {
    const searchTerm = query.toLowerCase().trim();
    
    if (!searchTerm) {
        hideSuggestions();
        return;
    }
    
    // Get all unique product titles and categories
    const suggestions = new Set();
    const productCards = document.querySelectorAll('.product-card');
    
    productCards.forEach(card => {
        const title = card.querySelector('.product-title')?.textContent || '';
        const categorySection = card.closest('.category-products-section');
        const category = categorySection?.querySelector('.category-products-title')?.textContent.trim() || '';
        
        // Add matching product titles
        if (title.toLowerCase().includes(searchTerm)) {
            suggestions.add(title);
        }
        
        // Add matching categories
        if (category.toLowerCase().includes(searchTerm)) {
            const categoryName = category.replace(/\s+/g, ' ').trim();
            suggestions.add(categoryName);
        }
    });
    
    displaySuggestions(Array.from(suggestions).slice(0, 8), searchTerm);
}

function displaySuggestions(suggestions, searchTerm) {
    hideSuggestions();
    
    if (suggestions.length === 0) return;
    
    const searchContainer = document.querySelector('.search-container');
    const suggestionsBox = document.createElement('div');
    suggestionsBox.id = 'search-suggestions';
    suggestionsBox.className = 'search-suggestions-box';
    
    suggestions.forEach(suggestion => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        
        const regex = new RegExp(`(${searchTerm})`, 'gi');
        item.innerHTML = suggestion.replace(regex, '<strong>$1</strong>');
        
        item.addEventListener('click', function() {
            const searchInput = document.querySelector('.search-input');
            searchInput.value = suggestion;
            filterProducts(suggestion);
            hideSuggestions();
        });
        
        suggestionsBox.appendChild(item);
    });
    
    searchContainer.appendChild(suggestionsBox);
    addSuggestionsStyles();
}

function hideSuggestions() {
    const suggestionsBox = document.getElementById('search-suggestions');
    if (suggestionsBox) {
        suggestionsBox.remove();
    }
}

function filterProducts(query) {
    const searchTerm = query.toLowerCase().trim();
    
    if (!searchTerm) {
        showAllProducts();
        return;
    }
    
    const productCards = document.querySelectorAll('.product-card');
    let visibleCount = 0;
    
    productCards.forEach(card => {
        const productColumn = card.closest('.col-lg-3, .col-md-6, .col-sm-6');
        const title = card.querySelector('.product-title')?.textContent.toLowerCase() || '';
        const categorySection = card.closest('.category-products-section');
        const category = categorySection?.querySelector('.category-products-title')?.textContent.toLowerCase() || '';
        
        const matches = title.includes(searchTerm) || category.includes(searchTerm);
        
        if (matches) {
            productColumn.style.display = 'block';
            visibleCount++;
        } else {
            productColumn.style.display = 'none';
        }
    });
    
    updateCategorySections();
    showNoResultsMessage(visibleCount, searchTerm);
    
    if (visibleCount > 0) {
        setTimeout(() => {
            const productsSection = document.getElementById('products');
            if (productsSection) {
                productsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 100);
    }
}

function showAllProducts() {
    const productColumns = document.querySelectorAll('.category-products-section .col-lg-3, .category-products-section .col-md-6, .category-products-section .col-sm-6');
    productColumns.forEach(col => {
        col.style.display = 'block';
    });
    
    const categorySections = document.querySelectorAll('.category-products-section');
    categorySections.forEach(section => {
        section.style.display = 'block';
    });
    
    const noResultsMsg = document.getElementById('no-results-message');
    if (noResultsMsg) {
        noResultsMsg.remove();
    }
}

function updateCategorySections() {
    const categorySections = document.querySelectorAll('.category-products-section');
    
    categorySections.forEach(section => {
        const allProducts = section.querySelectorAll('.col-lg-3, .col-md-6, .col-sm-6');
        const visibleProducts = Array.from(allProducts).filter(col => 
            col.style.display !== 'none'
        );
        
        section.style.display = visibleProducts.length > 0 ? 'block' : 'none';
    });
}

function showNoResultsMessage(count, searchTerm) {
    const productsSection = document.getElementById('products');
    let noResultsMsg = document.getElementById('no-results-message');
    
    if (count === 0) {
        if (!noResultsMsg) {
            noResultsMsg = document.createElement('div');
            noResultsMsg.id = 'no-results-message';
            noResultsMsg.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; background: white; border-radius: 12px; margin-bottom: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <i class="fas fa-search" style="font-size: 64px; color: #ccc; margin-bottom: 20px;"></i>
                    <h3 style="color: #666; margin-bottom: 10px;">No products found</h3>
                    <p style="color: #999;">No results for "<strong>${searchTerm}</strong>". Try a different search term.</p>
                    <button onclick="clearSearch()" class="btn btn-primary-red" style="margin-top: 20px; background: #940909; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer;">
                        <i class="fas fa-redo"></i> Clear Search
                    </button>
                </div>
            `;
            const firstCategory = productsSection.querySelector('.category-products-section');
            if (firstCategory) {
                firstCategory.parentNode.insertBefore(noResultsMsg, firstCategory);
            }
        }
    } else {
        if (noResultsMsg) {
            noResultsMsg.remove();
        }
    }
}

function clearSearch() {
    const searchInput = document.querySelector('.search-input');
    if (searchInput) {
        searchInput.value = '';
    }
    hideSuggestions();
    showAllProducts();
}

function handleSearchSubmit(event) {
    event.preventDefault();
    const searchInput = event.target.querySelector('.search-input');
    const query = searchInput?.value || '';
    hideSuggestions();
    filterProducts(query);
}

function addSuggestionsStyles() {
    const styleId = 'search-suggestions-styles';
    
    if (document.getElementById(styleId)) {
        return;
    }
    
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        .search-suggestions-box {
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: white;
            border: 1px solid #ddd;
            border-top: none;
            border-radius: 0 0 4px 4px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            max-height: 300px;
            overflow-y: auto;
            z-index: 1000;
            margin-top: 0;
        }
        
        .suggestion-item {
            padding: 12px 15px;
            cursor: pointer;
            border-bottom: 1px solid #f0f0f0;
            font-family: 'Montserrat', sans-serif;
            font-size: 0.9rem;
            color: #333;
            transition: background-color 0.2s ease;
        }
        
        .suggestion-item:last-child {
            border-bottom: none;
        }
        
        .suggestion-item:hover {
            background-color: #f8f9fa;
        }
        
        .suggestion-item strong {
            color: #940909;
            font-weight: 600;
        }
    `;
    
    document.head.appendChild(style);
}

// ========== CART FUNCTIONALITY FOR QUOTE PAGE ==========

let quoteCart = [];

// Add +/- controls to each product card
function addProductControls() {
    const productCards = document.querySelectorAll('.product-card');
    
    productCards.forEach(card => {
        // Skip if controls already added
        if (card.querySelector('.product-add-controls')) return;
        
        const productName = card.querySelector('.product-title').textContent;
        const priceText = card.querySelector('.product-price').textContent;
        const price = parseFloat(priceText.replace('₱', '').replace(',', '').split('-')[0]);
        
        const controls = document.createElement('div');
        controls.className = 'product-add-controls';
        controls.innerHTML = `
            <button class="product-qty-btn" onclick="event.stopPropagation(); updateProductQty('${escapeHtml(productName)}', -1)">-</button>
            <span class="product-qty-display" id="qty-${productName.replace(/[^a-zA-Z0-9]/g, '')}">0</span>
            <button class="product-qty-btn" onclick="event.stopPropagation(); updateProductQty('${escapeHtml(productName)}', 1)">+</button>
        `;
        
        card.appendChild(controls);
    });
}

// Escape HTML helper function
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Select variation for a product
function selectVariation(button, productId, variationName) {
    // Find all variation buttons for this product and variation type
    const card = button.closest('.product-card');
    const variationButtons = card.querySelectorAll(`.variation-btn[data-product-id="${productId}"][data-variation-name="${variationName}"]`);
    
    // Remove active class from all buttons in this variation group
    variationButtons.forEach(btn => {
        btn.classList.remove('active');
        btn.style.background = '#fff';
        btn.style.color = '#333';
    });
    
    // Add active class to clicked button
    button.classList.add('active');
    button.style.background = '#dc3545';
    button.style.color = '#fff';
}

// Make selectVariation globally available
window.selectVariation = selectVariation;

// Update product quantity from product card
function updateProductQty(productName, change) {
    const card = Array.from(document.querySelectorAll('.product-card')).find(c => 
        c.querySelector('.product-title').textContent === productName
    );
    
    if (!card) return;
    
    const productId = card.getAttribute('data-product-id');
    const priceText = card.querySelector('.product-price').textContent;
    const price = parseFloat(priceText.replace('₱', '').replace(',', '').split('-')[0]);
    const imageSrc = card.querySelector('.product-image').src;
    
    // Get selected variations
    const selectedVariations = {};
    const variationButtons = card.querySelectorAll('.variation-btn.active');
    variationButtons.forEach(btn => {
        const variationName = btn.getAttribute('data-variation-name');
        const variationValue = btn.getAttribute('data-variation-value');
        const variationId = btn.getAttribute('data-variation-id');
        if (variationName && variationValue) {
            selectedVariations[variationName] = {
                variation_id: variationId,
                variation_value: variationValue
            };
        }
    });
    
    // Create a unique key for cart items (product name + variations)
    const variationKey = Object.keys(selectedVariations).length > 0 
        ? Object.values(selectedVariations).map(v => v.variation_value).join(', ')
        : '';
    const cartItemKey = variationKey ? `${productName} (${variationKey})` : productName;
    
    const existingItem = quoteCart.find(item => item.key === cartItemKey);
    
    if (existingItem) {
        existingItem.quantity += change;
        if (existingItem.quantity <= 0) {
            quoteCart = quoteCart.filter(item => item.key !== cartItemKey);
        }
    } else if (change > 0) {
        quoteCart.push({
            key: cartItemKey,
            name: productName,
            product_id: productId,
            price: price,
            quantity: 1,
            image: imageSrc,
            variations: Object.keys(selectedVariations).length > 0 ? selectedVariations : null
        });
    }
    
    updateAllDisplays();
}

// Update quantity from cart
function updateQuantity(cartItemKey, change) {
    const item = quoteCart.find(item => item.key === cartItemKey);
    if (item) {
        item.quantity += change;
        if (item.quantity <= 0) {
            quoteCart = quoteCart.filter(i => i.key !== cartItemKey);
        }
        updateAllDisplays();
    }
}

// Remove item from cart
function removeFromQuoteCart(cartItemKey) {
    quoteCart = quoteCart.filter(item => item.key !== cartItemKey);
    updateAllDisplays();
}

// Update all displays (cart + product cards)
function updateAllDisplays() {
    updateQuoteCartDisplay();
    updateProductCardQuantities();
}

// Update product card quantity displays
function updateProductCardQuantities() {
    const productCards = document.querySelectorAll('.product-card');
    
    productCards.forEach(card => {
        const productName = card.querySelector('.product-title').textContent;
        const productId = card.getAttribute('data-product-id');
        const qtyDisplay = card.querySelector('.product-qty-display');
        
        if (qtyDisplay) {
            // Get selected variations for this card
            const selectedVariations = {};
            const variationButtons = card.querySelectorAll('.variation-btn.active');
            variationButtons.forEach(btn => {
                const variationName = btn.getAttribute('data-variation-name');
                const variationValue = btn.getAttribute('data-variation-value');
                if (variationName && variationValue) {
                    selectedVariations[variationName] = {
                        variation_value: variationValue
                    };
                }
            });
            
            // Create key to match cart items
            const variationKey = Object.keys(selectedVariations).length > 0 
                ? Object.values(selectedVariations).map(v => v.variation_value).join(', ')
                : '';
            const cartItemKey = variationKey ? `${productName} (${variationKey})` : productName;
            
            const cartItem = quoteCart.find(item => item.key === cartItemKey);
            qtyDisplay.textContent = cartItem ? cartItem.quantity : 0;
        }
    });
}

// Update cart display
function updateQuoteCartDisplay() {
    const container = document.getElementById('cartItemsContainer');
    
    if (!container) return;
    
    if (quoteCart.length === 0) {
        container.innerHTML = `
            <div class="empty-cart-message">
                <i class="fas fa-shopping-basket"></i>
                <p>No items selected yet. Click the + button on products above to add them to your quotation request.</p>
            </div>
        `;
        updateTotals(0, 0);
        return;
    }
    
    let cartHTML = '';
    let subtotal = 0;
    
    quoteCart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        subtotal += itemTotal;
        
        // Build variation display string
        let variationText = '';
        if (item.variations && Object.keys(item.variations).length > 0) {
            const variationParts = Object.entries(item.variations).map(([name, data]) => {
                return `${name}: ${data.variation_value}`;
            });
            variationText = `<div class="cart-item-variation" style="font-size: 0.85rem; color: #666; margin-top: 3px;">${variationParts.join(', ')}</div>`;
        }
        
        cartHTML += `
            <div class="cart-item">
                <img src="${item.image}" alt="${item.name}" class="cart-item-image">
                <div class="cart-item-details">
                    <div class="cart-item-name">${item.name}</div>
                    ${variationText}
                    <div class="cart-item-price">₱${item.price.toFixed(2)} each</div>
                </div>
                <div class="cart-item-quantity">
                    <button class="qty-btn" onclick="updateQuantity('${escapeHtml(item.key)}', -1)">-</button>
                    <span class="qty-display">${item.quantity}</span>
                    <button class="qty-btn" onclick="updateQuantity('${escapeHtml(item.key)}', 1)">+</button>
                </div>
                <div class="cart-item-total">₱${itemTotal.toFixed(2)}</div>
                <button class="remove-item-btn" onclick="removeFromQuoteCart('${escapeHtml(item.key)}')">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
    });
    
    container.innerHTML = cartHTML;
    
    // Total is same as subtotal (NO TAX - explicitly set to subtotal only)
    // Do NOT add any tax or additional fees
    const total = subtotal;
    
    // Verify total equals subtotal (no tax added)
    if (total !== subtotal) {
        console.error('ERROR: Total should equal subtotal (no tax)');
    }
    
    updateTotals(subtotal, total);
    
    // Show/hide download button based on cart items
    const downloadBtn = document.getElementById('downloadQuotationBtn');
    if (downloadBtn) {
        if (quoteCart.length > 0) {
            downloadBtn.style.display = 'inline-block';
        } else {
            downloadBtn.style.display = 'none';
        }
    }
}

// Update totals display
// IMPORTANT: Total must equal subtotal (NO TAX)
function updateTotals(subtotal, total) {
    const subtotalEl = document.querySelector('.cart-subtotal');
    const totalEl = document.querySelector('.cart-total');
    
    // Ensure total equals subtotal (no tax)
    const finalTotal = subtotal; // Explicitly set to subtotal, ignore any tax
    
    if (subtotalEl) subtotalEl.textContent = `₱${subtotal.toFixed(2)}`;
    if (totalEl) {
        // Force total to equal subtotal (no tax calculation)
        totalEl.textContent = `₱${finalTotal.toFixed(2)}`;
    }
}

// ========== INITIALIZATION ==========

document.addEventListener('DOMContentLoaded', function() {
    console.log('MATARIX System Initialized');
    
    // Setup search functionality
    const searchForm = document.querySelector('.search-container form');
    if (searchForm) {
        searchForm.addEventListener('submit', handleSearchSubmit);
        
        const searchInput = searchForm.querySelector('.search-input');
        if (searchInput) {
            searchInput.addEventListener('input', function() {
                const query = this.value;
                
                if (query.trim() === '') {
                    hideSuggestions();
                    showAllProducts();
                } else {
                    showSearchSuggestions(query);
                }
            });
            
            document.addEventListener('click', function(e) {
                if (!e.target.closest('.search-container')) {
                    hideSuggestions();
                }
            });
        }
    }
    
    // Check if we're on the quote page by looking for cart summary section
    const isQuotePage = document.querySelector('.cart-summary-section') !== null;
    
    if (isQuotePage) {
        addProductControls();
        console.log('Quote page - cart controls added');
    } else {
        console.log('Not quote page - cart controls skipped');
    }
    
    console.log('System ready');
});

// Download Quotation PDF
async function downloadQuotationPDF() {
    if (!quoteCart || quoteCart.length === 0) {
        if (typeof window.Notifications !== 'undefined') {
            window.Notifications.showToast('No items in quotation cart. Please add items first.', 'warning', 4000);
        } else {
            alert('No items in quotation cart. Please add items first.');
        }
        return;
    }
    
    const downloadBtn = document.getElementById('downloadQuotationBtn');
    const originalText = downloadBtn ? downloadBtn.innerHTML : '';
    
    // Disable button and show loading
    if (downloadBtn) {
        downloadBtn.disabled = true;
        downloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Generating PDF...';
    }
    
    try {
        // Prepare cart items data
        const cartData = quoteCart.map(item => ({
            name: item.name || 'Product',
            product_id: item.product_id || 0,
            price: parseFloat(item.price) || 0,
            quantity: parseInt(item.quantity) || 1,
            image: item.image || '',
            variations: item.variations || null
        }));
        
        // Send request to generate PDF
        const response = await fetch('../api/generate_quotation_pdf.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                cart_items: cartData
            })
        });
        
        // Check if response is PDF
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/pdf')) {
            // Get PDF blob
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `MATARIX_Quotation_${new Date().toISOString().slice(0, 10)}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            if (typeof window.Notifications !== 'undefined') {
                window.Notifications.showToast('Quotation PDF downloaded successfully!', 'success', 3000);
            }
        } else {
            // Handle JSON error response
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to generate PDF');
        }
    } catch (error) {
        console.error('Error generating PDF:', error);
        if (typeof window.Notifications !== 'undefined') {
            window.Notifications.showToast('Failed to generate PDF: ' + error.message, 'error', 5000);
        } else {
            alert('Failed to generate PDF: ' + error.message);
        }
    } finally {
        // Restore button
        if (downloadBtn) {
            downloadBtn.disabled = false;
            downloadBtn.innerHTML = originalText || '<i class="fas fa-file-pdf mr-2"></i>Download Quotation PDF';
        }
    }
}

// Setup download button event listener
document.addEventListener('DOMContentLoaded', function() {
    const downloadBtn = document.getElementById('downloadQuotationBtn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', downloadQuotationPDF);
    }
});

// Export functions for global access
window.clearSearch = clearSearch;
window.updateQuantity = updateQuantity;
window.removeFromQuoteCart = removeFromQuoteCart;
window.updateProductQty = updateProductQty;
window.downloadQuotationPDF = downloadQuotationPDF;