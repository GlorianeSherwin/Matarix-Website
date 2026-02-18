<?php
/**
 * Generate Quotation PDF API
 * Creates a downloadable PDF quotation from cart items
 */

// Start output buffering
ob_start();

// Suppress error display
error_reporting(E_ALL);
ini_set('display_errors', 0);

require_once __DIR__ . '/../includes/db_functions.php';
require_once __DIR__ . '/../includes/session_helper.php';

// Start session
if (session_status() === PHP_SESSION_NONE) {
    startSession('customer');
}

// Check if user is logged in
if (!isset($_SESSION['user_id'])) {
    ob_end_clean();
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'message' => 'Please log in to generate quotation'
    ]);
    exit;
}

// Get request data
$data = json_decode(file_get_contents('php://input'), true);
$cartItems = $data['cart_items'] ?? [];

if (empty($cartItems)) {
    ob_end_clean();
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'message' => 'No items in quotation cart'
    ]);
    exit;
}

// Get user information
$userId = $_SESSION['user_id'];
$userName = $_SESSION['user_name'] ?? 'Customer';
$userEmail = $_SESSION['user_email'] ?? '';

// Try to get full user profile
$db = new DatabaseFunctions();
$pdo = $db->getConnection();

$userPhone = '';
$userAddress = '';

try {
    $userStmt = $pdo->prepare("
        SELECT First_Name, Last_Name, email, Phone_Number, Address
        FROM users
        WHERE User_ID = :user_id
    ");
    $userStmt->execute(['user_id' => $userId]);
    $userData = $userStmt->fetch(PDO::FETCH_ASSOC);
    
    if ($userData) {
        $userName = trim(($userData['First_Name'] ?? '') . ' ' . ($userData['Last_Name'] ?? ''));
        if (empty($userName)) $userName = 'Customer';
        $userEmail = $userData['email'] ?? $userEmail;
        $userPhone = $userData['Phone_Number'] ?? '';
        $userAddress = $userData['Address'] ?? '';
    }
} catch (Exception $e) {
    error_log("Error fetching user data: " . $e->getMessage());
}

// Try to include TCPDF
$tcpdfPath = __DIR__ . '/../vendor/tecnickcom/tcpdf/tcpdf.php';
$tcpdfPathAlt = __DIR__ . '/../includes/tcpdf/tcpdf.php';

if (file_exists($tcpdfPath)) {
    require_once $tcpdfPath;
} elseif (file_exists($tcpdfPathAlt)) {
    require_once $tcpdfPathAlt;
} else {
    // Fallback: Use simple HTML to PDF or return error
    ob_end_clean();
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'message' => 'PDF library not installed. Please install TCPDF.',
        'instructions' => 'Install via Composer: composer require tecnickcom/tcpdf'
    ]);
    exit;
}

// Calculate totals
$subtotal = 0;
foreach ($cartItems as $item) {
    $itemTotal = floatval($item['price']) * intval($item['quantity']);
    $subtotal += $itemTotal;
}
$total = $subtotal; // No tax

// Generate quotation number
$quotationNumber = 'QUO-' . date('Ymd') . '-' . str_pad($userId, 4, '0', STR_PAD_LEFT) . '-' . time();

// Create custom PDF class
class QuotationPDF extends TCPDF {
    // Page header
    public function Header() {
        // Company logo and header
        $this->SetY(10);
        $this->SetFont('helvetica', 'B', 20);
        $this->SetTextColor(220, 53, 69); // Red color
        $this->Cell(0, 10, 'MATARIX CONSTRUCTION SUPPLY', 0, 1, 'C');
        $this->SetFont('helvetica', '', 10);
        $this->SetTextColor(0, 0, 0);
        $this->Cell(0, 5, 'Pioneer St, Bgy. Kapitolyo, Pasig City, Metro Manila', 0, 1, 'C');
        $this->Cell(0, 5, 'Email: matarixconstruction@gmail.com', 0, 1, 'C');
        $this->Ln(5);
        
        // Draw line
        $this->SetLineWidth(0.5);
        $this->Line(15, $this->GetY(), 195, $this->GetY());
        $this->Ln(3);
    }
    
    // Page footer
    public function Footer() {
        $this->SetY(-15);
        $this->SetFont('helvetica', 'I', 8);
        $this->SetTextColor(128, 128, 128);
        $this->Cell(0, 10, 'Page ' . $this->getAliasNumPage() . '/' . $this->getAliasNbPages(), 0, 0, 'C');
    }
}

// Create new PDF document
$pdf = new QuotationPDF(PDF_PAGE_ORIENTATION, PDF_UNIT, PDF_PAGE_FORMAT, true, 'UTF-8', false);

// Set document information
$pdf->SetCreator('MATARIX Quotation System');
$pdf->SetAuthor('MATARIX');
$pdf->SetTitle('Quotation - ' . $quotationNumber);
$pdf->SetSubject('Material Quotation');

// Set margins
$pdf->SetMargins(15, 50, 15);
$pdf->SetHeaderMargin(5);
$pdf->SetFooterMargin(10);

// Set auto page breaks
$pdf->SetAutoPageBreak(TRUE, 15);

// Set font
$pdf->SetFont('helvetica', '', 10);

// Add a page
$pdf->AddPage();

// Quotation Title
$pdf->SetFont('helvetica', 'B', 16);
$pdf->SetTextColor(220, 53, 69);
$pdf->Cell(0, 10, 'QUOTATION', 0, 1, 'C');
$pdf->Ln(5);

// Quotation Details
$pdf->SetFont('helvetica', '', 10);
$pdf->SetTextColor(0, 0, 0);
$pdf->Cell(0, 6, 'Quotation Number: ' . $quotationNumber, 0, 1, 'L');
$pdf->Cell(0, 6, 'Date: ' . date('F d, Y'), 0, 1, 'L');
$pdf->Cell(0, 6, 'Valid Until: ' . date('F d, Y', strtotime('+30 days')), 0, 1, 'L');
$pdf->Ln(5);

// Customer Information
$pdf->SetFont('helvetica', 'B', 12);
$pdf->Cell(0, 6, 'Customer Information', 0, 1, 'L');
$pdf->SetFont('helvetica', '', 10);
$pdf->Cell(0, 6, 'Name: ' . $userName, 0, 1, 'L');
if (!empty($userEmail)) {
    $pdf->Cell(0, 6, 'Email: ' . $userEmail, 0, 1, 'L');
}
if (!empty($userPhone)) {
    $pdf->Cell(0, 6, 'Phone: ' . $userPhone, 0, 1, 'L');
}
if (!empty($userAddress)) {
    $pdf->Cell(0, 6, 'Address: ' . $userAddress, 0, 1, 'L');
}
$pdf->Ln(5);

// Items Table Header
$pdf->SetFont('helvetica', 'B', 9);
$pdf->SetFillColor(220, 53, 69);
$pdf->SetTextColor(255);
$pdf->Cell(10, 8, '#', 1, 0, 'C', 1);
$pdf->Cell(80, 8, 'Product Name', 1, 0, 'L', 1);
$pdf->Cell(30, 8, 'Variations', 1, 0, 'C', 1);
$pdf->Cell(20, 8, 'Quantity', 1, 0, 'C', 1);
$pdf->Cell(25, 8, 'Unit Price', 1, 0, 'R', 1);
$pdf->Cell(25, 8, 'Total', 1, 1, 'R', 1);

// Items Table Content
$pdf->SetTextColor(0);
$pdf->SetFont('helvetica', '', 9);
$fill = false;
$itemNumber = 1;

foreach ($cartItems as $item) {
    $productName = $item['name'] ?? 'Product';
    $variations = $item['variations'] ?? null;
    $quantity = intval($item['quantity'] ?? 1);
    $unitPrice = floatval($item['price'] ?? 0);
    $itemTotal = $unitPrice * $quantity;
    
    // Build variation text
    $variationText = '-';
    if ($variations && is_array($variations) && count($variations) > 0) {
        $variationParts = [];
        foreach ($variations as $varName => $varData) {
            $varValue = is_array($varData) ? ($varData['variation_value'] ?? '') : $varData;
            $variationParts[] = $varName . ': ' . $varValue;
        }
        $variationText = implode(', ', $variationParts);
    }
    
    // Truncate long text
    if (strlen($productName) > 40) {
        $productName = substr($productName, 0, 37) . '...';
    }
    if (strlen($variationText) > 25) {
        $variationText = substr($variationText, 0, 22) . '...';
    }
    
    $pdf->SetFillColor(245, 245, 245);
    $pdf->Cell(10, 7, $itemNumber, 1, 0, 'C', $fill);
    $pdf->Cell(80, 7, $productName, 1, 0, 'L', $fill);
    $pdf->Cell(30, 7, $variationText, 1, 0, 'C', $fill);
    $pdf->Cell(20, 7, number_format($quantity), 1, 0, 'C', $fill);
    $pdf->Cell(25, 7, '₱' . number_format($unitPrice, 2), 1, 0, 'R', $fill);
    $pdf->Cell(25, 7, '₱' . number_format($itemTotal, 2), 1, 1, 'R', $fill);
    
    $fill = !$fill;
    $itemNumber++;
}

// Summary Section
$pdf->Ln(3);
$pdf->SetFont('helvetica', '', 10);
$pdf->Cell(135, 0, '', 0, 0); // Spacer
$pdf->Cell(30, 6, 'Subtotal:', 0, 0, 'R');
$pdf->Cell(25, 6, '₱' . number_format($subtotal, 2), 0, 1, 'R');

$pdf->SetFont('helvetica', 'B', 12);
$pdf->Cell(135, 0, '', 0, 0); // Spacer
$pdf->Cell(30, 8, 'Total:', 0, 0, 'R');
$pdf->Cell(25, 8, '₱' . number_format($total, 2), 0, 1, 'R');

// Terms and Conditions
$pdf->Ln(10);
$pdf->SetFont('helvetica', 'B', 10);
$pdf->Cell(0, 6, 'Terms and Conditions:', 0, 1, 'L');
$pdf->SetFont('helvetica', '', 9);
$pdf->MultiCell(0, 5, '1. This quotation is valid for 30 days from the date of issue.', 0, 'L');
$pdf->MultiCell(0, 5, '2. Prices are subject to change without prior notice.', 0, 'L');
$pdf->MultiCell(0, 5, '3. All prices are in Philippine Peso (PHP).', 0, 'L');
$pdf->MultiCell(0, 5, '4. Delivery terms and conditions apply as per company policy.', 0, 'L');
$pdf->MultiCell(0, 5, '5. For inquiries, please contact us at matarixconstruction@gmail.com', 0, 'L');

// Notes Section
$pdf->Ln(5);
$pdf->SetFont('helvetica', 'I', 9);
$pdf->SetTextColor(128, 128, 128);
$pdf->MultiCell(0, 5, 'Thank you for choosing MATARIX Construction Supply. We look forward to serving you!', 0, 'C');

// Clear output buffer and output PDF
ob_end_clean();
$filename = 'MATARIX_Quotation_' . date('Y-m-d_His') . '.pdf';
$pdf->Output($filename, 'D'); // 'D' = download, 'I' = inline

exit;
