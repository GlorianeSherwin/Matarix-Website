/**
 * Load Products from Database for Quotation Page
 * Dynamically loads and displays products on the Quotation page
 */

// Default product image (fallback)
const defaultProductImage = '../Customer_assets/images/Slice 15 (2).png';

/**
 * Get product image based on product data
 */
function getProductImage(product) {
    // Use image_path from database if available
    if (product.image_path) {
        return '../' + product.image_path;
    }
    // Fallback to default image
    return defaultProductImage;
}

/**
 * Format price with peso sign
 */
function formatPrice(price) {
    return '₱' + parseFloat(price).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

/**
 * Create product card HTML for quotation page
 */
function createQuotationProductCard(product) {
    const imageUrl = getProductImage(product);
    const price = formatPrice(product.price);
    const productId = product.product_id;
    const hasVariations = product.variations && Object.keys(product.variations).length > 0;
    
    // Build variation selection HTML if product has variations
    let variationHTML = '';
    if (hasVariations) {
        variationHTML = '<div class="product-variations-container" style="margin-top: 10px; padding: 10px; background: #f8f9fa; border-radius: 5px;">';
        
        Object.keys(product.variations).forEach(variationName => {
            const variationValues = product.variations[variationName];
            variationHTML += `<div class="variation-group" style="margin-bottom: 10px;">`;
            variationHTML += `<label style="font-size: 0.85rem; font-weight: 600; display: block; margin-bottom: 5px;">${variationName}:</label>`;
            variationHTML += `<div class="variation-buttons" style="display: flex; flex-wrap: wrap; gap: 5px;">`;
            
            variationValues.forEach((variation, index) => {
                const isFirst = index === 0;
                variationHTML += `
                    <button type="button" 
                            class="variation-btn ${isFirst ? 'active' : ''}" 
                            data-product-id="${productId}"
                            data-variation-name="${variationName}"
                            data-variation-id="${variation.variation_id}"
                            data-variation-value="${variation.variation_value}"
                            style="padding: 5px 10px; font-size: 0.8rem; border: 1px solid #ddd; background: ${isFirst ? '#dc3545' : '#fff'}; color: ${isFirst ? '#fff' : '#333'}; border-radius: 3px; cursor: pointer; transition: all 0.2s;"
                            onmouseover="if(!this.classList.contains('active')) this.style.background='#f0f0f0'"
                            onmouseout="if(!this.classList.contains('active')) this.style.background='#fff'"
                            onclick="selectVariation(this, '${productId}', '${variationName}')">
                        ${variation.variation_value}
                    </button>
                `;
            });
            
            variationHTML += `</div></div>`;
        });
        
        variationHTML += '</div>';
    }
    
    return `
        <div class="col-lg-3 col-md-6 col-sm-6">
            <div class="product-card" data-product-id="${productId}">
                <img src="${imageUrl}" alt="${product.product_name}" class="product-image">
                <div class="product-name product-title">${product.product_name}</div>
                <div class="product-price">${price}</div>
                ${variationHTML}
            </div>
        </div>
    `;
}

/**
 * Get or create category section container
 */
function getCategorySectionContainer(category) {
    const productsContainer = document.getElementById('products');
    if (!productsContainer) return null;
    
    // Check if section already exists
    const existingSection = Array.from(productsContainer.querySelectorAll('.category-products-section')).find(section => {
        const titleElement = section.querySelector('.category-products-title');
        return titleElement && titleElement.textContent.trim() === category;
    });
    
    if (existingSection) {
        const productsGrid = existingSection.querySelector('.products-grid');
        return productsGrid || existingSection;
    }
    
    // Create new section
    const section = document.createElement('div');
    section.className = 'product-section category-products-section';
    section.innerHTML = `
        <div class="section-title category-products-title">${category}</div>
        <div class="products-grid"></div>
    `;
    
    productsContainer.appendChild(section);
    
    return section.querySelector('.products-grid');
}

/**
 * Load products from API
 */
function loadQuotationProducts() {
    fetch('../api/get_products.php', {
        method: 'GET',
        credentials: 'include'
    })
    .then(response => response.json())
    .then(data => {
        if (data.success && data.products) {
            // Group products by category
            const productsByCategory = {};
            
            data.products.forEach(product => {
                const category = product.category;
                if (!productsByCategory[category]) {
                    productsByCategory[category] = [];
                }
                productsByCategory[category].push(product);
            });
            
            // Display products by category
            Object.keys(productsByCategory).sort().forEach(category => {
                const container = getCategorySectionContainer(category);
                if (container) {
                    // Clear existing static products if any
                    container.innerHTML = '';
                    
                    // Add products from database to the category
                    productsByCategory[category].forEach(product => {
                        const productCard = createQuotationProductCard(product);
                        container.insertAdjacentHTML('beforeend', productCard);
                    });
                }
            });
            
            // Add product controls after products are loaded (with small delay to ensure DOM is updated)
            setTimeout(() => {
                if (typeof addProductControls === 'function') {
                    addProductControls();
                }
            }, 100);
            
            console.log(`Loaded ${data.count} products for quotation successfully`);
        } else {
            console.error('Failed to load products:', data.message);
        }
    })
    .catch(error => {
        console.error('Error loading products:', error);
    });
}

// Load products when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadQuotationProducts);
} else {
    loadQuotationProducts();
}

