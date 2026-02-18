$(document).ready(function() {
    // Handle form submission
    $('#adminLoginForm').on('submit', function(e) {
        e.preventDefault();
        
        // Get form values
        const email = $('#email').val().trim();
        const password = $('#password').val();
        
        // Validate inputs
        if (!email || !password) {
            showMessage('Please fill in all fields', 'error');
            return;
        }
        
        // Disable button and show loading state
        const $loginButton = $('#loginButton');
        $loginButton.prop('disabled', true).text('LOGGING IN...');
        
        // Hide previous messages
        $('#loginMessage').hide();
        
        // Send login request to API
        $.ajax({
            url: '../api/login.php',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                email: email,
                password: password,
                user_type: 'Admin'
            }),
            success: function(response) {
                if (response.success) {
                    showMessage('Login successful! Redirecting...', 'success');
                    
                    // Store user data in sessionStorage for quick access
                    if (response.user) {
                        sessionStorage.setItem('user', JSON.stringify(response.user));
                        // Store individual user properties for easy access
                        if (response.user.id) {
                            sessionStorage.setItem('user_id', response.user.id);
                        }
                        if (response.user.email) {
                            sessionStorage.setItem('user_email', response.user.email);
                        }
                        if (response.user.role) {
                            sessionStorage.setItem('user_role', response.user.role);
                        }
                        if (response.user.name) {
                            sessionStorage.setItem('user_name', response.user.name);
                        }
                    }
                    
                    // Redirect based on role (from API response) or default to OrdersAdmin
                    // Session is already set on server, no need for user_id in URL
                    let redirectUrl = response.redirect_url || '../Admin/OrdersAdmin.html';
                    
                    // Redirect after short delay
                    setTimeout(function() {
                        window.location.href = redirectUrl;
                    }, 1000);
                } else {
                    showMessage(response.message || 'Login failed. Please try again.', 'error');
                    $loginButton.prop('disabled', false).text('LOGIN');
                }
            },
            error: function(xhr) {
                let errorMessage = 'An error occurred. Please try again.';
                
                if (xhr.responseJSON && xhr.responseJSON.message) {
                    errorMessage = xhr.responseJSON.message;
                } else if (xhr.status === 0) {
                    errorMessage = 'Unable to connect to server. Please check your connection.';
                }
                
                showMessage(errorMessage, 'error');
                $loginButton.prop('disabled', false).text('LOGIN');
            }
        });
    });
    
    // Function to show messages
    function showMessage(message, type) {
        const $messageDiv = $('#loginMessage');
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
    
    // Allow Enter key to submit form
    $('.form-input').on('keypress', function(e) {
        if (e.which === 13) { // Enter key
            e.preventDefault();
            $('#adminLoginForm').submit();
        }
    });
    
    // Focus and blur effects for form inputs
    $('.form-input').on('focus', function() {
        $(this).parent().addClass('focused');
        $(this).siblings('.input-icon').css('color', '#d32f2f');
    });
    
    $('.form-input').on('blur', function() {
        if ($(this).val() === '') {
            $(this).parent().removeClass('focused');
        }
        $(this).siblings('.input-icon').css('color', '#999');
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
