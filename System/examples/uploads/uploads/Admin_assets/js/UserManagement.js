$(document).ready(function() {
    // Global variables
    let currentPage = 1;
    let totalPages = 1;
    let currentFilters = {
        role: '',
        status: '',
        search: ''
    };
    let currentUserId = null;
    let isLoading = false; // Prevent multiple simultaneous requests
    let userRole = null; // Store user role
    let isAdmin = false; // Flag to check if user is Admin
    let rbacConfig = null; // Loaded from ../config/rbac.json
    const usersCacheById = new Map(); // Cache current page users for view/edit

    // If we were redirected here due to RBAC, show a one-time message
    try {
        const deniedMsg = sessionStorage.getItem('rbac_denied_message');
        if (deniedMsg) {
            sessionStorage.removeItem('rbac_denied_message');
            if (window.AdminNotifications) {
                AdminNotifications.warning(deniedMsg, { duration: 4000 });
            }
        }
    } catch (e) {
        // ignore
    }

    async function loadRbacConfig() {
        if (rbacConfig) return rbacConfig;
        try {
            const res = await fetch('../config/rbac.json', { cache: 'no-store' });
            if (!res.ok) throw new Error(`Failed to load RBAC config (${res.status})`);
            rbacConfig = await res.json();
            return rbacConfig;
        } catch (e) {
            console.warn('[RBAC] Could not load config:', e);
            rbacConfig = null;
            return null;
        }
    }

    function mapRoleValueToDbRole(roleValue) {
        const roleMap = {
            'admin': 'Admin',
            'employee': 'Store Employee',
            'delivery-driver': 'Delivery Driver',
            'customer': 'Customer'
        };
        return roleMap[roleValue] || roleValue || '';
    }

    async function renderRolePermissionPreview(roleValue) {
        const $preview = $('#rolePermissionPreview');
        if ($preview.length === 0) return;

        if (!roleValue) {
            $preview.html('<small class="text-muted">Select a role to preview its fixed permissions. Permissions are locked after account creation.</small>');
            return;
        }

        const cfg = await loadRbacConfig();
        const dbRole = mapRoleValueToDbRole(roleValue);
        if (!cfg || !cfg.roles || !cfg.roles[dbRole]) {
            $preview.html(`<small class="text-muted">Permissions preview unavailable for role: <strong>${escapeHtml(dbRole || roleValue)}</strong></small>`);
            return;
        }

        const roleCfg = cfg.roles[dbRole];
        const perms = Array.isArray(roleCfg.permissions) ? roleCfg.permissions : [];
        if (perms.includes('*')) {
            $preview.html('<div><strong>Admin</strong>: Full access to all system functions.</div>');
            return;
        }

        const labels = cfg.permissionLabels || {};
        const items = perms
            .map(p => labels[p] || p)
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b));

        if (items.length === 0) {
            $preview.html('<small class="text-muted">No permissions defined for this role.</small>');
            return;
        }

        const listHtml = items.map(t => `<li>${escapeHtml(t)}</li>`).join('');
        $preview.html(`
            <div style="margin-bottom: 6px;"><strong>${escapeHtml(dbRole)}</strong> permissions:</div>
            <ul>${listHtml}</ul>
            <small class="text-muted">These permissions are predefined and cannot be changed after account creation.</small>
        `);
    }

    // Check user role and restrict access if not Admin
    async function checkUserRoleAndRestrict() {
        try {
            // Get role from sessionStorage first
            userRole = sessionStorage.getItem('user_role');
            
            // If not in sessionStorage, check via API
            if (!userRole) {
                const response = await fetch('../api/check_session.php', {
                    method: 'GET',
                    credentials: 'include'
                });
                if (response.ok) {
                    const data = await response.json();
                    userRole = data.user_role || null;
                    if (userRole) {
                        sessionStorage.setItem('user_role', userRole);
                    }
                }
            }
            
            // Check if user is Admin
            isAdmin = userRole === 'Admin';
            
            if (!isAdmin) {
                // Hide/disable all interactive elements
                $('#add-user-btn').hide();
                $('#delete-selected-btn').hide();
                
                // Disable all action buttons in the table
                $('.edit-user-btn, .delete-user-btn, .view-user-btn').prop('disabled', true).css('opacity', '0.5');
                
                // Disable checkboxes
                $('.user-checkbox, #select-all').prop('disabled', true);
                
                // Show access denied message
                const accessDeniedMessage = `
                    <div class="alert alert-warning" style="margin: 20px; padding: 20px; text-align: center;">
                        <i class="fas fa-lock" style="font-size: 48px; color: #856404; margin-bottom: 15px;"></i>
                        <h4 style="color: #856404; margin-bottom: 10px;">Access Restricted</h4>
                        <p style="margin: 0; color: #856404;">
                            Only users with <strong>Admin</strong> role can manage users.<br>
                            Your current role: <strong>${userRole || 'Unknown'}</strong>
                        </p>
                    </div>
                `;
                
                // Insert message at the top of main content
                $('.main-content').prepend(accessDeniedMessage);
                
                // Hide the add user section
                $('.add-user-section').hide();
                
                console.log('[User Management] Access restricted - User role:', userRole);
            } else {
                console.log('[User Management] Admin access granted');
            }
        } catch (error) {
            console.error('Error checking user role:', error);
            // On error, still restrict access for safety
            isAdmin = false;
            $('#add-user-btn').hide();
            $('#delete-selected-btn').hide();
        }
    }

    // Initialize address selector for add user modal
    $('#addUserModal').on('shown.bs.modal', function() {
        if (!isAdmin) {
            $(this).modal('hide');
            return false;
        }
        initializeAddressSelector('addAddress');
        // Reset address fields
        $('#addAddressRegion').val('').trigger('change');
    });

    // Check role and restrict access first
    checkUserRoleAndRestrict().then(() => {
        // Only initialize if user is Admin
        if (isAdmin) {
            initializeUserManagement();
        } else {
            // Still try to load users (read-only) but show restricted message
            loadUsers().catch(err => {
                console.error('Failed to load users:', err);
            });
        }
    });

    /**
     * Initialize user management system
     */
    async function initializeUserManagement() {
        try {
            // First, ensure status and last_login columns exist
            await fetch('../api/add_user_status_column.php', { credentials: 'include' });
            await fetch('../api/add_last_login_column.php', { credentials: 'include' });
            
            // Load users
            await loadUsers();
        } catch (error) {
            console.error('Initialization error:', error);
            showError('Failed to initialize user management system');
        }
    }

    /**
     * Load users from API
     */
    async function loadUsers(page = 1) {
        // Prevent multiple simultaneous requests
        if (isLoading) {
            return;
        }
        
        try {
            isLoading = true;
            currentPage = page;
            
            // Show loading state
            const tbody = $('#users-table-body');
            tbody.html(`
                <tr class="user-row loading-row">
                    <td colspan="9" class="text-center">
                        <div class="spinner-border text-primary" role="status">
                            <span class="sr-only">Loading...</span>
                        </div>
                        <p class="mt-2">Loading users...</p>
                    </td>
                </tr>
            `);
            
            const params = new URLSearchParams({
                page: page,
                limit: 10,
                ...currentFilters
            });

            const response = await fetch(`../api/get_users.php?${params}`, {
                method: 'GET',
                credentials: 'include' // Include cookies for session
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                } catch (e) {
                    errorData = { message: errorText || `HTTP error! status: ${response.status}` };
                }
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();

            if (data.success) {
                displayUsers(data.users);
                updatePagination(data.pagination);
            } else {
                showError(data.message || 'Failed to load users');
                tbody.html(`
                    <tr class="user-row">
                        <td colspan="9" class="text-center text-danger">
                            <p class="mt-2">${data.message || 'Failed to load users'}</p>
                        </td>
                    </tr>
                `);
            }
        } catch (error) {
            console.error('Load users error:', error);
            let errorMessage = 'Failed to load users. Please try again.';
            if (error.message) {
                errorMessage += ' Error: ' + error.message;
            }
            showError(errorMessage);
            
            // Show error in table
            const tbody = $('#users-table-body');
            tbody.html(`
                <tr class="user-row">
                    <td colspan="9" class="text-center text-danger">
                        <p class="mt-2">Error loading users. Please try again.</p>
                        <small class="text-muted">${error.message || 'Unknown error'}</small>
                    </td>
                </tr>
            `);
        } finally {
            isLoading = false;
        }
    }

    /**
     * Display users in the table
     */
    function displayUsers(users) {
        const tbody = $('#users-table-body');
        tbody.empty();
        usersCacheById.clear();
        
        // Hide delete selected button and uncheck select all when reloading
        $('#delete-selected-btn').hide();
        $('#select-all').prop('checked', false);
        
        // Disable select all checkbox if not admin
        if (!isAdmin) {
            $('#select-all').prop('disabled', true);
        } else {
            $('#select-all').prop('disabled', false);
        }

        if (users.length === 0) {
            tbody.html(`
                <tr class="user-row">
                    <td colspan="9" class="text-center">
                        <p class="mt-2">No users found</p>
                    </td>
                </tr>
            `);
            return;
        }

        users.forEach(user => {
            usersCacheById.set(String(user.user_id), user);
            const statusClass = getStatusClass(user.status);
            const statusText = getStatusText(user.status);
            const roleDisplay = getRoleDisplay(user.role);
            const createdDate = formatDate(user.created_at);
            const lastLoginText = formatDateTime(user.last_login);
            const phoneText = user.phone_number ? escapeHtml(user.phone_number) : '<span class="text-muted">—</span>';

            const row = `
                <tr class="user-row" data-user-id="${user.user_id}">
                    <td><input type="checkbox" class="user-checkbox" data-user-id="${user.user_id}" ${!isAdmin ? 'disabled' : ''}></td>
                    <td>
                        <div class="user-info">
                            <div class="user-avatar"><i class="fas fa-user-circle"></i></div>
                            <span class="user-name">${escapeHtml(user.full_name || 'N/A')}</span>
                        </div>
                    </td>
                    <td class="user-email">${escapeHtml(user.email)}</td>
                    <td class="user-contact">${phoneText}</td>
                    <td class="user-role">${escapeHtml(roleDisplay)}</td>
                    <td><span class="status-badge ${statusClass}">${escapeHtml(statusText)}</span></td>
                    <td class="created-date">${createdDate}</td>
                    <td class="last-login">${lastLoginText}</td>
                    <td>
                        <div class="user-actions">
                            <button class="action-btn view-btn" data-user-id="${user.user_id}" title="View User"><i class="fas fa-eye"></i></button>
                            ${isAdmin ? `
                                <button class="action-btn edit-btn" data-user-id="${user.user_id}" title="Edit User"><i class="fas fa-edit"></i></button>
                            ` : `
                                <button class="action-btn edit-btn" data-user-id="${user.user_id}" title="Edit User" disabled style="opacity: 0.5; cursor: not-allowed;"><i class="fas fa-edit"></i></button>
                            `}
                        </div>
                    </td>
                </tr>
            `;
            tbody.append(row);
        });

        // Re-attach event handlers
        attachUserRowHandlers();
    }

    /**
     * Update pagination controls
     */
    function updatePagination(pagination) {
        totalPages = pagination.total_pages || 1;
        const start = ((currentPage - 1) * pagination.limit) + 1;
        const end = Math.min(currentPage * pagination.limit, pagination.total);
        
        $('#showing-info').text(`Showing ${start}-${end} out of ${pagination.total} Users`);
        $('#current-page').text(currentPage);
        
        $('#prev-btn').prop('disabled', currentPage <= 1);
        $('#next-btn').prop('disabled', currentPage >= totalPages);
    }

    /**
     * Get status CSS class
     */
    function getStatusClass(status) {
        const statusMap = {
            'active': 'status-active',
            'inactive': 'status-pending',
            'pending': 'status-pending',
            'archived': 'status-archived'
        };
        return statusMap[status] || 'status-pending';
    }

    /**
     * Get status display text
     */
    function getStatusText(status) {
        const statusMap = {
            'active': 'Active',
            'inactive': 'Inactive',
            'pending': 'Pending',
            'archived': 'Archived'
        };
        return statusMap[status] || 'Pending';
    }

    /**
     * Get role display text
     */
    function getRoleDisplay(role) {
        const roleMap = {
            'Admin': 'Admin',
            'Store Employee': 'Store Employee',
            'Customer': 'Customer',
            'Delivery Driver': 'Delivery Driver'
        };
        return roleMap[role] || role;
    }

    /**
     * Format date
     */
    function formatDate(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }

    function formatDateTime(dateString) {
        if (!dateString) return '<span class="text-muted">Never</span>';
        const date = new Date(dateString);
        if (Number.isNaN(date.getTime())) return '<span class="text-muted">Never</span>';
        return escapeHtml(date.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }));
    }

    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(text) {
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
     * Attach event handlers to user rows
     */
    function attachUserRowHandlers() {
        // View button (allowed for all authenticated users)
        $('.view-btn').off('click').on('click', function() {
            const userId = $(this).data('user-id');
            viewUser(userId);
        });

        // Edit button (Admin only)
        $('.edit-btn').off('click').on('click', function() {
            if (!isAdmin) {
                if (typeof AdminNotifications !== 'undefined') {
                    AdminNotifications.warning('Only Admin role can edit users.', { duration: 4000 });
                } else {
                    console.warn('Only Admin role can edit users.');
                }
                return;
            }
            const userId = $(this).data('user-id');
            editUser(userId);
        });

        // Toggle status button removed - status can be changed via Edit User modal
    }

    /**
     * View user details - show in modal
     */
    async function viewUser(userId) {
        try {
            const cached = usersCacheById.get(String(userId));
            if (cached) {
                const user = cached;
                    // Populate view modal
                    $('#viewUserName').text(user.full_name || 'N/A');
                    $('#viewUserEmail').text(user.email || 'N/A');
                    $('#viewUserId').text(user.user_id || 'N/A');
                    $('#viewUserRole').text(getRoleDisplay(user.role));
                    $('#viewUserPhone').text(user.phone_number || 'N/A');
                    $('#viewUserAddress').text(user.address || 'N/A');
                    $('#viewUserCreated').text(formatDate(user.created_at) || 'N/A');
                    
                    // Format last login
                    if (user.last_login) {
                        $('#viewUserLastLogin').text(formatDate(user.last_login));
                    } else {
                        $('#viewUserLastLogin').html('<span class="text-muted">Never logged in</span>');
                    }
                    
                    // Set status badge
                    const statusClass = getStatusClass(user.status);
                    const statusText = getStatusText(user.status);
                    $('#viewUserStatus').html(`<span class="status-badge ${statusClass}">${escapeHtml(statusText)}</span>`);
                    
                    // Show modal
                    $('#viewUserModal').modal('show');
                return;
            }

            // Fallback to fetch by ID (robust for pagination)
            const response = await fetch(`../api/get_user.php?user_id=${encodeURIComponent(userId)}`, {
                method: 'GET',
                credentials: 'include'
            });
            const data = await response.json();
            if (!data.success || !data.user) {
                showError(data.message || 'User not found');
                return;
            }
            const user = data.user;
            $('#viewUserName').text(user.full_name || 'N/A');
            $('#viewUserEmail').text(user.email || 'N/A');
            $('#viewUserId').text(user.user_id || 'N/A');
            $('#viewUserRole').text(getRoleDisplay(user.role));
            $('#viewUserPhone').text(user.phone_number || 'N/A');
            $('#viewUserAddress').text(user.address || 'N/A');
            $('#viewUserCreated').text(formatDate(user.created_at) || 'N/A');
            if (user.last_login) {
                $('#viewUserLastLogin').text(formatDate(user.last_login));
            } else {
                $('#viewUserLastLogin').html('<span class="text-muted">Never logged in</span>');
            }
            const statusClass = getStatusClass(user.status);
            const statusText = getStatusText(user.status);
            $('#viewUserStatus').html(`<span class="status-badge ${statusClass}">${escapeHtml(statusText)}</span>`);
            $('#viewUserModal').modal('show');
        } catch (error) {
            console.error('View user error:', error);
            showError('Failed to load user details');
        }
    }

    /**
     * Edit user - load user data into modal
     */
    async function editUser(userId) {
        try {
            currentUserId = userId;
            const cached = usersCacheById.get(String(userId));
            const user = cached || null;
            if (user) {
                    // Populate edit modal
                    $('#firstName').val(user.first_name || '');
                    $('#middleName').val(user.middle_name || '');
                    $('#lastName').val(user.last_name || '');
                    $('#emailAddress').val(user.email || '');
                    $('#phoneNumber').val(user.phone_number || '');
                    // Populate structured address fields
                    $('#editAddressStreet').val(user.address_street || '');
                    $('#editAddressPostalCode').val(user.address_postal_code || '');
                    $('#editUserId').val(user.user_id);
                    
                    // Clear and reset address dropdowns before initializing
                    $('#editAddressRegion').val('').trigger('change');
                    $('#editAddressDistrict').empty().append('<option value="">Select Province/District</option>');
                    $('#editAddressCity').empty().append('<option value="">Select City/Municipality</option>');
                    $('#editAddressBarangay').empty().append('<option value="">Select Barangay</option>');
                    
                    // Clear loading flags
                    $('#editAddressCity').removeData('loading');
                    $('#editAddressBarangay').removeData('loading');
                    
                    // Initialize address selector for edit modal
                    initializeAddressSelector('editAddress');
                    
                    // Set address dropdowns using cascading selector
                    if (user.address_region) {
                        setAddressValues('editAddress', {
                            address_region: user.address_region,
                            address_district: user.address_district,
                            address_city: user.address_city,
                            address_barangay: user.address_barangay
                        });
                    }
                    
                    // Role field removed - role cannot be edited, permissions are set automatically based on role
                    
                    // Set status
                    const statusValue = (user.status === 'archived') ? 'inactive' : (user.status || 'active');
                    $(`input[name="userStatus"][value="${statusValue}"]`).prop('checked', true);
                    
                    // Clear password fields
                    $('#userPassword').val('');
                    $('#confirmPassword').val('');
                    
                    // Show modal
                    $('#editUserModal').modal('show');
                return;
            }

            // Fallback to fetch by ID (robust for pagination)
            const response = await fetch(`../api/get_user.php?user_id=${encodeURIComponent(userId)}`, {
                method: 'GET',
                credentials: 'include'
            });
            const data = await response.json();
            if (!data.success || !data.user) {
                showError(data.message || 'User not found');
                return;
            }
            const u = data.user;
            $('#firstName').val(u.first_name || '');
            $('#middleName').val(u.middle_name || '');
            $('#lastName').val(u.last_name || '');
            $('#emailAddress').val(u.email || '');
            $('#phoneNumber').val(u.phone_number || '');
            $('#editAddressStreet').val(u.address_street || '');
            $('#editAddressPostalCode').val(u.address_postal_code || '');
            $('#editUserId').val(u.user_id);
            $('#editAddressRegion').val('').trigger('change');
            $('#editAddressDistrict').empty().append('<option value="">Select Province/District</option>');
            $('#editAddressCity').empty().append('<option value="">Select City/Municipality</option>');
            $('#editAddressBarangay').empty().append('<option value="">Select Barangay</option>');
            $('#editAddressCity').removeData('loading');
            $('#editAddressBarangay').removeData('loading');
            initializeAddressSelector('editAddress');
            if (u.address_region) {
                setAddressValues('editAddress', {
                    address_region: u.address_region,
                    address_district: u.address_district,
                    address_city: u.address_city,
                    address_barangay: u.address_barangay
                });
            }
            const statusValue = (u.status === 'archived') ? 'inactive' : (u.status || 'active');
            $(`input[name="userStatus"][value="${statusValue}"]`).prop('checked', true);
            $('#userPassword').val('');
            $('#confirmPassword').val('');
            $('#editUserModal').modal('show');
        } catch (error) {
            console.error('Edit user error:', error);
            showError('Failed to load user data');
        }
    }

    /**
     * Delete user
     */
    async function deleteUser(userId, userName) {
        // Use custom confirmation dialog
        const confirmed = await AdminNotifications.confirm(
            `Are you sure you want to delete user: ${userName}?\n\nThis action cannot be undone.`,
            {
                title: 'Delete User',
                confirmText: 'Delete',
                cancelText: 'Cancel',
                danger: true
            }
        );
        
        if (!confirmed) {
            return;
        }

        try {
            const response = await fetch('../api/delete_user.php', {
                method: 'POST',
                credentials: 'include', // Include cookies for session
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ user_id: userId })
            });

            const data = await response.json();

            if (data.success) {
                showSuccess('User deleted successfully');
                await loadUsers(currentPage);
            } else {
                showError(data.message || 'Failed to delete user');
            }
        } catch (error) {
            console.error('Delete user error:', error);
            showError('Failed to delete user. Please try again.');
        }
    }

    /**
     * Add new user
     */
    async function addUser(userData) {
        try {
            const response = await fetch('../api/add_user.php', {
                method: 'POST',
                credentials: 'include', // Include cookies for session
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            });

            const data = await response.json();

            if (data.success) {
                showSuccess('User added successfully');
                $('#addUserModal').modal('hide');
                $('#addUserForm')[0].reset();
                await loadUsers(1); // Reload to first page
            } else {
                showError(data.message || 'Failed to add user');
            }
        } catch (error) {
            console.error('Add user error:', error);
            showError('Failed to add user. Please try again.');
        }
    }

    /**
     * Update user
     */
    async function updateUser(userId, userData) {
        try {
            const response = await fetch('../api/update_user.php', {
                method: 'POST',
                credentials: 'include', // Include cookies for session
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: userId,
                    ...userData
                })
            });

            const data = await response.json();

            if (data.success) {
                showSuccess('User updated successfully');
                $('#editUserModal').modal('hide');
                await loadUsers(currentPage);
            } else {
                showError(data.message || 'Failed to update user');
            }
        } catch (error) {
            console.error('Update user error:', error);
            showError('Failed to update user. Please try again.');
        }
    }

    // Role tabs click handler
    $('.role-tab').on('click', function() {
        // Remove active class from all tabs
        $('.role-tab').removeClass('active');
        // Add active class to clicked tab
        $(this).addClass('active');
        // Get the role from data attribute
        currentFilters.role = $(this).data('role') || '';
        currentPage = 1;
        loadUsers();
    });

    // Status filter change handler
    $('#status-filter').on('change', function() {
        currentFilters.status = $('#status-filter').val();
        currentPage = 1;
        loadUsers();
    });

    // Search functionality with improved debouncing
    let searchTimeout;
    let lastSearchTerm = '';
    
    $('#user-search').on('input', function() {
        clearTimeout(searchTimeout);
        const searchTerm = $(this).val().trim();
        
        // Don't search if term hasn't changed
        if (searchTerm === lastSearchTerm) {
            return;
        }
        
        // Only search if user has stopped typing for 800ms (increased from 500ms)
        searchTimeout = setTimeout(() => {
            if (searchTerm !== lastSearchTerm) {
                lastSearchTerm = searchTerm;
                currentFilters.search = searchTerm;
                loadUsers(1); // Reset to first page when searching
            }
        }, 800); // Increased debounce time to reduce API calls
    });
    
    // Also trigger search on Enter key for immediate results
    $('#user-search').on('keypress', function(e) {
        if (e.which === 13) { // Enter key
            e.preventDefault();
            clearTimeout(searchTimeout);
            const searchTerm = $(this).val().trim();
            if (searchTerm !== lastSearchTerm) {
                lastSearchTerm = searchTerm;
                currentFilters.search = searchTerm;
                loadUsers(1);
            }
        }
    });
    
    // Clear search on Escape key
    $('#user-search').on('keydown', function(e) {
        if (e.which === 27) { // Escape key
            $(this).val('');
            lastSearchTerm = '';
            currentFilters.search = '';
            loadUsers(1);
        }
    });

    // Select all checkbox functionality (Admin only)
    $('#select-all').on('change', function() {
        if (!isAdmin) {
            $(this).prop('checked', false);
            return;
        }
        const isChecked = $(this).is(':checked');
        $('.user-checkbox').prop('checked', isChecked);
        updateDeleteSelectedButton();
    });

    // Individual checkbox functionality (Admin only)
    $(document).on('change', '.user-checkbox', function() {
        if (!isAdmin) {
            $(this).prop('checked', false);
            return;
        }
        const totalCheckboxes = $('.user-checkbox').length;
        const checkedCheckboxes = $('.user-checkbox:checked').length;
        $('#select-all').prop('checked', totalCheckboxes === checkedCheckboxes && totalCheckboxes > 0);
        updateDeleteSelectedButton();
    });
    
    /**
     * Update delete selected button visibility and count
     */
    function updateDeleteSelectedButton() {
        if (!isAdmin) {
            $('#delete-selected-btn').hide();
            return;
        }
        
        const checkedCheckboxes = $('.user-checkbox:checked').length;
        const deleteBtn = $('#delete-selected-btn');
        const countSpan = $('#selected-count');
        
        if (checkedCheckboxes > 0) {
            deleteBtn.show();
            countSpan.text(checkedCheckboxes);
        } else {
            deleteBtn.hide();
        }
    }
    
    /**
     * Delete selected users
     */
    async function deleteSelectedUsers() {
        console.log('[Delete Selected] Function called');
        const checkedCheckboxes = $('.user-checkbox:checked');
        console.log('[Delete Selected] Checked checkboxes:', checkedCheckboxes.length);
        
        const userIds = [];
        const userNames = [];
        
        checkedCheckboxes.each(function() {
            const userId = $(this).data('user-id');
            const userName = $(this).closest('.user-row').find('.user-name').text();
            console.log('[Delete Selected] Found user:', userId, userName);
            if (userId) {
                userIds.push(userId);
                userNames.push(userName);
            }
        });
        
        console.log('[Delete Selected] User IDs to delete:', userIds);
        
        if (userIds.length === 0) {
            console.log('[Delete Selected] No users selected');
            showError('No users selected');
            return;
        }
        
        // Confirmation dialog
        // Use AdminNotifications (always available on admin pages)
        let confirmed = false;
        if (typeof AdminNotifications !== 'undefined' && typeof AdminNotifications.confirm === 'function') {
            confirmed = await AdminNotifications.confirm(
                `Are you sure you want to delete ${userIds.length} user(s)?\n\nUsers:\n${userNames.join('\n')}\n\nThis action cannot be undone.`,
                {
                    title: 'Delete Selected Users',
                    confirmText: 'Delete All',
                    cancelText: 'Cancel',
                    danger: true
                }
            );
        } else {
            // Last resort fallback (should not happen on admin pages)
            console.warn('AdminNotifications not available, using browser confirm');
            confirmed = confirm(
                `Are you sure you want to delete ${userIds.length} user(s)?\n\nUsers:\n${userNames.join('\n')}\n\nThis action cannot be undone.`
            );
        }
        
        if (!confirmed) {
            return;
        }
        
        try {
            console.log('[Delete Selected] Sending request to API with user_ids:', userIds);
            const response = await fetch('../api/delete_user.php', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ user_ids: userIds })
            });

            console.log('[Delete Selected] Response status:', response.status);
            const data = await response.json();
            console.log('[Delete Selected] Response data:', data);

            if (data.success) {
                showSuccess(data.message || `Successfully deleted ${data.deleted_count || userIds.length} user(s)`);
                
                // Remove deleted user rows from DOM immediately
                userIds.forEach(userId => {
                    $(`.user-row[data-user-id="${userId}"]`).fadeOut(300, function() {
                        $(this).remove();
                    });
                    // Also remove from cache
                    usersCacheById.delete(String(userId));
                });
                
                // Uncheck all checkboxes
                $('#select-all').prop('checked', false);
                $('.user-checkbox').prop('checked', false);
                updateDeleteSelectedButton();
                
                // Check if table is now empty
                const remainingRows = $('.user-row:not(.loading-row)').length;
                if (remainingRows === 0) {
                    // If no users left on current page, reload to get previous page or show empty message
                    await loadUsers(currentPage);
                } else {
                    // Update pagination info if needed
                    const tbody = $('#users-table-body');
                    if (tbody.children('.user-row:not(.loading-row)').length === 0) {
                        await loadUsers(currentPage);
                    }
                }
            } else {
                console.error('[Delete Selected] API returned error:', data);
                showError(data.message || 'Failed to delete users');
                if (data.errors && data.errors.length > 0) {
                    console.error('Delete errors:', data.errors);
                }
            }
        } catch (error) {
            console.error('[Delete Selected] Exception occurred:', error);
            showError('Failed to delete users. Please try again.');
        }
    }
    
    // Delete selected button click handler (Admin only)
    // Use event delegation to ensure it works even if button is added dynamically
    $(document).on('click', '#delete-selected-btn', function(e) {
        e.preventDefault();
        console.log('[Delete Selected] Button clicked, isAdmin:', isAdmin);
        
        if (!isAdmin) {
            if (typeof AdminNotifications !== 'undefined') {
                AdminNotifications.warning('Only Admin role can delete users.', { duration: 4000 });
            } else {
                console.warn('Only Admin role can delete users.');
            }
            return;
        }
        deleteSelectedUsers();
    });

    // Add User button functionality (Admin only)
    $('#add-user-btn').on('click', function() {
        if (!isAdmin) {
            if (typeof AdminNotifications !== 'undefined') {
                AdminNotifications.warning('Only Admin role can add users.', { duration: 4000 });
            } else {
                console.warn('Only Admin role can add users.');
            }
            return;
        }
        $('#addUserForm')[0].reset();
        $('input[name="addUserStatus"][value="active"]').prop('checked', true);
        renderRolePermissionPreview($('#addUserRole').val());
        // Initialize address selector when modal opens
        initializeAddressSelector('addAddress');
        // Reset address fields
        $('#addAddressRegion').val('').trigger('change');
        $('#addUserModal').modal('show');
    });

    // Role preview (read-only) - update whenever the admin changes the role dropdown
    $('#addUserRole').on('change', function() {
        renderRolePermissionPreview($(this).val());
    });

    // Add User form submission (Admin only)
    $('#addUserForm').on('submit', function(e) {
        e.preventDefault();
        
        if (!isAdmin) {
            if (typeof AdminNotifications !== 'undefined') {
                AdminNotifications.warning('Only Admin role can add users.', { duration: 4000 });
            } else {
                console.warn('Only Admin role can add users.');
            }
            return;
        }

        const password = $('#addUserPassword').val();
        const confirmPassword = $('#addConfirmPassword').val();

        // Validate password match
        if (password !== confirmPassword) {
            $('#addPasswordMatchError').show();
            $('#addConfirmPassword').css('border-color', '#dc3545');
            showError('Passwords do not match!');
            return;
        } else {
            $('#addPasswordMatchError').hide();
            $('#addConfirmPassword').css('border-color', '#ddd');
        }

        if (password.length < 6) {
            showError('Password must be at least 6 characters long');
            return;
        }

        const userData = {
            first_name: $('#addFirstName').val().trim(),
            middle_name: $('#addMiddleName').val().trim() || null,
            last_name: $('#addLastName').val().trim(),
            email: $('#addEmailAddress').val().trim(),
            phone_number: $('#addPhoneNumber').val().trim() || null,
            address_street: $('#addAddressStreet').val().trim(),
            address_city: $('#addAddressCity').val().trim(),
            address_district: $('#addAddressDistrict').val().trim(),
            address_barangay: $('#addAddressBarangay').val().trim(),
            address_postal_code: $('#addAddressPostalCode').val().trim(),
            address_region: $('#addAddressRegion').val().trim() || null,
            role: $('#addUserRole').val(),
            password: password,
            status: $('input[name="addUserStatus"]:checked').val()
        };

        addUser(userData);
    });

    // Edit User form submission
    $('#editUserForm').on('submit', function(e) {
        e.preventDefault();
        
        if (!isAdmin) {
            if (typeof AdminNotifications !== 'undefined') {
                AdminNotifications.warning('Only Admin role can edit users.', { duration: 4000 });
            } else {
                console.warn('Only Admin role can edit users.');
            }
            return;
        }

        const userId = $('#editUserId').val();
        if (!userId) {
            showError('User ID is missing');
            return;
        }

        const password = $('#userPassword').val();
        const confirmPassword = $('#confirmPassword').val();

        // Validate password match (only if password is provided)
        if (password) {
            if (password !== confirmPassword) {
                $('#editPasswordMatchError').show();
                $('#confirmPassword').css('border-color', '#dc3545');
                showError('Passwords do not match!');
                return;
            } else {
                $('#editPasswordMatchError').hide();
                $('#confirmPassword').css('border-color', '#ddd');
            }

            if (password.length < 6) {
                showError('Password must be at least 6 characters long');
                return;
            }
        }

        const userData = {
            first_name: $('#firstName').val().trim(),
            middle_name: $('#middleName').val().trim() || null,
            last_name: $('#lastName').val().trim(),
            email: $('#emailAddress').val().trim(),
            phone_number: $('#phoneNumber').val().trim() || null,
            address_street: $('#editAddressStreet').val().trim(),
            address_city: $('#editAddressCity').val().trim(),
            address_district: $('#editAddressDistrict').val().trim(),
            address_barangay: $('#editAddressBarangay').val().trim(),
            address_postal_code: $('#editAddressPostalCode').val().trim(),
            address_region: $('#editAddressRegion').val().trim() || null,
            // Role removed - role cannot be edited, permissions are set automatically based on role
            status: $('input[name="userStatus"]:checked').val()
        };

        // Only include password if it was provided
        if (password) {
            userData.password = password;
        }

        updateUser(userId, userData);
    });

    // Pagination functionality
    $('#prev-btn').on('click', function() {
        if (currentPage > 1) {
            loadUsers(currentPage - 1);
        }
    });

    $('#next-btn').on('click', function() {
        if (currentPage < totalPages) {
            loadUsers(currentPage + 1);
        }
    });

    // Permission management removed - Permissions are automatically set based on user roles

    // Utility functions for notifications
    function showSuccess(message) {
        if (typeof AdminNotifications !== 'undefined') {
            AdminNotifications.success(message, { duration: 3000 });
        } else {
            console.log('Success: ' + message);
        }
    }

    function showError(message) {
        if (typeof AdminNotifications !== 'undefined') {
            AdminNotifications.error(message, { duration: 5000 });
        } else {
            console.error('Error: ' + message);
        }
    }

    // Clear modals on close
    $('#addUserModal, #editUserModal').on('hidden.bs.modal', function() {
        $(this).find('form')[0].reset();
        currentUserId = null;
        // Reset password toggle icons
        $('.password-toggle-btn i').removeClass('fa-eye-slash').addClass('fa-eye');
        $('.password-toggle-btn').attr('aria-label', 'Show password');
        // Hide password match errors
        $('#addPasswordMatchError, #editPasswordMatchError').hide();
    });

    // Password toggle functionality for Add User modal
    $('#toggleAddPassword').on('click', function() {
        const passwordInput = $('#addUserPassword');
        const icon = $(this).find('i');
        
        if (passwordInput.attr('type') === 'password') {
            passwordInput.attr('type', 'text');
            icon.removeClass('fa-eye').addClass('fa-eye-slash');
            $(this).attr('aria-label', 'Hide password');
        } else {
            passwordInput.attr('type', 'password');
            icon.removeClass('fa-eye-slash').addClass('fa-eye');
            $(this).attr('aria-label', 'Show password');
        }
    });

    $('#toggleAddConfirmPassword').on('click', function() {
        const confirmPasswordInput = $('#addConfirmPassword');
        const icon = $(this).find('i');
        
        if (confirmPasswordInput.attr('type') === 'password') {
            confirmPasswordInput.attr('type', 'text');
            icon.removeClass('fa-eye').addClass('fa-eye-slash');
            $(this).attr('aria-label', 'Hide password');
        } else {
            confirmPasswordInput.attr('type', 'password');
            icon.removeClass('fa-eye-slash').addClass('fa-eye');
            $(this).attr('aria-label', 'Show password');
        }
    });

    // Password toggle functionality for Edit User modal
    $('#toggleEditPassword').on('click', function() {
        const passwordInput = $('#userPassword');
        const icon = $(this).find('i');
        
        if (passwordInput.attr('type') === 'password') {
            passwordInput.attr('type', 'text');
            icon.removeClass('fa-eye').addClass('fa-eye-slash');
            $(this).attr('aria-label', 'Hide password');
        } else {
            passwordInput.attr('type', 'password');
            icon.removeClass('fa-eye-slash').addClass('fa-eye');
            $(this).attr('aria-label', 'Show password');
        }
    });

    $('#toggleEditConfirmPassword').on('click', function() {
        const confirmPasswordInput = $('#confirmPassword');
        const icon = $(this).find('i');
        
        if (confirmPasswordInput.attr('type') === 'password') {
            confirmPasswordInput.attr('type', 'text');
            icon.removeClass('fa-eye').addClass('fa-eye-slash');
            $(this).attr('aria-label', 'Hide password');
        } else {
            confirmPasswordInput.attr('type', 'password');
            icon.removeClass('fa-eye-slash').addClass('fa-eye');
            $(this).attr('aria-label', 'Show password');
        }
    });

    // Real-time password matching validation for Add User modal
    $('#addUserPassword, #addConfirmPassword').on('input', function() {
        const password = $('#addUserPassword').val();
        const confirmPassword = $('#addConfirmPassword').val();
        const errorElement = $('#addPasswordMatchError');
        
        if (confirmPassword && password !== confirmPassword) {
            errorElement.show();
            $('#addConfirmPassword').css('border-color', '#dc3545');
        } else {
            errorElement.hide();
            $('#addConfirmPassword').css('border-color', '#ddd');
        }
    });

    // Real-time password matching validation for Edit User modal
    $('#userPassword, #confirmPassword').on('input', function() {
        const password = $('#userPassword').val();
        const confirmPassword = $('#confirmPassword').val();
        const errorElement = $('#editPasswordMatchError');
        
        if (password && confirmPassword && password !== confirmPassword) {
            errorElement.show();
            $('#confirmPassword').css('border-color', '#dc3545');
        } else {
            errorElement.hide();
            $('#confirmPassword').css('border-color', '#ddd');
        }
    });
});
