/**
 * Script to add notification system to all admin pages
 * This can be run to automatically add the notification system to admin HTML files
 */

// This is a reference script - the notification system should be manually added to each admin page
// Or you can use this as a template for automation

const adminPages = [
    'InventoryAdmin.html',
    'OrdersAdmin.html',
    'ReportsAdmin.html',
    'UserManagement.html',
    'DeliveriesAdmin.html',
    'CustomerFeedback.html',
    'QuotationRequests.html',
    'AdminProfile.html',
    'ViewOrderAccept.html',
    'ViewOrdersReject.html',
    'ViewReceipt.html'
];

// Instructions:
// 1. Add this CSS link in the <head> section (after other CSS files):
//    <link rel="stylesheet" href="../Admin_assets/css/admin-notifications.css">
//
// 2. Add this JS script in the <body> section (before other JS files, after jQuery):
//    <script src="../Admin_assets/js/admin-notifications.js"></script>

console.log('Notification system reference script loaded. Add the CSS and JS links to admin pages manually.');

