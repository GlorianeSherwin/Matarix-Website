$(document).ready(function() {
    // Get token from URL
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    // Check if token exists
    if (!token) {
        showMessage('Invalid reset link. Please request a new password reset.', 'error');
        $('#password-input, #confirm-password-input, #resetPasswordBtn').prop('disabled', true);
        return;
    }
    
    // Password validation function
    function validatePassword(password) {
        return password.length >= 8;
    }

    // Password visibility toggles (eye icons)
    $('.password-toggle-btn').on('click', function(e) {
        e.preventDefault();
        e.stopPropagation();

        const $btn = $(this);
        const targetSelector = $btn.attr('data-target');
        const $input = $(targetSelector);
        const $icon = $btn.find('i');

        if ($input.length === 0) return;

        const isHidden = $input.attr('type') === 'password';
        $input.attr('type', isHidden ? 'text' : 'password');
        $icon.toggleClass('fa-eye fa-eye-slash');
        $btn.attr('aria-label', isHidden ? 'Hide password' : 'Show password');
    });
    
    // Real-time password match validation
    $('#confirm-password-input').on('keyup', function() {
        const password = $('#password-input').val();
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
    $('#password-input').on('keyup', function() {
        const password = $(this).val();
        const confirmPassword = $('#confirm-password-input').val();
        const $matchText = $('#passwordMatchText');
        
        if (confirmPassword.length > 0) {
            if (password !== confirmPassword) {
                $('#confirm-password-input').removeClass('password-match').addClass('password-mismatch');
                $matchText.removeClass('match').addClass('mismatch')
                    .text('✗ Passwords do not match').show();
            } else {
                $('#confirm-password-input').removeClass('password-mismatch').addClass('password-match');
                $matchText.removeClass('mismatch').addClass('match')
                    .text('✓ Passwords match').show();
            }
        }
    });
    
    // Reset Password button functionality
    $('#resetPasswordBtn').on('click', function() {
        const password = $('#password-input').val().trim();
        const confirmPassword = $('#confirm-password-input').val().trim();
        const button = $(this);

        // Always hide passwords on submit
        $('#password-input, #confirm-password-input').attr('type', 'password');
        $('.password-toggle-btn').attr('aria-label', 'Show password').find('i').removeClass('fa-eye-slash').addClass('fa-eye');
        
        // Clear previous messages
        $('#password-input, #confirm-password-input').removeClass('error');
        hideMessage();
        
        // Validate inputs
        if (!password) {
            showMessage('Please enter a new password.', 'error');
            $('#password-input').addClass('error').focus();
            return;
        }
        
        if (!validatePassword(password)) {
            showMessage('Password must be at least 8 characters long.', 'error');
            $('#password-input').addClass('error').focus();
            return;
        }
        
        if (!confirmPassword) {
            showMessage('Please confirm your password.', 'error');
            $('#confirm-password-input').addClass('error').focus();
            return;
        }
        
        if (password !== confirmPassword) {
            showMessage('Passwords do not match. Please make sure both password fields are identical.', 'error');
            $('#confirm-password-input').addClass('error').focus();
            return;
        }
        
        // Show loading state
        showLoadingState(button);
        
        // Send reset request to API
        $.ajax({
            url: '../api/reset_password.php',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                token: token,
                password: password
            }),
            success: function(response) {
                hideLoadingState(button);
                
                if (response.success) {
                    showMessage(response.message || 'Password has been reset successfully!', 'success');
                    
                    // Disable form
                    $('#password-input, #confirm-password-input, #resetPasswordBtn').prop('disabled', true);
                    
                    // Redirect based on source
                    const fromProfile = sessionStorage.getItem('passwordResetFromProfile') === 'true';
                    const userId = sessionStorage.getItem('user_id');
                    
                    setTimeout(function() {
                        if (fromProfile && userId) {
                            window.location.href = 'CustomerProfile.html';
                            sessionStorage.removeItem('passwordResetFromProfile');
                        } else {
                            window.location.href = 'Login.html';
                        }
                    }, 3000);
                } else {
                    showMessage(response.message || 'Failed to reset password. Please try again.', 'error');
                }
            },
            error: function(xhr) {
                hideLoadingState(button);
                
                let errorMessage = 'An error occurred. Please try again.';
                
                if (xhr.responseJSON && xhr.responseJSON.message) {
                    errorMessage = xhr.responseJSON.message;
                } else if (xhr.status === 400) {
                    errorMessage = 'Invalid or expired reset token. Please request a new password reset.';
                } else if (xhr.status === 0) {
                    errorMessage = 'Unable to connect to server. Please check your connection.';
                }
                
                showMessage(errorMessage, 'error');
            }
        });
    });
    
    // Enter key handler
    $('#password-input, #confirm-password-input').on('keypress', function(e) {
        if (e.which === 13) { // Enter key
            $('#resetPasswordBtn').click();
        }
    });
    
    // Show loading state
    function showLoadingState(button) {
        button.prop('disabled', true);
        button.html('<i class="fas fa-spinner fa-spin"></i> Resetting...');
        button.css('cursor', 'not-allowed');
    }
    
    // Hide loading state
    function hideLoadingState(button) {
        button.prop('disabled', false);
        button.html('<i class="fas fa-lock" style="margin-right: 8px;"></i> Reset Password');
        button.css('cursor', 'pointer');
    }
    
    // Show message
    function showMessage(message, type) {
        const $messageDiv = $('#resetMessage');
        $messageDiv.removeClass('alert-success alert-danger')
                   .addClass(type === 'success' ? 'alert-success' : 'alert-danger')
                   .text(message)
                   .fadeIn();
    }
    
    // Hide message
    function hideMessage() {
        $('#resetMessage').fadeOut();
    }
    
    // Auto-focus password input on page load
    setTimeout(function() {
        $('#password-input').focus();
    }, 500);
});

