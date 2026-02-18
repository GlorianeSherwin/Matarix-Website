/**
 * Manage Product Variations
 * Handles UI and API interactions for managing product variations
 */

let currentProductId = null;
let currentVariations = [];

// Handle variations button click - open Edit Product modal (variations are inside it)
$(document).on('click', '.variations-btn', function() {
    const productId = $(this).data('product');
    if (productId) {
        $('.edit-btn[data-product="' + productId + '"]').trigger('click');
    }
});

// Load product variations from API (called when Edit Product modal opens)
// Exposed globally for load_inventory.js
async function loadProductVariations(productId) {
    currentProductId = productId;
    try {
        const response = await fetch(`../api/get_product_variations.php?product_id=${productId}&_=${Date.now()}`, {
            method: 'GET',
            credentials: 'include',
            cache: 'no-store'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            // Store variations
            currentVariations = data.variations || [];
            
            // Display variations
            displayVariations(currentVariations);
            return currentVariations;
        } else {
            alert('Failed to load variations: ' + (data.message || 'Unknown error'));
            return [];
        }
    } catch (error) {
        console.error('Error loading variations:', error);
        alert('Error loading variations. Please try again.');
        return [];
    }
}

// Display variations in the list
function displayVariations(variations) {
    const variationsList = $('#variationsList');
    variationsList.empty();
    
    if (variations.length === 0) {
        variationsList.html('<p class="text-muted">No variations added yet.</p>');
        return;
    }
    
    // Group variations by type
    const grouped = {};
    variations.forEach(variation => {
        const type = variation.variation_name;
        if (!grouped[type]) {
            grouped[type] = [];
        }
        grouped[type].push(variation);
    });
    
    // Display grouped variations
    Object.keys(grouped).forEach(type => {
        const typeDiv = $('<div class="variation-type-group mb-3"></div>');
        const typeHeader = $(`<h6 class="text-primary mb-2"><i class="fas fa-tag mr-2"></i>${type}</h6>`);
        typeDiv.append(typeHeader);
        
        const variationsContainer = $('<div class="row"></div>');
        
        grouped[type].forEach(variation => {
            const extras = [];
            if (variation.price_modifier != null && variation.price_modifier !== '') extras.push(`Price: ${Number(variation.price_modifier) >= 0 ? '+' : ''}${variation.price_modifier}`);
            if (variation.stock_level != null && variation.stock_level !== '') extras.push(`Stock: ${variation.stock_level}`);
            if (variation.sku) extras.push(`SKU: ${escapeHtml(variation.sku)}`);
            const extrasHtml = extras.length ? `<small class="text-muted d-block mt-1">${extras.join(' | ')}</small>` : '';
            const variationCard = $(`
                <div class="col-md-6 mb-2">
                    <div class="card variation-card">
                        <div class="card-body p-2">
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    <strong>${escapeHtml(variation.variation_value)}</strong>
                                    ${extrasHtml}
                                </div>
                                <div class="variation-actions">
                                    <button class="btn btn-sm btn-outline-primary edit-variation-btn" data-variation-id="${variation.Variation_ID}" title="Edit">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button class="btn btn-sm btn-outline-danger delete-variation-btn" data-variation-id="${variation.Variation_ID}" title="Delete">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `);
            variationsContainer.append(variationCard);
        });
        
        typeDiv.append(variationsContainer);
        variationsList.append(typeDiv);
    });
}

// Handle edit variation button click
$(document).on('click', '.edit-variation-btn', function() {
    const variationId = $(this).data('variation-id');
    const variation = currentVariations.find(v => v.Variation_ID == variationId);
    
    if (!variation) return;
    
    // Populate form with existing values
    $('#variationName').val(variation.variation_name);
    $('#variationValue').val(variation.variation_value);
    $('#variationPriceModifier').val(variation.price_modifier != null && variation.price_modifier !== '' ? variation.price_modifier : '');
    $('#variationStock').val(variation.stock_level != null && variation.stock_level !== '' ? variation.stock_level : '');
    $('#variationSku').val(variation.sku || '');
    if (variation.image_path) {
        $('#variationImage').val(variation.image_path);
        $('#variationImageImg').attr('src', '../' + variation.image_path);
        $('#variationImagePlaceholder').hide();
        $('#variationImagePreview').show();
    } else {
        $('#variationImage').val('');
        $('#variationImagePlaceholder').show();
        $('#variationImagePreview').hide();
    }
    
    // Change form to edit mode
    $('#addVariationForm').data('edit-mode', true);
    $('#addVariationForm').data('variation-id', variationId);
    $('#addVariationSubmitBtn').html('<i class="fas fa-save"></i> Update');
    $('#addVariationFormTitle').text('Edit Variation');
    
    // Scroll to form
    $('html, body').animate({
        scrollTop: $('#addVariationForm').offset().top - 100
    }, 500);
});

// Handle delete variation button click
$(document).on('click', '.delete-variation-btn', function() {
    const variationId = $(this).data('variation-id');
    const variation = currentVariations.find(v => v.Variation_ID == variationId);
    
    if (!variation) return;
    
    // Use custom confirmation dialog
    AdminNotifications.confirm(
        `Are you sure you want to delete the variation "${variation.variation_value}"?`,
        {
            title: 'Delete Variation',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            danger: true
        }
    ).then(confirmed => {
        if (confirmed) {
            deleteVariation(variationId);
        }
    });
});

// Delete variation
async function deleteVariation(variationId) {
    try {
        const response = await fetch('../api/manage_product_variations.php', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                variation_id: variationId
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Reload variations
            await loadProductVariations(currentProductId);
            showNotification('Variation deleted successfully!', 'success');
        } else {
            alert('Failed to delete variation: ' + (data.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error deleting variation:', error);
        alert('Error deleting variation. Please try again.');
    }
}

// Handle add/edit variation button click (was form submit - changed to avoid nested form)
$(document).on('click', '#addVariationSubmitBtn', async function() {
    const isEditMode = $('#addVariationForm').data('edit-mode');
    const variationName = $('#variationName').val();
    const variationValue = $('#variationValue').val();
    
    if (!variationName || !variationValue) {
        alert('Please fill in all fields');
        return;
    }
    
    try {
        let response;
        
        const extras = getVariationExtrasPayload();
        
        if (isEditMode) {
            // Update existing variation
            const variationId = $('#addVariationForm').data('variation-id');
            response = await fetch('../api/manage_product_variations.php', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    variation_id: variationId,
                    variation_name: variationName,
                    variation_value: variationValue,
                    ...extras
                })
            });
        } else {
            // Add new variation
            response = await fetch('../api/manage_product_variations.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    product_id: currentProductId,
                    variation_name: variationName,
                    variation_value: variationValue,
                    ...extras
                })
            });
        }
        
        const data = await response.json();
        
        if (data.success) {
            // Reload variations
            await loadProductVariations(currentProductId);
            
            // Reset form
            resetVariationForm();
            
            showNotification(isEditMode ? 'Variation updated successfully!' : 'Variation added successfully!', 'success');
        } else {
            alert('Failed to ' + (isEditMode ? 'update' : 'add') + ' variation: ' + (data.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error saving variation:', error);
        alert('Error saving variation. Please try again.');
    }
});

// Reset variation form
function resetVariationForm() {
    $('#variationName').val('');
    $('#variationValue').val('');
    $('#variationPriceModifier').val('');
    $('#variationStock').val('');
    $('#variationSku').val('');
    $('#addVariationForm').removeData('edit-mode');
    $('#addVariationForm').removeData('variation-id');
    $('#addVariationSubmitBtn').html('<i class="fas fa-plus"></i> Add');
    $('#addVariationFormTitle').text('Add New Variation');
    // Reset variation image upload
    $('#variationImage').val('');
    $('#variationImageInput').val('');
    $('#variationImagePlaceholder').show();
    $('#variationImagePreview').hide();
}

// Variation image upload - click placeholder to select file
$('#variationImagePlaceholder').on('click', function() {
    $('#variationImageInput').click();
});
$('#variationImageInput').on('change', async function(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
        const formData = new FormData();
        formData.append('image', file);
        const response = await fetch('../api/upload_product_image.php', {
            method: 'POST',
            credentials: 'include',
            body: formData
        });
        const result = await response.json();
        if (result.success && result.file_path) {
            $('#variationImage').val(result.file_path);
            $('#variationImageImg').attr('src', '../' + result.file_path);
            $('#variationImagePlaceholder').hide();
            $('#variationImagePreview').show();
        } else {
            alert(result.message || 'Image upload failed');
        }
    } catch (err) {
        console.error('Variation image upload error:', err);
        alert('Image upload failed. Please try again.');
    }
});
$(document).on('click', '.variation-image-remove', function() {
    $('#variationImage').val('');
    $('#variationImageInput').val('');
    $('#variationImagePlaceholder').show();
    $('#variationImagePreview').hide();
});

// Build payload for optional variation fields (price_modifier, stock_level, image_path, sku)
function getVariationExtrasPayload() {
    const payload = {};
    const pm = $('#variationPriceModifier').val();
    if (pm !== '') {
        const n = parseFloat(pm);
        if (!isNaN(n)) payload.price_modifier = n;
    }
    const st = $('#variationStock').val();
    if (st !== '') {
        const n = parseInt(st, 10);
        if (!isNaN(n) && n >= 0) payload.stock_level = n;
    }
    const sku = $('#variationSku').val();
    if (sku && sku.trim()) payload.sku = sku.trim();
    const img = $('#variationImage').val();
    if (img && img.trim()) payload.image_path = img.trim();
    return payload;
}

// Reset variation form when Edit Product modal is closed
$('#editProductModal').on('hidden.bs.modal', function() {
    resetVariationForm();
    currentProductId = null;
    currentVariations = [];
});

// Show notification
function showNotification(message, type = 'info') {
    // Simple alert for now - can be enhanced with toast notifications
    const alertClass = type === 'success' ? 'alert-success' : 'alert-info';
    const alert = $(`
        <div class="alert ${alertClass} alert-dismissible fade show" role="alert" style="position: fixed; top: 20px; right: 20px; z-index: 9999; min-width: 300px;">
            ${message}
            <button type="button" class="close" data-dismiss="alert" aria-label="Close">
                <span aria-hidden="true">&times;</span>
            </button>
        </div>
    `);
    
    $('body').append(alert);
    
    // Auto-dismiss after 3 seconds
    setTimeout(() => {
        alert.alert('close');
    }, 3000);
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, function(m) { return map[m]; });
}

