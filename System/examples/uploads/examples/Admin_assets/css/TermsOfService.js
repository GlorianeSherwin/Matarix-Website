$(document).ready(function() {
    // Terms checkbox functionality - visual feedback only
    $('.terms-checkbox').on('change', function() {
        const isChecked = $(this).is(':checked');
        
        if (isChecked) {
            console.log('Terms of Service accepted');
        } else {
            console.log('Terms of Service not accepted');
        }
    });
    
    // Complete Registration link functionality
    $('.complete-registration-btn').on('click', function(e) {
        const isTermsAccepted = $('.terms-checkbox').is(':checked');
        
        if (!isTermsAccepted) {
            e.preventDefault();
            alert('Please accept the Terms of Service to complete registration.');
            return false;
        }
        
        console.log('Registration completed - redirecting to login...');
    });
    
    // Terms link functionality
    $('.terms-link').on('click', function(e) {
        e.preventDefault();
        console.log('Terms of Service link clicked');
        
        // Scroll to top of terms content
        $('html, body').animate({
            scrollTop: $('.terms-header').offset().top - 20
        }, 500);
    });
    
    // Checkbox label click functionality
    $('.checkbox-label').on('click', function() {
        const checkbox = $('#agreeTerms');
        checkbox.prop('checked', !checkbox.prop('checked')).trigger('change');
    });
    
    // Keyboard navigation support
    $(document).keydown(function(e) {
        // Space bar to toggle checkbox when focused
        if (e.keyCode === 32 && $('.terms-checkbox').is(':focus')) {
            e.preventDefault();
            $('.terms-checkbox').trigger('click');
        }
    });
    
    console.log('Terms of Service page loaded successfully');
});