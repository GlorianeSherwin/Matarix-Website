$(document).ready(function() {
    // Load user profile data
    function loadUserProfile() {
        // First try to get from sessionStorage (quick access)
        const userId = sessionStorage.getItem('user_id');
        const userEmail = sessionStorage.getItem('user_email');
        const userName = sessionStorage.getItem('user_name');
        const userRole = sessionStorage.getItem('user_role');
        
        // If we have basic data, use it temporarily while fetching full profile
        if (userName) {
            $('.profile-name').text(userName);
        }
        if (userRole) {
            $('.admin-badge').text(userRole);
        }
        
        // Fetch full profile data from API
        fetch('../api/get_profile.php', {
            method: 'GET',
            credentials: 'include' // Include cookies for session
        })
        .then(response => response.json())
        .then(data => {
            if (data.success && data.user) {
                const user = data.user;
                
                // Populate form fields using IDs for more reliable targeting
                $('#firstName').val(user.first_name || '');
                $('#lastName').val(user.last_name || '');
                $('#email').val(user.email || '');
                $('#phoneNumber').val(user.phone_number || '');
                
                // Update profile name display
                const fullName = user.full_name || user.first_name + ' ' + user.last_name || 'User';
                $('.profile-name').text(fullName.trim() || 'User');
                
                // Update role badge
                if (user.role) {
                    $('.admin-badge').text(user.role);
                }
                
                // Update profile picture if available
                if (user.profile_picture) {
                    $('.profile-img').attr('src', '../' + user.profile_picture);
                } else {
                    // Reset to default if no profile picture
                    $('.profile-img').attr('src', '../Admin_assets/images/ProfileIcon.svg');
                }
                
                console.log('Profile data loaded successfully');
            } else {
                console.error('Failed to load profile:', data.message);
                // Fallback to sessionStorage data
                if (userName) {
                    $('.profile-name').text(userName);
                }
            }
        })
        .catch(error => {
            console.error('Error loading profile:', error);
            // Fallback to sessionStorage data
            if (userName) {
                $('.profile-name').text(userName);
            }
            if (userEmail) {
                $('.form-input[type="email"]').val(userEmail);
            }
        });
    }
    
    // Load profile data on page load
    loadUserProfile();
    
    // Profile picture change functionality
    $('.profile-status-indicator').on('click', function() {
        // Create a file input element
        const fileInput = $('<input type="file" accept="image/*" style="display: none;">');
        
        // Handle file selection
        fileInput.on('change', async function(e) {
            const file = e.target.files[0];
            if (file) {
                // Show preview immediately
                const reader = new FileReader();
                reader.onload = function(e) {
                    $('.profile-img').attr('src', e.target.result);
                };
                reader.readAsDataURL(file);
                
                // Upload to server
                const formData = new FormData();
                formData.append('image', file);
                formData.append('type', 'profile');
                
                try {
                    const response = await fetch('../api/upload_image.php', {
                        method: 'POST',
                        credentials: 'include',
                        body: formData
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        // Update profile picture display with the saved path
                        $('.profile-img').attr('src', '../' + data.file_path);
                        console.log('Profile picture uploaded successfully');
                        alert('Profile picture uploaded successfully!');
                        // Reload profile to ensure everything is in sync
                        loadUserProfile();
                    } else {
                        // Revert to original image on error
                        loadUserProfile();
                        alert('Failed to upload picture: ' + (data.message || 'Unknown error'));
                    }
                } catch (error) {
                    console.error('Upload error:', error);
                    // Revert to original image on error
                    loadUserProfile();
                    alert('Failed to upload picture. Please try again.');
                }
            }
        });
        
        // Trigger file input
        fileInput.click();
    });
    
    // Edit icon functionality for form fields
    $('.input-edit-icon').on('click', function() {
        const input = $(this).siblings('.form-input');
        
        // Toggle readonly state
        if (input.prop('readonly')) {
            input.prop('readonly', false);
            input.focus();
            $(this).removeClass('fa-edit').addClass('fa-save');
            console.log('Editing enabled for field');
        } else {
            input.prop('readonly', true);
            $(this).removeClass('fa-save').addClass('fa-edit');
            console.log('Changes saved for field');
            
            // Here you would typically save the data to your backend
            // For now, we'll just log the value
            console.log('Field value:', input.val());
        }
    });
    
    // Initially set all inputs to readonly
    $('.form-input').prop('readonly', true);
    
    // Focus and blur effects for form inputs
    $('.form-input').on('focus', function() {
        if (!$(this).prop('readonly')) {
            $(this).parent().addClass('editing');
        }
    });
    
    $('.form-input').on('blur', function() {
        $(this).parent().removeClass('editing');
    });
    
    // Bottom logout button functionality
    $('.logout-btn').on('click', function(e) {
        e.preventDefault();
        
        // Optional: Add confirmation dialog
        if (confirm('Are you sure you want to logout?')) {
            console.log('Logging out...');
            window.location.href = '../Customer/Login.html';
        }
    });
    
    // Sidebar logout button functionality
    $('.logout-button').on('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('Logging out from sidebar...');
        // Redirect to customer login
        window.location.href = '../Customer/Login.html';
    });
    
    
    // Handle profile form submission (if you want to add a save button later)
    $('.profile-form').on('submit', function(e) {
        e.preventDefault();
        
        const formData = {
            firstName: $('#firstName').val(),
            lastName: $('#lastName').val(),
            email: $('#email').val(),
            phone: $('#phoneNumber').val(),
            password: $('.form-input[type="password"]').val()
        };
        
        console.log('Profile form submitted:', formData);
        
        // Here you would send the data to your backend
        alert('Profile updated successfully!');
    });
    
    // Profile picture hover effect
    $('.profile-picture').on('mouseenter', function() {
        $(this).find('.profile-status-indicator').css('transform', 'scale(1.1)');
    });
    
    $('.profile-picture').on('mouseleave', function() {
        $(this).find('.profile-status-indicator').css('transform', 'scale(1)');
    });
    
    // Phone number formatting
    $('.form-input[type="tel"]').on('input', function() {
        let value = $(this).val().replace(/\D/g, '');
        
        if (value.length > 11) {
            value = value.substr(0, 11);
        }
        
        if (value.length >= 7) {
            value = value.replace(/(\d{1})(\d{3})(\d{3})(\d{1,4})/, '+$1 ($2) $3-$4');
        } else if (value.length >= 4) {
            value = value.replace(/(\d{1})(\d{3})(\d{1,3})/, '+$1 ($2) $3');
        } else if (value.length >= 1) {
            value = value.replace(/(\d{1})(\d{0,3})/, '+$1 ($2');
        }
        
        $(this).val(value);
    });
});