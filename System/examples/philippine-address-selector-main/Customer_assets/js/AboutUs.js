$(document).ready(function() {
    // Navigation functionality
    $('.nav-item').on('click', function() {
        const navText = $(this).find('.nav-text').text();
        
        if (navText === 'CONTACT') {
            // Handle contact navigation
            console.log('Contact navigation clicked');
            
            // You can add contact page navigation here
            // For example: window.location.href = '../Contact/Contact.html';
            
            // Or show a contact modal/section
            alert('Contact functionality to be implemented');
        } else {
            // Handle other navigation items
            console.log('Navigation clicked:', navText);
        }
    });
    
    // Add smooth scrolling for better UX
    $('html, body').css({
        'scroll-behavior': 'smooth'
    });
    
    // Parallax effect for background on scroll
    $(window).scroll(function() {
        const scrolled = $(this).scrollTop();
        const parallax = $('.about-container');
        const speed = 0.5;
        
        parallax.css('background-position', 'center ' + (scrolled * speed) + 'px');
    });
    
    // Animate elements on scroll (optional enhancement)
    function animateOnScroll() {
        const windowHeight = $(window).height();
        const scrollTop = $(window).scrollTop();
        
        $('.content-section').each(function() {
            const elementTop = $(this).offset().top;
            const elementHeight = $(this).height();
            
            if (scrollTop + windowHeight > elementTop + 100) {
                $(this).addClass('animated fadeInLeft');
            }
        });
        
        $('.image-section').each(function() {
            const elementTop = $(this).offset().top;
            const elementHeight = $(this).height();
            
            if (scrollTop + windowHeight > elementTop + 100) {
                $(this).addClass('animated fadeInRight');
            }
        });
    }
    
    // Call animation function on scroll
    $(window).scroll(animateOnScroll);
    
    // Initial call for elements already in view
    animateOnScroll();
    
    // Add hover effects for navigation items
    $('.nav-item:not(.contact-nav)').hover(
        function() {
            $(this).find('.nav-underline').css('transform', 'scaleX(1.1)');
        },
        function() {
            $(this).find('.nav-underline').css('transform', 'scaleX(1)');
        }
    );
    
    // Image hover effects
    $('.circular-image-container').hover(
        function() {
            $(this).css({
                'box-shadow': '0 25px 50px rgba(0, 0, 0, 0.4)',
                'border-color': 'rgba(255, 255, 255, 0.4)'
            });
        },
        function() {
            $(this).css({
                'box-shadow': '0 20px 40px rgba(0, 0, 0, 0.3)',
                'border-color': 'rgba(255, 255, 255, 0.2)'
            });
        }
    );
    
    // Responsive navigation handling
    function handleResponsiveNav() {
        const windowWidth = $(window).width();
        
        if (windowWidth <= 768) {
            $('.top-navigation').addClass('mobile-nav');
        } else {
            $('.top-navigation').removeClass('mobile-nav');
        }
    }
    
    // Call on window resize
    $(window).resize(handleResponsiveNav);
    
    // Initial call
    handleResponsiveNav();
    
    // Add loading animation for the page
    $('body').addClass('loaded');
    
    // Preload images for better performance
    function preloadImages() {
        const images = [
            '../Admin_assets/images/AboutUsBG.png',
            '../Admin_assets/images/AboutUsRight.png'
        ];
        
        images.forEach(function(src) {
            const img = new Image();
            img.src = src;
        });
    }
    
    preloadImages();
    
    // Add keyboard navigation support
    $(document).keydown(function(e) {
        // ESC key to close any overlays (if implemented)
        if (e.keyCode === 27) {
            console.log('Escape key pressed');
        }
        
        // Enter key for contact button
        if (e.keyCode === 13 && $('.contact-nav').is(':focus')) {
            $('.contact-nav').click();
        }
    });
    
    // Make navigation items focusable for accessibility
    $('.nav-item').attr('tabindex', '0');
    
    // Handle focus events for accessibility
    $('.nav-item').focus(function() {
        $(this).addClass('focused');
    });
    
    $('.nav-item').blur(function() {
        $(this).removeClass('focused');
    });
    
    // Add subtle entrance animations
    setTimeout(function() {
        $('.company-name').addClass('animate-in');
        
        setTimeout(function() {
            $('.company-description').addClass('animate-in');
        }, 300);
        
        setTimeout(function() {
            $('.circular-image-container').addClass('animate-in');
        }, 600);
    }, 500);
    
    // Log page load for analytics (optional)
    console.log('About Us page loaded successfully');
});