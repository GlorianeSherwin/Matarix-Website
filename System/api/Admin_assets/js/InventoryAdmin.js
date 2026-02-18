$(document).ready(function() {
    // Sample product data with different statuses
    const products = [
        { id: 1, name: 'Cement Portland', lot: 'Lot A-1', category: 'Building', stock: 155, minStock: 50, status: 'In Stock', price: 250.00, restock: '2025-01-15', image: '../Admin_assets/images/cement.png' },
        { id: 2, name: 'Steel Rebar 10mm', lot: 'Lot B-2', category: 'Building', stock: 45, minStock: 50, status: 'Low Stock', price: 180.00, restock: '2025-01-10', image: '../Admin_assets/images/rebar.png' },
        { id: 3, name: 'Plywood 4x8', lot: 'Lot C-3', category: 'Building', stock: 0, minStock: 20, status: 'Out of Stock', price: 450.00, restock: '2024-12-28', image: '../Admin_assets/images/plywood.png' },
        { id: 4, name: 'Paint White 5L', lot: 'Lot D-4', category: 'Hardware', stock: 78, minStock: 30, status: 'In Stock', price: 320.00, restock: '2025-01-12', image: '../Admin_assets/images/paint.png' },
        { id: 5, name: 'Hammer 16oz', lot: 'Lot E-5', category: 'Tools', stock: 25, minStock: 25, status: 'Low Stock', price: 150.00, restock: '2025-01-08', image: '../Admin_assets/images/hammer.png' },
        { id: 6, name: 'Power Drill', lot: 'Lot F-6', category: 'Tools', stock: 12, minStock: 15, status: 'Low Stock', price: 2500.00, restock: '2025-01-05', image: '../Admin_assets/images/drill.png' },
        { id: 7, name: 'PVC Pipe 1/2"', lot: 'Lot G-7', category: 'Plumbing', stock: 200, minStock: 100, status: 'In Stock', price: 85.00, restock: '2025-01-14', image: '../Admin_assets/images/pipe.png' },
        { id: 8, name: 'Electrical Wire 2.0', lot: 'Lot H-8', category: 'Electronics', stock: 0, minStock: 50, status: 'Out of Stock', price: 120.00, restock: '2024-12-30', image: '../Admin_assets/images/wire.png' }
    ];
    
    // Render products to table
    function renderProducts(productsToRender = products) {
        const tbody = $('.inventory-table tbody');
        tbody.empty();
        
        productsToRender.forEach(product => {
            const statusClass = product.status === 'In Stock' ? 'status-in-stock' : 
                              product.status === 'Low Stock' ? 'status-low-stock' : 'status-out-of-stock';
            
            // Use a simple 1x1 transparent pixel as ultimate fallback to prevent infinite loops
            const fallbackImage = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
            const row = `
                <tr class="product-row" data-product-id="${product.id}">
                    <td>
                        <div class="product-info">
                            <img src="${product.image}" alt="${product.name}" class="product-image" onerror="if(this.dataset.retried!=='true'){this.dataset.retried='true';this.src='../Customer_assets/images/PreviewMain.png';}else{this.onerror=null;this.src='${fallbackImage}';}">
                            <div class="product-details">
                                <strong class="product-name">${product.name}</strong>
                            </div>
                        </div>
                    </td>
                    <td>
                        <span class="category-badge">${product.category}</span>
                    </td>
                    <td>
                        <div class="stock-info">
                            <span class="stock-level">${product.stock} units</span>
                            <small class="stock-min">Min: ${product.minStock}</small>
                        </div>
                    </td>
                    <td>
                        <span class="status-badge ${statusClass}">${product.status}</span>
                    </td>
                    <td class="product-price">₱${product.price.toFixed(2)}</td>
                    <td class="restock-date">${product.restock}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="action-btn view-btn" data-action="view" data-product="${product.id}">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="action-btn edit-btn" data-action="edit" data-product="${product.id}">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="restock-btn" data-action="restock" data-product="${product.id}">
                                Restock
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            tbody.append(row);
        });
        
        updateStatistics(productsToRender);
    }
    
    // Update statistics cards
    function updateStatistics(productsToShow = products) {
        const totalProducts = productsToShow.length;
        // Handle both old sample data structure and new database structure
        const lowStock = productsToShow.filter(p => 
            (p.status === 'Low Stock') || (p.stock_status === 'Low Stock')
        ).length;
        const outOfStock = productsToShow.filter(p => 
            (p.status === 'Out of Stock') || (p.stock_status === 'Out of Stock')
        ).length;
        
        $('.stat-card:eq(0) .stat-number').text(totalProducts);
        $('.stat-card:eq(1) .stat-number').text(lowStock);
        $('.stat-card:eq(2) .stat-number').text(outOfStock);
    }
    
    // Initial render
    renderProducts();
    
    // View button functionality - Show product details modal
    $(document).on('click', '.view-btn', async function() {
        const productId = $(this).data('product');
        
        if (!productId) {
            AdminNotifications.warning('Product ID not found', {
                duration: 4000
            });
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
                productImage = '../' + product.image_path;
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
            $('#viewProductStock').text(product.stock_level + ' units');
            $('#viewProductMinStock').text((product.minimum_stock || 0) + ' units');
            
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
            
            // Weight
            let weight = 'N/A';
            if (product.weight) {
                weight = product.weight;
                if (product.weight_unit) {
                    weight += ' ' + product.weight_unit;
                }
            }
            $('#viewProductWeight').text(weight);
            
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
    
    // Restock button functionality
    $(document).on('click', '.restock-btn', function() {
        const productId = $(this).data('product');
        const product = products.find(p => p.id === productId);
        
        if (product) {
            const modal = `
                <div class="modal fade" id="restockModal" tabindex="-1" role="dialog">
                    <div class="modal-dialog modal-dialog-centered" role="document">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">Restock Product</h5>
                                <button type="button" class="close" data-dismiss="modal">
                                    <span>&times;</span>
                                </button>
                            </div>
                            <div class="modal-body">
                                <p><strong>Product:</strong> ${product.name}</p>
                                <p><strong>Current Stock:</strong> ${product.stock} units</p>
                                <p><strong>Minimum Stock:</strong> ${product.minStock} units</p>
                                <div class="form-group">
                                    <label for="restockQuantity">Quantity to Add:</label>
                                    <input type="number" class="form-control" id="restockQuantity" min="1" value="${product.minStock - product.stock > 0 ? product.minStock - product.stock : 50}">
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-dismiss="modal">Cancel</button>
                                <button type="button" class="btn btn-danger" id="confirmRestock" data-product="${productId}">Confirm Restock</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            $('#restockModal').remove();
            $('body').append(modal);
            $('#restockModal').modal('show');
        }
    });
    
    // Confirm restock
    $(document).on('click', '#confirmRestock', function() {
        const productId = $(this).data('product');
        const quantity = parseInt($('#restockQuantity').val());
        const product = products.find(p => p.id === productId);
        
        if (product && quantity > 0) {
            product.stock += quantity;
            
            // Update status based on new stock level
            if (product.stock >= product.minStock) {
                product.status = 'In Stock';
            } else if (product.stock > 0) {
                product.status = 'Low Stock';
            } else {
                product.status = 'Out of Stock';
            }
            
            // Update restock date to today
            const today = new Date().toISOString().split('T')[0];
            product.restock = today;
            
            renderProducts();
            $('#restockModal').modal('hide');
            
                AdminNotifications.success(`Successfully restocked ${quantity} units of ${product.name}. New stock level: ${product.stock} units`, {
                    duration: 4000
                });
        }
    });
    
    // Debounce filter to reduce lag
    let filterTimeout;
    function debounceFilter() {
        clearTimeout(filterTimeout);
        filterTimeout = setTimeout(() => {
            filterInventory();
        }, 150); // 150ms debounce
    }
    
    // Category filter - use real products from database
    $('#category-filter').on('change', function() {
        debounceFilter();
    });
    
    // Items filter - use real products from database
    $('#items-filter').on('change', function() {
        debounceFilter();
    });
    
    // Unified filter function that uses real database products
    function filterInventory() {
        // Use real products from database if available, otherwise use sample data
        const allProducts = window.inventoryProducts && window.inventoryProducts.length > 0 
            ? window.inventoryProducts 
            : products;
        
        if (!allProducts || allProducts.length === 0) {
            console.warn('No products available for filtering. Waiting for products to load...');
            // If products haven't loaded yet, wait a bit and try again
            if (window.inventoryProducts === undefined || window.inventoryProducts.length === 0) {
                setTimeout(() => {
                    if (window.inventoryProducts && window.inventoryProducts.length > 0) {
                        filterInventory();
                    } else {
                        // Show message that products are loading
                        const tbody = $('.inventory-table tbody');
                        if (tbody.length) {
                            tbody.html(`
                                <tr>
                                    <td colspan="8" class="text-center" style="padding: 40px;">
                                        <p class="text-muted">Loading products...</p>
                                    </td>
                                </tr>
                            `);
                        }
                    }
                }, 500);
            }
            return;
        }
        
        const category = $('#category-filter').val();
        const itemsFilter = $('#items-filter').val();
        
        let filtered = allProducts;
        
        // Filter by category (check both category name and category_id)
        if (category && category !== '' && category !== 'all') {
            filtered = filtered.filter(p => {
                // Check if product has category_id (number) or category (string)
                const productCategoryId = p.category_id || p.Category_ID;
                // Use category_name from join if available, otherwise fall back to category field
                const productCategoryName = (p.category_name || p.category || '').toString().trim();
                
                // Try matching by category_id first (if filter value is a number)
                if (!isNaN(category) && category !== '' && category !== 'all') {
                    // Filter by category_id (number comparison)
                    return productCategoryId != null && productCategoryId == category;
                } else {
                    // Filter by category name (case-insensitive, exact match)
                    const filterCategory = category.toString().trim().toLowerCase();
                    const productCategoryLower = productCategoryName.toLowerCase();
                    // Exact match
                    return productCategoryLower === filterCategory;
                }
            });
        }
        
        // Filter by status
        if (itemsFilter && itemsFilter !== 'all') {
            filtered = filterByStatus(filtered, itemsFilter);
        }
        
        // Render filtered products using the real product rendering function
        renderFilteredProducts(filtered);
    }
    
    // Export filterInventory to global scope so load_inventory.js can call it after auto-refresh
    window.filterInventory = filterInventory;
    
    // Render filtered products using database product structure
    function renderFilteredProducts(filteredProducts) {
        const tbody = $('.inventory-table tbody');
        tbody.empty();
        
        if (filteredProducts.length === 0) {
            tbody.html(`
                <tr>
                    <td colspan="8" class="text-center" style="padding: 40px;">
                        <p class="text-muted">No products found matching the selected filters.</p>
                    </td>
                </tr>
            `);
            updateStatistics([]);
            return;
        }
        
        // Use the real product rendering from load_inventory.js if available
        if (typeof createProductRow === 'function') {
            filteredProducts.forEach(product => {
                tbody.append(createProductRow(product));
            });
            // Attach checkbox handlers if function exists
            if (typeof attachCheckboxHandlers === 'function') {
                attachCheckboxHandlers();
            }
        } else {
            // Fallback to old rendering method for sample data
            filteredProducts.forEach(product => {
                const statusClass = product.status === 'In Stock' ? 'status-in-stock' : 
                                  product.status === 'Low Stock' ? 'status-low-stock' : 'status-out-of-stock';
                
                const row = `
                    <tr class="product-row" data-product-id="${product.id || product.Product_ID}">
                        <td>
                            <div class="product-info">
                                <img src="${product.image || getProductImage(product)}" alt="${product.name || product.Product_Name}" class="product-image">
                                <div class="product-details">
                                    <strong class="product-name">${product.name || product.Product_Name}</strong>
                                </div>
                            </div>
                        </td>
                        <td>
                            <span class="category-badge">${product.category || 'Uncategorized'}</span>
                        </td>
                        <td>
                            <div class="stock-info">
                                <span class="stock-level">${product.stock || product.stock_level} ${product.stock_unit || 'units'}</span>
                                <small class="stock-min">Min: ${product.minStock || product.Minimum_Stock}</small>
                            </div>
                        </td>
                        <td>
                            <span class="status-badge ${statusClass}">${product.status || product.stock_status}</span>
                        </td>
                        <td class="product-price">₱${(product.price || 0).toFixed(2)}</td>
                        <td class="restock-date">${product.restock || product.last_restock || 'N/A'}</td>
                        <td>
                            <div class="action-buttons">
                                <button class="action-btn view-btn" data-action="view" data-product="${product.id || product.Product_ID}">
                                    <i class="fas fa-eye"></i>
                                </button>
                                <button class="action-btn edit-btn" data-action="edit" data-product="${product.id || product.Product_ID}">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="restock-btn" data-action="restock" data-product="${product.id || product.Product_ID}">
                                    Restock
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
                tbody.append(row);
            });
        }
        
        updateStatistics(filteredProducts);
    }
    
    // Filter by status helper - handles both old sample data and new database structure
    function filterByStatus(productsList, status) {
        if (status === 'in-stock') {
            return productsList.filter(p => 
                (p.status === 'In Stock') || (p.stock_status === 'In Stock')
            );
        } else if (status === 'low-stock') {
            return productsList.filter(p => 
                (p.status === 'Low Stock') || (p.stock_status === 'Low Stock')
            );
        } else if (status === 'out-of-stock') {
            return productsList.filter(p => 
                (p.status === 'Out of Stock') || (p.stock_status === 'Out of Stock')
            );
        }
        return productsList;
    }
    
    // Upload image button
    $('#uploadImageBtn').on('click', function() {
        $('#productImageInput').click();
    });
    
    // Handle image preview
    let selectedImageFile = null;
    $('#productImageInput').on('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            selectedImageFile = file;
            // Show preview
            const reader = new FileReader();
            reader.onload = function(e) {
                $('#uploadImageBtn').html(`
                    <img src="${e.target.result}" style="max-width: 100px; max-height: 100px; object-fit: cover; border-radius: 5px;">
                    <span class="upload-text">Change Photo</span>
                `);
            };
            reader.readAsDataURL(file);
        }
    });
    
    // Thumbnail upload handlers
    let selectedThumbnailFiles = [];
    $('#uploadThumbnailsBtn').on('click', function() {
        $('#productThumbnailsInput').click();
    });
    
    $('#productThumbnailsInput').on('change', function(e) {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            // Limit to 4 thumbnails
            selectedThumbnailFiles = files.slice(0, 4);
            
            // Show preview
            const previewContainer = $('#thumbnailsPreview');
            const previewRow = $('#thumbnailsPreviewRow');
            previewRow.empty();
            
            selectedThumbnailFiles.forEach((file, index) => {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const col = $('<div>').addClass('col-3 mb-2');
                    col.html(`
                        <div class="position-relative">
                            <img src="${e.target.result}" style="width: 100%; height: 80px; object-fit: cover; border-radius: 5px; border: 1px solid #ddd;">
                            <button type="button" class="btn btn-sm btn-danger position-absolute" style="top: 0; right: 0; padding: 2px 6px;" onclick="removeThumbnail(${index})">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    `);
                    previewRow.append(col);
                };
                reader.readAsDataURL(file);
            });
            
            previewContainer.show();
        }
    });
    
    // Remove thumbnail function (global for onclick)
    window.removeThumbnail = function(index) {
        selectedThumbnailFiles.splice(index, 1);
        $('#productThumbnailsInput').val(''); // Reset input
        
        // Rebuild preview
        const previewRow = $('#thumbnailsPreviewRow');
        previewRow.empty();
        
        if (selectedThumbnailFiles.length === 0) {
            $('#thumbnailsPreview').hide();
            return;
        }
        
        selectedThumbnailFiles.forEach((file, idx) => {
            const reader = new FileReader();
            reader.onload = function(e) {
                const col = $('<div>').addClass('col-3 mb-2');
                col.html(`
                    <div class="position-relative">
                        <img src="${e.target.result}" style="width: 100%; height: 80px; object-fit: cover; border-radius: 5px; border: 1px solid #ddd;">
                        <button type="button" class="btn btn-sm btn-danger position-absolute" style="top: 0; right: 0; padding: 2px 6px;" onclick="removeThumbnail(${idx})">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `);
                previewRow.append(col);
            };
            reader.readAsDataURL(file);
        });
    };
    
    // Add variation button functionality
    let variationCount = 0;
    $('#addVariationBtn').on('click', function() {
        variationCount++;
        const variationHtml = `
            <div class="variation-item mb-2" data-variation-index="${variationCount}">
                <div class="row">
                    <div class="col-md-5">
                        <select class="form-control product-select variation-name" required>
                            <option value="">Select Type</option>
                            <option value="Size">Size</option>
                            <option value="Length">Length</option>
                            <option value="Color">Color</option>
                            <option value="Material">Material</option>
                            <option value="Type">Type</option>
                        </select>
                    </div>
                    <div class="col-md-5">
                        <input type="text" class="form-control product-input variation-value" placeholder="e.g., 2x2 x 8ft, 10ft, Red" required>
                    </div>
                    <div class="col-md-2">
                        <button type="button" class="btn btn-sm btn-danger remove-variation-btn">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        $('#variationsContainer').append(variationHtml);
    });
    
    // Remove variation button
    $(document).on('click', '.remove-variation-btn', function() {
        $(this).closest('.variation-item').remove();
    });
    
    // Add product form submission - use event delegation to ensure it works even if form is added dynamically
    $(document).on('submit', '#addProductForm', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('[Add Product] Form submission triggered');
        
        // Collect form data with null checks - safe handling for all fields
        const getFieldValue = (selector) => {
            const $field = $(selector);
            return $field.length > 0 ? ($field.val() || '') : '';
        };
        
        const getFieldValueTrim = (selector) => {
            const val = getFieldValue(selector);
            return val ? val.trim() : '';
        };
        
        const getFieldValueNumber = (selector) => {
            const val = getFieldValue(selector);
            return val ? parseFloat(val) : 0;
        };
        
        const getFieldValueInt = (selector) => {
            const val = getFieldValue(selector);
            return val ? parseInt(val) : 0;
        };
        
        const categoryValue = getFieldValue('#productCategory');
        // Convert category_id to number if it's a valid ID, otherwise keep as string (for backward compatibility)
        const categoryId = categoryValue && !isNaN(categoryValue) ? parseInt(categoryValue) : categoryValue;
        
        const productData = {
            product_name: getFieldValueTrim('#productName'),
            category_id: categoryId, // Use category_id (number) or category name (string) for backward compatibility
            price: getFieldValueNumber('#productPrice'),
            stock_level: getFieldValueInt('#productStock'),
            stock_unit: getFieldValue('#productStockUnit') || 'PC',
            minimum_stock: getFieldValueInt('#productMinStock'),
            description: getFieldValueTrim('#productDescription'),
            length: getFieldValue('#productLength') ? getFieldValueTrim('#productLength') : null,
            width: getFieldValue('#productWidth') ? getFieldValueNumber('#productWidth') : null,
            unit: getFieldValue('#productUnit') || null,
            weight: getFieldValue('#productWeight') ? getFieldValueNumber('#productWeight') : null,
            weight_unit: getFieldValue('#productWeightUnit') || null
        };
        
        console.log('[Add Product] Product data collected:', productData);
        
        // Validate required fields with detailed error messages
        const missingFields = [];
        if (!productData.product_name) missingFields.push('Product Name');
        if (!productData.category_id || productData.category_id === '' || productData.category_id === '0') {
            missingFields.push('Category');
        }
        if (!productData.price || isNaN(productData.price) || productData.price <= 0) {
            missingFields.push('Price');
        }
        if (!productData.stock_level || isNaN(productData.stock_level)) {
            missingFields.push('Stock Level');
        }
        if (!productData.minimum_stock || isNaN(productData.minimum_stock)) {
            missingFields.push('Minimum Stock');
        }
        if (!productData.description) {
            missingFields.push('Description');
        }
        
        if (missingFields.length > 0) {
            console.warn('[Add Product] Validation failed - missing required fields:', missingFields);
            AdminNotifications.warning(`Please fill in all required fields. Missing: ${missingFields.join(', ')}`, { duration: 5000 });
            return;
        }
        console.log('[Add Product] Validation passed');
        
        // Collect variations
        const variations = [];
        $('.variation-item').each(function() {
            const variationName = $(this).find('.variation-name').val();
            const variationValue = $(this).find('.variation-value').val();
            if (variationName && variationValue) {
                variations.push({
                    variation_name: variationName,
                    variation_value: variationValue.trim()
                });
            }
        });
        productData.variations = variations;
        
        // Handle image upload first if image is selected
        let imagePath = null;
        if (selectedImageFile) {
            try {
                const formData = new FormData();
                formData.append('image', selectedImageFile);
                formData.append('type', 'product');
                
                const uploadResponse = await fetch('../api/upload_product_image.php', {
                    method: 'POST',
                    body: formData,
                    credentials: 'include'
                });
                
                const uploadResult = await uploadResponse.json();
                if (uploadResult.success) {
                    imagePath = uploadResult.file_path;
                } else {
                    console.warn('Image upload failed:', uploadResult.message);
                }
            } catch (error) {
                console.error('Error uploading image:', error);
            }
        }
        
        if (imagePath) {
            productData.image_path = imagePath;
        }
        
        // Handle thumbnail uploads
        let thumbnailPaths = [];
        if (selectedThumbnailFiles.length > 0) {
            for (const thumbnailFile of selectedThumbnailFiles) {
                try {
                    const formData = new FormData();
                    formData.append('image', thumbnailFile);
                    formData.append('type', 'product');
                    
                    const uploadResponse = await fetch('../api/upload_product_image.php', {
                        method: 'POST',
                        body: formData,
                        credentials: 'include'
                    });
                    
                    const uploadResult = await uploadResponse.json();
                    if (uploadResult.success) {
                        thumbnailPaths.push(uploadResult.file_path);
                    } else {
                        console.warn('Thumbnail upload failed:', uploadResult.message);
                    }
                } catch (error) {
                    console.error('Error uploading thumbnail:', error);
                }
            }
        }
        
        if (thumbnailPaths.length > 0) {
            productData.thumbnails = thumbnailPaths; // Will be stored as JSON array
        }
        
        // Submit product data
        try {
            console.log('[Add Product] Submitting to API...');
            const response = await fetch('../api/add_product.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(productData),
                credentials: 'include'
            });
            
            console.log('[Add Product] API response status:', response.status);
            const result = await response.json();
            console.log('[Add Product] API response:', result);
            
            if (result.success) {
                AdminNotifications.apiResponse(result, {
                    title: 'Product Added',
                    duration: 3000
                });
                
                // Reset form
                $('#addProductForm')[0].reset();
                $('#variationsContainer').empty();
                variationCount = 0;
                selectedImageFile = null;
                selectedThumbnailFiles = [];
                $('#uploadImageBtn').html(`
                    <i class="fas fa-plus upload-icon"></i>
                    <span class="upload-text">Upload Main Image</span>
                `);
                $('#thumbnailsPreview').hide();
                $('#thumbnailsPreviewRow').empty();
                
                // Close modal
                $('#addProductModal').modal('hide');
                
                // Reload inventory
                if (window.loadInventory) {
                    window.loadInventory();
                } else {
                    location.reload();
                }
            } else {
                AdminNotifications.apiResponse(result, {
                    title: 'Add Product Failed',
                    duration: 7000
                });
            }
        } catch (error) {
            console.error('Error adding product:', error);
            AdminNotifications.error(`An error occurred while adding the product: ${error.message || 'Please try again.'}`, {
                details: { error: error.message, stack: error.stack }
            });
        }
    });
    
    // Variations are now managed inline in Edit Product modal via addVariationForm (manage_variations.js)
    
    // Edit main image upload
    $('#editUploadImageBtn').on('click', function() {
        $('#editProductImageInput').click();
    });
    $(document).on('click', '.change-image-btn', function() {
        editSelectedImageFile = null;
        $('#editUploadImageBtn').show();
        $('#editMainImagePreview').hide();
        $('#editProductImageInput').val('');
    });
    
    let editSelectedImageFile = null;
    $('#editProductImageInput').on('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            editSelectedImageFile = file;
            const reader = new FileReader();
            reader.onload = function(ev) {
                $('#editCurrentImage').attr('src', ev.target.result);
                $('#editUploadImageBtn').hide();
                $('#editMainImagePreview').show();
            };
            reader.readAsDataURL(file);
        }
    });
    
    // Edit thumbnail upload handlers
    let editSelectedThumbnailFiles = [];
    let editCurrentThumbnails = []; // Store current thumbnails from database
    
    $('#editUploadThumbnailsBtn').on('click', function() {
        $('#editProductThumbnailsInput').click();
    });
    
    $('#editProductThumbnailsInput').on('change', function(e) {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            editSelectedThumbnailFiles = files.slice(0, 4);
            const previewRow = $('#editThumbnailsPreviewRow');
            previewRow.empty();
            
            editSelectedThumbnailFiles.forEach((file, index) => {
                const reader = new FileReader();
                reader.onload = function(ev) {
                    const col = $('<div>').addClass('thumbnail-preview-item thumbnail-preview-new');
                    col.html(`
                        <img src="${ev.target.result}" alt="New thumbnail">
                        <button type="button" class="btn btn-sm btn-danger thumbnail-remove-btn" data-index="${index}"><i class="fas fa-times"></i></button>
                    `);
                    previewRow.append(col);
                };
                reader.readAsDataURL(file);
            });
        }
    });
    
    $(document).on('click', '.thumbnail-remove-btn', function() {
        const index = parseInt($(this).data('index'), 10);
        editSelectedThumbnailFiles.splice(index, 1);
        $('#editProductThumbnailsInput').val('');
        
        const previewRow = $('#editThumbnailsPreviewRow');
        previewRow.empty();
        
        editSelectedThumbnailFiles.forEach((file, idx) => {
            const reader = new FileReader();
            reader.onload = function(ev) {
                const col = $('<div>').addClass('thumbnail-preview-item thumbnail-preview-new');
                col.html(`
                    <img src="${ev.target.result}" alt="New thumbnail">
                    <button type="button" class="btn btn-sm btn-danger thumbnail-remove-btn" data-index="${idx}"><i class="fas fa-times"></i></button>
                `);
                previewRow.append(col);
            };
            reader.readAsDataURL(file);
        });
    });
    
    // Edit product form submission
    $('#editProductForm').on('submit', async function(e) {
        e.preventDefault();
        
        const productId = $('#editProductId').val();
        if (!productId) {
            AdminNotifications.warning('Product ID is missing', { duration: 4000 });
            return;
        }
        
        // Helper functions for safe field access (reuse from add product)
        const getFieldValue = (selector) => {
            const $field = $(selector);
            return $field.length > 0 ? ($field.val() || '') : '';
        };
        
        const getFieldValueTrim = (selector) => {
            const val = getFieldValue(selector);
            return val ? val.trim() : '';
        };
        
        const getFieldValueNumber = (selector) => {
            const val = getFieldValue(selector);
            return val ? parseFloat(val) : 0;
        };
        
        const getFieldValueInt = (selector) => {
            const val = getFieldValue(selector);
            return val ? parseInt(val) : 0;
        };
        
        // Collect form data with safe null checks
        const categoryValue = getFieldValue('#editProductCategory');
        const categoryId = categoryValue && !isNaN(categoryValue) ? parseInt(categoryValue) : categoryValue;
        
        const stockFieldDisabled = $('#editProductStock').prop('disabled');
        const productData = {
            product_id: parseInt(productId),
            product_name: getFieldValueTrim('#editProductName'),
            category_id: categoryId, // Use category_id (number) or category name (string) for backward compatibility
            price: getFieldValueNumber('#editProductPrice'),
            stock_unit: getFieldValue('#editProductStockUnit') || 'PC',
            minimum_stock: getFieldValueInt('#editProductMinStock'),
            description: getFieldValueTrim('#editProductDescription'),
            length: getFieldValue('#editProductLength') ? getFieldValueTrim('#editProductLength') : null,
            width: getFieldValue('#editProductWidth') ? getFieldValueNumber('#editProductWidth') : null,
            unit: getFieldValue('#editProductUnit') || null,
            weight: getFieldValue('#editProductWeight') ? getFieldValueNumber('#editProductWeight') : null,
            weight_unit: getFieldValue('#editProductWeightUnit') || null
        };
        // When stock is managed per variation, do not send stock_level (leave product-level stock unchanged)
        if (!stockFieldDisabled) {
            productData.stock_level = getFieldValueInt('#editProductStock');
        }
        
        console.log('[Update Product] Form submission triggered');
        console.log('[Update Product] Product data collected:', productData);
        
        // Validate required fields (stock_level not required when managed by variations)
        if (!productData.product_name || !productData.category_id || !productData.price || 
            !productData.minimum_stock || !productData.description) {
            AdminNotifications.warning('Please fill in all required fields.', { duration: 4000 });
            return;
        }
        if (!stockFieldDisabled && (productData.stock_level === undefined || productData.stock_level === null || isNaN(productData.stock_level))) {
            AdminNotifications.warning('Please enter stock quantity.', { duration: 4000 });
            return;
        }
        
        // Variations are managed separately via addVariationForm (manage_product_variations API)
        // Do not send variations with product update - they are add/edit/deleted in-place
        
        // Handle main image upload first if image is selected
        if (editSelectedImageFile) {
            try {
                const formData = new FormData();
                formData.append('image', editSelectedImageFile);
                formData.append('type', 'product');
                
                const uploadResponse = await fetch('../api/upload_product_image.php', {
                    method: 'POST',
                    body: formData,
                    credentials: 'include'
                });
                
                const uploadResult = await uploadResponse.json();
                if (uploadResult.success) {
                    productData.image_path = uploadResult.file_path;
                } else {
                    console.warn('Image upload failed:', uploadResult.message);
                }
            } catch (error) {
                console.error('Error uploading image:', error);
            }
        }
        
        // Handle thumbnail uploads (new thumbnails will replace existing ones)
        let thumbnailPaths = [];
        if (editSelectedThumbnailFiles.length > 0) {
            for (const thumbnailFile of editSelectedThumbnailFiles) {
                try {
                    const formData = new FormData();
                    formData.append('image', thumbnailFile);
                    formData.append('type', 'product');
                    
                    const uploadResponse = await fetch('../api/upload_product_image.php', {
                        method: 'POST',
                        body: formData,
                        credentials: 'include'
                    });
                    
                    const uploadResult = await uploadResponse.json();
                    if (uploadResult.success) {
                        thumbnailPaths.push(uploadResult.file_path);
                    } else {
                        console.warn('Thumbnail upload failed:', uploadResult.message);
                    }
                } catch (error) {
                    console.error('Error uploading thumbnail:', error);
                }
            }
        }
        
        // If new thumbnails are uploaded, replace existing ones
        // If no new thumbnails, keep existing ones (don't send thumbnails field)
        if (thumbnailPaths.length > 0) {
            productData.thumbnails = thumbnailPaths; // Will replace existing thumbnails
        }
        // If no new thumbnails uploaded, existing thumbnails will be preserved (API handles this)
        
        console.log('[Update Product] Validation passed');
        console.log('[Update Product] Submitting to API...');
        
        // Submit product update
        try {
            const response = await fetch('../api/update_product.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(productData),
                credentials: 'include'
            });
            
            console.log('[Update Product] API response status:', response.status);
            const result = await response.json();
            console.log('[Update Product] API response:', result);
            
            if (result.success) {
                alert(`Product "${productData.product_name}" updated successfully!`);
                
                // Reset form
                $('#editProductForm')[0].reset();
                editSelectedImageFile = null;
                editSelectedThumbnailFiles = [];
                editCurrentThumbnails = [];
                $('#editUploadImageBtn').show();
                $('#editMainImagePreview').hide();
                $('#editCurrentThumbnailsRow').empty();
                $('#editThumbnailsPreviewRow').empty();
                
                // Close modal
                $('#editProductModal').modal('hide');
                
                // Reload inventory
                if (window.loadInventory) {
                    window.loadInventory();
                } else {
                    location.reload();
                }
            } else {
                alert(`Error: ${result.message || 'Failed to update product'}`);
            }
        } catch (error) {
            console.error('Error updating product:', error);
            alert('An error occurred while updating the product. Please try again.');
        }
    });
    
    // Delete product button
    $('#deleteProductBtn').on('click', async function() {
        const productId = $('#editProductId').val();
        const productName = $('#editProductName').val();
        
        if (!productId) {
            AdminNotifications.warning('Product ID is missing', { duration: 4000 });
            return;
        }
        
        // Show custom confirmation dialog
        const confirmDelete = await AdminNotifications.confirm(
            `Are you sure you want to delete "${productName || 'this product'}"?\n\n` +
            `This action cannot be undone. The product and all its variations will be permanently deleted.\n\n` +
            `Note: Products that are associated with existing orders cannot be deleted.`,
            {
                title: 'Delete Product',
                confirmText: 'Delete',
                cancelText: 'Cancel',
                danger: true
            }
        );
        
        if (!confirmDelete) {
            return;
        }
        
        // Show loading state
        const deleteBtn = $(this);
        const originalBtnHtml = deleteBtn.html();
        deleteBtn.html('<i class="fas fa-spinner fa-spin"></i> Deleting...').prop('disabled', true);
        
        try {
            const response = await fetch('../api/delete_product.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    product_id: parseInt(productId)
                }),
                credentials: 'include'
            });
            
            const result = await response.json();
            
            if (result.success) {
                AdminNotifications.success(`Product "${productName || 'Product'}" has been deleted successfully!`, {
                    duration: 3000
                });
                
                // Close modal
                $('#editProductModal').modal('hide');
                
                // Reset form
                $('#editProductForm')[0].reset();
                editSelectedImageFile = null;
                $('#editUploadImageBtn').show();
                $('#editMainImagePreview').hide();
                $('#editCurrentThumbnailsRow').empty();
                $('#editThumbnailsPreviewRow').empty();
                
                // Reload inventory
                if (window.loadInventory) {
                    window.loadInventory();
                } else {
                    location.reload();
                }
            } else {
                AdminNotifications.apiResponse(result, {
                    title: 'Delete Product Failed',
                    duration: 7000
                });
                deleteBtn.html(originalBtnHtml).prop('disabled', false);
            }
        } catch (error) {
            console.error('Error deleting product:', error);
            AdminNotifications.error('An error occurred while deleting the product. Please try again.');
            deleteBtn.html(originalBtnHtml).prop('disabled', false);
        }
    });
    
    // More filters button (placeholder)
    $('#more-filters-btn').on('click', function() {
        AdminNotifications.info('Advanced filters functionality would be implemented here.', { duration: 3000 });
    });
    
    console.log('Inventory Admin page loaded with', products.length, 'products');
    
    // Additional click handler for the submit button as fallback
    $(document).on('click', '#addProductSubmitBtn, .add-product-submit-btn[form="addProductForm"]', function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('[Add Product] Submit button clicked (footer button)');
        // Trigger form submission
        const form = document.getElementById('addProductForm');
        if (form) {
            form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        } else {
            console.error('[Add Product] Form not found!');
        }
    });
    
    // Also handle the submit button inside the form
    $(document).on('click', '#addProductForm button[type="submit"]', function(e) {
        console.log('[Add Product] Form submit button clicked (inside form)');
        // Let the form submit handler take over - don't prevent default
    });
});