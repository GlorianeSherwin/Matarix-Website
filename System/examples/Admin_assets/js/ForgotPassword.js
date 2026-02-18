$(document).ready(function() {
    // Email validation function
    function validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    
    // Send Reset Link button functionality
    $('#sendResetBtn').on('click', function() {
        const email = $('#email-input').val().trim();
        const button = $(this);
        
        // Clear any previous error styling
        $('#email-input').removeClass('error');
        
        // Validate email
        if (!email) {
            showError('Please enter your email address.');
            $('#email-input').addClass('error').focus();
            return;
        }
        
        if (!validateEmail(email)) {
            showError('Please enter a valid email address.');
            $('#email-input').addClass('error').focus();
            return;
        }
        
        // Show loading state
        showLoadingState(button);
        
        // Send reset request to API
        $.ajax({
            url: '../api/forgot_password.php',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                email: email
            }),
            success: function(response) {
                hideLoadingState(button);
                
                if (response.success) {
                    showSuccess(email);
                } else {
                    showError(response.message || 'Failed to send reset link. Please try again.');
                }
            },
            error: function(xhr) {
                hideLoadingState(button);
                
                let errorMessage = 'An error occurred. Please try again.';
                
                if (xhr.responseJSON && xhr.responseJSON.message) {
                    errorMessage = xhr.responseJSON.message;
                } else if (xhr.status === 0) {
                    errorMessage = 'Unable to connect to server. Please check your connection.';
                }
                
                showError(errorMessage);
            }
        });
    });
    
    // Email input Enter key handler
    $('#email-input').on('keypress', function(e) {
        if (e.which === 13) { // Enter key
            $('#sendResetBtn').click();
        }
    });
    
    // Email input focus/blur effects
    $('#email-input').on('focus', function() {
        $(this).removeClass('error');
        $('.error-message').fadeOut();
    });
    
    // Real-time email validation
    $('#email-input').on('input', function() {
        const email = $(this).val().trim();
        
        if (email && !validateEmail(email)) {
            $(this).addClass('warning');
        } else {
            $(this).removeClass('warning');
        }
    });
    
    // Show loading state
    function showLoadingState(button) {
        button.prop('disabled', true);
        button.html('<i class="fas fa-spinner fa-spin"></i> Sending...');
        button.css('cursor', 'not-allowed');
    }
    
    // Hide loading state
    function hideLoadingState(button) {
        button.prop('disabled', false);
        button.html('<img src="../Admin_assets/images/Message_light.svg" alt="Email Icon" class="btn-icon">Send reset link');
        button.css('cursor', 'pointer');
    }
    
    // Show error message
    function showError(message) {
        // Remove existing error messages
        $('.error-message').remove();
        
        // Create and show error message
        const errorDiv = $('<div class="error-message">' + message + '</div>');
        $('.email-input-section').append(errorDiv);
        
        // Auto-hide after 5 seconds
        setTimeout(function() {
            errorDiv.fadeOut(300, function() {
                $(this).remove();
            });
        }, 5000);
    }
    
    // Show success message
    function showSuccess(email) {
        // Create success modal/overlay
        const successModal = $(`
            <div class="success-overlay">
                <div class="success-modal">
                    <div class="success-icon">
                        <i class="fas fa-check-circle"></i>
                    </div>
                    <h3>Reset Link Sent!</h3>
                    <p>We've sent a password reset link to:</p>
                    <p class="email-sent"><strong>${email}</strong></p>
                    <p class="success-note">Please check your email and follow the instructions to reset your password.</p>
                    <button class="success-btn" id="successOk">Got it</button>
                </div>
            </div>
        `);
        
        $('body').append(successModal);
        
        // Handle success modal close
        $('#successOk, .success-overlay').on('click', function(e) {
            if (e.target === this) {
                successModal.fadeOut(300, function() {
                    $(this).remove();
                });
            }
        });
    }
    
    // Back to Login link analytics
    $('.back-to-login-link').on('click', function() {
        console.log('User returned to login page from forgot password');
    });
    
    // Support email click tracking
    $('.support-email').on('click', function() {
        console.log('User clicked support email');
    });
    
    // Form validation styling
    $('#email-input').on('blur', function() {
        const email = $(this).val().trim();
        
        if (email && !validateEmail(email)) {
            $(this).addClass('error');
        } else {
            $(this).removeClass('error');
        }
    });
    
    // Prevent form submission on Enter (handled by keypress event)
    $('.forgot-password-card').on('submit', function(e) {
        e.preventDefault();
        $('#sendResetBtn').click();
    });
    
    // Auto-focus email input on page load
    setTimeout(function() {
        $('#email-input').focus();
    }, 500);
    
    // Handle responsive layout adjustments
    $(window).resize(function() {
        const windowWidth = $(window).width();
        
        if (windowWidth <= 480) {
            $('.company-logo').css({
                'width': '200px',
                'height': '200px'
            });
        } else if (windowWidth <= 768) {
            $('.company-logo').css({
                'width': '250px',
                'height': '250px'
            });
        } else {
            $('.company-logo').css({
                'width': '300px',
                'height': '300px'
            });
        }
    });
    
    // Track page load
    console.log('Forgot Password page loaded successfully');
    
    // Optional: Track how long user stays on page
    let pageLoadTime = Date.now();
    
    $(window).on('beforeunload', function() {
        const timeSpent = Date.now() - pageLoadTime;
        console.log('Time spent on forgot password page:', Math.round(timeSpent / 1000), 'seconds');
    });
});