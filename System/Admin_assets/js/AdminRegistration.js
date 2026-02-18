$(document).ready(function() {
    // Simple signup button click handler - no validation, just redirect
    $('.signup-button').on('click', function(e) {
        e.preventDefault();
        
        // Optional: Log that signup was clicked (for development purposes)
        console.log('Signup button clicked - redirecting to login');
        
        // Redirect immediately to login page
        window.location.href = '../Customer/Login.html';
    });
    
    // Also handle form submission the same way
    $('.registration-form').on('submit', function(e) {
        e.preventDefault();
        
        // Redirect to login page
        window.location.href = '../Customer/Login.html';
    });
    
    // Optional: Keep some basic UX features for the form fields
    // Focus and blur effects for form inputs (visual enhancement only)
    $('.form-input').on('focus', function() {
        $(this).parent().addClass('focused');
    });
    
    $('.form-input').on('blur', function() {
        if ($(this).val() === '') {
            $(this).parent().removeClass('focused');
        }
    });
    
    // Optional: Format mobile number input (just for visual formatting)
    $('.form-row:nth-child(3) .col-md-6:last-child input').on('input', function() {
        let value = $(this).val().replace(/\D/g, '');
        
        // Limit to 11 digits
        if (value.length > 11) {
            value = value.substr(0, 11);
        }
        
        // Format as XXX-XXX-XXXX
        if (value.length >= 7) {
            value = value.replace(/(\d{4})(\d{3})(\d{1,4})/, '$1-$2-$3');
        } else if (value.length >= 4) {
            value = value.replace(/(\d{3})(\d{1,3})/, '$1-$2');
        }
        
        $(this).val(value);
    });
});