<?php
/**
 * Export Deliveries to PDF
 * Generates a downloadable PDF report of deliveries
 * 
 * Note: This uses TCPDF library. If not installed, download from:
 * https://github.com/tecnickcom/TCPDF
 * Or install via Composer: composer require tecnickcom/tcpdf
 */

require_once __DIR__ . '/../includes/db_functions.php';
require_once __DIR__ . '/../includes/session_helper.php';

if (session_status() === PHP_SESSION_NONE) {
    startSession('admin');
}

// Check authentication
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    die('Unauthorized');
}

$userRole = $_SESSION['user_role'] ?? '';
if (!in_array($userRole, ['Admin', 'Store Employee'])) {
    http_response_code(403);
    die('Access denied');
}

// Try to include TCPDF
$tcpdfPath = __DIR__ . '/../vendor/tecnickcom/tcpdf/tcpdf.php';
$tcpdfPathAlt = __DIR__ . '/../includes/tcpdf/tcpdf.php';

if (file_exists($tcpdfPath)) {
    require_once $tcpdfPath;
} elseif (file_exists($tcpdfPathAlt)) {
    require_once $tcpdfPathAlt;
} else {
    // TCPDF not found - provide download link or use alternative
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'message' => 'PDF library not installed. Please install TCPDF.',
        'instructions' => 'Download TCPDF from https://github.com/tecnickcom/TCPDF and place it in includes/tcpdf/ or install via Composer: composer require tecnickcom/tcpdf'
    ]);
    exit;
}

$db = new DatabaseFunctions();
$pdo = $db->getConnection();

// Get filter parameters
$statusFilter = $_GET['status'] ?? 'all';
$dateFrom = $_GET['date_from'] ?? null;
$dateTo = $_GET['date_to'] ?? null;
$driverFilter = $_GET['driver'] ?? 'all';
$vehicleFilter = $_GET['vehicle'] ?? 'all';
$customerFilter = $_GET['customer'] ?? '';
$deliveryCodeFilter = $_GET['delivery_code'] ?? '';
$scope = $_GET['scope'] ?? 'all'; // all, active, history

// Build query with filters
$sql = "
    SELECT 
        COALESCE(d.Delivery_ID, 0) as Delivery_ID,
        o.Order_ID,
        COALESCE(d.Delivery_Status, 'Pending') as Delivery_Status,
        d.Driver_ID,
        d.Vehicle_ID,
        COALESCE(d.Created_At, o.order_date) as Created_At,
        COALESCE(d.Updated_At, o.order_date) as Updated_At,
        o.amount,
        o.order_date,
        u.First_Name as Customer_First_Name,
        u.Last_Name as Customer_Last_Name,
        u.address as Customer_Address,
        u.Phone_Number as Customer_Phone,
        driver.First_Name as Driver_First_Name,
        driver.Last_Name as Driver_Last_Name,
        f.vehicle_model
    FROM orders o
    LEFT JOIN deliveries d ON o.Order_ID = d.Order_ID
    LEFT JOIN users u ON o.User_ID = u.User_ID
    LEFT JOIN users driver ON d.Driver_ID = driver.User_ID
    LEFT JOIN fleet f ON d.Vehicle_ID = f.Vehicle_ID
    WHERE o.status NOT IN ('Cancelled', 'Deleted')
    AND o.Order_ID IS NOT NULL
";

$params = [];

// Apply status filter
if ($statusFilter !== 'all') {
    $sql .= " AND COALESCE(d.Delivery_Status, 'Pending') = :status";
    $params['status'] = $statusFilter;
}

// Apply scope filter
if ($scope === 'active') {
    $sql .= " AND COALESCE(d.Delivery_Status, 'Pending') IN ('Pending', 'Preparing', 'Out for Delivery')";
} elseif ($scope === 'history') {
    $sql .= " AND COALESCE(d.Delivery_Status, 'Pending') IN ('Delivered', 'Cancelled')";
}

// Apply date filters
if ($dateFrom) {
    $sql .= " AND DATE(COALESCE(d.Created_At, o.order_date)) >= :date_from";
    $params['date_from'] = $dateFrom;
}

if ($dateTo) {
    $sql .= " AND DATE(COALESCE(d.Created_At, o.order_date)) <= :date_to";
    $params['date_to'] = $dateTo;
}

// Apply driver filter
if ($driverFilter !== 'all' && $driverFilter) {
    if ($driverFilter === 'unassigned') {
        $sql .= " AND (d.Driver_ID IS NULL OR d.Driver_ID = 0)";
    } else {
        $sql .= " AND d.Driver_ID = :driver_id";
        $params['driver_id'] = $driverFilter;
    }
}

// Apply vehicle filter
if ($vehicleFilter !== 'all' && $vehicleFilter) {
    if ($vehicleFilter === 'unassigned') {
        $sql .= " AND (d.Vehicle_ID IS NULL OR d.Vehicle_ID = 0)";
    } else {
        $sql .= " AND d.Vehicle_ID = :vehicle_id";
        $params['vehicle_id'] = $vehicleFilter;
    }
}

// Apply customer filter
if ($customerFilter) {
    $sql .= " AND (u.First_Name LIKE :customer OR u.Last_Name LIKE :customer)";
    $params['customer'] = '%' . $customerFilter . '%';
}

// Apply delivery code filter
if ($deliveryCodeFilter) {
    $sql .= " AND (d.Delivery_ID LIKE :delivery_code OR o.Order_ID LIKE :delivery_code)";
    $params['delivery_code'] = '%' . str_replace(['DEL-', 'ORD-'], '', $deliveryCodeFilter) . '%';
}

$sql .= " ORDER BY COALESCE(d.Updated_At, d.Created_At, o.order_date) DESC";

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$deliveries = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Create PDF class
class DeliveryPDF extends TCPDF {
    // Page header
    public function Header() {
        // Logo area
        $this->SetFont('helvetica', 'B', 20);
        $this->Cell(0, 15, 'MATARIX', 0, false, 'L', 0, '', 0, false, 'M', 'M');
        $this->Ln(8);
        
        // Title
        $this->SetFont('helvetica', 'B', 16);
        $this->Cell(0, 10, 'Delivery Management Report', 0, false, 'L', 0, '', 0, false, 'M', 'M');
        $this->Ln(5);
        
        // Date
        $this->SetFont('helvetica', '', 10);
        $this->Cell(0, 5, 'Generated: ' . date('F d, Y h:i A'), 0, false, 'L', 0, '', 0, false, 'M', 'M');
        $this->Ln(10);
        
        // Line separator
        $this->Line(15, $this->GetY(), 195, $this->GetY());
        $this->Ln(5);
    }

    // Page footer
    public function Footer() {
        $this->SetY(-15);
        $this->SetFont('helvetica', 'I', 8);
        $this->Cell(0, 10, 'Page ' . $this->getAliasNumPage() . '/' . $this->getAliasNbPages(), 0, false, 'C', 0, '', 0, false, 'T', 'M');
    }
}

// Create new PDF document
$pdf = new DeliveryPDF(PDF_PAGE_ORIENTATION, PDF_UNIT, PDF_PAGE_FORMAT, true, 'UTF-8', false);

// Set document information
$pdf->SetCreator('MATARIX Delivery Management');
$pdf->SetAuthor('MATARIX');
$pdf->SetTitle('Delivery Report - ' . date('Y-m-d'));
$pdf->SetSubject('Delivery Management Report');

// Set margins
$pdf->SetMargins(15, 35, 15);
$pdf->SetHeaderMargin(5);
$pdf->SetFooterMargin(10);

// Set auto page breaks
$pdf->SetAutoPageBreak(TRUE, 15);

// Set font
$pdf->SetFont('helvetica', '', 10);

// Add a page
$pdf->AddPage();

// Summary section
$pdf->SetFont('helvetica', 'B', 12);
$pdf->Cell(0, 10, 'Summary', 0, 1, 'L');
$pdf->SetFont('helvetica', '', 10);

// Build filter summary
$filterSummary = [];
if ($statusFilter !== 'all') $filterSummary[] = "Status: $statusFilter";
if ($scope !== 'all') $filterSummary[] = "Scope: " . ucfirst($scope);
if ($dateFrom) $filterSummary[] = "From: $dateFrom";
if ($dateTo) $filterSummary[] = "To: $dateTo";
if ($driverFilter !== 'all') $filterSummary[] = "Driver: " . ($driverFilter === 'unassigned' ? 'Unassigned' : 'Selected');
if ($vehicleFilter !== 'all') $filterSummary[] = "Vehicle: " . ($vehicleFilter === 'unassigned' ? 'Unassigned' : 'Selected');
if ($customerFilter) $filterSummary[] = "Customer: $customerFilter";
if ($deliveryCodeFilter) $filterSummary[] = "Code: $deliveryCodeFilter";

$pdf->Cell(0, 5, 'Total Deliveries: ' . count($deliveries), 0, 1, 'L');
if (!empty($filterSummary)) {
    $pdf->Cell(0, 5, 'Filters: ' . implode(', ', $filterSummary), 0, 1, 'L');
}
$pdf->Ln(5);

// Table header
$pdf->SetFont('helvetica', 'B', 9);
$pdf->SetFillColor(220, 53, 69);
$pdf->SetTextColor(255);
$pdf->Cell(20, 8, 'Delivery ID', 1, 0, 'C', 1);
$pdf->Cell(20, 8, 'Order ID', 1, 0, 'C', 1);
$pdf->Cell(35, 8, 'Customer', 1, 0, 'C', 1);
$pdf->Cell(30, 8, 'Driver', 1, 0, 'C', 1);
$pdf->Cell(30, 8, 'Vehicle', 1, 0, 'C', 1);
$pdf->Cell(30, 8, 'Status', 1, 0, 'C', 1);
$pdf->Cell(30, 8, 'Date', 1, 1, 'C', 1);

// Table data
$pdf->SetTextColor(0);
$pdf->SetFont('helvetica', '', 8);
$fill = false;

foreach ($deliveries as $delivery) {
    $deliveryId = $delivery['Delivery_ID'] > 0 
        ? 'DEL-' . str_pad($delivery['Delivery_ID'], 6, '0', STR_PAD_LEFT)
        : 'N/A';
    $orderId = 'ORD-' . str_pad($delivery['Order_ID'], 6, '0', STR_PAD_LEFT);
    $customer = trim(($delivery['Customer_First_Name'] ?? '') . ' ' . ($delivery['Customer_Last_Name'] ?? ''));
    if (empty($customer)) $customer = 'N/A';
    $driver = trim(($delivery['Driver_First_Name'] ?? '') . ' ' . ($delivery['Driver_Last_Name'] ?? ''));
    if (empty($driver)) $driver = 'Unassigned';
    $vehicle = $delivery['vehicle_model'] ?? 'Unassigned';
    $status = $delivery['Delivery_Status'] ?? 'Pending';
    $date = date('M d, Y', strtotime($delivery['Created_At']));
    
    // Truncate long strings
    $customer = mb_substr($customer, 0, 20);
    $driver = mb_substr($driver, 0, 15);
    $vehicle = mb_substr($vehicle, 0, 15);
    
    $pdf->SetFillColor(245, 245, 245);
    $pdf->Cell(20, 6, $deliveryId, 1, 0, 'C', $fill);
    $pdf->Cell(20, 6, $orderId, 1, 0, 'C', $fill);
    $pdf->Cell(35, 6, $customer, 1, 0, 'L', $fill);
    $pdf->Cell(30, 6, $driver, 1, 0, 'L', $fill);
    $pdf->Cell(30, 6, $vehicle, 1, 0, 'L', $fill);
    $pdf->Cell(30, 6, $status, 1, 0, 'C', $fill);
    $pdf->Cell(30, 6, $date, 1, 1, 'C', $fill);
    
    $fill = !$fill;
}

// Output PDF
$filename = 'Deliveries_Report_' . date('Y-m-d_His') . '.pdf';
$pdf->Output($filename, 'D'); // 'D' = download, 'I' = inline
exit;
?>

