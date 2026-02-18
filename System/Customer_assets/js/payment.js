// Payment Page JavaScript

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.querySelector('.overlay');
    sidebar.classList.toggle('show');
    overlay.classList.toggle('show');
}

function toggleOrderDetails() {
    const orderCard = document.getElementById('orderCard');
    orderCard.classList.toggle('expanded');
}

function selectPayment(element, event) {
    event.stopPropagation(); // Prevent card toggle
    
    // Remove selected class from all options
    document.querySelectorAll('.payment-option').forEach(option => {
        option.classList.remove('selected');
    });
    
    // Add selected class to clicked option
    element.classList.add('selected');
    
    // Check the radio button
    const radio = element.querySelector('input[type="radio"]');
    radio.checked = true;
}

function processPayment(event) {
    event.stopPropagation(); // Prevent card toggle
    
    const selectedPayment = document.querySelector('input[name="payment"]:checked');
    const paymentMethod = selectedPayment ? selectedPayment.nextElementSibling.textContent : 'Unknown';
    
    // Use custom notification system instead of browser alert
    if (typeof window.Notifications !== 'undefined') {
        window.Notifications.showToast(`Processing payment via ${paymentMethod}...`, 'info', 3000);
    } else {
        console.log(`Processing payment via ${paymentMethod}...`);
    }
    
    // Simulate payment processing
    setTimeout(() => {
        if (typeof window.Notifications !== 'undefined') {
            window.Notifications.showToast('Payment successful! Your order is now being prepared.', 'success', 5000);
        } else {
            console.log('Payment successful! Your order is now being prepared.');
        }
        moveToNextStage();
    }, 2000);
}

function moveToNextStage() {
    // Update progress tracker to show "Preparing" as active
    document.querySelectorAll('.progress-step').forEach((step, index) => {
        step.classList.remove('active');
        if (index === 0) {
            step.classList.add('completed');
        } else if (index === 1) {
            step.classList.add('active');
        }
    });
    
    // Update button text
    const button = document.querySelector('.order-actions .btn-custom');
    button.textContent = 'Order Preparing';
    button.style.background = 'var(--green)';
    button.disabled = true;
    
    // Hide payment notice
    const notice = document.querySelector('.payment-notice');
    notice.style.display = 'none';
}

// Close sidebar when clicking outside on mobile
document.addEventListener('click', function(event) {
    const sidebar = document.getElementById('sidebar');
    const toggle = document.querySelector('.mobile-menu-toggle');
    
    if (toggle && !sidebar.contains(event.target) && !toggle.contains(event.target)) {
        sidebar.classList.remove('show');
        const overlay = document.querySelector('.overlay');
        if (overlay) {
            overlay.classList.remove('show');
        }
    }
});