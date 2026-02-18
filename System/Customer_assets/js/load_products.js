/**
 * Load Products from Database
 * Dynamically loads and displays products on the MainPage
 */

// Dynamic category mapping - loaded from API
let categoryMapping = {};

/**
 * Generate section ID from category name
 */
function generateSectionId(categoryName) {
    return categoryName
        .toLowerCase()
        .replace(/&/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') + '-products';
}

/**
 * Load categories from API and build mapping
 */
async function loadCategories() {
    try {
        // Add timestamp to prevent caching
        const timestamp = new Date().getTime();
        const response = await fetch(`../api/get_categories.php?t=${timestamp}`, {
            method: 'GET',
            credentials: 'include',
            cache: 'no-cache'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.categories) {
            // Build category mapping dynamically
            categoryMapping = {};
            data.categories.forEach(category => {
                const categoryName = category.category_name || category;
                categoryMapping[categoryName] = {
                    sectionId: generateSectionId(categoryName),
                    icon: category.category_icon || 'fas fa-box',
                    title: categoryName,
                    display_order: category.display_order || 0
                };
            });
            return true;
        } else {
            console.warn('Failed to load categories, using fallback');
            return false;
        }
    } catch (error) {
        console.error('Error loading categories:', error);
        // Use fallback mapping
        return false;
    }
}

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
 * Create product card HTML
 */
function createProductCard(product) {
    const imageUrl = getProductImage(product);
    const price = formatPrice(product.price);
    const productId = product.product_id;
    const categoryName = product.category || 'Uncategorized';
    
    return `
        <div class="col-lg-3 col-md-6 col-sm-6 mb-4">
            <div class="product-card" style="cursor: pointer;" onclick="window.location.href='ProductDetails.html?product_id=${productId}'">
                <div class="product-image">
                    <img src="${imageUrl}" alt="${escapeHtml(product.product_name)}" style="max-width: 100%; height: 200px; object-fit: cover;">
                </div>
                <div class="product-info">
                    <small class="product-category" style="color: #6c757d; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 5px;">${escapeHtml(categoryName)}</small>
                    <h5 class="product-title">${escapeHtml(product.product_name)}</h5>
                    <p class="product-price">${price}</p>
                    <a href="ProductDetails.html?product_id=${productId}" class="btn btn-primary-red btn-sm add-to-cart-btn" onclick="event.stopPropagation();">Add To Cart</a>
                </div>
            </div>
        </div>
    `;
}

/**
 * Escape HTML to prevent XSS (shared function)
 */
function escapeHtml(text) {
    if (!text) return '';
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
 * Get or create category section row container
 * Creates a section even if category is not in categoryMapping (for new categories)
 */
function getCategoryRowContainer(category) {
    let mapping = categoryMapping[category];
    
    // If category doesn't exist in mapping, create a default mapping for it
    if (!mapping) {
        console.warn('Category not in mapping, creating default section:', category);
        mapping = {
            sectionId: generateSectionId(category),
            icon: 'fas fa-box', // Default icon
            title: category
        };
        // Add to mapping for future use
        categoryMapping[category] = mapping;
    }
    
    const sectionId = mapping.sectionId;
    let section = document.getElementById(sectionId);
    
    if (!section) {
        // Create the section if it doesn't exist
        const productsSection = document.querySelector('#products .container');
        if (!productsSection) return null;
        
        section = document.createElement('div');
        section.id = sectionId;
        section.className = 'category-products-section';
        section.innerHTML = `
            <h3 class="category-products-title">
                <i class="${mapping.icon} category-title-icon"></i>
                ${escapeHtml(mapping.title)}
            </h3>
            <div class="row" id="${sectionId}-row">
            </div>
        `;
        
        // Insert after the loading message
        const loadingDiv = document.getElementById('products-loading');
        if (loadingDiv && loadingDiv.parentNode) {
            loadingDiv.parentNode.insertBefore(section, loadingDiv.nextSibling);
        } else {
            productsSection.appendChild(section);
        }
    } else {
        // Update existing section title and icon if they've changed in the database
        const titleElement = section.querySelector('.category-products-title');
        if (titleElement) {
            // Get current title text (skip icon)
            const currentText = titleElement.textContent.trim();
            const currentIcon = titleElement.querySelector('.category-title-icon');
            
            // Always update to ensure it matches the latest category name from database
            titleElement.innerHTML = `
                <i class="${mapping.icon} category-title-icon"></i>
                ${escapeHtml(mapping.title)}
            `;
        }
    }
    
    // Find or create the row container
    let rowContainer = section.querySelector('.row');
    if (!rowContainer) {
        rowContainer = document.createElement('div');
        rowContainer.className = 'row';
        rowContainer.id = sectionId + '-row';
        section.appendChild(rowContainer);
    }
    
    return rowContainer;
}

/**
 * Load products from API
 */
async function loadProducts() {
    try {
        // First load categories
        const categoriesLoaded = await loadCategories();
        if (!categoriesLoaded) {
            console.warn('Categories not loaded, using fallback');
        }
        
        // Then load products (with cache-busting)
        const timestamp = new Date().getTime();
        const response = await fetch(`../api/get_products.php?t=${timestamp}`, {
            method: 'GET',
            credentials: 'include',
            cache: 'no-cache'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.products) {
            // Group products by category, using database category names when available
            const productsByCategory = {};
            
            data.products.forEach(product => {
                // Prefer category_name from API join (updated category name from database)
                // Fall back to product.category if category_name not available
                let category = product.category_name || product.category;
                
                // Try to find matching database category (case-insensitive, trim whitespace)
                const normalizedCategory = category ? category.trim() : 'Uncategorized';
                const dbCategoryName = Object.keys(categoryMapping).find(
                    dbCat => dbCat.trim().toLowerCase() === normalizedCategory.toLowerCase()
                );
                
                // Always use database category name if found (this ensures updated names are used)
                // Otherwise use the normalized category from product
                const categoryKey = dbCategoryName || normalizedCategory;
                
                if (!productsByCategory[categoryKey]) {
                    productsByCategory[categoryKey] = [];
                }
                productsByCategory[categoryKey].push(product);
            });
            
            // Hide loading message
            const loadingDiv = document.getElementById('products-loading');
            if (loadingDiv) {
                loadingDiv.style.display = 'none';
            }
            
            // Remove all existing hardcoded category sections first
            const existingSections = document.querySelectorAll('#products .category-products-section');
            existingSections.forEach(section => section.remove());
            
            // Sort categories by display_order, then by name
            const sortedCategories = Object.keys(productsByCategory).sort((a, b) => {
                const mappingA = categoryMapping[a];
                const mappingB = categoryMapping[b];
                const orderA = mappingA ? (mappingA.display_order || 0) : 999;
                const orderB = mappingB ? (mappingB.display_order || 0) : 999;
                if (orderA !== orderB) {
                    return orderA - orderB;
                }
                return a.localeCompare(b);
            });
            
            // Display products by category in sorted order
            sortedCategories.forEach(category => {
                const rowContainer = getCategoryRowContainer(category);
                if (rowContainer) {
                    // Clear existing static products to replace with database products
                    rowContainer.innerHTML = '';
                    
                    // Add products from database to the category
                    productsByCategory[category].forEach(product => {
                        const productCard = createProductCard(product);
                        rowContainer.insertAdjacentHTML('beforeend', productCard);
                    });
                }
            });
            
            console.log(`Loaded ${data.count || data.products.length} products successfully`);
        } else {
            console.error('Failed to load products:', data.message || 'Unknown error');
            showError('Failed to load products. Please refresh the page.');
        }
    } catch (error) {
        console.error('Error loading products:', error);
        showError('An error occurred while loading products. Please check your connection and try again.');
    }
}

/**
 * Show error message to user
 */
function showError(message) {
    const loadingDiv = document.getElementById('products-loading');
    if (loadingDiv) {
        loadingDiv.innerHTML = `<div class="alert alert-danger">${message}</div>`;
    }
}

// Export function to reload products (useful when categories are updated)
window.reloadProducts = loadProducts;

// Load products when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadProducts);
} else {
    loadProducts();
}

