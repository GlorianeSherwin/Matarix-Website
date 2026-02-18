/**
 * Load Inventory for Admin
 * Dynamically loads and displays products with live stock updates
 */

// Format price
function formatPrice(price) {
    return '₱' + parseFloat(price).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// Get product image
function getProductImage(product) {
    if (product.image_path) {
        // Normalize path: replace spaces with underscores in folder names
        // Fix common issue: "Admin assets" -> "Admin_assets"
        let normalizedPath = product.image_path.replace(/Admin assets/g, 'Admin_assets');
        normalizedPath = normalizedPath.replace(/Customer assets/g, 'Customer_assets');
        return '../' + normalizedPath;
    }
    return '../Customer_assets/images/PreviewMain.png';
}

// Get status badge class
function getStatusBadgeClass(status) {
    const statusMap = {
        'In Stock': 'status-in-stock',
        'Low Stock': 'status-low-stock',
        'Out of Stock': 'status-out-of-stock'
    };
    return statusMap[status] || 'status-in-stock';
}

// Create product row HTML
function createProductRow(product) {
    const image = getProductImage(product);
    const statusClass = getStatusBadgeClass(product.stock_status);
    // Use a simple 1x1 transparent pixel as ultimate fallback to prevent infinite loops
    const fallbackImage = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    
    // Escape HTML to prevent XSS
    function escapeHtml(text) {
        if (!text) return 'Uncategorized';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }
    
    // Use category_name from join if available, otherwise fall back to category field
    const categoryName = escapeHtml(product.category_name || product.category || 'Uncategorized');
    
    return `
        <tr class="product-row" data-product-id="${product.Product_ID}">
            <td>
                <input type="checkbox" class="product-checkbox" data-product-id="${product.Product_ID}">
            </td>
            <td>
                <div class="product-info">
                    <img src="${image}" alt="${escapeHtml(product.Product_Name)}" class="product-image" onerror="if(this.dataset.retried!=='true'){this.dataset.retried='true';this.src='../Customer_assets/images/PreviewMain.png';}else{this.onerror=null;this.src='${fallbackImage}';}">
                    <div class="product-details">
                        <strong class="product-name">${escapeHtml(product.Product_Name)}</strong>
                    </div>
                </div>
            </td>
            <td>
                <span class="category-badge">${categoryName}</span>
            </td>
            <td>
                <div class="stock-info">
                    <span class="stock-level">${product.stock_level} ${product.stock_unit || 'PC'}</span>
                    <small class="stock-min">Min: ${product.Minimum_Stock} ${product.stock_unit || 'PC'}</small>
                </div>
            </td>
            <td>
                <span class="status-badge ${statusClass}">${product.stock_status}</span>
            </td>
            <td class="product-price">${formatPrice(product.price)}</td>
            <td class="restock-date">${product.last_restock || 'N/A'}</td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn view-btn" data-action="view" data-product="${product.Product_ID}" title="View Product">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="action-btn edit-btn" data-action="edit" data-product="${product.Product_ID}" title="Edit Product">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn variations-btn" data-action="variations" data-product="${product.Product_ID}" title="Manage Variations">
                        <i class="fas fa-list"></i>
                    </button>
                </div>
            </td>
        </tr>
    `;
}

// Store loaded products globally for filtering
window.inventoryProducts = [];

// Load inventory
async function loadInventory() {
    try {
        console.log('Loading inventory from database...');
        const response = await fetch('../api/get_products_admin.php', {
            method: 'GET',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Inventory data received:', data);
        
        if (data.success && data.products) {
            // Store products globally for filtering
            window.inventoryProducts = data.products;
            
            const tbody = document.querySelector('.inventory-table tbody');
            if (!tbody) {
                console.error('Inventory table body not found');
                return;
            }
            
            // Clear existing rows (remove any static rows)
            // Remove all images first to prevent error loops
            const existingImages = tbody.querySelectorAll('img');
            existingImages.forEach(img => {
                img.onerror = null;
                img.src = '';
            });
            tbody.innerHTML = '';
            
            // Add product rows from database
            if (data.products.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="8" class="text-center" style="padding: 40px;">
                            <p class="text-muted">No products found in inventory.</p>
                        </td>
                    </tr>
                `;
            } else {
                data.products.forEach(product => {
                    tbody.insertAdjacentHTML('beforeend', createProductRow(product));
                });
            }
            
            // Attach checkbox event handlers after products are loaded
            attachCheckboxHandlers();
            
            // Update statistics
            updateInventoryStatistics(data.products);
            
            // Check if there are active filters and reapply them after auto-refresh
            // Use setTimeout to ensure InventoryAdmin.js has loaded and filterInventory is available
            setTimeout(() => {
                const categoryFilter = document.getElementById('category-filter');
                const itemsFilter = document.getElementById('items-filter');
                const categoryValue = categoryFilter ? categoryFilter.value : '';
                const itemsValue = itemsFilter ? itemsFilter.value : '';
                
                const hasActiveFilter = (categoryValue && categoryValue !== '' && categoryValue !== 'all') ||
                                      (itemsValue && itemsValue !== '' && itemsValue !== 'all');
                
                if (hasActiveFilter && typeof window.filterInventory === 'function') {
                    // Reapply filters after loading
                    console.log('Reapplying filters after auto-refresh. Category:', categoryValue, 'Items:', itemsValue);
                    window.filterInventory();
                }
            }, 200);
            
            console.log(`Successfully loaded ${data.products.length} products`);
        } else {
            console.error('Failed to load inventory:', data.message);
            window.inventoryProducts = [];
            const tbody = document.querySelector('.inventory-table tbody');
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="7" class="text-center text-danger" style="padding: 40px;">
                            <p>Failed to load inventory: ${data.message || 'Unknown error'}</p>
                        </td>
                    </tr>
                `;
            }
        }
    } catch (error) {
        console.error('Error loading inventory:', error);
        window.inventoryProducts = [];
        const tbody = document.querySelector('.inventory-table tbody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center text-danger" style="padding: 40px;">
                        <p>Error loading inventory. Please refresh the page.</p>
                    </td>
                </tr>
            `;
        }
    }
}

// Update inventory statistics
function updateInventoryStatistics(products) {
    const totalProducts = products.length;
    const lowStockItems = products.filter(p => p.stock_status === 'Low Stock').length;
    const outOfStock = products.filter(p => p.stock_status === 'Out of Stock').length;
    
    // Update stat cards - find by parent stat-card structure
    const statCards = document.querySelectorAll('.stat-card');
    
    // First stat card: Total Products
    if (statCards[0]) {
        const totalEl = statCards[0].querySelector('.stat-number');
        if (totalEl) totalEl.textContent = totalProducts;
    }
    
    // Second stat card: Low Stock Items
    if (statCards[1]) {
        const lowStockEl = statCards[1].querySelector('.stat-number');
        if (lowStockEl) lowStockEl.textContent = lowStockItems;
    }
    
    // Third stat card: Out of Stock
    if (statCards[2]) {
        const outOfStockEl = statCards[2].querySelector('.stat-number');
        if (outOfStockEl) outOfStockEl.textContent = outOfStock;
    }
    
    console.log('Statistics updated:', { totalProducts, lowStockItems, outOfStock });
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadInventory);
} else {
    loadInventory();
}

// Auto-refresh every 15 seconds for live updates
// Only refresh if page is visible
let refreshInterval;
function startAutoRefresh() {
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(() => {
        // Only refresh if page is visible
        if (!document.hidden) {
            loadInventory();
        }
    }, 15000); // Refresh every 15 seconds
}

// Start auto-refresh
startAutoRefresh();

// Pause auto-refresh when page is hidden
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        if (refreshInterval) clearInterval(refreshInterval);
    } else {
        startAutoRefresh();
    }
});

// Export function for global access
window.loadInventory = loadInventory;

// Handle view button click - Show product details modal
$(document).on('click', '.view-btn', async function() {
    const productId = $(this).data('product');
    
    if (!productId) {
        if (window.AdminNotifications) {
            AdminNotifications.warning('Product ID not found', { duration: 4000 });
        } else {
            alert('Product ID not found');
        }
        return;
    }
    
    // Show modal and loading state
    $('#viewProductModal').modal('show');
    $('#viewProductLoading').show();
    $('#viewProductContent').hide();
    
    try {
        // Fetch product details from API
        const response = await fetch(`../api/get_product_details.php?product_id=${productId}`, {
            method: 'GET',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.success || !data.product) {
            throw new Error(data.message || 'Failed to load product details');
        }
        
        const product = data.product;
        
        // Get product image
        let productImage = '../Customer_assets/images/PreviewMain.png';
        if (product.image_path) {
            // Normalize path: replace spaces with underscores in folder names
            let normalizedPath = product.image_path.replace(/Admin assets/g, 'Admin_assets');
            normalizedPath = normalizedPath.replace(/Customer assets/g, 'Customer_assets');
            productImage = '../' + normalizedPath;
        }
        
        // Populate product details
        $('#viewProductImage').attr('src', productImage).attr('alt', product.product_name);
        $('#viewProductName').text(product.product_name);
        $('#viewProductId').text(product.product_id);
        $('#viewProductCategory').text(product.category);
        $('#viewProductDescription').text(product.description || 'No description available');
        $('#viewProductPrice').text('₱' + parseFloat(product.price).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }));
        $('#viewProductStock').text(product.stock_level + ' ' + (product.stock_unit || 'PC'));
        $('#viewProductMinStock').text((product.minimum_stock || 0) + ' ' + (product.stock_unit || 'PC'));
        
        // Stock status with badge
        const statusClass = product.stock_status === 'In Stock' ? 'status-in-stock' : 
                          product.stock_status === 'Low Stock' ? 'status-low-stock' : 'status-out-of-stock';
        $('#viewProductStatus').html(`<span class="status-badge ${statusClass}">${product.stock_status}</span>`);
        
        // Dimensions
        let dimensions = 'N/A';
        if (product.length || product.width) {
            const parts = [];
            if (product.length) parts.push('Length: ' + product.length);
            if (product.width) parts.push('Width: ' + product.width);
            if (product.unit) parts.push('Unit: ' + product.unit);
            dimensions = parts.join(', ');
        }
        $('#viewProductDimensions').text(dimensions);
        
        // Last restock
        $('#viewProductRestock').text(product.last_restock || 'N/A');
        
        // Product variations
        const variationsContainer = $('#viewProductVariations');
        variationsContainer.empty();
        
        if (product.variations && Object.keys(product.variations).length > 0) {
            Object.keys(product.variations).forEach(variationName => {
                const variationGroup = $('<div class="mb-3"></div>');
                variationGroup.append(`<strong class="d-block mb-2">${variationName}:</strong>`);
                
                const valuesList = $('<div class="pl-3"></div>');
                product.variations[variationName].forEach(variation => {
                    valuesList.append(`<span class="badge badge-secondary mr-2 mb-2">${variation.variation_value}</span>`);
                });
                
                variationGroup.append(valuesList);
                variationsContainer.append(variationGroup);
            });
        } else {
            variationsContainer.html('<p class="text-muted">No variations available for this product.</p>');
        }
        
        // Hide loading, show content
        $('#viewProductLoading').hide();
        $('#viewProductContent').show();
        
    } catch (error) {
        console.error('Error loading product details:', error);
        $('#viewProductLoading').html(`
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle"></i>
                <p class="mb-0">Failed to load product details: ${error.message}</p>
            </div>
        `);
    }
});

// Edit thumbnail variables (global scope for edit modal)
let editSelectedThumbnailFiles = [];
let editCurrentThumbnails = [];

// Handle edit button click
$(document).on('click', '.edit-btn', async function() {
    const productId = $(this).data('product');
    if (!productId) {
        if (window.AdminNotifications) {
            AdminNotifications.warning('Product ID not found', { duration: 4000 });
        } else {
            alert('Product ID not found');
        }
        return;
    }
    
    try {
        // Show modal first
        $('#editProductModal').modal('show');
        
        // Disable form and show loading
        $('#editProductForm input, #editProductForm select, #editProductForm textarea, #editProductForm button').prop('disabled', true);
        const submitBtn = $('#editProductForm').closest('.modal').find('.add-product-submit-btn');
        const originalBtnText = submitBtn.html();
        submitBtn.html('<i class="fas fa-spinner fa-spin"></i> Loading...').prop('disabled', true);
        
        // Fetch product details
        const response = await fetch(`../api/get_product_details.php?product_id=${productId}`, {
            method: 'GET',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.success || !data.product) {
            throw new Error(data.message || 'Failed to load product details');
        }
        
        const product = data.product;
        
        // Populate form fields
        $('#editProductId').val(product.product_id);
        $('#editProductName').val(product.product_name);
        // Set category_id if available, otherwise fallback to category name
        if (product.category_id) {
            $('#editProductCategory').val(product.category_id);
        } else {
            $('#editProductCategory').val(product.category);
        }
        $('#editProductPrice').val(parseFloat(product.price));
        $('#editProductStock').val(product.stock_level);
        $('#editProductStockUnit').val(product.stock_unit || 'PC');
        $('#editProductDescription').val(product.description || '');
        $('#editProductLength').val(product.length || '');
        $('#editProductWidth').val(product.width || '');
        $('#editProductUnit').val(product.unit || '');
        $('#editProductMinStock').val(product.minimum_stock || 0);
        
        // Handle current image
        if (product.image_path) {
            let normalizedPath = product.image_path.replace(/Admin assets/g, 'Admin_assets');
            normalizedPath = normalizedPath.replace(/Customer assets/g, 'Customer_assets');
            $('#editCurrentImage').attr('src', '../' + normalizedPath);
            $('#editUploadImageBtn').hide();
            $('#editMainImagePreview').show();
        } else {
            $('#editUploadImageBtn').show();
            $('#editMainImagePreview').hide();
        }
        
        // Handle current thumbnails
        editCurrentThumbnails = product.thumbnails || [];
        const currentThumbnailsRow = $('#editCurrentThumbnailsRow');
        currentThumbnailsRow.empty();
        
        if (editCurrentThumbnails.length > 0) {
            editCurrentThumbnails.forEach((thumbnailPath, index) => {
                const col = $('<div>').addClass('thumbnail-preview-item');
                col.html(`<img src="../${thumbnailPath}" alt="Thumbnail ${index + 1}">`);
                currentThumbnailsRow.append(col);
            });
        }
        
        // Reset new thumbnails preview
        editSelectedThumbnailFiles = [];
        $('#editThumbnailsPreviewRow').empty();
        
        // Load variations into the inline Manage Variations section (variationsList, add form)
        let variations = [];
        if (typeof loadProductVariations === 'function') {
            variations = await loadProductVariations(productId) || [];
        }
        
        // When product has variations with stock_level, disable product-level stock field (stock is per variation)
        const hasVariationStock = Array.isArray(variations) && variations.some(function(v) {
            return v.stock_level != null && v.stock_level !== '';
        });
        const $stockInput = $('#editProductStock');
        if (hasVariationStock) {
            $stockInput.prop('disabled', true).attr('title', 'Stock is managed per variation below.');
            $stockInput.closest('.form-group').find('label .variation-stock-hint').remove();
            $stockInput.closest('.form-group').find('label').append(' <span class="text-muted small variation-stock-hint">(managed by variations)</span>');
        } else {
            $stockInput.prop('disabled', false).attr('title', '');
            $stockInput.closest('.form-group').find('label .variation-stock-hint').remove();
        }
        
        // Re-enable form
        $('#editProductForm input, #editProductForm select, #editProductForm textarea, #editProductForm button').prop('disabled', false);
        if (hasVariationStock) {
            $stockInput.prop('disabled', true);
        }
        submitBtn.html(originalBtnText).prop('disabled', false);
        
    } catch (error) {
        console.error('Error loading product details:', error);
        if (window.AdminNotifications) {
            AdminNotifications.error('Failed to load product details: ' + error.message, {
                details: { error: error.message }
            });
        } else {
            alert('Failed to load product details: ' + error.message);
        }
        $('#editProductModal').modal('hide');
        
        // Re-enable form in case of error
        $('#editProductForm input, #editProductForm select, #editProductForm textarea, #editProductForm button').prop('disabled', false);
        const submitBtn = $('#editProductForm').closest('.modal').find('.add-product-submit-btn');
        submitBtn.html('Update Product').prop('disabled', false);
    }
});

// ==========================================
// CHECKBOX SELECTION AND BULK DELETE FUNCTIONALITY
// ==========================================

// Attach checkbox event handlers
function attachCheckboxHandlers() {
    // Select All checkbox
    const selectAllCheckbox = document.getElementById('select-all-products');
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', function() {
            const checkboxes = document.querySelectorAll('.product-checkbox');
            checkboxes.forEach(checkbox => {
                checkbox.checked = this.checked;
            });
            updateDeleteButton();
        });
    }
    
    // Individual checkboxes
    document.querySelectorAll('.product-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            updateSelectAllCheckbox();
            updateDeleteButton();
        });
    });
}

// Update Select All checkbox state
function updateSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('select-all-products');
    const checkboxes = document.querySelectorAll('.product-checkbox');
    const checkedCount = document.querySelectorAll('.product-checkbox:checked').length;
    
    if (selectAllCheckbox && checkboxes.length > 0) {
        selectAllCheckbox.checked = checkedCount === checkboxes.length;
        selectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
    }
}

// Update delete button visibility and count
function updateDeleteButton() {
    const deleteBtn = document.getElementById('delete-selected-products-btn');
    const countSpan = document.getElementById('selected-products-count');
    const checkedCheckboxes = document.querySelectorAll('.product-checkbox:checked');
    const count = checkedCheckboxes.length;
    
    if (deleteBtn) {
        if (count > 0) {
            deleteBtn.style.display = 'inline-block';
            if (countSpan) {
                countSpan.textContent = count;
            }
        } else {
            deleteBtn.style.display = 'none';
        }
    }
}

// Delete selected products
async function deleteSelectedProducts() {
    const checkedCheckboxes = document.querySelectorAll('.product-checkbox:checked');
    const productIds = Array.from(checkedCheckboxes).map(cb => parseInt(cb.dataset.productId));
    
    if (productIds.length === 0) {
        if (window.AdminNotifications) {
            AdminNotifications.warning('Please select at least one product to delete.', { duration: 4000 });
        } else {
            alert('Please select at least one product to delete.');
        }
        return;
    }
    
    // Show confirmation dialog
    const confirmMessage = `Are you sure you want to delete ${productIds.length} product(s)?\n\nThis action cannot be undone. Products associated with existing orders cannot be deleted.`;
    const confirmed = window.confirm(confirmMessage);
    
    if (!confirmed) {
        return;
    }
    
    // Show loading state
    const deleteBtn = document.getElementById('delete-selected-products-btn');
    const originalBtnHtml = deleteBtn ? deleteBtn.innerHTML : '';
    if (deleteBtn) {
        deleteBtn.disabled = true;
        deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
    }
    
    // Disable all checkboxes during deletion
    document.querySelectorAll('.product-checkbox').forEach(cb => {
        cb.disabled = true;
    });
    const selectAllCheckbox = document.getElementById('select-all-products');
    if (selectAllCheckbox) {
        selectAllCheckbox.disabled = true;
    }
    
    let successCount = 0;
    let failCount = 0;
    const failedProducts = [];
    
    // Delete products one by one
    for (const productId of productIds) {
        try {
            const response = await fetch('../api/delete_product.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    product_id: productId
                }),
                credentials: 'include'
            });
            
            const result = await response.json();
            
            if (result.success) {
                successCount++;
            } else {
                failCount++;
                failedProducts.push({
                    id: productId,
                    message: result.message || 'Unknown error'
                });
            }
        } catch (error) {
            console.error(`Error deleting product ${productId}:`, error);
            failCount++;
            failedProducts.push({
                id: productId,
                message: error.message || 'Network error'
            });
        }
    }
    
    // Re-enable checkboxes
    document.querySelectorAll('.product-checkbox').forEach(cb => {
        cb.disabled = false;
    });
    if (selectAllCheckbox) {
        selectAllCheckbox.disabled = false;
    }
    
    // Show results
    if (window.AdminNotifications) {
        if (successCount > 0 && failCount === 0) {
            AdminNotifications.success(`Successfully deleted ${successCount} product(s)!`, {
                duration: 4000
            });
        } else if (successCount > 0 && failCount > 0) {
            AdminNotifications.warning(`Deleted ${successCount} product(s), but ${failCount} failed.`, {
                duration: 6000
            });
        } else {
            AdminNotifications.error(`Failed to delete products. ${failedProducts[0]?.message || 'Unknown error'}`, {
                duration: 6000
            });
        }
    } else {
        if (successCount > 0 && failCount === 0) {
            alert(`Successfully deleted ${successCount} product(s)!`);
        } else if (successCount > 0 && failCount > 0) {
            alert(`Deleted ${successCount} product(s), but ${failCount} failed.`);
        } else {
            alert(`Failed to delete products. ${failedProducts[0]?.message || 'Unknown error'}`);
        }
    }
    
    // Reset button
    if (deleteBtn) {
        deleteBtn.disabled = false;
        deleteBtn.innerHTML = originalBtnHtml;
    }
    
    // Uncheck all checkboxes
    document.querySelectorAll('.product-checkbox').forEach(cb => {
        cb.checked = false;
    });
    if (selectAllCheckbox) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
    }
    updateDeleteButton();
    
    // Reload inventory
    if (window.loadInventory) {
        window.loadInventory();
    } else {
        location.reload();
    }
}

// Attach delete button click handler
$(document).ready(function() {
    $(document).on('click', '#delete-selected-products-btn', function(e) {
        e.preventDefault();
        deleteSelectedProducts();
    });
    
    // Initial call to attach handlers when page loads
    setTimeout(attachCheckboxHandlers, 500);
});

