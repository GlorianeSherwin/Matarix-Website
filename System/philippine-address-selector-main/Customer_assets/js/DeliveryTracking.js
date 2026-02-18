// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    
    // COUNTDOWN TIMER FOR TO PAY TAB
    function startCountdown() {
        const countdownElement = document.getElementById('countdown');
        if (!countdownElement) return;

        // Set countdown to 24 hours from now (you can adjust this)
        const endTime = new Date().getTime() + (24 * 60 * 60 * 1000);

        function updateCountdown() {
            const now = new Date().getTime();
            const distance = endTime - now;

            if (distance < 0) {
                countdownElement.textContent = "Payment time expired";
                return;
            }

            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));

            countdownElement.textContent = hours + " hours " + minutes + " minutes";
        }

        updateCountdown();
        setInterval(updateCountdown, 60000); // Update every minute
    }

    startCountdown();
    
    // TAB SWITCHING FUNCTIONALITY
    const tabItems = document.querySelectorAll('.tab-item');
    const tabContents = document.querySelectorAll('.tab-content');

    tabItems.forEach(tab => {
        tab.addEventListener('click', function() {
            // Remove active class from all tabs
            tabItems.forEach(item => item.classList.remove('active'));
            
            // Hide all tab contents
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Add active class to clicked tab
            this.classList.add('active');
            
            // Show corresponding tab content
            const tabName = this.getAttribute('data-tab');
            const targetContent = document.getElementById(tabName);
            if (targetContent) {
                targetContent.classList.add('active');
            }
        });
    });

    // SIDEBAR TOGGLE FOR MOBILE
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');

    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', function() {
            sidebar.classList.toggle('active');
            sidebarOverlay.classList.toggle('active');
        });
    }

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', function() {
            sidebar.classList.remove('active');
            sidebarOverlay.classList.remove('active');
        });
    }

    // ORDER CARD CLICK FUNCTIONALITY
    const orderCards = document.querySelectorAll('.order-card');
    
    orderCards.forEach(card => {
        card.addEventListener('click', function(e) {
            // Don't trigger if clicking on a button
            if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
                return;
            }
            
            // Get order number
            const orderNumber = this.querySelector('.order-number').textContent;
            
            // You can redirect to order details page or show modal
            console.log('Clicked on: ' + orderNumber);
            // window.location.href = 'order-details.html?order=' + orderNumber;
        });
    });

    // PAY NOW BUTTON
    const payButtons = document.querySelectorAll('.btn-danger');
    
    payButtons.forEach(button => {
        if (button.textContent.trim() === 'Pay Now') {
            button.addEventListener('click', function(e) {
                e.stopPropagation();
                const orderCard = this.closest('.order-card');
                const orderNumber = orderCard.querySelector('.order-number').textContent;
                
                // Redirect to payment page or show payment modal
                console.log('Pay Now clicked for: ' + orderNumber);
                if (typeof window.Notifications !== 'undefined') {
                    window.Notifications.showToast('Redirecting to payment page for ' + orderNumber, 'info', 3000);
                } else {
                    console.log('Redirecting to payment page for ' + orderNumber);
                }
                // window.location.href = 'payment.html?order=' + orderNumber;
            });
        }
    });

    // TRACK BUTTON
    const trackButtons = document.querySelectorAll('.btn-outline-primary');
    
    trackButtons.forEach(button => {
        if (button.textContent.trim() === 'Track') {
            button.addEventListener('click', function(e) {
                e.stopPropagation();
                const orderCard = this.closest('.order-card');
                const orderNumber = orderCard.querySelector('.order-number').textContent;
                
                // Show tracking details
                console.log('Track clicked for: ' + orderNumber);
                alert('Showing tracking details for ' + orderNumber);
                // You can show a modal with tracking information here
            });
        }
    });

    // RATE NOW BUTTON
    const rateButtons = document.querySelectorAll('.btn-warning');
    
    rateButtons.forEach(button => {
        if (button.textContent.trim() === 'Rate Now') {
            button.addEventListener('click', function(e) {
                e.stopPropagation();
                const orderCard = this.closest('.order-card');
                const orderNumber = orderCard.querySelector('.order-number').textContent;
                
                // Show rating modal
                console.log('Rate Now clicked for: ' + orderNumber);
                alert('Opening rating form for ' + orderNumber);
                // You can show a modal with star rating here
            });
        }
    });

    // VIEW DETAILS BUTTON
    const viewDetailsButtons = document.querySelectorAll('.btn-outline-secondary');
    
    viewDetailsButtons.forEach(button => {
        if (button.textContent.trim() === 'View Details') {
            button.addEventListener('click', function(e) {
                e.stopPropagation();
                const orderCard = this.closest('.order-card');
                const orderNumber = orderCard.querySelector('.order-number').textContent;
                
                // Redirect to order details
                console.log('View Details clicked for: ' + orderNumber);
                // window.location.href = 'order-details.html?order=' + orderNumber;
            });
        }
    });

    // STAR RATING FUNCTIONALITY (for To Rate section)
    const starContainers = document.querySelectorAll('.stars:not(.rated)');
    
    starContainers.forEach(container => {
        const stars = container.querySelectorAll('i');
        
        stars.forEach((star, index) => {
            star.addEventListener('mouseenter', function() {
                // Highlight stars up to hovered star
                for (let i = 0; i <= index; i++) {
                    stars[i].classList.remove('far');
                    stars[i].classList.add('fas');
                    stars[i].style.color = '#ffc107';
                }
            });
            
            star.addEventListener('click', function(e) {
                e.stopPropagation();
                const rating = index + 1;
                console.log('Rated: ' + rating + ' stars');
                
                // Keep the stars filled
                container.classList.add('rated');
                
                // You can send the rating to your backend here
                alert('You rated this order ' + rating + ' stars!');
            });
        });
        
        container.addEventListener('mouseleave', function() {
            // Reset stars if not rated
            if (!this.classList.contains('rated')) {
                const stars = this.querySelectorAll('i');
                stars.forEach(star => {
                    star.classList.remove('fas');
                    star.classList.add('far');
                    star.style.color = '';
                });
            }
        });
    });

    // SMOOTH SCROLL TO TOP WHEN SWITCHING TABS
    tabItems.forEach(tab => {
        tab.addEventListener('click', function() {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    });
});