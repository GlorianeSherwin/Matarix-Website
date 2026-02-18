$(document).ready(function() {
    // Store form data for later submission
    let pendingFormData = null;
    const LOGIN_URL = '../Customer/Login.html';
    
    // Function to save all form data to sessionStorage (global function for onclick handlers)
    window.saveRegistrationFormData = function() {
        try {
            const formData = {
                email: $('#email').val() ? $('#email').val().trim() : '',
                first_name: $('#first_name').val() ? $('#first_name').val().trim() : '',
                last_name: $('#last_name').val() ? $('#last_name').val().trim() : '',
                middle_name: $('#middle_name').val() ? $('#middle_name').val().trim() : '',
                phone_number: $('#phone_number').val() || '',
                password: $('#password').val() || '',
                confirm_password: $('#confirm_password').val() || '',
                address_street: $('#address_street').val() ? $('#address_street').val().trim() : '',
                address_city: $('#address_city').val() ? $('#address_city').val().trim() : '',
                address_district: $('#address_district').val() ? $('#address_district').val().trim() : '',
                address_barangay: $('#address_barangay').val() ? $('#address_barangay').val().trim() : '',
                address_postal_code: $('#address_postal_code').val() ? $('#address_postal_code').val().trim() : '',
                address_region: ($('#address_region').val() && $('#address_region').val().trim()) ? $('#address_region').val().trim() : null
            };
            sessionStorage.setItem('registrationFormData', JSON.stringify(formData));
            console.log('Form data saved:', formData); // Debug log
        } catch (e) {
            console.error('Error saving form data:', e);
        }
    };
    
    // Also create a local reference for internal use
    function saveFormData() {
        window.saveRegistrationFormData();
    }
    
    // Function to restore form data from sessionStorage
    function restoreFormData() {
        const savedData = sessionStorage.getItem('registrationFormData');
        if (savedData) {
            try {
                const formData = JSON.parse(savedData);
                console.log('Restoring form data:', formData); // Debug log
                
                // Restore basic fields first
                $('#email').val(formData.email || '');
                $('#first_name').val(formData.first_name || '');
                $('#last_name').val(formData.last_name || '');
                $('#middle_name').val(formData.middle_name || '');
                $('#phone_number').val(formData.phone_number || '');
                $('#password').val(formData.password || '');
                $('#confirm_password').val(formData.confirm_password || '');
                $('#address_street').val(formData.address_street || '');
                $('#address_postal_code').val(formData.address_postal_code || '');
                
                // Restore address dropdowns in the correct order (region -> district -> city -> barangay)
                if (formData.address_region) {
                    $('#address_region').val(formData.address_region).trigger('change');
                    
                    // Wait for districts to populate, then restore district
                    const checkDistrict = setInterval(function() {
                        const districtOptions = $('#address_district option').length;
                        if (districtOptions > 1) { // More than just the default option
                            clearInterval(checkDistrict);
                            if (formData.address_district) {
                                $('#address_district').val(formData.address_district).trigger('change');
                                
                                // Wait for cities to populate, then restore city
                                const checkCity = setInterval(function() {
                                    const cityOptions = $('#address_city option').length;
                                    if (cityOptions > 1) {
                                        clearInterval(checkCity);
                                        if (formData.address_city) {
                                            $('#address_city').val(formData.address_city).trigger('change');
                                            
                                            // Wait for barangays to populate, then restore barangay
                                            const checkBarangay = setInterval(function() {
                                                const barangayOptions = $('#address_barangay option').length;
                                                if (barangayOptions > 1) {
                                                    clearInterval(checkBarangay);
                                                    if (formData.address_barangay) {
                                                        $('#address_barangay').val(formData.address_barangay);
                                                    }
                                                }
                                            }, 100);
                                            
                                            // Timeout after 5 seconds
                                            setTimeout(function() {
                                                clearInterval(checkBarangay);
                                            }, 5000);
                                        }
                                    }
                                }, 100);
                                
                                // Timeout after 5 seconds
                                setTimeout(function() {
                                    clearInterval(checkCity);
                                }, 5000);
                            }
                        }
                    }, 100);
                    
                    // Timeout after 5 seconds
                    setTimeout(function() {
                        clearInterval(checkDistrict);
                    }, 5000);
                } else {
                    // If no region, just set the other address fields directly
                    $('#address_district').val(formData.address_district || '');
                    $('#address_city').val(formData.address_city || '');
                    $('#address_barangay').val(formData.address_barangay || '');
                }
                
                // Note: We DON'T clear the saved data here anymore - it will persist until registration is complete
            } catch (e) {
                console.error('Error restoring form data:', e);
                // Clear corrupted data
                sessionStorage.removeItem('registrationFormData');
            }
        }
    }
    
    // Restore form data on page load (whenever saved data exists)
    // Wait a bit to ensure address dropdowns are initialized first
    setTimeout(function() {
        restoreFormData();
    }, 100);
    
    // Auto-save form data as user types (debounced to avoid excessive saves)
    let saveTimeout;
    function autoSaveFormData() {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(function() {
            saveFormData();
        }, 300); // Save 300ms after user stops typing
    }
    
    // Immediate save function (no debounce) for critical moments
    function immediateSaveFormData() {
        clearTimeout(saveTimeout); // Clear any pending debounced save
        saveFormData();
    }
    
    // Auto-save on input for text fields (debounced)
    $('#email, #first_name, #last_name, #middle_name, #phone_number, #password, #confirm_password, #address_street, #address_postal_code').on('input', function() {
        autoSaveFormData();
    });
    
    // Immediate save on change for dropdowns (no debounce needed)
    $('#address_region, #address_district, #address_city, #address_barangay').on('change', function() {
        immediateSaveFormData();
    });
    
    // Save form data when navigating to ToS/Privacy pages (immediate save)
    // Note: The links also have onclick="saveRegistrationFormData()" in HTML, but we add this as backup
    $('.terms-link-inline').on('click', function(e) {
        // Save form data immediately when clicking ToS/Privacy links (backup to onclick handler)
        immediateSaveFormData();
        // Also save checkbox states
        sessionStorage.setItem('termsChecked', $('#agreeTerms').is(':checked') ? 'true' : 'false');
        sessionStorage.setItem('privacyChecked', $('#agreePrivacy').is(':checked') ? 'true' : 'false');
        // Don't prevent default - let the onclick handler and normal navigation proceed
    });
    
    // Save form data before page unload (as a safety net) - synchronous save
    $(window).on('beforeunload', function() {
        // Use synchronous storage for beforeunload
        try {
            const formData = {
                email: $('#email').val().trim(),
                first_name: $('#first_name').val().trim(),
                last_name: $('#last_name').val().trim(),
                middle_name: $('#middle_name').val().trim(),
                phone_number: $('#phone_number').val(),
                password: $('#password').val(),
                confirm_password: $('#confirm_password').val(),
                address_street: $('#address_street').val().trim(),
                address_city: $('#address_city').val().trim(),
                address_district: $('#address_district').val().trim(),
                address_barangay: $('#address_barangay').val().trim(),
                address_postal_code: $('#address_postal_code').val().trim(),
                address_region: $('#address_region').val().trim() || null
            };
            sessionStorage.setItem('registrationFormData', JSON.stringify(formData));
        } catch (e) {
            console.error('Error saving form data on unload:', e);
        }
    });
    
    // Check if we should show modal (coming back from terms/privacy pages)
    if (sessionStorage.getItem('showRegistrationModal') === 'true') {
        // Form data is already restored on page load, so we just need to restore checkbox states
        // Load checkbox states from sessionStorage
        const termsChecked = sessionStorage.getItem('termsChecked') === 'true';
        const privacyChecked = sessionStorage.getItem('privacyChecked') === 'true';
        
        // Restore checkbox states
        $('#agreeTerms').prop('checked', termsChecked);
        $('#agreePrivacy').prop('checked', privacyChecked);
        
        // Show modal
        $('#termsModal').modal('show');
        
        // Clear the flag
        sessionStorage.removeItem('showRegistrationModal');
    }
    
    // Handle form submission - show terms modal first
    $('#registrationForm').on('submit', function(e) {
        e.preventDefault();
        
        // Get form values
        const formData = {
            email: $('#email').val().trim(),
            first_name: $('#first_name').val().trim(),
            last_name: $('#last_name').val().trim(),
            middle_name: $('#middle_name').val().trim(),
            phone_number: $('#phone_number').val().replace(/\D/g, ''), // Remove non-digits
            password: $('#password').val(),
            confirm_password: $('#confirm_password').val(),
            // Structured address fields
            address_street: $('#address_street').val().trim(),
            address_city: $('#address_city').val().trim(),
            address_district: $('#address_district').val().trim(),
            address_barangay: $('#address_barangay').val().trim(),
            address_postal_code: $('#address_postal_code').val().trim(),
            address_region: $('#address_region').val().trim() || null
        };
        
        // Validate inputs
        if (!validateForm(formData)) {
            return;
        }
        
        // Save form data to sessionStorage before showing modal (immediate save)
        immediateSaveFormData();
        
        // Store form data for later submission
        pendingFormData = formData;
        
        // Load checkbox states from sessionStorage if available
        const termsChecked = sessionStorage.getItem('termsChecked') === 'true';
        const privacyChecked = sessionStorage.getItem('privacyChecked') === 'true';
        
        // Restore checkbox states or reset if not set
        $('#agreeTerms').prop('checked', termsChecked || false);
        $('#agreePrivacy').prop('checked', privacyChecked || false);
        $('#termsError').hide();
        
        // Show terms modal
        $('#termsModal').modal('show');
        
        // Save again after modal is shown (in case any fields changed)
        setTimeout(function() {
            immediateSaveFormData();
        }, 100);
    });
    
    
    // Save checkbox states when changed
    $('#agreeTerms, #agreePrivacy').on('change', function() {
        const isTermsAccepted = $('#agreeTerms').is(':checked');
        const isPrivacyAccepted = $('#agreePrivacy').is(':checked');
        
        // Save to sessionStorage as strings for consistency
        sessionStorage.setItem('termsChecked', isTermsAccepted ? 'true' : 'false');
        sessionStorage.setItem('privacyChecked', isPrivacyAccepted ? 'true' : 'false');
        
        // Clear error if both are checked
        if (isTermsAccepted && isPrivacyAccepted) {
            $('#termsError').fadeOut();
        }
    });
    
    // Handle Complete Registration button
    $('#completeRegistrationBtn').on('click', function() {
        const isTermsAccepted = $('#agreeTerms').is(':checked');
        const isPrivacyAccepted = $('#agreePrivacy').is(':checked');
        
        if (!isTermsAccepted || !isPrivacyAccepted) {
            $('#termsError').fadeIn();
            return;
        }
        
        // Save checkbox states
        sessionStorage.setItem('termsChecked', 'true');
        sessionStorage.setItem('privacyChecked', 'true');
        
        // Save current form data one more time before submission (in case user made changes)
        saveFormData();
        
        // Hide error and modal
        $('#termsError').hide();
        $('#termsModal').modal('hide');
        
        // Get the latest form data (either from pendingFormData or from saved data)
        if (!pendingFormData) {
            const savedData = sessionStorage.getItem('registrationFormData');
            if (savedData) {
                try {
                    pendingFormData = JSON.parse(savedData);
                    // Remove confirm_password from data sent to API
                    delete pendingFormData.confirm_password;
                    // Clean phone number
                    pendingFormData.phone_number = pendingFormData.phone_number.replace(/\D/g, '');
                } catch (e) {
                    console.error('Error parsing saved form data:', e);
                }
            }
        }
        
        // Proceed with registration
        if (pendingFormData) {
            submitRegistration(pendingFormData);
        } else {
            showMessage('Form data not found. Please fill out the form again.', 'error');
        }
    });
    
    // Success modal: continue to login
    $('#continueToLoginBtn').on('click', function() {
        window.location.href = LOGIN_URL;
    });

    function showRegistrationSuccessModal(message) {
        // Always use the user-friendly message
        const successMessage = 'Account created successfully.';

        const $msg = $('#registrationSuccessMessage');
        if ($msg.length) {
            $msg.text(successMessage);
        }

        const $modal = $('#registrationSuccessModal');
        if ($modal.length && typeof $modal.modal === 'function') {
            $modal.modal({
                backdrop: 'static', // Prevent closing by clicking outside
                keyboard: false // Prevent closing with ESC key
            });
            $modal.modal('show');
            return;
        }

        // Fallback if Bootstrap modal isn't available for any reason
        alert(successMessage);
        window.location.href = LOGIN_URL;
    }

    
    // Function to submit registration
    function submitRegistration(formData) {
        // Disable button and show loading state
        const $signupButton = $('#signupButton');
        $signupButton.prop('disabled', true).text('CREATING ACCOUNT...');
        
        // Hide previous messages
        $('#registrationMessage').hide();
        
        // Remove confirm_password from data sent to API
        delete formData.confirm_password;
        
        // Send registration request to API
        $.ajax({
            url: '../api/register.php',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(formData),
            success: function(response) {
                if (response.success) {
                    // Clear any inline message and show success modal instead
                    $('#registrationMessage').hide();
                    
                    // Clear all saved form data and checkbox states after successful registration
                    sessionStorage.removeItem('registrationFormData');
                    sessionStorage.removeItem('termsChecked');
                    sessionStorage.removeItem('privacyChecked');
                    sessionStorage.removeItem('showRegistrationModal');
                    
                    // Store user data in sessionStorage (optional)
                    if (response.user_id) {
                        sessionStorage.setItem('registered_user_id', response.user_id);
                    }
                    
                    // Keep button disabled (account already created) and show modal with Continue button
                    $signupButton.prop('disabled', true).text('ACCOUNT CREATED');
                    showRegistrationSuccessModal('Account created successfully.');
                } else {
                    showMessage(response.message || 'Registration failed. Please try again.', 'error');
                    $signupButton.prop('disabled', false).text('Sign Up');
                }
            },
            error: function(xhr) {
                let errorMessage = 'An error occurred. Please try again.';
                
                if (xhr.responseJSON && xhr.responseJSON.message) {
                    errorMessage = xhr.responseJSON.message;
                } else if (xhr.status === 0) {
                    errorMessage = 'Unable to connect to server. Please check your connection.';
                } else if (xhr.status === 409) {
                    errorMessage = 'Email already registered. Please use a different email or login.';
                }
                
                showMessage(errorMessage, 'error');
                $signupButton.prop('disabled', false).text('Sign Up');
            }
        });
    }
    
    // Form validation function
    function validateForm(data) {
        // Check required fields
        if (!data.email || !data.first_name || !data.last_name || !data.phone_number || 
            !data.password || !data.confirm_password || !data.address_street || 
            !data.address_city || !data.address_district || !data.address_barangay || !data.address_postal_code) {
            showMessage('Please fill in all required fields', 'error');
            return false;
        }
        
        // Validate postal code (Philippines format: 4 digits)
        const postalCodeRegex = /^\d{4}$/;
        if (!postalCodeRegex.test(data.address_postal_code)) {
            showMessage('Postal code must be 4 digits', 'error');
            return false;
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(data.email)) {
            showMessage('Please enter a valid email address', 'error');
            return false;
        }
        
        // Validate password length (minimum 8 characters)
        if (data.password.length < 8) {
            showMessage('Password must be at least 8 characters long', 'error');
            return false;
        }
        
        // Validate password match
        if (data.password !== data.confirm_password) {
            showMessage('Passwords do not match. Please make sure both password fields are identical.', 'error');
            $('#confirm_password').addClass('password-mismatch').removeClass('password-match');
            $('#passwordMatchText').removeClass('match').addClass('mismatch').text('✗ Passwords do not match').show();
            $('#confirm_password').focus();
            return false;
        }
        
        // Validate phone number (Philippines format: 10-11 digits max)
        const phoneNumber = data.phone_number.replace(/\D/g, '');
        if (phoneNumber.length < 10 || phoneNumber.length > 11) {
            if (phoneNumber.length > 11) {
                showMessage('Mobile number cannot exceed 11 digits. Please enter a valid Philippine mobile number (09XX-XXX-XXXX)', 'error');
            } else {
                showMessage('Please enter a valid phone number (10-11 digits for Philippines)', 'error');
            }
            return false;
        }
        
        // Validate name fields (should not contain numbers or special characters)
        const nameRegex = /^[a-zA-Z\s'-]+$/;
        if (data.first_name && !nameRegex.test(data.first_name)) {
            showMessage('First name should only contain letters', 'error');
            return false;
        }
        if (data.last_name && !nameRegex.test(data.last_name)) {
            showMessage('Last name should only contain letters', 'error');
            return false;
        }
        if (data.middle_name && !nameRegex.test(data.middle_name)) {
            showMessage('Middle name should only contain letters', 'error');
            return false;
        }
        
        return true;
    }
    
    // Function to show messages
    function showMessage(message, type) {
        const $messageDiv = $('#registrationMessage');
        $messageDiv.removeClass('alert-success alert-danger')
                   .addClass(type === 'success' ? 'alert-success' : 'alert-danger')
                   .text(message)
                   .fadeIn();
        
        // Auto-hide success messages
        if (type === 'success') {
            setTimeout(function() {
                $messageDiv.fadeOut();
            }, 3000);
        }
    }
    
    // Real-time password match validation
    $('#confirm_password').on('keyup', function() {
        const password = $('#password').val();
        const confirmPassword = $(this).val();
        const $matchText = $('#passwordMatchText');
        
        if (confirmPassword.length > 0) {
            if (password !== confirmPassword) {
                $(this).removeClass('password-match').addClass('password-mismatch');
                $matchText.removeClass('match').addClass('mismatch')
                    .text('✗ Passwords do not match').show();
            } else {
                $(this).removeClass('password-mismatch').addClass('password-match');
                $matchText.removeClass('mismatch').addClass('match')
                    .text('✓ Passwords match').show();
            }
        } else {
            $(this).removeClass('password-match password-mismatch');
            $matchText.hide();
        }
    });
    
    // Also check when password field changes
    $('#password').on('keyup', function() {
        const password = $(this).val();
        const confirmPassword = $('#confirm_password').val();
        const $matchText = $('#passwordMatchText');
        
        if (confirmPassword.length > 0) {
            if (password !== confirmPassword) {
                $('#confirm_password').removeClass('password-match').addClass('password-mismatch');
                $matchText.removeClass('match').addClass('mismatch')
                    .text('✗ Passwords do not match').show();
            } else {
                $('#confirm_password').removeClass('password-mismatch').addClass('password-match');
                $matchText.removeClass('mismatch').addClass('match')
                    .text('✓ Passwords match').show();
            }
        }
    });
    
    // Password visibility toggle functionality
    $('#togglePassword').on('click', function() {
        const passwordInput = $('#password');
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
    
    $('#toggleConfirmPassword').on('click', function() {
        const confirmPasswordInput = $('#confirm_password');
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
    
    // Format mobile number input with strict 11 digit limit
    // Use beforeinput event (modern browsers) to prevent input before it happens
    $('#phone_number').on('beforeinput', function(e) {
        const currentValue = $(this).val().replace(/\D/g, '');
        const inputType = e.originalEvent?.inputType || e.inputType;
        
        // Allow deletion operations
        if (inputType === 'deleteContentBackward' || inputType === 'deleteContentForward' || 
            inputType === 'deleteByCut' || inputType === 'deleteByDrag') {
            return true;
        }
        
        // For insert operations, check length
        if (inputType === 'insertText' || inputType === 'insertCompositionText' || !inputType) {
            const newText = e.originalEvent?.data || e.data || '';
            const digitsOnly = newText.replace(/\D/g, '');
            
            // If adding this would exceed 11 digits, prevent it
            if (currentValue.length + digitsOnly.length > 11) {
                e.preventDefault();
                showMessage('Mobile number cannot exceed 11 digits', 'error');
                $(this).css('border-color', '#dc3545');
                return false;
            }
            
            // Only allow digits
            if (digitsOnly.length !== newText.length) {
                e.preventDefault();
                return false;
            }
        }
    });
    
    // Fallback: Use keydown to prevent the character from being entered (for older browsers)
    $('#phone_number').on('keydown', function(e) {
        const currentValue = $(this).val().replace(/\D/g, '');
        const key = e.key;
        
        // Allow: backspace, delete, tab, escape, enter, arrow keys, home, end
        const allowedKeys = ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
        if (allowedKeys.includes(key)) {
            return true;
        }
        
        // Allow Ctrl/Cmd combinations (for copy, paste, select all, etc.)
        if (e.ctrlKey || e.metaKey) {
            return true;
        }
        
        // Only allow digits (0-9)
        if (!/^\d$/.test(key)) {
            e.preventDefault();
            return false;
        }
        
        // Prevent typing if already at 11 digits
        if (currentValue.length >= 11) {
            e.preventDefault();
            showMessage('Mobile number cannot exceed 11 digits', 'error');
            $(this).css('border-color', '#dc3545');
            return false;
        }
    });
    
    // Clean and validate on input event
    $('#phone_number').on('input', function() {
        let value = $(this).val().replace(/\D/g, ''); // Remove all non-digits first
        const $phoneInput = $(this);
        const $errorDiv = $('#registrationMessage');
        const errorText = $errorDiv.text().trim();
        
        // Strictly limit to 11 digits - truncate if exceeds (safety check)
        if (value.length > 11) {
            value = value.substring(0, 11); // Truncate to exactly 11 digits
            showMessage('Mobile number cannot exceed 11 digits', 'error');
            $phoneInput.css('border-color', '#dc3545');
        } else {
            // Clear error message when input becomes valid
            if (errorText === 'Mobile number cannot exceed 11 digits' || 
                errorText.includes('Mobile number cannot exceed 11 digits') ||
                (errorText.includes('phone number') && errorText.includes('exceed'))) {
                $errorDiv.fadeOut(200, function() {
                    $(this).hide().removeClass('alert-danger alert-success');
                });
            }
            
            // Reset border color
            $phoneInput.css('border-color', '');
            
            // Show green border if valid length (10-11 digits)
            if (value.length >= 10 && value.length <= 11) {
                $phoneInput.css('border-color', '#28a745');
            }
        }
        
        // Update the input value with cleaned number (digits only, no formatting)
        $phoneInput.val(value);
    });
    
    // Prevent paste of numbers exceeding 11 digits
    $('#phone_number').on('paste', function(e) {
        e.preventDefault(); // Prevent default paste
        const paste = (e.originalEvent || e).clipboardData.getData('text');
        const digitsOnly = paste.replace(/\D/g, '');
        const truncated = digitsOnly.substring(0, 11); // Truncate to max 11 digits
        $(this).val(truncated);
        
        // Trigger input event to update validation
        $(this).trigger('input');
        
        if (digitsOnly.length > 11) {
            showMessage('Mobile number cannot exceed 11 digits. Pasted value was truncated.', 'error');
            $(this).css('border-color', '#dc3545');
        }
    });
    
    // Clear error on blur if input is valid
    $('#phone_number').on('blur', function() {
        const value = $(this).val().replace(/\D/g, '');
        const $errorDiv = $('#registrationMessage');
        const errorText = $errorDiv.text().trim();
        
        if (value.length >= 10 && value.length <= 11) {
            // Valid phone number - clear any phone-related errors
            if (errorText === 'Mobile number cannot exceed 11 digits' || 
                errorText.includes('Mobile number cannot exceed 11 digits') ||
                (errorText.includes('phone number') && errorText.includes('exceed'))) {
                $errorDiv.fadeOut(200, function() {
                    $(this).hide().removeClass('alert-danger alert-success');
                });
            }
            $(this).css('border-color', '#28a745');
        } else if (value.length > 0 && value.length < 10) {
            $(this).css('border-color', '');
        }
    });
    
    // Focus and blur effects for form inputs
    $('.form-input').on('focus', function() {
        $(this).parent().addClass('focused');
    });
    
    $('.form-input').on('blur', function() {
        if ($(this).val() === '') {
            $(this).parent().removeClass('focused');
        }
    });
    
    // Add visual feedback when typing
    $('.form-input').on('input', function() {
        if ($(this).val().length > 0) {
            $(this).parent().addClass('has-content');
        } else {
            $(this).parent().removeClass('has-content');
        }
    });
});
