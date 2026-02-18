-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1:3306
-- Generation Time: Feb 07, 2026 at 12:57 AM
-- Server version: 11.8.3-MariaDB-log
-- PHP Version: 7.2.34

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `u634157906_matarik`
--

-- --------------------------------------------------------

--
-- Table structure for table `admin_notifications`
--

CREATE TABLE `admin_notifications` (
  `Notification_ID` int(11) NOT NULL,
  `Activity_Type` varchar(50) DEFAULT 'order_created',
  `Order_ID` int(11) NOT NULL,
  `User_ID` int(11) NOT NULL,
  `Customer_Name` varchar(255) NOT NULL,
  `Order_Date` datetime NOT NULL,
  `Message` text DEFAULT NULL,
  `Is_Read` tinyint(1) DEFAULT 0,
  `Created_At` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `admin_notifications`
--

INSERT INTO `admin_notifications` (`Notification_ID`, `Activity_Type`, `Order_ID`, `User_ID`, `Customer_Name`, `Order_Date`, `Message`, `Is_Read`, `Created_At`) VALUES
(1, 'order_created', 51, 2, 'Customer  User', '2026-01-11 16:42:23', 'New order #51 from Customer  User', 1, '2026-01-11 08:42:23'),
(2, 'order_created', 52, 2, 'Customer  User', '2026-01-11 16:42:44', 'New order #52 from Customer  User', 1, '2026-01-11 08:42:44'),
(3, 'order_created', 53, 2, 'Customer  User', '2026-01-11 16:46:00', 'New order #53 from Customer  User', 1, '2026-01-11 08:46:00'),
(4, 'order_created', 54, 2, 'Customer  User', '2026-01-11 16:51:15', 'New order #54 from Customer  User', 1, '2026-01-11 08:51:15'),
(5, 'order_created', 55, 2, 'Customer  User', '2026-01-11 17:04:37', 'New order #55 from Customer  User', 1, '2026-01-11 09:04:37'),
(6, 'order_created', 56, 2, 'Customer  User', '2026-01-11 17:08:06', 'New order #56 from Customer  User', 1, '2026-01-11 09:08:06'),
(7, 'order_created', 57, 2, 'Customer  User', '2026-01-11 17:17:22', 'New order #57 from Customer  User', 1, '2026-01-11 09:17:22'),
(8, 'order_status_changed', 32, 1, 'Customer  User', '2026-01-11 17:39:40', 'Order #32 status changed to Ready (Customer: Customer  User)', 1, '2026-01-11 09:39:40'),
(9, 'order_status_changed', 31, 1, 'Customer  User', '2026-01-11 17:55:30', 'Order #31 status changed to Ready (Customer: Customer  User)', 1, '2026-01-11 09:55:30'),
(10, 'order_created', 58, 24, 'Henzo Timothy  Quito', '2026-01-18 15:56:21', 'New order #58 from Henzo Timothy  Quito', 1, '2026-01-18 07:56:21'),
(11, 'order_created', 59, 24, 'Henzo Timothy  Quito', '2026-01-18 16:36:58', 'New order #59 from Henzo Timothy  Quito', 1, '2026-01-18 08:36:58'),
(12, 'order_created', 60, 24, 'Henzo Timothy  Quito', '2026-01-18 16:39:37', 'New order #60 from Henzo Timothy  Quito', 1, '2026-01-18 08:39:37'),
(13, 'order_created', 61, 24, 'Henzo Timothy  Quito', '2026-01-18 17:39:12', 'New order #61 from Henzo Timothy  Quito', 1, '2026-01-18 09:39:12'),
(14, 'order_created', 62, 24, 'Henzo Timothy  Quito', '2026-01-18 17:47:13', 'New order #62 from Henzo Timothy  Quito', 1, '2026-01-18 09:47:13'),
(15, 'order_status_changed', 62, 1, 'Henzo Timothy  Quito', '2026-01-18 17:48:46', 'Order #62 status changed to Ready (Customer: Henzo Timothy  Quito)', 1, '2026-01-18 09:48:46'),
(16, 'order_created', 63, 24, 'Henzo Timothy  Quito', '2026-01-18 17:56:33', 'New order #63 from Henzo Timothy  Quito', 1, '2026-01-18 09:56:33'),
(17, 'order_created', 64, 2, 'Customer  User', '2026-01-20 01:33:01', 'New order #64 from Customer  User', 1, '2026-01-19 17:33:01'),
(18, 'order_created', 65, 2, 'Customer  User', '2026-01-23 20:39:48', 'New order #65 from Customer  User', 1, '2026-01-23 12:39:48'),
(19, 'order_created', 66, 2, 'Customer  User', '2026-01-23 21:19:28', 'New order #66 from Customer  User', 1, '2026-01-23 13:19:28'),
(20, 'order_created', 67, 25, 'Sherwin  Gloriane', '2026-01-24 14:57:36', 'New order #67 from Sherwin  Gloriane', 1, '2026-01-24 06:57:36'),
(21, 'order_created', 68, 25, 'Sherwin  Gloriane', '2026-01-24 14:59:53', 'New order #68 from Sherwin  Gloriane', 1, '2026-01-24 06:59:53'),
(22, 'order_created', 69, 25, 'Sherwin  Gloriane', '2026-01-24 15:10:35', 'New order #69 from Sherwin  Gloriane', 1, '2026-01-24 07:10:35'),
(23, 'order_created', 70, 25, 'Sherwin  Gloriane', '2026-01-24 15:47:38', 'New order #70 from Sherwin  Gloriane', 1, '2026-01-24 07:47:38'),
(24, 'order_status_changed', 69, 1, 'Sherwin  Gloriane', '2026-01-24 16:16:34', 'Order #69 status changed to Processing (Customer: Sherwin  Gloriane)', 1, '2026-01-24 08:16:34'),
(25, 'order_status_changed', 69, 1, 'Sherwin  Gloriane', '2026-01-24 16:16:38', 'Order #69 status changed to Ready (Customer: Sherwin  Gloriane)', 1, '2026-01-24 08:16:38'),
(26, 'order_created', 71, 25, 'Sherwin  Gloriane', '2026-01-24 16:47:19', 'New order #71 from Sherwin  Gloriane', 1, '2026-01-24 08:47:19'),
(27, 'order_status_changed', 71, 1, 'Sherwin  Gloriane', '2026-01-24 16:48:19', 'Order #71 status changed to Processing (Customer: Sherwin  Gloriane)', 1, '2026-01-24 08:48:19'),
(28, 'order_status_changed', 71, 1, 'Sherwin  Gloriane', '2026-01-24 16:48:25', 'Order #71 status changed to Ready (Customer: Sherwin  Gloriane)', 1, '2026-01-24 08:48:25'),
(29, 'order_created', 72, 25, 'Sherwin  Gloriane', '2026-01-24 16:50:11', 'New order #72 from Sherwin  Gloriane', 1, '2026-01-24 08:50:11'),
(30, 'order_status_changed', 72, 1, 'Sherwin  Gloriane', '2026-01-24 16:50:27', 'Order #72 status changed to Processing (Customer: Sherwin  Gloriane)', 1, '2026-01-24 08:50:27'),
(31, 'order_status_changed', 72, 1, 'Sherwin  Gloriane', '2026-01-24 16:50:30', 'Order #72 status changed to Ready (Customer: Sherwin  Gloriane)', 1, '2026-01-24 08:50:30'),
(32, 'order_created', 73, 25, 'Sherwin  Gloriane', '2026-01-24 16:56:08', 'New order #73 from Sherwin  Gloriane', 1, '2026-01-24 08:56:08'),
(33, 'order_status_changed', 73, 1, 'Sherwin  Gloriane', '2026-01-24 16:57:23', 'Order #73 status changed to Ready (Customer: Sherwin  Gloriane)', 1, '2026-01-24 08:57:23'),
(34, 'order_created', 74, 2, 'Customer  User', '2026-01-24 23:51:26', 'New order #74 from Customer  User', 1, '2026-01-24 15:51:26'),
(35, 'order_created', 75, 2, 'Customer  User', '2026-01-25 00:13:43', 'New order #75 from Customer  User', 1, '2026-01-24 16:13:43'),
(36, 'order_created', 76, 2, 'Customer  User', '2026-01-25 00:19:03', 'New order #76 from Customer  User', 1, '2026-01-24 16:19:03'),
(37, 'order_created', 77, 2, 'Customer  User', '2026-01-25 00:42:11', 'New order #77 from Customer  User', 1, '2026-01-24 16:42:11'),
(38, 'order_created', 78, 2, 'Customer  User', '2026-01-25 09:44:53', 'New order #78 from Customer  User', 1, '2026-01-25 01:44:53'),
(39, 'order_created', 79, 2, 'Customer  User', '2026-01-25 10:26:34', 'New order #79 from Customer  User', 1, '2026-01-25 02:26:34'),
(40, 'order_status_changed', 79, 27, 'Customer  User', '2026-01-25 10:29:51', 'Order #79 status changed to Processing (Customer: Customer  User)', 1, '2026-01-25 02:29:51'),
(41, 'order_status_changed', 79, 27, 'Customer  User', '2026-01-25 10:29:57', 'Order #79 status changed to Ready (Customer: Customer  User)', 1, '2026-01-25 02:29:57'),
(42, 'order_created', 84, 28, 'Joshua  Villaresis', '2026-01-26 13:02:24', 'New order #84 from Joshua  Villaresis', 1, '2026-01-26 05:02:24'),
(43, 'order_status_changed', 84, 1, 'Joshua  Villaresis', '2026-01-26 13:05:02', 'Order #84 status changed to Processing (Customer: Joshua  Villaresis)', 1, '2026-01-26 05:05:02'),
(44, 'order_status_changed', 84, 1, 'Joshua  Villaresis', '2026-01-26 13:06:54', 'Order #84 status changed to Ready (Customer: Joshua  Villaresis)', 1, '2026-01-26 05:06:54'),
(45, 'order_status_changed', 84, 1, 'Joshua  Villaresis', '2026-01-26 13:18:28', 'Order #84 status changed to Ready (Customer: Joshua  Villaresis)', 1, '2026-01-26 05:18:28'),
(46, 'order_created', 85, 30, 'Joshua  Villaresis', '2026-01-26 14:47:24', 'New order #85 from Joshua  Villaresis', 1, '2026-01-26 06:47:24'),
(47, 'order_status_changed', 85, 1, 'Joshua  Villaresis', '2026-01-26 14:54:45', 'Order #85 status changed to Ready (Customer: Joshua  Villaresis)', 1, '2026-01-26 06:54:45'),
(48, 'order_created', 86, 30, 'Joshua  Villaresis', '2026-01-26 16:05:30', 'New order #86 from Joshua  Villaresis', 1, '2026-01-26 08:05:30'),
(49, 'order_created', 87, 30, 'Joshua  Villaresis', '2026-01-26 16:40:00', 'New order #87 from Joshua  Villaresis', 1, '2026-01-26 08:40:00'),
(50, 'order_created', 88, 30, 'Joshua  Villaresis', '2026-01-26 17:21:35', 'New order #88 from Joshua  Villaresis', 1, '2026-01-26 09:21:35'),
(51, 'order_created', 89, 30, 'Joshua  Villaresis', '2026-01-26 17:34:29', 'New order #89 from Joshua  Villaresis', 1, '2026-01-26 09:34:29'),
(52, 'order_status_changed', 89, 1, 'Joshua  Villaresis', '2026-01-26 17:56:31', 'Order #89 status changed to Ready (Customer: Joshua  Villaresis)', 1, '2026-01-26 09:56:31'),
(53, 'order_status_changed', 88, 1, 'Joshua  Villaresis', '2026-01-26 18:09:53', 'Order #88 status changed to Ready (Customer: Joshua  Villaresis)', 1, '2026-01-26 10:09:53'),
(54, 'order_status_changed', 87, 1, 'Joshua  Villaresis', '2026-01-26 18:23:09', 'Order #87 status changed to Ready (Customer: Joshua  Villaresis)', 1, '2026-01-26 10:23:09'),
(55, 'order_created', 90, 30, 'Joshua  Villaresis', '2026-01-26 18:38:05', 'New order #90 from Joshua  Villaresis', 1, '2026-01-26 10:38:05'),
(56, 'order_status_changed', 90, 1, 'Joshua  Villaresis', '2026-01-26 18:40:26', 'Order #90 status changed to Ready (Customer: Joshua  Villaresis)', 1, '2026-01-26 10:40:26'),
(57, 'order_status_changed', 86, 1, 'Joshua  Villaresis', '2026-01-26 19:15:39', 'Order #86 status changed to Ready (Customer: Joshua  Villaresis)', 1, '2026-01-26 11:15:39'),
(58, 'order_created', 91, 30, 'Joshua  Villaresis', '2026-01-26 19:25:46', 'New order #91 from Joshua  Villaresis', 1, '2026-01-26 11:25:46'),
(59, 'order_created', 92, 30, 'Joshua  Villaresis', '2026-01-26 19:34:57', 'New order #92 from Joshua  Villaresis', 1, '2026-01-26 11:34:57'),
(60, 'order_created', 93, 2, 'Customer  User', '2026-01-26 23:53:11', 'New order #93 from Customer  User', 1, '2026-01-26 15:53:11'),
(61, 'order_created', 94, 2, 'Customer  User', '2026-01-26 23:53:47', 'New order #94 from Customer  User', 1, '2026-01-26 15:53:47'),
(62, 'order_created', 95, 30, 'Joshua  Villaresis', '2026-01-26 23:57:55', 'New order #95 from Joshua  Villaresis', 1, '2026-01-26 15:57:55'),
(63, 'order_created', 96, 30, 'Joshua  Villaresis', '2026-01-27 00:01:38', 'New order #96 from Joshua  Villaresis', 1, '2026-01-26 16:01:38'),
(64, 'order_created', 97, 30, 'Joshua  Villaresis', '2026-01-27 00:05:06', 'New order #97 from Joshua  Villaresis', 0, '2026-01-26 16:05:06'),
(65, 'order_status_changed', 97, 27, 'Joshua  Villaresis', '2026-01-27 00:08:14', 'Order #97 status changed to Ready (Customer: Joshua  Villaresis)', 0, '2026-01-26 16:08:14'),
(66, 'order_created', 98, 30, 'Joshua  Villaresis', '2026-01-27 01:34:48', 'New order #98 from Joshua  Villaresis', 0, '2026-01-26 17:34:48'),
(67, 'order_status_changed', 98, 27, 'Joshua  Villaresis', '2026-01-27 01:38:13', 'Order #98 status changed to Processing (Customer: Joshua  Villaresis)', 1, '2026-01-26 17:38:13'),
(68, 'order_status_changed', 98, 27, 'Joshua  Villaresis', '2026-01-27 01:38:30', 'Order #98 status changed to Ready (Customer: Joshua  Villaresis)', 1, '2026-01-26 17:38:30'),
(69, 'order_status_changed', 98, 1, 'Joshua  Villaresis', '2026-01-27 01:54:38', 'Order #98 status changed to Processing (Customer: Joshua  Villaresis)', 0, '2026-01-26 17:54:38'),
(70, 'order_status_changed', 98, 1, 'Joshua  Villaresis', '2026-01-27 01:54:41', 'Order #98 status changed to Ready (Customer: Joshua  Villaresis)', 0, '2026-01-26 17:54:41'),
(71, 'order_created', 99, 31, 'Sherwin  Gloriane', '2026-01-27 01:59:04', 'New order #99 from Sherwin  Gloriane', 0, '2026-01-26 17:59:04'),
(72, 'order_status_changed', 99, 1, 'Sherwin  Gloriane', '2026-01-27 02:01:47', 'Order #99 status changed to Processing (Customer: Sherwin  Gloriane)', 0, '2026-01-26 18:01:47'),
(73, 'order_status_changed', 99, 1, 'Sherwin  Gloriane', '2026-01-27 02:01:52', 'Order #99 status changed to Ready (Customer: Sherwin  Gloriane)', 0, '2026-01-26 18:01:52'),
(74, 'order_created', 100, 31, 'Sherwin  Gloriane', '2026-01-27 02:03:50', 'New order #100 from Sherwin  Gloriane', 0, '2026-01-26 18:03:50'),
(75, 'order_status_changed', 98, 1, 'Joshua  Villaresis', '2026-01-27 02:21:55', 'Order #98 status changed to Processing (Customer: Joshua  Villaresis)', 0, '2026-01-26 18:21:55'),
(76, 'order_status_changed', 100, 1, 'Sherwin  Gloriane', '2026-01-27 02:23:30', 'Order #100 status changed to Ready (Customer: Sherwin  Gloriane)', 0, '2026-01-26 18:23:30'),
(77, 'order_status_changed', 100, 1, 'Sherwin  Gloriane', '2026-01-27 02:25:54', 'Order #100 status changed to Processing (Customer: Sherwin  Gloriane)', 0, '2026-01-26 18:25:54'),
(78, 'order_status_changed', 100, 1, 'Sherwin  Gloriane', '2026-01-27 02:25:57', 'Order #100 status changed to Ready (Customer: Sherwin  Gloriane)', 0, '2026-01-26 18:25:57'),
(79, 'order_status_changed', 100, 27, 'Sherwin  Gloriane', '2026-01-27 02:31:28', 'Order #100 status changed to Processing (Customer: Sherwin  Gloriane)', 0, '2026-01-26 18:31:28'),
(80, 'order_status_changed', 100, 27, 'Sherwin  Gloriane', '2026-01-27 02:31:30', 'Order #100 status changed to Ready (Customer: Sherwin  Gloriane)', 0, '2026-01-26 18:31:30'),
(81, 'order_status_changed', 100, 27, 'Sherwin  Gloriane', '2026-01-27 02:32:29', 'Order #100 status changed to Processing (Customer: Sherwin  Gloriane)', 0, '2026-01-26 18:32:29'),
(82, 'order_status_changed', 100, 27, 'Sherwin  Gloriane', '2026-01-27 02:32:31', 'Order #100 status changed to Ready (Customer: Sherwin  Gloriane)', 0, '2026-01-26 18:32:31'),
(83, 'order_created', 101, 2, 'Customer  User', '2026-01-27 05:01:01', 'New order #101 from Customer  User', 1, '2026-01-26 21:01:01'),
(84, 'order_status_changed', 101, 1, 'Customer  User', '2026-01-27 05:02:34', 'Order #101 status changed to Ready (Customer: Customer  User)', 0, '2026-01-26 21:02:34'),
(85, 'order_created', 102, 2, 'Customer  User', '2026-01-27 05:08:53', 'New order #102 from Customer  User', 0, '2026-01-26 21:08:53'),
(86, 'order_created', 103, 30, 'Joshua  Villaresis', '2026-01-27 05:09:27', 'New order #103 from Joshua  Villaresis', 0, '2026-01-26 21:09:27'),
(87, 'order_status_changed', 103, 1, 'Joshua  Villaresis', '2026-01-27 05:10:57', 'Order #103 status changed to Ready (Customer: Joshua  Villaresis)', 0, '2026-01-26 21:10:57'),
(88, 'order_created', 104, 31, 'Sherwin  Gloriane', '2026-01-27 05:46:16', 'New order #104 from Sherwin  Gloriane', 0, '2026-01-26 21:46:16'),
(89, 'order_status_changed', 99, 1, 'Sherwin  Gloriane', '2026-01-27 06:30:04', 'Order #99 status changed to Processing (Customer: Sherwin  Gloriane)', 0, '2026-01-26 22:30:04'),
(90, 'order_status_changed', 99, 1, 'Sherwin  Gloriane', '2026-01-27 06:30:48', 'Order #99 status changed to Ready (Customer: Sherwin  Gloriane)', 0, '2026-01-26 22:30:48'),
(91, 'order_created', 105, 2, 'Customer  User', '2026-01-27 07:36:16', 'New order #105 from Customer  User', 0, '2026-01-26 23:36:16'),
(92, 'order_created', 106, 2, 'Customer  User', '2026-01-27 07:39:27', 'New order #106 from Customer  User', 0, '2026-01-26 23:39:27'),
(93, 'order_status_changed', 106, 27, 'Customer  User', '2026-01-27 07:50:05', 'Order #106 status changed to Ready (Customer: Customer  User)', 0, '2026-01-26 23:50:05'),
(94, 'order_created', 107, 33, 'Skipskip  Moe', '2026-01-27 18:39:54', 'New order #107 from Skipskip  Moe', 0, '2026-01-27 10:39:54'),
(95, 'order_status_changed', 107, 1, 'Skipskip  Moe', '2026-01-27 18:40:31', 'Order #107 status changed to Processing (Customer: Skipskip  Moe)', 0, '2026-01-27 10:40:31'),
(96, 'order_status_changed', 107, 1, 'Skipskip  Moe', '2026-01-27 18:43:04', 'Order #107 status changed to Ready (Customer: Skipskip  Moe)', 1, '2026-01-27 10:43:04'),
(97, 'order_status_changed', 85, 1, 'Joshua  Villaresis', '2026-02-02 18:03:32', 'Order #85 status changed to Ready (Customer: Joshua  Villaresis)', 0, '2026-02-02 10:03:32'),
(98, 'order_status_changed', 96, 1, 'Joshua  Villaresis', '2026-02-02 19:00:44', 'Order #96 status changed to Processing (Customer: Joshua  Villaresis)', 0, '2026-02-02 11:00:44'),
(99, 'order_status_changed', 98, 1, 'Joshua  Villaresis', '2026-02-02 19:01:06', 'Order #98 status changed to Ready (Customer: Joshua  Villaresis)', 0, '2026-02-02 11:01:06'),
(100, 'order_created', 108, 2, 'Customer  User', '2026-02-02 19:31:57', 'New order #108 from Customer  User', 0, '2026-02-02 11:31:57'),
(101, 'order_created', 109, 2, 'Customer  User', '2026-02-02 19:33:51', 'New order #109 from Customer  User', 0, '2026-02-02 11:33:51'),
(102, 'order_created', 110, 2, 'Customer  User', '2026-02-02 19:34:48', 'New order #110 from Customer  User', 0, '2026-02-02 11:34:48'),
(103, 'order_created', 111, 2, 'Customer  User', '2026-02-02 19:52:53', 'New order #111 from Customer  User', 0, '2026-02-02 11:52:53');

-- --------------------------------------------------------

--
-- Table structure for table `categories`
--

CREATE TABLE `categories` (
  `Category_ID` int(11) NOT NULL,
  `category_name` varchar(100) NOT NULL,
  `category_description` text DEFAULT NULL,
  `category_icon` varchar(50) DEFAULT 'fas fa-box',
  `display_order` int(11) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `categories`
--

INSERT INTO `categories` (`Category_ID`, `category_name`, `category_description`, `category_icon`, `display_order`, `is_active`, `created_at`, `updated_at`) VALUES
(7, 'Pipes & Plumbing', NULL, 'fas fa-wrench', 7, 1, '2025-12-04 04:08:18', '2025-12-04 04:08:18'),
(8, 'Paints & Finishes', NULL, 'fas fa-paint-brush', 8, 1, '2025-12-04 04:08:18', '2025-12-04 04:08:18'),
(9, 'Tools & Hardware', NULL, 'fas fa-tools', 9, 1, '2025-12-04 04:08:18', '2025-12-04 04:08:18'),
(10, 'Electrical Supplies', '', 'fas fa-bolt', 10, 1, '2025-12-04 04:08:18', '2026-01-26 05:58:43'),
(15, 'Construction & Building Materials', '', 'fas fa-box', 25, 1, '2026-01-25 07:33:18', '2026-01-25 07:33:18'),
(18, 'sample category', '', 'fas fa-box', 0, 1, '2026-01-26 06:19:04', '2026-01-26 06:30:46');

-- --------------------------------------------------------

--
-- Table structure for table `customer_feedback`
--

CREATE TABLE `customer_feedback` (
  `Feedback_ID` int(11) NOT NULL,
  `Rating` tinyint(4) DEFAULT NULL CHECK (`Rating` between 1 and 5),
  `Message` text DEFAULT NULL,
  `Created_At` timestamp NOT NULL DEFAULT current_timestamp(),
  `Delivery_ID` int(11) NOT NULL,
  `is_Anonymous` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `customer_feedback`
--

INSERT INTO `customer_feedback` (`Feedback_ID`, `Rating`, `Message`, `Created_At`, `Delivery_ID`, `is_Anonymous`) VALUES
(5, 5, '', '2026-01-26 16:10:35', 81, 0),
(6, 4, '', '2026-01-27 00:03:39', 90, 0);

-- --------------------------------------------------------

--
-- Table structure for table `customer_notifications`
--

CREATE TABLE `customer_notifications` (
  `Notification_ID` int(11) NOT NULL,
  `User_ID` int(11) NOT NULL,
  `Activity_Type` varchar(50) DEFAULT 'order_approved',
  `Order_ID` int(11) DEFAULT NULL,
  `Message` text DEFAULT NULL,
  `Is_Read` tinyint(1) DEFAULT 0,
  `Created_At` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `customer_notifications`
--

INSERT INTO `customer_notifications` (`Notification_ID`, `User_ID`, `Activity_Type`, `Order_ID`, `Message`, `Is_Read`, `Created_At`) VALUES
(1, 2, 'order_ready', 31, 'Your order #31 is ready for delivery!', 1, '2026-01-11 09:55:30'),
(2, 24, 'order_rejected', 58, 'Your order #58 has been rejected.', 0, '2026-01-18 07:57:10'),
(3, 24, 'order_rejected', 59, 'Your order #59 has been rejected.', 0, '2026-01-18 08:37:14'),
(4, 24, 'order_rejected', 60, 'Your order #60 has been rejected. Reason: uhmm', 0, '2026-01-18 08:39:59'),
(5, 2, 'delivery_status_changed', 57, 'Your delivery for order #57 status has been updated to Preparing', 1, '2026-01-18 08:57:03'),
(6, 2, 'delivery_status_changed', 57, 'Your delivery for order #57 status has been updated to Out for Delivery', 1, '2026-01-18 08:57:21'),
(7, 2, 'delivery_completed', 57, 'Your order #57 has been delivered successfully!', 1, '2026-01-18 08:58:29'),
(8, 2, 'delivery_status_changed', 55, 'Your delivery for order #55 status has been updated to Cancelled', 1, '2026-01-18 08:58:40'),
(9, 2, 'delivery_status_changed', 54, 'Your delivery for order #54 status has been updated to Out for Delivery', 1, '2026-01-18 08:58:46'),
(10, 2, 'delivery_completed', 54, 'Your order #54 has been delivered successfully!', 1, '2026-01-18 08:58:55'),
(11, 2, 'delivery_status_changed', 50, 'Your delivery for order #50 status has been updated to Out for Delivery', 1, '2026-01-18 08:59:15'),
(12, 2, 'delivery_completed', 50, 'Your order #50 has been delivered successfully!', 1, '2026-01-18 08:59:26'),
(13, 16, 'delivery_completed', 33, 'Your order #33 has been delivered successfully!', 0, '2026-01-18 08:59:28'),
(14, 2, 'delivery_status_changed', 47, 'Your delivery for order #47 status has been updated to Out for Delivery', 1, '2026-01-18 09:06:47'),
(15, 2, 'delivery_completed', 47, 'Your order #47 has been delivered successfully!', 1, '2026-01-18 09:10:04'),
(16, 2, 'delivery_status_changed', 38, 'Your delivery for order #38 status has been updated to Cancelled', 1, '2026-01-18 09:10:06'),
(17, 2, 'delivery_status_changed', 44, 'Your delivery for order #44 status has been updated to Cancelled', 1, '2026-01-18 09:10:10'),
(18, 2, 'delivery_status_changed', 49, 'Your delivery for order #49 status has been updated to Preparing', 1, '2026-01-18 09:19:58'),
(19, 2, 'delivery_status_changed', 49, 'Your delivery for order #49 status has been updated to Out for Delivery', 1, '2026-01-18 09:20:04'),
(20, 2, 'delivery_completed', 49, 'Your order #49 has been delivered successfully!', 1, '2026-01-18 09:20:11'),
(21, 2, 'delivery_completed', 46, 'Your order #46 has been delivered successfully!', 1, '2026-01-18 09:20:15'),
(22, 2, 'delivery_completed', 45, 'Your order #45 has been delivered successfully!', 1, '2026-01-18 09:21:57'),
(23, 2, 'delivery_completed', 43, 'Your order #43 has been delivered successfully!', 1, '2026-01-18 09:22:03'),
(24, 2, 'delivery_completed', 42, 'Your order #42 has been delivered successfully!', 1, '2026-01-18 09:22:21'),
(25, 2, 'delivery_completed', 40, 'Your order #40 has been delivered successfully!', 1, '2026-01-18 09:24:48'),
(26, 2, 'delivery_status_changed', 36, 'Your delivery for order #36 status has been updated to Out for Delivery', 1, '2026-01-18 09:25:41'),
(27, 2, 'delivery_completed', 36, 'Your order #36 has been delivered successfully!', 1, '2026-01-18 09:25:44'),
(28, 2, 'delivery_status_changed', 32, 'Your delivery for order #32 status has been updated to Out for Delivery', 1, '2026-01-18 09:28:13'),
(29, 2, 'delivery_completed', 37, 'Your order #37 has been delivered successfully!', 1, '2026-01-18 09:28:18'),
(30, 2, 'delivery_status_changed', 31, 'Your delivery for order #31 status has been updated to Out for Delivery', 1, '2026-01-18 09:28:29'),
(31, 2, 'delivery_completed', 31, 'Your order #31 has been delivered successfully!', 1, '2026-01-18 09:28:37'),
(32, 2, 'delivery_status_changed', 39, 'Your delivery for order #39 status has been updated to Preparing', 1, '2026-01-18 09:28:57'),
(33, 2, 'delivery_status_changed', 29, 'Your delivery for order #29 status has been updated to Preparing', 1, '2026-01-18 09:29:22'),
(34, 2, 'delivery_completed', 29, 'Your order #29 has been delivered successfully!', 1, '2026-01-18 09:30:41'),
(35, 2, 'delivery_status_changed', 39, 'Your delivery for order #39 status has been updated to Out for Delivery', 1, '2026-01-18 09:33:00'),
(36, 2, 'delivery_completed', 32, 'Your order #32 has been delivered successfully!', 1, '2026-01-18 09:33:17'),
(37, 2, 'delivery_completed', 39, 'Your order #39 has been delivered successfully!', 1, '2026-01-18 09:33:36'),
(38, 2, 'delivery_status_changed', 28, 'Your delivery for order #28 status has been updated to Preparing', 1, '2026-01-18 09:33:50'),
(39, 2, 'delivery_status_changed', 28, 'Your delivery for order #28 status has been updated to Out for Delivery', 1, '2026-01-18 09:33:54'),
(40, 2, 'delivery_status_changed', 27, 'Your delivery for order #27 status has been updated to Out for Delivery', 1, '2026-01-18 09:35:09'),
(41, 2, 'delivery_completed', 28, 'Your order #28 has been delivered successfully!', 1, '2026-01-18 09:36:25'),
(42, 24, 'order_approved', 61, 'Your order #61 has been approved! You can now proceed with payment.', 0, '2026-01-18 09:39:39'),
(43, 24, 'delivery_status_changed', 61, 'Your delivery for order #61 status has been updated to Preparing', 0, '2026-01-18 09:39:47'),
(44, 24, 'delivery_status_changed', 61, 'Your delivery for order #61 status has been updated to Out for Delivery', 0, '2026-01-18 09:40:19'),
(45, 24, 'delivery_completed', 61, 'Your order #61 has been delivered successfully!', 0, '2026-01-18 09:40:32'),
(46, 24, 'order_approved', 62, 'Your order #62 has been approved! You can now proceed with payment.', 0, '2026-01-18 09:47:34'),
(47, 24, 'order_ready', 62, 'Your order #62 is ready for delivery!', 0, '2026-01-18 09:48:46'),
(48, 24, 'order_rejected', 61, 'Your order #61 has been rejected. Reason: yoo', 0, '2026-01-18 09:52:45'),
(49, 24, 'delivery_assigned', 62, 'A driver has been assigned to your order #62', 0, '2026-01-18 09:53:31'),
(50, 24, 'delivery_status_changed', 62, 'Your delivery for order #62 status has been updated to Out for Delivery', 0, '2026-01-18 09:53:51'),
(51, 24, 'order_approved', 63, 'Your order #63 has been approved! You can now proceed with payment.', 0, '2026-01-18 09:56:59'),
(52, 2, 'proof_reupload_requested', 38, 'Please reupload your proof of payment for order #38. The current proof of payment needs to be replaced.', 1, '2026-01-19 11:47:00'),
(53, 2, 'proof_reupload_requested', 38, 'Please reupload your proof of payment for order #38. The current proof of payment needs to be replaced.', 1, '2026-01-19 11:56:21'),
(54, 2, 'proof_reupload_requested', 38, 'Please reupload your proof of payment for order #38. The current proof of payment needs to be replaced.', 1, '2026-01-19 11:57:11'),
(55, 2, 'order_approved', 64, 'Your order #64 has been approved! You can now proceed with payment.', 1, '2026-01-23 12:22:04'),
(56, 2, 'order_approved', 65, 'Your order #65 has been approved! You can now proceed with payment.', 1, '2026-01-23 12:40:28'),
(57, 2, 'order_approved', 66, 'Your order #66 has been approved! You can now proceed with payment.', 1, '2026-01-23 13:19:42'),
(58, 25, 'order_approved', 70, 'Your order #70 has been approved! You can now proceed with payment.', 1, '2026-01-24 08:15:56'),
(59, 25, 'order_approved', 69, 'Your order #69 has been approved! You can now proceed with payment.', 1, '2026-01-24 08:16:28'),
(60, 25, 'order_processing', 69, 'Your order #69 is now being processed', 1, '2026-01-24 08:16:34'),
(61, 25, 'order_ready', 69, 'Your order #69 is ready for delivery!', 1, '2026-01-24 08:16:38'),
(62, 25, 'delivery_assigned', 70, 'A driver has been assigned to your order #70', 1, '2026-01-24 08:24:56'),
(63, 25, 'delivery_assigned', 69, 'A driver has been assigned to your order #69', 1, '2026-01-24 08:26:18'),
(64, 25, 'delivery_assigned', 70, 'A driver has been assigned to your order #70', 1, '2026-01-24 08:26:37'),
(65, 25, 'delivery_assigned', 70, 'A driver has been assigned to your order #70', 1, '2026-01-24 08:47:36'),
(66, 25, 'order_approved', 71, 'Your order #71 has been approved! You can now proceed with payment.', 1, '2026-01-24 08:48:16'),
(67, 25, 'order_processing', 71, 'Your order #71 is now being processed', 1, '2026-01-24 08:48:19'),
(68, 25, 'order_ready', 71, 'Your order #71 is ready for delivery!', 1, '2026-01-24 08:48:25'),
(69, 25, 'delivery_assigned', 71, 'A driver has been assigned to your order #71', 1, '2026-01-24 08:48:53'),
(70, 25, 'delivery_status_changed', 71, 'Your delivery for order #71 status has been updated to Out for Delivery', 1, '2026-01-24 08:49:00'),
(71, 25, 'delivery_completed', 71, 'Your order #71 has been delivered successfully!', 1, '2026-01-24 08:49:51'),
(72, 25, 'order_approved', 72, 'Your order #72 has been approved! You can now proceed with payment.', 1, '2026-01-24 08:50:24'),
(73, 25, 'order_processing', 72, 'Your order #72 is now being processed', 1, '2026-01-24 08:50:27'),
(74, 25, 'order_ready', 72, 'Your order #72 is ready for delivery!', 1, '2026-01-24 08:50:30'),
(75, 25, 'delivery_assigned', 72, 'A driver has been assigned to your order #72', 1, '2026-01-24 08:54:44'),
(76, 25, 'order_approved', 73, 'Your order #73 has been approved! You can now proceed with payment.', 1, '2026-01-24 08:56:46'),
(77, 25, 'order_ready', 73, 'Your order #73 is ready for delivery!', 1, '2026-01-24 08:57:23'),
(78, 25, 'delivery_assigned', 73, 'A driver has been assigned to your order #73', 1, '2026-01-24 08:57:42'),
(79, 25, 'delivery_status_changed', 73, 'Your delivery for order #73 status has been updated to Out for Delivery', 1, '2026-01-24 08:58:37'),
(80, 25, 'delivery_completed', 73, 'Your order #73 has been delivered successfully!', 1, '2026-01-24 08:58:52'),
(81, 25, 'delivery_status_changed', 72, 'Your delivery for order #72 status has been updated to Out for Delivery', 1, '2026-01-24 09:09:48'),
(82, 25, 'order_approved', 73, 'Your order #73 has been approved! You can now proceed with payment.', 1, '2026-01-24 09:27:46'),
(83, 25, 'order_approved', 71, 'Your order #71 has been approved! You can now proceed with payment.', 1, '2026-01-24 09:31:56'),
(84, 25, 'order_approved', 68, 'Your order #68 has been approved! You can now proceed with payment.', 1, '2026-01-24 09:32:02'),
(85, 2, 'order_approved', 79, 'Your order #79 has been approved! You can now proceed with payment.', 0, '2026-01-25 02:29:14'),
(86, 2, 'order_processing', 79, 'Your order #79 is now being processed', 0, '2026-01-25 02:29:51'),
(87, 2, 'order_ready', 79, 'Your order #79 is ready for delivery!', 0, '2026-01-25 02:29:57'),
(88, 2, 'delivery_assigned', 79, 'A driver has been assigned to your order #79', 0, '2026-01-25 02:31:39'),
(89, 2, 'delivery_status_changed', 79, 'Your delivery for order #79 status has been updated to Out for Delivery', 0, '2026-01-25 02:34:27'),
(90, 28, 'order_approved', 84, 'Your order #84 has been approved! You can now proceed with payment.', 0, '2026-01-26 05:03:10'),
(91, 28, 'order_processing', 84, 'Your order #84 is now being processed', 0, '2026-01-26 05:05:02'),
(92, 28, 'delivery_assigned', 84, 'A driver has been assigned to your order #84', 0, '2026-01-26 05:05:48'),
(93, 28, 'order_ready', 84, 'Your order #84 is ready for delivery!', 0, '2026-01-26 05:06:54'),
(94, 28, 'order_ready', 84, 'Your order #84 is ready for delivery!', 0, '2026-01-26 05:18:28'),
(95, 30, 'order_approved', 85, 'Your order #85 has been approved! You can now proceed with payment.', 1, '2026-01-26 06:48:26'),
(96, 30, 'proof_reupload_requested', 85, 'Please reupload your proof of payment for order #85. The current proof of payment needs to be replaced.', 1, '2026-01-26 06:52:11'),
(97, 30, 'order_ready', 85, 'Your order #85 is ready for delivery!', 1, '2026-01-26 06:54:45'),
(98, 30, 'delivery_assigned', 85, 'A driver has been assigned to your order #85', 1, '2026-01-26 07:26:44'),
(99, 30, 'order_approved', 86, 'Your order #86 has been approved! You can now proceed with payment.', 1, '2026-01-26 08:20:08'),
(100, 30, 'order_approved', 87, 'Your order #87 has been approved! You can now proceed with payment.', 1, '2026-01-26 08:44:09'),
(101, 30, 'proof_reupload_requested', 87, 'Please reupload your proof of payment for order #87. The current proof of payment needs to be replaced.', 1, '2026-01-26 08:52:50'),
(102, 30, 'proof_reupload_requested', 87, 'Please reupload your proof of payment for order #87. The current proof of payment needs to be replaced.', 1, '2026-01-26 09:08:52'),
(103, 30, 'proof_reupload_requested', 87, 'Please reupload your proof of payment for order #87. The current proof of payment needs to be replaced.', 1, '2026-01-26 09:09:14'),
(104, 30, 'proof_reupload_requested', 87, 'Please reupload your proof of payment for order #87. The current proof of payment needs to be replaced.', 1, '2026-01-26 09:09:28'),
(105, 30, 'proof_reupload_requested', 87, 'Please reupload your proof of payment for order #87. The current proof of payment needs to be replaced.', 1, '2026-01-26 09:11:58'),
(106, 30, 'proof_reupload_requested', 87, 'Please reupload your proof of payment for order #87. The current proof of payment needs to be replaced.', 1, '2026-01-26 09:15:42'),
(107, 30, 'proof_reupload_requested', 87, 'Please reupload your proof of payment for order #87. The current proof of payment needs to be replaced.', 1, '2026-01-26 09:16:05'),
(108, 30, 'proof_reupload_requested', 87, 'Please reupload your proof of payment for order #87. The current proof of payment needs to be replaced.', 1, '2026-01-26 09:17:31'),
(109, 30, 'proof_reupload_requested', 87, 'Please reupload your proof of payment for order #87. The current proof of payment needs to be replaced.', 1, '2026-01-26 09:17:42'),
(110, 30, 'proof_reupload_requested', 87, 'Please reupload your proof of payment for order #87. The current proof of payment needs to be replaced.', 1, '2026-01-26 09:20:18'),
(111, 30, 'order_approved', 88, 'Your order #88 has been approved! You can now proceed with payment.', 1, '2026-01-26 09:21:51'),
(112, 30, 'proof_reupload_requested', 88, 'Please reupload your proof of payment for order #88. The current proof of payment needs to be replaced.', 1, '2026-01-26 09:22:27'),
(113, 30, 'order_approved', 89, 'Your order #89 has been approved! You can now proceed with payment.', 1, '2026-01-26 09:34:56'),
(114, 30, 'proof_reupload_requested', 89, 'Please reupload your proof of payment for order #89. The current proof of payment needs to be replaced.', 1, '2026-01-26 09:36:09'),
(115, 30, 'proof_rejected', 89, 'Your proof of payment for order #89 has been rejected. Please upload a new proof of payment.', 1, '2026-01-26 09:46:27'),
(116, 30, 'proof_reupload_requested', 89, 'Please reupload your proof of payment for order #89. The current proof of payment needs to be replaced.', 1, '2026-01-26 09:53:06'),
(117, 30, 'proof_rejected', 89, 'Your proof of payment for order #89 has been rejected. Please upload a new proof of payment.', 1, '2026-01-26 09:55:50'),
(118, 30, 'order_ready', 89, 'Your order #89 is ready for delivery!', 1, '2026-01-26 09:56:31'),
(119, 30, 'delivery_status_changed', 89, 'Your delivery for order #89 status has been updated to Out for Delivery', 1, '2026-01-26 10:00:12'),
(120, 30, 'delivery_status_changed', 89, 'Your delivery for order #89 status has been updated to Out for Delivery', 1, '2026-01-26 10:00:55'),
(121, 30, 'delivery_assigned', 88, 'A driver has been assigned to your order #88', 1, '2026-01-26 10:06:03'),
(122, 30, 'order_ready', 88, 'Your order #88 is ready for delivery!', 1, '2026-01-26 10:09:53'),
(123, 30, 'delivery_status_changed', 89, 'Your delivery for order #89 status has been updated to Out for Delivery', 1, '2026-01-26 10:18:51'),
(124, 30, 'delivery_assigned', 89, 'A driver has been assigned to your order #89', 1, '2026-01-26 10:19:27'),
(125, 30, 'delivery_assigned', 89, 'A driver has been assigned to your order #89', 1, '2026-01-26 10:19:35'),
(126, 30, 'order_ready', 87, 'Your order #87 is ready for delivery!', 1, '2026-01-26 10:23:09'),
(127, 30, 'delivery_status_changed', 89, 'Your delivery for order #89 status has been updated to Out for Delivery', 1, '2026-01-26 10:35:59'),
(128, 30, 'order_approved', 90, 'Your order #90 has been approved! You can now proceed with payment.', 1, '2026-01-26 10:38:51'),
(129, 30, 'order_ready', 90, 'Your order #90 is ready for delivery!', 1, '2026-01-26 10:40:26'),
(130, 30, 'delivery_status_changed', 90, 'Your delivery for order #90 status has been updated to Out for Delivery', 1, '2026-01-26 10:40:43'),
(131, 30, 'delivery_status_changed', 88, 'Your delivery for order #88 status has been updated to Out for Delivery', 1, '2026-01-26 10:54:48'),
(132, 30, 'delivery_status_changed', 89, 'Your delivery for order #89 status has been updated to Out for Delivery', 1, '2026-01-26 10:55:28'),
(133, 30, 'delivery_status_changed', 87, 'Your delivery for order #87 status has been updated to Out for Delivery', 1, '2026-01-26 10:56:10'),
(134, 30, 'proof_rejected', 86, 'Your proof of payment for order #86 has been rejected. Please upload a new proof of payment.', 1, '2026-01-26 10:57:39'),
(135, 30, 'proof_rejected', 86, 'Your proof of payment for order #86 has been rejected. Please upload a new proof of payment.', 1, '2026-01-26 11:14:53'),
(136, 30, 'order_ready', 86, 'Your order #86 is ready for delivery!', 1, '2026-01-26 11:15:39'),
(137, 30, 'delivery_status_changed', 86, 'Your delivery for order #86 status has been updated to Out for Delivery', 1, '2026-01-26 11:16:05'),
(138, 30, 'order_approved', 91, 'Your order #91 has been approved! You can now proceed with payment.', 1, '2026-01-26 11:26:05'),
(139, 30, 'order_approved', 92, 'Your order #92 has been approved! You can now proceed with payment.', 1, '2026-01-26 11:35:14'),
(140, 30, 'delivery_completed', 86, 'Your order #86 has been delivered successfully!', 1, '2026-01-26 15:50:14'),
(141, 30, 'delivery_completed', 87, 'Your order #87 has been delivered successfully!', 1, '2026-01-26 15:59:50'),
(142, 30, 'delivery_completed', 88, 'Your order #88 has been delivered successfully!', 1, '2026-01-26 16:03:31'),
(143, 30, 'delivery_completed', 89, 'Your order #89 has been delivered successfully!', 1, '2026-01-26 16:03:35'),
(144, 30, 'order_approved', 97, 'Your order #97 has been approved! You can now proceed with payment.', 1, '2026-01-26 16:07:31'),
(145, 30, 'order_ready', 97, 'Your order #97 is ready for delivery!', 1, '2026-01-26 16:08:14'),
(146, 30, 'delivery_status_changed', 97, 'Your delivery for order #97 status has been updated to Out for Delivery', 1, '2026-01-26 16:09:29'),
(147, 30, 'delivery_completed', 97, 'Your order #97 has been delivered successfully!', 1, '2026-01-26 16:10:17'),
(148, 30, 'delivery_completed', 90, 'Your order #90 has been delivered successfully!', 1, '2026-01-26 16:14:57'),
(149, 30, 'order_approved', 98, 'Your order #98 has been approved! You can now proceed with payment.', 0, '2026-01-26 17:35:23'),
(150, 30, 'order_processing', 98, 'Your order #98 is now being processed', 0, '2026-01-26 17:38:13'),
(151, 30, 'order_ready', 98, 'Your order #98 is ready for delivery!', 0, '2026-01-26 17:38:30'),
(152, 30, 'delivery_status_changed', 98, 'Your delivery for order #98 status has been updated to Out for Delivery', 0, '2026-01-26 17:38:38'),
(153, 30, 'delivery_cancelled', 98, 'Your delivery for order #98 has been cancelled. Reason: Customer Request. You can reschedule your delivery.', 0, '2026-01-26 17:45:17'),
(154, 30, 'order_approved', 98, 'Your order #98 has been approved! You can now proceed with payment.', 0, '2026-01-26 17:46:29'),
(155, 30, 'order_processing', 98, 'Your order #98 is now being processed', 0, '2026-01-26 17:54:38'),
(156, 30, 'order_ready', 98, 'Your order #98 is ready for delivery!', 0, '2026-01-26 17:54:41'),
(157, 30, 'delivery_status_changed', 98, 'Your delivery for order #98 status has been updated to Out for Delivery', 0, '2026-01-26 17:54:49'),
(158, 30, 'delivery_cancelled', 98, 'Your delivery for order #98 has been cancelled. Reason: Customer Request. You can reschedule your delivery.', 0, '2026-01-26 17:55:03'),
(159, 30, 'order_approved', 98, 'Your order #98 has been approved! You can now proceed with payment.', 0, '2026-01-26 17:56:05'),
(160, 31, 'order_approved', 99, 'Your order #99 has been approved! You can now proceed with payment.', 1, '2026-01-26 17:59:30'),
(161, 31, 'order_processing', 99, 'Your order #99 is now being processed', 1, '2026-01-26 18:01:47'),
(162, 31, 'order_ready', 99, 'Your order #99 is ready for delivery!', 1, '2026-01-26 18:01:52'),
(163, 31, 'delivery_status_changed', 99, 'Your delivery for order #99 status has been updated to Out for Delivery', 1, '2026-01-26 18:02:01'),
(164, 31, 'delivery_cancelled', 99, 'Your delivery for order #99 has been cancelled. Reason: Customer Request. You can reschedule your delivery.', 1, '2026-01-26 18:02:28'),
(165, 31, 'order_approved', 100, 'Your order #100 has been approved! You can now proceed with payment.', 1, '2026-01-26 18:03:58'),
(166, 30, 'order_processing', 98, 'Your order #98 is now being processed', 0, '2026-01-26 18:21:55'),
(167, 31, 'proof_rejected', 100, 'Your proof of payment for order #100 has been rejected. Please upload a new proof of payment.', 1, '2026-01-26 18:22:12'),
(168, 31, 'order_ready', 100, 'Your order #100 is ready for delivery!', 1, '2026-01-26 18:23:30'),
(169, 31, 'delivery_status_changed', 100, 'Your delivery for order #100 status has been updated to Out for Delivery', 1, '2026-01-26 18:23:42'),
(170, 31, 'delivery_cancelled', 100, 'Your delivery for order #100 has been cancelled. Reason: Weather Conditions. You can reschedule your delivery.', 1, '2026-01-26 18:23:59'),
(171, 31, 'order_approved', 99, 'Your order #99 has been approved! You can now proceed with payment.', 1, '2026-01-26 18:25:07'),
(172, 31, 'order_approved', 100, 'Your order #100 has been approved! You can now proceed with payment.', 1, '2026-01-26 18:25:26'),
(173, 31, 'order_processing', 100, 'Your order #100 is now being processed', 1, '2026-01-26 18:25:54'),
(174, 31, 'order_ready', 100, 'Your order #100 is ready for delivery!', 1, '2026-01-26 18:25:57'),
(175, 31, 'delivery_status_changed', 100, 'Your delivery for order #100 status has been updated to Out for Delivery', 1, '2026-01-26 18:26:08'),
(176, 31, 'delivery_cancelled', 100, 'Your delivery for order #100 has been cancelled. Reason: Weather Conditions. You can reschedule your delivery.', 1, '2026-01-26 18:28:36'),
(177, 31, 'order_approved', 100, 'Your order #100 has been approved! You can now proceed with payment.', 1, '2026-01-26 18:31:22'),
(178, 31, 'order_processing', 100, 'Your order #100 is now being processed', 1, '2026-01-26 18:31:28'),
(179, 31, 'order_ready', 100, 'Your order #100 is ready for delivery!', 1, '2026-01-26 18:31:30'),
(180, 31, 'order_approved', 100, 'Your order #100 has been approved! You can now proceed with payment.', 1, '2026-01-26 18:32:21'),
(181, 31, 'order_processing', 100, 'Your order #100 is now being processed', 1, '2026-01-26 18:32:29'),
(182, 31, 'order_ready', 100, 'Your order #100 is ready for delivery!', 1, '2026-01-26 18:32:31'),
(183, 31, 'delivery_status_changed', 100, 'Your delivery for order #100 status has been updated to Out for Delivery', 1, '2026-01-26 18:32:41'),
(184, 31, 'delivery_completed', 100, 'Your order #100 has been delivered successfully!', 1, '2026-01-26 18:32:53'),
(185, 30, 'order_approved', 96, 'Your order #96 has been approved! You can now proceed with payment.', 0, '2026-01-26 20:57:34'),
(186, 28, 'delivery_status_changed', 84, 'Your delivery for order #84 status has been updated to Out for Delivery', 0, '2026-01-26 20:58:04'),
(187, 28, 'delivery_completed', 84, 'Your order #84 has been delivered successfully!', 0, '2026-01-26 20:58:29'),
(188, 2, 'order_approved', 101, 'Your order #101 has been approved! You can now proceed with payment.', 0, '2026-01-26 21:01:40'),
(189, 2, 'order_ready', 101, 'Your order #101 is ready for delivery!', 0, '2026-01-26 21:02:34'),
(190, 2, 'delivery_status_changed', 101, 'Your delivery for order #101 status has been updated to Out for Delivery', 0, '2026-01-26 21:03:13'),
(191, 30, 'order_approved', 103, 'Your order #103 has been approved! You can now proceed with payment.', 0, '2026-01-26 21:09:49'),
(192, 30, 'order_ready', 103, 'Your order #103 is ready for delivery!', 0, '2026-01-26 21:10:57'),
(193, 30, 'delivery_status_changed', 103, 'Your delivery for order #103 status has been updated to Out for Delivery', 0, '2026-01-26 21:12:06'),
(194, 30, 'delivery_completed', 103, 'Your order #103 has been delivered successfully!', 0, '2026-01-26 21:12:39'),
(195, 2, 'order_rejected', 94, 'Your order #94 has been rejected.', 0, '2026-01-26 22:17:16'),
(196, 31, 'order_processing', 99, 'Your order #99 is now being processed', 0, '2026-01-26 22:30:04'),
(197, 31, 'order_ready', 99, 'Your order #99 is ready for delivery!', 0, '2026-01-26 22:30:48'),
(198, 2, 'order_approved', 106, 'Your order #106 has been approved! You can now proceed with payment.', 0, '2026-01-26 23:44:50'),
(199, 2, 'order_ready', 106, 'Your order #106 is ready for delivery!', 0, '2026-01-26 23:50:05'),
(200, 2, 'delivery_status_changed', 106, 'Your delivery for order #106 status has been updated to Out for Delivery', 0, '2026-01-26 23:54:50'),
(201, 2, 'delivery_completed', 106, 'Your order #106 has been delivered successfully!', 0, '2026-01-27 00:00:15'),
(202, 33, 'order_approved', 107, 'Your order #107 has been approved! You can now proceed with payment.', 0, '2026-01-27 10:40:24'),
(203, 33, 'order_processing', 107, 'Your order #107 is now being processed', 0, '2026-01-27 10:40:31'),
(204, 33, 'order_ready', 107, 'Your order #107 is ready for delivery!', 0, '2026-01-27 10:43:04'),
(205, 33, 'delivery_status_changed', 107, 'Your delivery for order #107 status has been updated to Out for Delivery', 0, '2026-01-27 10:43:27'),
(206, 33, 'delivery_completed', 107, 'Your order #107 has been delivered successfully!', 0, '2026-01-27 10:43:55'),
(207, 2, 'delivery_completed', 101, 'Your order #101 has been delivered successfully!', 0, '2026-02-02 08:09:52'),
(208, 30, 'order_ready', 85, 'Your order #85 is ready for delivery!', 0, '2026-02-02 10:03:32'),
(209, 30, 'delivery_status_changed', 85, 'Your delivery for order #85 status has been updated to Out for Delivery', 0, '2026-02-02 10:04:08'),
(210, 30, 'delivery_completed', 85, 'Your order #85 has been delivered successfully!', 0, '2026-02-02 10:04:50'),
(211, 30, 'order_processing', 96, 'Your order #96 is now being processed', 0, '2026-02-02 11:00:44'),
(212, 30, 'order_ready', 98, 'Your order #98 is ready for delivery!', 0, '2026-02-02 11:01:06'),
(213, 2, 'order_approved', 108, 'Your order #108 has been approved! You can now proceed with payment.', 0, '2026-02-02 11:32:15'),
(214, 2, 'order_approved', 109, 'Your order #109 has been approved! You can now proceed with payment.', 0, '2026-02-02 11:34:05'),
(215, 2, 'order_approved', 110, 'Your order #110 has been approved! You can now proceed with payment.', 0, '2026-02-02 11:35:04'),
(216, 2, 'order_approved', 111, 'Your order #111 has been approved! You can now proceed with payment.', 0, '2026-02-02 11:53:19');

-- --------------------------------------------------------

--
-- Table structure for table `deliveries`
--

CREATE TABLE `deliveries` (
  `Delivery_ID` int(11) NOT NULL,
  `Order_ID` int(11) DEFAULT NULL,
  `delivery_details` text DEFAULT NULL,
  `Delivery_Status` enum('Pending','Preparing','Out for Delivery','Delivered','Cancelled') DEFAULT 'Pending',
  `Created_At` timestamp NOT NULL DEFAULT current_timestamp(),
  `Updated_At` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `Vehicle_ID` int(11) DEFAULT NULL,
  `Driver_ID` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `deliveries`
--

INSERT INTO `deliveries` (`Delivery_ID`, `Order_ID`, `delivery_details`, `Delivery_Status`, `Created_At`, `Updated_At`, `Vehicle_ID`, `Driver_ID`) VALUES
(68, 84, NULL, 'Delivered', '2026-01-26 05:02:24', '2026-01-26 20:58:29', 12, 26),
(69, 85, '{\"proof_image\":\"uploads\\/delivery_proof\\/delivery_69_698076c23774d_1770026690.jpg\"}', 'Delivered', '2026-01-26 06:47:24', '2026-02-02 10:04:50', 11, 26),
(70, 86, NULL, 'Delivered', '2026-01-26 08:05:30', '2026-01-26 15:50:14', 11, 26),
(71, 87, NULL, 'Delivered', '2026-01-26 08:40:00', '2026-01-26 15:59:50', 13, 26),
(72, 88, NULL, 'Delivered', '2026-01-26 09:21:35', '2026-01-26 16:03:31', 12, 26),
(73, 89, NULL, 'Delivered', '2026-01-26 09:34:29', '2026-01-26 16:03:35', 12, 26),
(74, 90, NULL, 'Delivered', '2026-01-26 10:38:05', '2026-01-26 16:14:56', NULL, 1),
(75, 91, NULL, 'Pending', '2026-01-26 11:25:46', '2026-01-26 11:25:46', NULL, NULL),
(76, 92, NULL, 'Pending', '2026-01-26 11:34:57', '2026-01-26 11:34:57', NULL, NULL),
(77, 93, NULL, 'Pending', '2026-01-26 15:53:11', '2026-01-26 15:53:11', NULL, NULL),
(78, 94, NULL, 'Pending', '2026-01-26 15:53:47', '2026-01-26 15:53:47', NULL, NULL),
(79, 95, NULL, 'Pending', '2026-01-26 15:57:55', '2026-01-26 15:57:55', NULL, NULL),
(80, 96, NULL, 'Pending', '2026-01-26 16:01:38', '2026-01-26 16:01:38', NULL, NULL),
(81, 97, NULL, 'Delivered', '2026-01-26 16:05:06', '2026-01-26 16:10:17', 12, 26),
(82, 98, NULL, 'Preparing', '2026-01-26 17:34:48', '2026-02-02 11:01:06', 11, 26),
(83, 99, NULL, 'Cancelled', '2026-01-26 17:59:04', '2026-01-26 18:02:28', 11, 26),
(84, 100, NULL, 'Delivered', '2026-01-26 18:03:50', '2026-01-26 18:32:53', 11, 26),
(85, 101, NULL, 'Delivered', '2026-01-26 21:01:01', '2026-02-02 08:09:52', 11, 26),
(86, 102, NULL, 'Pending', '2026-01-26 21:08:53', '2026-01-26 21:08:53', NULL, NULL),
(87, 103, NULL, 'Delivered', '2026-01-26 21:09:27', '2026-01-26 21:12:39', 12, 26),
(88, 104, NULL, 'Pending', '2026-01-26 21:46:16', '2026-01-26 21:46:16', NULL, NULL),
(89, 105, NULL, 'Pending', '2026-01-26 23:36:15', '2026-01-26 23:36:15', NULL, NULL),
(90, 106, NULL, 'Delivered', '2026-01-26 23:39:27', '2026-01-27 00:00:15', 12, 26),
(91, 107, NULL, 'Delivered', '2026-01-27 10:39:54', '2026-01-27 10:43:55', 11, 26),
(92, 109, NULL, 'Pending', '2026-02-02 11:33:51', '2026-02-02 11:33:51', NULL, NULL),
(93, 110, NULL, 'Pending', '2026-02-02 11:34:48', '2026-02-02 11:34:48', NULL, NULL),
(94, 108, NULL, 'Pending', '2026-02-02 11:51:51', '2026-02-02 11:51:51', NULL, NULL),
(95, 111, NULL, 'Pending', '2026-02-02 11:52:53', '2026-02-02 11:52:53', NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `delivery_drivers`
--

CREATE TABLE `delivery_drivers` (
  `id` int(11) NOT NULL,
  `Delivery_ID` int(11) NOT NULL,
  `Driver_ID` int(11) NOT NULL,
  `Assigned_At` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `delivery_drivers`
--

INSERT INTO `delivery_drivers` (`id`, `Delivery_ID`, `Driver_ID`, `Assigned_At`) VALUES
(32, 68, 26, '2026-01-26 05:05:48'),
(33, 69, 26, '2026-01-26 07:26:44'),
(34, 72, 26, '2026-01-26 10:06:03'),
(36, 73, 26, '2026-01-26 10:19:35');

-- --------------------------------------------------------

--
-- Table structure for table `delivery_vehicles`
--

CREATE TABLE `delivery_vehicles` (
  `id` int(11) NOT NULL,
  `Delivery_ID` int(11) NOT NULL,
  `Vehicle_ID` int(11) NOT NULL,
  `Assigned_At` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `delivery_vehicles`
--

INSERT INTO `delivery_vehicles` (`id`, `Delivery_ID`, `Vehicle_ID`, `Assigned_At`) VALUES
(15, 73, 12, '2026-01-26 10:19:42'),
(16, 72, 12, '2026-01-26 10:54:52'),
(17, 71, 13, '2026-01-26 10:56:14'),
(18, 70, 11, '2026-01-26 11:16:09'),
(19, 81, 12, '2026-01-26 16:09:33'),
(21, 82, 11, '2026-01-26 17:54:53'),
(22, 83, 11, '2026-01-26 18:02:08'),
(25, 84, 11, '2026-01-26 18:32:44'),
(26, 68, 12, '2026-01-26 20:58:07'),
(27, 85, 11, '2026-01-26 21:03:16'),
(28, 87, 12, '2026-01-26 21:12:10'),
(29, 90, 12, '2026-01-26 23:54:54'),
(30, 91, 11, '2026-01-27 10:43:30'),
(31, 69, 11, '2026-02-02 10:04:11');

-- --------------------------------------------------------

--
-- Table structure for table `driver_notifications`
--

CREATE TABLE `driver_notifications` (
  `Notification_ID` int(11) NOT NULL,
  `Driver_ID` int(11) NOT NULL,
  `Activity_Type` varchar(50) DEFAULT 'delivery_assigned',
  `Order_ID` int(11) DEFAULT NULL,
  `Delivery_ID` int(11) DEFAULT NULL,
  `Message` text DEFAULT NULL,
  `Is_Read` tinyint(1) DEFAULT 0,
  `Created_At` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `driver_notifications`
--

INSERT INTO `driver_notifications` (`Notification_ID`, `Driver_ID`, `Activity_Type`, `Order_ID`, `Delivery_ID`, `Message`, `Is_Read`, `Created_At`) VALUES
(1, 4, 'delivery_assigned', 70, 58, 'New delivery assigned: Delivery #58 (Order #70)', 0, '2026-01-24 08:47:36'),
(2, 26, 'delivery_assigned', 70, 58, 'New delivery assigned: Delivery #58 (Order #70)', 1, '2026-01-24 08:47:36'),
(3, 26, 'delivery_assigned', 71, 59, 'New delivery assigned: Delivery #59 (Order #71)', 1, '2026-01-24 08:48:53'),
(4, 26, 'delivery_assigned', 72, 60, 'New delivery assigned: Delivery #60 (Order #72)', 1, '2026-01-24 08:54:44'),
(5, 26, 'delivery_assigned', 73, 61, 'New delivery assigned: Delivery #61 (Order #73)', 1, '2026-01-24 08:57:42'),
(6, 26, 'delivery_assigned', 79, 63, 'New delivery assigned: Delivery #63 (Order #79)', 1, '2026-01-25 02:31:39'),
(7, 26, 'delivery_assigned', 84, 68, 'New delivery assigned: Delivery #68 (Order #84)', 1, '2026-01-26 05:05:48'),
(8, 26, 'delivery_assigned', 85, 69, 'New delivery assigned: Delivery #69 (Order #85)', 1, '2026-01-26 07:26:44'),
(9, 26, 'delivery_assigned', 88, 72, 'New delivery assigned: Delivery #72 (Order #88)', 1, '2026-01-26 10:06:03'),
(10, 26, 'delivery_assigned', 89, 73, 'New delivery assigned: Delivery #73 (Order #89)', 1, '2026-01-26 10:19:27'),
(11, 26, 'delivery_assigned', 89, 73, 'New delivery assigned: Delivery #73 (Order #89)', 1, '2026-01-26 10:19:35');

-- --------------------------------------------------------

--
-- Table structure for table `fleet`
--

CREATE TABLE `fleet` (
  `Vehicle_ID` int(20) NOT NULL,
  `vehicle_model` varchar(50) NOT NULL,
  `status` enum('In Use','Available','Unavailable') NOT NULL,
  `capacity` decimal(10,2) DEFAULT NULL,
  `capacity_unit` enum('kg','g','lb','oz','ton') DEFAULT 'kg'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `fleet`
--

INSERT INTO `fleet` (`Vehicle_ID`, `vehicle_model`, `status`, `capacity`, `capacity_unit`) VALUES
(11, 'Vehicle 1', 'In Use', 1000.00, 'kg'),
(12, 'Vehicle 2', 'In Use', 500.00, 'kg'),
(13, 'Vehicle 3', 'In Use', 50.00, 'kg');

-- --------------------------------------------------------

--
-- Table structure for table `orders`
--

CREATE TABLE `orders` (
  `Order_ID` int(11) NOT NULL,
  `User_ID` int(11) DEFAULT NULL,
  `order_date` datetime DEFAULT current_timestamp(),
  `status` enum('Pending Approval','Waiting Payment','Processing','Ready','Rejected') NOT NULL DEFAULT 'Pending Approval',
  `payment` enum('Paid','To Pay') NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `availability_date` date DEFAULT NULL,
  `availability_time` time DEFAULT NULL,
  `last_updated` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `rejection_reason` text DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `rejected_at` datetime DEFAULT NULL,
  `approved_by` int(11) DEFAULT NULL,
  `Employee_ID` int(11) DEFAULT NULL,
  `payment_method` enum('GCash','On-Site') DEFAULT NULL,
  `delivery_method` enum('Standard Delivery','Pick Up') DEFAULT 'Standard Delivery'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `orders`
--

INSERT INTO `orders` (`Order_ID`, `User_ID`, `order_date`, `status`, `payment`, `amount`, `availability_date`, `availability_time`, `last_updated`, `rejection_reason`, `approved_at`, `rejected_at`, `approved_by`, `Employee_ID`, `payment_method`, `delivery_method`) VALUES
(84, 28, '2026-01-26 13:02:24', 'Ready', 'Paid', 4080.00, '2026-01-30', '09:00:00', '2026-01-26 20:58:29', NULL, '2026-01-26 13:03:10', NULL, 1, NULL, 'GCash', 'Standard Delivery'),
(85, 30, '2026-01-26 14:47:24', 'Ready', 'Paid', 3973.00, '2026-01-30', '09:00:00', '2026-02-02 10:04:50', NULL, '2026-01-26 14:48:26', NULL, 1, NULL, 'GCash', 'Standard Delivery'),
(86, 30, '2026-01-26 16:05:30', 'Ready', 'Paid', 8925.00, '2026-01-31', '09:00:00', '2026-01-26 15:50:14', NULL, '2026-01-26 16:20:08', NULL, 1, NULL, 'GCash', 'Standard Delivery'),
(87, 30, '2026-01-26 16:40:00', 'Ready', 'Paid', 336.00, '2026-01-30', '09:00:00', '2026-01-26 15:59:50', NULL, '2026-01-26 16:44:09', NULL, 1, NULL, 'GCash', 'Standard Delivery'),
(88, 30, '2026-01-26 17:21:35', 'Ready', 'Paid', 2975.00, '2026-01-30', '09:00:00', '2026-01-26 16:03:31', NULL, '2026-01-26 17:21:51', NULL, 1, NULL, 'GCash', 'Standard Delivery'),
(89, 30, '2026-01-26 17:34:29', 'Ready', 'Paid', 2975.00, '2026-01-30', '09:00:00', '2026-01-26 16:03:35', NULL, '2026-01-26 17:34:56', NULL, 1, NULL, 'GCash', 'Standard Delivery'),
(90, 30, '2026-01-26 18:38:05', 'Ready', 'Paid', 2975.00, '2026-01-30', '09:00:00', '2026-01-26 16:14:56', NULL, '2026-01-26 18:38:51', NULL, 1, NULL, 'GCash', 'Standard Delivery'),
(91, 30, '2026-01-26 19:25:46', 'Waiting Payment', 'To Pay', 2975.00, '2026-01-30', '09:00:00', '2026-01-26 11:26:05', NULL, '2026-01-26 19:26:05', NULL, 1, NULL, NULL, 'Standard Delivery'),
(92, 30, '2026-01-26 19:34:57', 'Waiting Payment', 'To Pay', 2975.00, '2026-01-30', '09:00:00', '2026-01-26 11:35:14', NULL, '2026-01-26 19:35:14', NULL, 1, NULL, NULL, 'Standard Delivery'),
(93, 2, '2026-01-26 23:53:11', 'Pending Approval', 'To Pay', 2975.00, '2026-01-30', '09:00:00', '2026-01-26 15:53:11', NULL, NULL, NULL, NULL, NULL, NULL, 'Standard Delivery'),
(94, 2, '2026-01-26 23:53:47', 'Rejected', 'To Pay', 2975.00, '2026-01-30', '09:00:00', '2026-01-26 22:17:16', NULL, NULL, '2026-01-27 06:17:16', NULL, NULL, NULL, 'Standard Delivery'),
(95, 30, '2026-01-26 23:57:55', 'Pending Approval', 'To Pay', 5950.00, '2026-01-30', '09:00:00', '2026-01-26 15:57:55', NULL, NULL, NULL, NULL, NULL, NULL, 'Standard Delivery'),
(96, 30, '2026-01-27 00:01:38', 'Processing', 'To Pay', 5950.00, '2026-01-31', '09:00:00', '2026-02-02 11:00:44', NULL, '2026-01-27 04:57:34', NULL, 1, NULL, NULL, 'Standard Delivery'),
(97, 30, '2026-01-27 00:05:06', 'Ready', 'Paid', 2975.00, '2026-01-31', '09:00:00', '2026-01-26 16:10:17', NULL, '2026-01-27 00:07:31', NULL, 27, NULL, 'GCash', 'Standard Delivery'),
(98, 30, '2026-01-27 01:34:48', 'Ready', 'To Pay', 9105.00, '2026-02-02', NULL, '2026-02-02 11:01:06', NULL, '2026-01-27 01:56:05', NULL, 1, NULL, NULL, 'Standard Delivery'),
(99, 31, '2026-01-27 01:59:04', 'Ready', 'To Pay', 540.00, '2026-01-31', '09:00:00', '2026-01-26 22:30:48', NULL, '2026-01-27 02:25:07', NULL, 1, NULL, 'On-Site', 'Standard Delivery'),
(100, 31, '2026-01-27 02:03:50', 'Ready', 'Paid', 720.00, '2026-01-31', NULL, '2026-01-26 18:32:53', NULL, '2026-01-27 02:32:21', NULL, 27, NULL, 'GCash', 'Standard Delivery'),
(101, 2, '2026-01-27 05:01:01', 'Ready', 'Paid', 6848.00, '2026-01-31', '09:00:00', '2026-02-02 08:09:52', NULL, '2026-01-27 05:01:40', NULL, 1, NULL, 'GCash', 'Standard Delivery'),
(102, 2, '2026-01-27 05:08:53', 'Pending Approval', 'To Pay', 7072.00, '2026-01-31', '09:00:00', '2026-01-26 21:08:53', NULL, NULL, NULL, NULL, NULL, NULL, 'Standard Delivery'),
(103, 30, '2026-01-27 05:09:27', 'Ready', 'Paid', 2975.00, '2026-01-31', '09:00:00', '2026-01-26 21:12:39', NULL, '2026-01-27 05:09:49', NULL, 1, NULL, 'GCash', 'Standard Delivery'),
(104, 31, '2026-01-27 05:46:16', 'Pending Approval', 'To Pay', 336.00, '2026-01-31', '09:00:00', '2026-01-26 21:46:16', NULL, NULL, NULL, NULL, NULL, NULL, 'Standard Delivery'),
(105, 2, '2026-01-27 07:36:15', 'Pending Approval', 'To Pay', 6140.00, '2026-01-31', '09:00:00', '2026-01-26 23:36:15', NULL, NULL, NULL, NULL, NULL, NULL, 'Standard Delivery'),
(106, 2, '2026-01-27 07:39:27', 'Ready', 'Paid', 336.00, '2026-01-31', '09:00:00', '2026-01-27 00:00:15', NULL, '2026-01-27 07:44:50', NULL, 27, NULL, 'GCash', 'Standard Delivery'),
(107, 33, '2026-01-27 18:39:54', 'Ready', 'Paid', 8925.00, '2026-02-19', '09:00:00', '2026-01-27 10:43:55', NULL, '2026-01-27 18:40:24', NULL, 1, NULL, 'GCash', 'Standard Delivery'),
(108, 2, '2026-02-02 19:31:57', 'Waiting Payment', 'To Pay', 3005.00, '2026-02-06', '09:00:00', '2026-02-02 11:32:15', NULL, '2026-02-02 19:32:15', NULL, 1, NULL, NULL, 'Pick Up'),
(109, 2, '2026-02-02 19:33:51', 'Waiting Payment', 'To Pay', 2975.00, '2026-02-06', '09:00:00', '2026-02-02 11:34:05', NULL, '2026-02-02 19:34:05', NULL, 1, NULL, NULL, 'Standard Delivery'),
(110, 2, '2026-02-02 19:34:48', 'Waiting Payment', 'To Pay', 1080.00, '2026-02-14', '09:00:00', '2026-02-02 11:35:04', NULL, '2026-02-02 19:35:04', NULL, 1, NULL, NULL, 'Standard Delivery'),
(111, 2, '2026-02-02 19:52:53', 'Waiting Payment', 'To Pay', 2975.00, '2026-02-07', '09:00:00', '2026-02-02 11:53:19', NULL, '2026-02-02 19:53:19', NULL, 1, NULL, NULL, 'Standard Delivery');

-- --------------------------------------------------------

--
-- Table structure for table `order_availability_slots`
--

CREATE TABLE `order_availability_slots` (
  `slot_id` int(11) NOT NULL,
  `order_id` int(11) NOT NULL,
  `slot_number` int(11) NOT NULL,
  `availability_date` date NOT NULL,
  `availability_time` time NOT NULL,
  `is_preferred` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `order_availability_slots`
--

INSERT INTO `order_availability_slots` (`slot_id`, `order_id`, `slot_number`, `availability_date`, `availability_time`, `is_preferred`, `created_at`) VALUES
(45, 84, 1, '2026-01-30', '09:00:00', 1, '2026-01-26 05:02:24'),
(46, 85, 1, '2026-01-30', '09:00:00', 1, '2026-01-26 06:47:24'),
(47, 86, 1, '2026-01-31', '09:00:00', 1, '2026-01-26 08:05:30'),
(48, 87, 1, '2026-01-30', '09:00:00', 1, '2026-01-26 08:40:00'),
(49, 88, 1, '2026-01-30', '09:00:00', 1, '2026-01-26 09:21:35'),
(50, 89, 1, '2026-01-30', '09:00:00', 1, '2026-01-26 09:34:29'),
(51, 90, 1, '2026-01-30', '09:00:00', 1, '2026-01-26 10:38:05'),
(52, 91, 1, '2026-01-30', '09:00:00', 1, '2026-01-26 11:25:46'),
(53, 92, 1, '2026-01-30', '09:00:00', 1, '2026-01-26 11:34:57'),
(54, 93, 1, '2026-01-30', '09:00:00', 1, '2026-01-26 15:53:11'),
(55, 94, 1, '2026-01-30', '09:00:00', 1, '2026-01-26 15:53:47'),
(56, 95, 1, '2026-01-30', '09:00:00', 1, '2026-01-26 15:57:55'),
(57, 96, 1, '2026-01-31', '09:00:00', 1, '2026-01-26 16:01:38'),
(58, 97, 1, '2026-01-31', '09:00:00', 1, '2026-01-26 16:05:06'),
(59, 98, 1, '2026-02-02', '00:00:00', 1, '2026-01-26 17:34:48'),
(60, 99, 1, '2026-01-31', '09:00:00', 1, '2026-01-26 17:59:04'),
(61, 100, 1, '2026-01-31', '00:00:00', 1, '2026-01-26 18:03:50'),
(62, 101, 1, '2026-01-31', '09:00:00', 1, '2026-01-26 21:01:01'),
(63, 102, 1, '2026-01-31', '09:00:00', 1, '2026-01-26 21:08:53'),
(64, 103, 1, '2026-01-31', '09:00:00', 1, '2026-01-26 21:09:27'),
(65, 104, 1, '2026-01-31', '09:00:00', 1, '2026-01-26 21:46:16'),
(66, 105, 1, '2026-01-31', '09:00:00', 1, '2026-01-26 23:36:15'),
(67, 106, 1, '2026-01-31', '09:00:00', 1, '2026-01-26 23:39:27'),
(68, 107, 1, '2026-02-19', '09:00:00', 1, '2026-01-27 10:39:54'),
(69, 108, 1, '2026-02-06', '09:00:00', 1, '2026-02-02 11:31:57'),
(70, 109, 1, '2026-02-06', '09:00:00', 1, '2026-02-02 11:33:51'),
(71, 110, 1, '2026-02-14', '09:00:00', 1, '2026-02-02 11:34:48'),
(72, 111, 1, '2026-02-07', '09:00:00', 1, '2026-02-02 11:52:53');

-- --------------------------------------------------------

--
-- Table structure for table `order_settings`
--

CREATE TABLE `order_settings` (
  `setting_key` varchar(50) NOT NULL,
  `setting_value` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `order_settings`
--

INSERT INTO `order_settings` (`setting_key`, `setting_value`, `description`, `updated_at`) VALUES
('allow_below_minimum_with_fee', '0', 'Allow orders below minimum with premium delivery fee (1 = yes, 0 = no).', '2026-02-02 11:06:23'),
('allow_heavy_single_items', '0', 'Allow single items that exceed minimum weight (1 = yes, 0 = no).', '2026-02-02 11:06:23'),
('auto_calculate_from_fleet', '0', 'Auto-calculate minimum from smallest vehicle capacity (1 = yes, 0 = use fixed value).', '2026-02-02 11:06:23'),
('disable_minimum_order_value', '0', NULL, '2026-02-02 11:06:23'),
('disable_minimum_weight', '1', NULL, '2026-02-02 11:06:23'),
('max_advance_notice_days', '30', 'Maximum number of days in advance customers can select delivery date', '2026-02-02 11:06:23'),
('max_deliveries_per_day', '5', NULL, '2026-02-02 11:06:23'),
('min_advance_notice_days', '3', 'Minimum number of days in advance customers must select delivery date (e.g., 3 = cannot select today, tomorrow, or day after tomorrow)', '2026-02-02 11:06:23'),
('min_order_value', '1000', 'Minimum order value in pesos. Set to 0 to disable. Can be combined with weight minimum (OR condition).', '2026-02-02 11:06:23'),
('min_order_weight_kg', '200', 'Minimum order weight in kilograms. Orders below this weight will be rejected.', '2026-02-02 11:06:23'),
('min_order_weight_percentage', '25', 'Percentage of smallest vehicle capacity to use as minimum (if auto-calculated).', '2026-02-02 11:06:23'),
('premium_delivery_fee', '500', 'Premium delivery fee in pesos for orders below minimum weight.', '2026-02-02 11:06:23'),
('volume_discount_tier1_min', '20', 'Minimum quantity for Tier 1 discount (5%)', '2026-02-02 11:06:23'),
('volume_discount_tier1_percent', '5', 'Tier 1 discount percentage (20+ items)', '2026-02-02 11:06:23'),
('volume_discount_tier2_min', '50', 'Minimum quantity for Tier 2 discount (10%)', '2026-02-02 11:06:23'),
('volume_discount_tier2_percent', '10', 'Tier 2 discount percentage (50+ items)', '2026-02-02 11:06:23'),
('volume_discount_tier3_min', '100', 'Minimum quantity for Tier 3 discount (15%)', '2026-02-02 11:06:23'),
('volume_discount_tier3_percent', '15', 'Tier 3 discount percentage (100+ items)', '2026-02-02 11:06:23'),
('volume_discount_tier4_min', '200', 'Minimum quantity for Tier 4 discount (20%)', '2026-02-02 11:06:23'),
('volume_discount_tier4_percent', '20', 'Tier 4 discount percentage (200+ items)', '2026-02-02 11:06:23');

-- --------------------------------------------------------

--
-- Table structure for table `password_reset_tokens`
--

CREATE TABLE `password_reset_tokens` (
  `id` int(11) NOT NULL,
  `email` varchar(100) NOT NULL,
  `token` varchar(255) NOT NULL,
  `expires_at` datetime NOT NULL,
  `used` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `password_reset_tokens`
--

INSERT INTO `password_reset_tokens` (`id`, `email`, `token`, `expires_at`, `used`, `created_at`) VALUES
(1, 'glorianelectanasherwin@gmail.com', 'f36925880cbe19cdc444f417570a75a3f252ae2bbac8b96a220bf252767b7a32', '2025-12-07 02:27:02', 1, '2025-12-06 17:27:02'),
(2, 'glorianelectanasherwin@gmail.com', '1b9fbdfb1040dbf46f5c0df066c91319c0fff4b0c74fdb2dc15bfe37022e0b33', '2025-12-07 02:27:35', 1, '2025-12-06 17:27:35'),
(3, 'jessicalectana068@gmail.com', '8f2c1ac7d7f59df68ed155acc083e7be9f74e7bf46eec6cfeac0ec34c8d67348', '2025-12-07 02:27:54', 1, '2025-12-06 17:27:54'),
(4, 'glorianelectanasherwin@gmail.com', '6a69e064f743686a3905bdde27dfbfbe2cd8bd96673905ac3cb743a0bc08f4fb', '2025-12-07 02:28:05', 1, '2025-12-06 17:28:05'),
(5, 'glorianelectanasherwin@gmail.com', '00b981e0902a2dab81ab583eab0a3f8df290e1d76332e645ce1f1e6e4f297c61', '2025-12-07 02:30:53', 1, '2025-12-06 17:30:53'),
(6, 'glorianelectanasherwin@gmail.com', 'ac79e20269299402fdde7bdbfe92427cf44a228a2d2417d6ddb42fa66d26dffc', '2025-12-07 02:30:54', 1, '2025-12-06 17:30:54'),
(7, 'glorianelectanasherwin@gmail.com', 'f96e6d0688ad51755457129ea1ed736cb4d5eb1616c0fc78de01c0a4ae314451', '2025-12-07 02:31:15', 1, '2025-12-06 17:31:15'),
(8, 'jessicalectana068@gmail.com', 'f4ca1307b5c270bfc7f93efd8a2ec2c2bcf49a33386a89ef548b5b0be190bf9c', '2025-12-07 02:31:39', 1, '2025-12-06 17:31:39'),
(9, 'glorianelectanasherwin@gmail.com', '4ad8b5066ab3a41cdefd2316c0cd5b6a663d0a28dc034528db8b5daefcc14654', '2025-12-07 02:33:51', 1, '2025-12-06 17:33:51'),
(10, 'glorianelectanasherwin@gmail.com', 'c163a69a870d7ff98a84fab35aed82fb519e02d344298aa85a2f0194d8504e9e', '2025-12-07 02:34:05', 1, '2025-12-06 17:34:05'),
(11, 'glorianelectanasherwin@gmail.com', '213c8efebdcf6cf95352356a070bf155112da95712e658f3ea081addf6eeabc4', '2025-12-07 02:35:22', 1, '2025-12-06 17:35:22'),
(12, 'glorianelectanasherwin@gmail.com', '8a3708726304a7cedfd40f8edf678797f273cede99083c99ffef952947cfe74c', '2025-12-07 02:35:33', 1, '2025-12-06 17:35:33'),
(13, 'jessicalectana068@gmail.com', '7124b46359418bf0c856790e0f24677bf5c08377e32193cb9c24d25d3c6b67e2', '2025-12-07 02:39:54', 0, '2025-12-06 17:39:54'),
(14, 'glorianelectanasherwin@gmail.com', 'e8320de709fbbb8f8cd9bad4c828acb53f1ca78c43210ffa6b02068bbd2c9354', '2025-12-07 02:40:13', 1, '2025-12-06 17:40:13'),
(15, 'koahla.official@gmail.com', 'a65b0c66568c5096b0b022ee47e95cadc035c657808d5ff3a89c4195a594a3d7', '2025-12-08 14:12:51', 1, '2025-12-08 05:12:51'),
(16, 'koahla.official@gmail.com', 'f4d639373b0f3e23e95c4d261d9a253037d45bb49fc8e64a430581aa0f65d36d', '2025-12-08 14:13:42', 1, '2025-12-08 05:13:42'),
(17, 'koahla.official@gmail.com', '37301346a4443d739ac6fcc13d4467d30d9d06f3af65d09fe46597aba4f9caea', '2025-12-08 14:18:35', 1, '2025-12-08 05:18:35'),
(18, 'koahla.official@gmail.com', '4d779ced5d1501ce7d4d8ab15cdb80e8ca753edf248d2a6c0b569e9dcc76d0c3', '2025-12-08 14:18:46', 0, '2025-12-08 05:18:46'),
(19, 'rojasalan293@gmail.com', '845c54b9aec7e9901d4b08585a5f46ba12d4a91a22124e5852e20c7a12216779', '2025-12-08 15:14:22', 1, '2025-12-08 06:14:22'),
(20, 'heno8172004@gmail.com', 'a72d5d7c3e665a1fcb4b379947946250c0c2c9606f90b1879542402acc8a9ab5', '2026-01-19 20:35:45', 1, '2026-01-19 11:35:45'),
(21, 'heno8172004@gmail.com', '13df402bd0a6189048e482694bb634e69bd073124242b1de8e6f4e81617e5d77', '2026-01-19 20:42:25', 1, '2026-01-19 11:42:25'),
(22, 'heno8172004@gmail.com', 'd48c62a226c725daaedffbeb1eb608dfe4e10c866d2ee5982dce4e0560f2b5b1', '2026-01-19 22:05:09', 1, '2026-01-19 13:05:09'),
(23, 'heno8172004@gmail.com', 'b3d1d29ba5e59ca04e1e9dd1aaabf4822f4bab1135cedf843390ca4a570564fc', '2026-01-19 22:08:11', 0, '2026-01-19 13:08:11'),
(24, 'glorianelectanasherwin@gmail.com', '62f2ecc8ef151c8b7429ab2be7b5b62a19a229918d31d7a63e333164c6633b16', '2026-01-24 15:29:32', 1, '2026-01-24 06:29:32'),
(25, 'glorianelectanasherwin@gmail.com', '75afa37258510e7ca9d03778aad77fa54245f0514d72454b6a3fe48547b3f954', '2026-01-27 05:32:31', 0, '2026-01-26 20:32:31');

-- --------------------------------------------------------

--
-- Table structure for table `products`
--

CREATE TABLE `products` (
  `Product_ID` int(11) NOT NULL,
  `Product_Name` varchar(100) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `image_path` varchar(255) DEFAULT NULL,
  `thumbnails` text DEFAULT NULL,
  `category` varchar(100) NOT NULL DEFAULT 'Uncategorized',
  `category_id` int(11) NOT NULL,
  `stock_level` int(11) NOT NULL,
  `stock_unit` varchar(10) DEFAULT 'PC',
  `Minimum_Stock` int(11) DEFAULT 0,
  `stock_status` enum('In Stock','Low Stock','Out of Stock') NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `length` varchar(50) DEFAULT NULL,
  `last_restock` date DEFAULT NULL,
  `Width` decimal(10,2) DEFAULT NULL,
  `Unit` enum('mm','cm','m','inch','ft') DEFAULT NULL,
  `weight` decimal(10,2) DEFAULT NULL,
  `weight_unit` enum('kg','g','lb','oz','ton') DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `products`
--

INSERT INTO `products` (`Product_ID`, `Product_Name`, `description`, `image_path`, `thumbnails`, `category`, `category_id`, `stock_level`, `stock_unit`, `Minimum_Stock`, `stock_status`, `price`, `length`, `last_restock`, `Width`, `Unit`, `weight`, `weight_unit`) VALUES
(9, 'SS Cable Tie', 'Cable Tie', 'uploads/products/696e2ec1bdc17_1768828609.png', '[\"uploads\\/products\\/696e2ec1bf368_1768828609.png\"]', 'Tools & Hardware', 9, 73, 'BOX', 20, 'In Stock', 7.00, NULL, '2025-12-05', NULL, NULL, 18.00, 'kg'),
(10, 'EL EAGLE #101 Rubber Plug HD', 'Rubber Electrical Plug', 'uploads/products/6975af694b18e_1769320297.jpg', NULL, 'Electrical', 10, 25, 'PC', 15, 'In Stock', 54.00, NULL, '2026-01-25', NULL, NULL, 0.10, 'kg'),
(11, 'Window Mounted Exhaust Fan', 'Window Mounted Exhaust Fan', 'uploads/products/6975b0b02b561_1769320624.jpg', NULL, 'Electrical', 10, 25, 'PC', 15, 'In Stock', 600.00, NULL, '2026-01-25', NULL, NULL, 1.80, 'kg'),
(12, 'Royu PVC Electrical Mounting', 'Rovu PVC Electrical Mounting 12mmx12mmx8', 'uploads/products/6975b1ce46cb9_1769320910.png', NULL, 'Electrical', 10, 50, 'PC', 25, 'In Stock', 33.00, NULL, '2026-01-25', NULL, NULL, NULL, NULL),
(13, 'Dual Portable Extension', 'Dual Portable Extension', 'uploads/products/6975b2df1f3fe_1769321183.jpg', NULL, 'Electrical', 10, 20, 'PC', 15, 'In Stock', 150.00, NULL, '2026-01-25', NULL, NULL, 0.10, 'kg'),
(14, 'Koten KSB', 'Koten KSB 20 60A', 'uploads/products/6975b37e0c238_1769321342.jpg', NULL, 'Electrical', 10, 25, 'PC', 15, 'In Stock', 555.00, NULL, '2026-01-25', NULL, NULL, 0.45, 'kg'),
(16, 'AWG THHN Stranded', 'AWG THHN Stranded 3.5mm²', 'uploads/products/6975b9de8437a_1769322974.jpg', NULL, 'Electrical', 10, 25, 'ROL', 15, 'In Stock', 1980.00, NULL, '2026-01-25', NULL, NULL, 0.04, 'kg'),
(17, '1 Way Switch', '1 Way Switch', 'uploads/products/6975bba8e2471_1769323432.jpg', NULL, 'Electrical', 10, 21, 'SET', 15, 'In Stock', 78.00, NULL, '2026-01-25', NULL, NULL, 0.05, 'kg'),
(18, '1-Way Switch-A', '1-Way Switch-A', 'uploads/products/6975bbdcbd963_1769323484.jpg', NULL, 'Electrical', 10, 25, 'PC', 15, 'In Stock', 49.00, NULL, '2026-01-25', NULL, NULL, 0.05, 'kg'),
(19, 'Wide Outlet', 'Wide Outlet', 'uploads/products/6975bc1a8383a_1769323546.png', NULL, 'Electrical', 10, 25, 'PC', 15, 'In Stock', 47.00, NULL, '2026-01-25', NULL, NULL, 0.05, 'kg'),
(20, 'Wide 1-Gang Plate', 'Wide Gang Plate', 'uploads/products/6975bc46687a1_1769323590.jpg', NULL, 'Electrical', 10, 25, 'PC', 15, 'In Stock', 29.00, NULL, '2026-01-25', NULL, NULL, 0.05, 'kg'),
(21, 'Wide 2-Gang Plate', 'Wide 2-Gang Plate', 'uploads/products/6975bd837fbc1_1769323907.png', NULL, 'Electrical', 10, 25, 'PC', 15, 'In Stock', 29.00, NULL, '2026-01-25', NULL, NULL, 0.05, 'kg'),
(22, 'Wide 3-Gang Plate', 'Wide 3-Gang Plate', 'uploads/products/6975bda8534d0_1769323944.jpg', NULL, 'Electrical', 10, 25, 'PC', 15, 'In Stock', 29.00, NULL, '2026-01-25', NULL, NULL, 0.05, 'kg'),
(23, 'Wall Type Exhaust Fan', 'Wall Type Exhaust Fan 12x12', 'uploads/products/6975bdea38be6_1769324010.jpg', NULL, 'Electrical', 10, 25, 'PC', 15, 'In Stock', 910.00, NULL, '2026-01-25', NULL, NULL, 1.80, 'kg'),
(24, 'Aircon Outlet', 'WD Aircon Outlet  Set 20A', 'uploads/products/6975be2e794d7_1769324078.png', NULL, 'Electrical', 10, 25, 'SET', 15, 'In Stock', 88.00, NULL, '2026-01-25', NULL, NULL, 0.05, 'kg'),
(25, '5W DL', 'Firefly Dusk to Dawn 5W DL', 'uploads/products/6975be87dd959_1769324167.jpg', NULL, 'Electrical', 10, 25, 'PC', 15, 'In Stock', 154.00, NULL, '2026-01-25', NULL, NULL, 0.08, 'kg'),
(26, 'Motion Sensor', 'Firefly LED Motion Sensor 6W', 'uploads/products/6975beb206d4a_1769324210.jpg', NULL, 'Electrical', 10, 25, 'PC', 15, 'In Stock', 175.00, NULL, '2026-01-25', NULL, NULL, 0.08, 'kg'),
(27, 'Floodlight', 'FF Basic LED Floodlight 10W DL', 'uploads/products/6975bf2cb94bb_1769324332.jpg', NULL, 'Electrical', 10, 25, 'PC', 15, 'In Stock', 315.00, NULL, '2026-01-25', NULL, NULL, 0.50, 'kg'),
(28, 'Ecolum LED', 'Ecolum LED T5 4W DL', 'uploads/products/6975bf62928a7_1769324386.png', NULL, 'Electrical', 10, 25, 'PC', 15, 'In Stock', 116.00, NULL, '2026-01-25', NULL, NULL, 0.50, 'kg'),
(29, 'Tokina Small MGAS Regulator', 'Tokina Small MGAS Regulator', 'uploads/products/6975c19b360b9_1769324955.jpg', NULL, 'Pipes & Plumbing', 7, 21, 'PC', 3, 'In Stock', 100.00, NULL, '2026-01-25', NULL, NULL, 0.30, 'kg'),
(30, 'Tokina M-Gas Small', 'Tokina M-Gas Small', 'uploads/products/6975c1cd0b757_1769325005.jpg', NULL, 'Pipes & Plumbing', 7, 21, 'PC', 3, 'In Stock', 119.00, NULL, '2026-01-25', NULL, NULL, 0.30, 'kg'),
(31, 'Tokina LPG Hose Splitter', 'Tokina LPG Hose Splitter', 'uploads/products/6975c20a4e384_1769325066.jpg', NULL, 'Pipes & Plumbing', 7, 10, 'PC', 3, 'In Stock', 85.00, NULL, '2026-01-25', NULL, NULL, 0.15, 'kg'),
(32, '858-H HD Regulator w/ Gauge', '858-H HD Regulator w/ Gauge', 'uploads/products/6975c246a2c6f_1769325126.jpg', NULL, 'Pipes & Plumbing', 7, 10, 'PC', 3, 'In Stock', 190.00, NULL, '2026-01-25', NULL, NULL, 0.09, 'kg'),
(33, 'Ivolee Stainless P-Trap 1-1/2', 'Ivolee Stainless P-Trap 1-1/2', 'uploads/products/6975c29088067_1769325200.jpg', NULL, 'Pipes & Plumbing', 7, 25, 'PC', 10, 'In Stock', 350.00, NULL, '2026-01-25', NULL, NULL, 0.56, 'kg'),
(34, 'Washing Machine Hose', 'Washing Machine Hose', NULL, NULL, 'Pipes & Plumbing', 7, 25, 'PC', 10, 'In Stock', 100.00, NULL, '2026-01-25', NULL, NULL, 0.40, NULL),
(35, 'Prosil Aluminum Fray-25', 'Prosil Aluminum Fray-25', 'uploads/products/6975c3a76df35_1769325479.png', NULL, 'Paints & Finishes', 8, 25, 'BOX', 15, 'In Stock', 3500.00, NULL, '2026-01-25', NULL, NULL, 7.00, 'kg'),
(36, '1L Vulcaseal 12/B', '1L Vulcaseal 12/B', 'uploads/products/6975c3eb688bb_1769325547.jpg', NULL, 'Paints & Finishes', 8, 25, 'BOX', 15, 'In Stock', 7140.00, NULL, '2026-01-25', NULL, NULL, 14.00, 'kg'),
(37, '4L CS-88 Solo Flat Latex White', '4L CS-88 Solo Flat Latex White', 'uploads/products/6975c42b3014e_1769325611.jpg', NULL, 'Paints & Finishes', 8, 25, 'GAL', 15, 'In Stock', 300.00, NULL, '2026-01-25', NULL, NULL, 5.00, 'kg'),
(38, '4L Acreex ACK-54 Dark Velvet Gray', '4L Acreex ACK-54 Dark Velvet Gray', 'uploads/products/6975c4851993b_1769325701.png', NULL, 'Paints & Finishes', 8, 25, 'GAL', 14, 'In Stock', 1175.00, NULL, '2026-01-25', NULL, NULL, 5.00, NULL),
(39, 'Hippo Sandpaper (already sorted)', 'Hippo Sandpaper (already sorted)', 'uploads/products/6975c4d6a8c78_1769325782.jpg', NULL, 'Paints & Finishes', 8, 25, 'PC', 12, 'In Stock', 15.00, NULL, '2026-01-25', NULL, NULL, 0.15, 'kg'),
(40, '1L Turco Rust Converter', '1L Turco Rust Converter', 'uploads/products/6975c5748285d_1769325940.png', NULL, 'Paints & Finishes', 8, 22, 'PC', 15, 'In Stock', 3900.00, NULL, '2026-01-25', NULL, NULL, 1.20, 'kg'),
(41, '4L Weber Epoxy Primer Gray w/ Catalyst', '4L Weber Epoxy Primer Gray w/ Catalyst', 'uploads/products/6975c5b1aa402_1769326001.png', NULL, 'Paints & Finishes', 8, 25, 'PC', 13, 'In Stock', 885.00, NULL, '2026-01-25', NULL, NULL, 6.00, 'kg'),
(42, 'Painter’s Choice Paint Thinner Bottle', 'Painter’s Choice Paint Thinner Bottle', 'uploads/products/6975c5ec4aaf3_1769326060.png', NULL, 'Paints & Finishes', 8, 25, 'PC', 15, 'In Stock', 39.00, NULL, '2026-01-25', NULL, NULL, 1.20, 'kg'),
(43, 'Painter’s Choice Thinner Gallon', 'Painter’s Choice Thinner Gallon', 'uploads/products/6975c629aad07_1769326121.jpg', NULL, 'Paints & Finishes', 8, 25, 'PC', 15, 'In Stock', 230.00, NULL, '2026-01-25', NULL, NULL, 6.90, 'kg'),
(44, 'Stikwel 250g', 'Stikwel 250g', 'uploads/products/6975c68378a5f_1769326211.jpg', NULL, 'Paints & Finishes', 8, 25, 'PC', 13, 'In Stock', 42.00, NULL, '2026-01-25', NULL, NULL, 0.25, NULL),
(45, 'Nihon Special N-6013 3/32', 'Nihon Special N-6013 3/32', 'uploads/products/6975c7945ca4a_1769326484.jpg', NULL, 'Construction & Building Materials', 15, 25, 'PC', 15, 'In Stock', 1295.00, NULL, '2026-01-25', NULL, NULL, 5.50, 'kg'),
(46, '16L Powermix', '16L Powermix', 'uploads/products/6975c7c8f34e4_1769326536.jpg', NULL, 'Construction & Building Materials', 15, 9, 'PC', 15, 'Low Stock', 2975.00, NULL, '2026-01-25', NULL, NULL, 17.00, 'kg'),
(47, 'Sun Screen 3/8 x 3 x 30m', 'Sun Screen 3/8 x 3 x 30m', 'uploads/products/6975c8229e780_1769326626.jpg', NULL, 'Construction & Building Materials', 15, 25, 'PC', 15, 'In Stock', 3050.00, NULL, '2026-01-25', NULL, NULL, 40.00, 'kg'),
(48, 'Glass Block Water Bubble Pattern', 'Glass Block Water Bubble Pattern', 'uploads/products/6975c8560dd01_1769326678.jpg', NULL, 'Construction & Building Materials', 15, 25, 'PC', 15, 'In Stock', 115.00, NULL, '2026-01-25', NULL, NULL, 2.30, 'kg'),
(49, 'Black Pipe #2', 'Black Pipe #2', 'uploads/products/6975c8a56e234_1769326757.jpg', NULL, 'Construction & Building Materials', 15, 18, 'PC', 14, 'In Stock', 112.00, NULL, '2026-01-25', NULL, NULL, 5.10, 'kg'),
(50, 'Orange Elbow 1/8 x 2', 'Orange Elbow 1/8 x 2', 'uploads/products/6975c8eaa343e_1769326826.png', NULL, 'Construction & Building Materials', 15, 25, 'PC', 15, 'In Stock', 53.00, NULL, '2026-01-25', NULL, NULL, 0.06, 'kg'),
(51, 'Polycarbonate 4x8 6mm Blue', 'Polycarbonate 4x8 6mm Blue', 'uploads/products/6975c91ce3e69_1769326876.jpg', NULL, 'Construction & Building Materials', 15, 25, 'PC', 15, 'In Stock', 1000.00, NULL, '2026-01-25', NULL, NULL, 4.00, 'kg'),
(52, 'Orange Elbow 1/4 x 3', 'Orange Elbow 1/4 x 3', 'uploads/products/6975c9509621c_1769326928.png', NULL, 'Construction & Building Materials', 15, 13, 'PC', 15, 'Low Stock', 53.00, NULL, '2026-01-25', NULL, NULL, 0.07, 'kg'),
(53, 'CHB (Concrete Hollow Block) 4\"', 'CHB (Concrete Hollow Block) 4\"', 'uploads/products/6975c9d4c9e5a_1769327060.jpg', NULL, 'Construction & Building Materials', 15, 25, 'PC', 14, 'In Stock', 12.00, NULL, '2026-01-25', NULL, NULL, 10.00, 'kg'),
(54, 'Washed Sand', 'Washed Sand', 'uploads/products/6975ca27d444a_1769327143.jpg', NULL, 'Construction & Building Materials', 15, 5, 'UNT', 2, 'In Stock', 1500.00, NULL, '2026-01-25', NULL, NULL, 1600.00, 'kg'),
(55, 'Gravel 3/4\"', 'Gravel 3/4\"', 'uploads/products/6975ca4fd8361_1769327183.jpg', NULL, 'Construction & Building Materials', 15, 3, 'UNT', 1, 'In Stock', 1700.00, NULL, '2026-01-25', NULL, NULL, 1680.00, NULL),
(56, 'Cement (Portland Cement)', 'Cement (Portland Cement)', 'uploads/products/6975ca7fdab2f_1769327231.png', NULL, 'Construction & Building Materials', 15, 25, 'BAG', 15, 'In Stock', 270.00, NULL, '2026-01-25', NULL, NULL, 40.00, 'kg'),
(57, 'Plywood Marine', 'Plywood Marine', 'uploads/products/6975caad7af6d_1769327277.jpg', NULL, 'Construction & Building Materials', 15, 25, 'PC', 12, 'In Stock', 650.00, NULL, '2026-01-25', NULL, NULL, 22.00, NULL),
(58, 'Coco Lumber 2x2', 'Coco Lumber 2x2 2in x 2in x 8ft', 'uploads/products/6975caf42fa3d_1769327348.jpg', NULL, 'Construction & Building Materials', 15, 50, 'PC', 12, 'In Stock', 30.00, NULL, '2026-01-25', NULL, NULL, 3.00, 'kg'),
(59, 'Tie Wire #16', 'Tie Wire #16', 'uploads/products/6975cb1d3f182_1769327389.jpg', NULL, 'Construction & Building Materials', 15, 35, 'PC', 12, 'In Stock', 65.00, NULL, '2026-01-25', NULL, NULL, 1.00, 'kg'),
(60, 'PVC Pipe 1/2\" (PN16)', 'PVC Pipe 1/2\" (PN16)', 'uploads/products/6975cb3e4178d_1769327422.jpg', NULL, 'Construction & Building Materials', 15, 24, 'PC', 12, 'In Stock', 70.00, NULL, '2026-01-25', NULL, NULL, 0.50, 'kg'),
(61, 'Deformed Bar Ø10mm', 'Deformed Bar Ø10mm', 'uploads/products/6975cb6710b6e_1769327463.jpg', NULL, 'Construction & Building Materials', 15, 34, 'PC', 12, 'In Stock', 210.00, NULL, '2026-01-25', NULL, NULL, 4.60, NULL),
(62, 'Angle Bar 1\" x 1\"', 'Angle Bar 1\" x 1\"', 'uploads/products/6975cb9cb7cee_1769327516.jpg', NULL, 'Construction & Building Materials', 15, 24, 'PC', 12, 'In Stock', 180.00, NULL, '2026-01-25', NULL, NULL, 5.40, NULL),
(63, 'C-Purlin 100mm x 50mm', 'C-Purlin 100mm x 50mm', 'uploads/products/6975cbffac436_1769327615.png', NULL, 'Construction & Building Materials', 15, 32, 'PC', 12, 'In Stock', 580.00, NULL, '2026-01-25', NULL, NULL, 12.40, 'kg'),
(64, 'Steel Square Tube 1\" x 1\"', 'Steel Square Tube 1\" x 1\"', 'uploads/products/6975cc50cc614_1769327696.jpg', NULL, 'Construction & Building Materials', 15, 36, 'PC', 13, 'In Stock', 180.00, NULL, '2026-01-25', NULL, NULL, 6.00, 'kg'),
(65, 'Union Desk DAN 16', 'Union Desk DAN 16', 'uploads/products/6975ccd85f27a_1769327832.jpg', NULL, 'Tools & Hardware', 9, 25, 'PC', 15, 'In Stock', 1291.00, NULL, '2026-01-25', NULL, NULL, 3.10, 'kg'),
(66, 'NEMA 3R P.1', 'NEMA 3R P.1', 'uploads/products/6975cd0b1ee2b_1769327883.jpg', NULL, 'Tools & Hardware', 9, 20, 'PC', 15, 'In Stock', 407.00, NULL, '2026-01-25', NULL, NULL, 5.00, 'kg'),
(67, 'SS Pocket Size Multimeter', 'SS Pocket Size Multimeter', 'uploads/products/6975cdce7ea59_1769328078.jpg', NULL, 'Tools & Hardware', 9, 25, 'PC', 13, 'In Stock', 150.00, NULL, '2026-01-25', NULL, NULL, 0.16, NULL),
(68, 'SS Excellent DC Resolution Fuse/Diod', 'SS Excellent DC Resolution Fuse/Diod', 'uploads/products/6975ce101ebb5_1769328144.jpg', NULL, 'Tools & Hardware', 9, 26, 'PC', 15, 'In Stock', 375.00, NULL, '2026-01-25', NULL, NULL, 3.00, 'g'),
(69, 'SS Circinal Type', 'SS Circinal Type', NULL, NULL, 'Tools & Hardware', 9, 25, 'PAC', 12, 'In Stock', 300.00, NULL, '2026-01-25', NULL, NULL, 5.00, 'kg'),
(70, 'SS Cable Tie 60mm', 'SS Cable Tie 60mm', 'uploads/products/6975cec7ddae8_1769328327.jpg', NULL, 'Tools & Hardware', 9, 26, 'PC', 15, 'In Stock', 7.00, NULL, '2026-01-25', NULL, NULL, 0.32, 'kg'),
(71, 'SS Cable Tie 60mm Black', 'SS Cable Tie 60mm Black', 'uploads/products/6975cf1ced8a6_1769328412.jpg', NULL, 'Tools & Hardware', 9, 25, 'PC', 15, 'In Stock', 7.00, NULL, '2026-01-25', NULL, NULL, 0.50, 'kg'),
(72, 'SS Cable Tie 120mm Black', 'SS Cable Tie 120mm Black', 'uploads/products/6975cf5f32afb_1769328479.jpg', NULL, 'Tools & Hardware', 9, 35, 'PC', 13, 'In Stock', 31.00, NULL, '2026-01-25', NULL, NULL, 0.01, 'kg'),
(73, 'Masking Tape Armak 3/4', 'Masking Tape Armak 3/4', 'uploads/products/6975cfb098903_1769328560.png', NULL, 'Tools & Hardware', 9, 64, 'ROL', 15, 'In Stock', 24.00, NULL, '2026-01-25', NULL, NULL, 0.04, 'kg'),
(74, 'Masking Tape Armak 3/4', 'Masking Tape Armak 3/4', 'uploads/products/6975d356a29a6_1769329494.jpg', NULL, 'Tools & Hardware', 9, 24, 'PAC', 12, 'In Stock', 60.00, NULL, '2026-01-25', NULL, NULL, 1.00, 'kg'),
(75, 'Hippo Sandpaper #80', 'Hippo Sandpaper #80', 'uploads/products/6975d032ed15d_1769328690.png', NULL, 'Tools & Hardware', 9, 100, 'PC', 12, 'In Stock', 11.60, NULL, '2026-01-25', NULL, NULL, 0.01, 'kg'),
(76, 'Topgrade Masonry Drill Bit 5/16', 'Topgrade Masonry Drill Bit 5/16', 'uploads/products/6975d069b6e00_1769328745.jpg', NULL, 'Tools & Hardware', 9, 20, 'PC', 12, 'In Stock', 70.00, NULL, '2026-01-25', NULL, NULL, 0.20, 'kg'),
(77, 'Topgrade Aluminum Level Bar 18', 'Topgrade Aluminum Level Bar 18', 'uploads/products/6975d0987aa5b_1769328792.jpg', NULL, 'Tools & Hardware', 9, 27, 'PC', 12, 'In Stock', 225.00, NULL, '2026-01-25', NULL, NULL, 0.45, 'kg'),
(78, 'Topgrade Masonry Drill Bit 55/16', 'Topgrade Masonry Drill Bit 55/16', 'uploads/products/6975d0cbb9b61_1769328843.jpg', NULL, 'Tools & Hardware', 9, 20, 'PC', 12, 'In Stock', 35.00, NULL, '2026-01-25', NULL, NULL, 0.10, 'kg'),
(79, 'Topgrade Combination Wrench 2mm', 'Topgrade Combination Wrench 2mm', 'uploads/products/6975d0f2d321a_1769328882.jpg', NULL, 'Tools & Hardware', 9, 23, 'PC', 12, 'In Stock', 230.00, NULL, '2026-01-25', NULL, NULL, 0.03, 'kg'),
(80, 'Topgrade Combination Wrench 2mm', 'Topgrade Combination Wrench 2mm', 'uploads/products/6975d0f2eb0c1_1769328882.jpg', NULL, 'Tools & Hardware', 9, 7, 'PC', 12, 'Low Stock', 230.00, NULL, '2026-01-25', NULL, NULL, 0.03, 'kg'),
(81, 'Dormwe Brass L/Pin 3x3', 'Dormwe Brass L/Pin 3x3', 'uploads/products/6975d1321baa2_1769328946.png', NULL, 'Tools & Hardware', 9, 34, 'PC', 12, 'In Stock', 55.00, NULL, '2026-01-25', NULL, NULL, 0.15, 'kg'),
(82, 'Irwin Visegrip 7R', 'Irwin Visegrip 7R', 'uploads/products/6975d1b3e7b4b_1769329075.jpg', NULL, 'Tools & Hardware', 9, 23, 'PC', 12, 'In Stock', 700.00, NULL, '2026-01-25', NULL, NULL, 220.00, 'g'),
(83, 'Narrow Butt 505B 1-1/2', 'Narrow Butt 505B 1-1/2', 'uploads/products/6975d1e58cb64_1769329125.jpg', NULL, 'Tools & Hardware', 9, 34, 'PC', 12, 'In Stock', 69.00, NULL, '2026-01-25', NULL, NULL, 0.05, 'kg'),
(84, 'Aluminum Ladder #8', 'Aluminum Ladder #8', 'uploads/products/6975d21f8874e_1769329183.jpg', NULL, 'Tools & Hardware', 9, 12, 'PC', 12, 'In Stock', 1760.00, NULL, '2026-01-25', NULL, NULL, 9.60, 'kg'),
(85, 'Single Pulley 3/4', 'Single Pulley 3/4', 'uploads/products/6975d259799b9_1769329241.jpg', NULL, 'Tools & Hardware', 9, 34, 'PC', 12, 'In Stock', 17.00, NULL, '2026-01-25', NULL, NULL, 24.00, 'g'),
(86, 'Single Pulley 3/4', 'Single Pulley 3/4', 'uploads/products/6975d25992e45_1769329241.jpg', NULL, 'Tools & Hardware', 9, 34, 'PC', 12, 'In Stock', 17.00, NULL, '2026-01-25', NULL, NULL, 24.00, 'g'),
(87, 'Single Pulley 1/2', 'Single Pulley 1/2', 'uploads/products/6975d2924ec9a_1769329298.jpg', NULL, 'Tools & Hardware', 9, 24, 'PC', 12, 'In Stock', 15.00, NULL, '2026-01-25', NULL, NULL, 0.02, 'kg'),
(88, 'Blind rivets 5/32x3/8', 'Blind rivets 5/32x3/8', 'uploads/products/6975d2eeefce9_1769329390.jpg', NULL, 'Tools & Hardware', 9, 6, 'PC', 12, 'Low Stock', 360.00, NULL, '2026-01-25', NULL, NULL, 2.00, 'kg');

-- --------------------------------------------------------

--
-- Table structure for table `product_reviews`
--

CREATE TABLE `product_reviews` (
  `Review_ID` int(11) NOT NULL,
  `Order_ID` int(11) NOT NULL,
  `Product_ID` int(11) NOT NULL,
  `User_ID` int(11) NOT NULL,
  `Rating` tinyint(4) NOT NULL CHECK (`Rating` between 1 and 5),
  `Review_Text` text DEFAULT NULL,
  `Created_At` timestamp NOT NULL DEFAULT current_timestamp(),
  `Updated_At` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `product_reviews`
--

INSERT INTO `product_reviews` (`Review_ID`, `Order_ID`, `Product_ID`, `User_ID`, `Rating`, `Review_Text`, `Created_At`, `Updated_At`) VALUES
(4, 97, 46, 30, 5, 'Good job!', '2026-01-26 16:10:35', '2026-01-26 21:13:13'),
(5, 106, 49, 2, 2, '', '2026-01-27 00:03:39', '2026-01-27 00:03:39');

-- --------------------------------------------------------

--
-- Table structure for table `product_variations`
--

CREATE TABLE `product_variations` (
  `Variation_ID` int(11) NOT NULL,
  `Product_ID` int(11) NOT NULL,
  `variation_name` varchar(100) NOT NULL,
  `variation_value` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `product_variations`
--

INSERT INTO `product_variations` (`Variation_ID`, `Product_ID`, `variation_name`, `variation_value`) VALUES
(9, 12, 'Length', '12mmx12mmx8'),
(10, 13, 'Length', '1.77inch'),
(13, 29, 'Color', 'blue'),
(14, 37, 'Color', 'White'),
(15, 38, 'Color', 'dark velvet gray'),
(16, 58, 'Length', '2in x 2in x 8ft'),
(17, 70, 'Length', '60 mmm');

-- --------------------------------------------------------

--
-- Table structure for table `transactions`
--

CREATE TABLE `transactions` (
  `Transaction_ID` int(11) NOT NULL,
  `Order_ID` int(11) DEFAULT NULL,
  `Base_Fee` decimal(10,2) DEFAULT 0.00,
  `Distance_Fee` decimal(10,2) DEFAULT 0.00,
  `Subtotal` decimal(10,2) NOT NULL,
  `Delivery_Fee` decimal(10,2) GENERATED ALWAYS AS (`Base_Fee` + `Distance_Fee`) STORED,
  `Total` decimal(10,2) NOT NULL,
  `Payment_Method` enum('GCash','Cash on Delivery') DEFAULT 'GCash',
  `Payment_Status` enum('Pending','Paid','Failed') DEFAULT 'Pending',
  `Created_At` timestamp NOT NULL DEFAULT current_timestamp(),
  `Updated_At` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `proof_of_payment` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `transactions`
--

INSERT INTO `transactions` (`Transaction_ID`, `Order_ID`, `Base_Fee`, `Distance_Fee`, `Subtotal`, `Total`, `Payment_Method`, `Payment_Status`, `Created_At`, `Updated_At`, `proof_of_payment`) VALUES
(68, 84, 0.00, 0.00, 4080.00, 4080.00, 'GCash', 'Paid', '2026-01-26 05:02:24', '2026-01-26 05:17:55', 'uploads/proof_of_payment/6976f8fe11bb1_1769404670.jpg'),
(69, 85, 0.00, 0.00, 3973.00, 3973.00, 'GCash', 'Paid', '2026-01-26 06:47:24', '2026-01-26 07:11:08', 'uploads/proof_of_payment/6977138a1cd74_1769411466.jpg'),
(70, 86, 0.00, 0.00, 8925.00, 8925.00, 'GCash', 'Paid', '2026-01-26 08:05:30', '2026-01-26 11:15:25', 'uploads/proof_of_payment/69774cc9d3dff_1769426121.jpg'),
(71, 87, 0.00, 0.00, 336.00, 336.00, 'GCash', 'Paid', '2026-01-26 08:40:00', '2026-01-26 08:44:56', 'uploads/proof_of_payment/69772983e875f_1769417091.png'),
(72, 88, 0.00, 0.00, 2975.00, 2975.00, 'GCash', 'Paid', '2026-01-26 09:21:35', '2026-01-26 09:22:08', 'uploads/proof_of_payment/6977323e51c7e_1769419326.png'),
(73, 89, 0.00, 0.00, 2975.00, 2975.00, 'GCash', 'Paid', '2026-01-26 09:34:29', '2026-01-26 09:56:20', 'uploads/proof_of_payment/69773a4148389_1769421377.png'),
(74, 90, 0.00, 0.00, 2975.00, 2975.00, 'GCash', 'Paid', '2026-01-26 10:38:05', '2026-01-26 10:39:39', 'uploads/proof_of_payment/69774469050cb_1769423977.png'),
(75, 91, 0.00, 0.00, 2975.00, 2975.00, 'GCash', 'Pending', '2026-01-26 11:25:46', '2026-01-26 11:25:46', NULL),
(76, 92, 0.00, 0.00, 2975.00, 2975.00, 'GCash', 'Pending', '2026-01-26 11:34:57', '2026-01-26 11:34:57', NULL),
(77, 93, 0.00, 0.00, 2975.00, 2975.00, 'GCash', 'Pending', '2026-01-26 15:53:11', '2026-01-26 15:53:11', NULL),
(78, 94, 0.00, 0.00, 2975.00, 2975.00, 'GCash', 'Pending', '2026-01-26 15:53:47', '2026-01-26 15:53:47', NULL),
(79, 95, 0.00, 0.00, 5950.00, 5950.00, 'GCash', 'Pending', '2026-01-26 15:57:55', '2026-01-26 15:57:55', NULL),
(80, 96, 0.00, 0.00, 5950.00, 5950.00, 'GCash', 'Pending', '2026-01-26 16:01:38', '2026-01-26 16:01:38', NULL),
(81, 97, 0.00, 0.00, 2975.00, 2975.00, 'GCash', 'Paid', '2026-01-26 16:05:06', '2026-01-26 16:08:01', 'uploads/proof_of_payment/6977915f39697_1769443679.png'),
(82, 98, 0.00, 0.00, 9105.00, 9105.00, 'GCash', 'Pending', '2026-01-26 17:34:48', '2026-01-26 17:34:48', NULL),
(83, 99, 0.00, 0.00, 540.00, 540.00, 'Cash on Delivery', 'Pending', '2026-01-26 17:59:04', '2026-01-26 18:01:34', NULL),
(84, 100, 0.00, 0.00, 720.00, 720.00, 'GCash', 'Paid', '2026-01-26 18:03:50', '2026-01-26 18:23:04', 'uploads/proof_of_payment/6977b10608dd0_1769451782.jpg'),
(85, 101, 0.00, 0.00, 6848.00, 6848.00, 'GCash', 'Paid', '2026-01-26 21:01:01', '2026-01-26 21:02:13', 'uploads/proof_of_payment/6977d652f1aea_1769461330.png'),
(86, 102, 0.00, 0.00, 7072.00, 7072.00, 'GCash', 'Pending', '2026-01-26 21:08:53', '2026-01-26 21:08:53', NULL),
(87, 103, 0.00, 0.00, 2975.00, 2975.00, 'GCash', 'Paid', '2026-01-26 21:09:27', '2026-01-26 21:10:34', 'uploads/proof_of_payment/6977d8497e1f1_1769461833.png'),
(88, 104, 0.00, 0.00, 336.00, 336.00, 'GCash', 'Pending', '2026-01-26 21:46:16', '2026-01-26 21:46:16', NULL),
(89, 105, 0.00, 0.00, 6140.00, 6140.00, 'GCash', 'Pending', '2026-01-26 23:36:16', '2026-01-26 23:36:16', NULL),
(90, 106, 0.00, 0.00, 336.00, 336.00, 'GCash', 'Paid', '2026-01-26 23:39:27', '2026-01-26 23:49:26', 'uploads/proof_of_payment/6977fd7e929d3_1769471358.jpg'),
(91, 107, 0.00, 0.00, 8925.00, 8925.00, 'GCash', 'Paid', '2026-01-27 10:39:54', '2026-01-27 10:42:45', 'uploads/proof_of_payment/697896a39af54_1769510563.jpg'),
(92, 108, 0.00, 0.00, 3005.00, 3005.00, 'GCash', 'Pending', '2026-02-02 11:31:57', '2026-02-02 11:31:57', NULL),
(93, 109, 0.00, 0.00, 2975.00, 2975.00, 'GCash', 'Pending', '2026-02-02 11:33:51', '2026-02-02 11:33:51', NULL),
(94, 110, 0.00, 0.00, 1080.00, 1080.00, 'GCash', 'Pending', '2026-02-02 11:34:48', '2026-02-02 11:34:48', NULL),
(95, 111, 0.00, 0.00, 2975.00, 2975.00, 'GCash', 'Pending', '2026-02-02 11:52:53', '2026-02-02 11:52:53', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `transaction_items`
--

CREATE TABLE `transaction_items` (
  `Item_ID` int(11) NOT NULL,
  `Product_ID` int(11) NOT NULL,
  `Quantity` int(11) NOT NULL,
  `Price` decimal(10,2) NOT NULL,
  `Order_ID` int(11) NOT NULL,
  `variation` text DEFAULT NULL COMMENT 'Selected variation for this line e.g. Size: 2x2, Length: 8ft'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `transaction_items`
--

INSERT INTO `transaction_items` (`Item_ID`, `Product_ID`, `Quantity`, `Price`, `Order_ID`, `variation`) VALUES
(77, 40, 1, 3900.00, 84, NULL),
(78, 62, 1, 180.00, 84, NULL),
(79, 80, 4, 230.00, 85, NULL),
(80, 46, 1, 2975.00, 85, NULL),
(81, 17, 1, 78.00, 85, NULL),
(82, 46, 3, 2975.00, 86, NULL),
(83, 49, 3, 112.00, 87, NULL),
(84, 46, 1, 2975.00, 88, NULL),
(85, 46, 1, 2975.00, 89, NULL),
(86, 46, 1, 2975.00, 90, NULL),
(87, 46, 1, 2975.00, 91, NULL),
(88, 46, 1, 2975.00, 92, NULL),
(89, 46, 1, 2975.00, 93, NULL),
(90, 46, 1, 2975.00, 94, NULL),
(91, 46, 2, 2975.00, 95, NULL),
(92, 46, 2, 2975.00, 96, NULL),
(93, 46, 1, 2975.00, 97, NULL),
(94, 46, 3, 2975.00, 98, NULL),
(95, 62, 1, 180.00, 98, NULL),
(96, 62, 3, 180.00, 99, NULL),
(97, 62, 4, 180.00, 100, NULL),
(98, 52, 6, 53.00, 101, NULL),
(99, 63, 1, 580.00, 101, NULL),
(100, 46, 2, 2975.00, 101, NULL),
(101, 52, 6, 53.00, 102, NULL),
(102, 63, 1, 580.00, 102, NULL),
(103, 46, 2, 2975.00, 102, NULL),
(104, 49, 2, 112.00, 102, NULL),
(105, 46, 1, 2975.00, 103, NULL),
(106, 49, 3, 112.00, 104, NULL),
(107, 32, 1, 190.00, 105, NULL),
(108, 46, 2, 2975.00, 105, NULL),
(109, 49, 3, 112.00, 106, NULL),
(110, 46, 3, 2975.00, 107, NULL),
(111, 58, 1, 30.00, 108, NULL),
(112, 46, 1, 2975.00, 108, NULL),
(113, 46, 1, 2975.00, 109, NULL),
(114, 62, 6, 180.00, 110, NULL),
(115, 46, 1, 2975.00, 111, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `User_ID` int(11) NOT NULL,
  `First_Name` varchar(25) DEFAULT NULL,
  `Middle_Name` varchar(25) DEFAULT NULL,
  `Last_Name` varchar(25) DEFAULT NULL,
  `Phone_Number` varchar(15) DEFAULT NULL,
  `email` varchar(100) NOT NULL,
  `address` varchar(255) NOT NULL,
  `address_street` varchar(255) DEFAULT NULL,
  `address_city` varchar(100) DEFAULT NULL,
  `address_barangay` varchar(100) DEFAULT NULL,
  `address_district` varchar(100) DEFAULT NULL,
  `address_postal_code` varchar(20) DEFAULT NULL,
  `address_region` varchar(100) DEFAULT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('Customer','Store Employee','Delivery Driver','Admin') NOT NULL DEFAULT 'Customer',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `profile_picture` varchar(255) DEFAULT NULL,
  `status` enum('active','inactive','pending','archived') DEFAULT 'active',
  `last_login` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`User_ID`, `First_Name`, `Middle_Name`, `Last_Name`, `Phone_Number`, `email`, `address`, `address_street`, `address_city`, `address_barangay`, `address_district`, `address_postal_code`, `address_region`, `password`, `role`, `created_at`, `profile_picture`, `status`, `last_login`) VALUES
(1, 'Admin', NULL, 'User', NULL, 'admin@matarik.com', '123 Admin Street', '123 Admin Street', NULL, NULL, NULL, NULL, 'Philippines', '$2y$10$lEqpsi2kGSD7GL3SzwNb0.N3W264IDK3YcgK2Ii7AC5qFv/Gp7YZK', 'Admin', '2025-11-12 16:46:33', 'uploads/profiles/693503ba3358a_1765082042.png', 'active', '2026-02-06 13:27:42'),
(2, 'Customer', NULL, 'User', '09878756756', 'customer@matarik.com', '456 Customer Avenue, National Capital Region (NCR)', '456 Customer Avenue', NULL, NULL, '', NULL, 'National Capital Region (NCR)', '$2y$10$4U.hWW3qUxaVcGl75Zs7i.HKZnmeXBQTCZ/X3SzKxrjNN6//V8VRi', 'Customer', '2025-11-12 16:46:33', 'uploads/profiles/6936a60452b49_1765189124.png', 'active', '2026-02-06 12:51:05'),
(26, 'Test', NULL, 'Driver', '09170000001', 'test.driver@matarix.local', 'Test Address', NULL, NULL, NULL, NULL, NULL, NULL, '$2y$10$1CjN5OaCgg.77yYXI2D89uu4KAik25wy/MycPH9XaANcJZwGforZe', 'Delivery Driver', '2026-01-24 07:49:24', NULL, 'active', '2026-02-02 10:07:27'),
(27, 'Test', NULL, 'Employee', '09170000002', 'test.employee@matarix.local', 'Test Address', NULL, NULL, NULL, NULL, NULL, NULL, '$2y$10$jfDyeuyjlkIDx8YTeqkJD.bm.MZQypEevcAwAOr.denvBETKDV8Za', 'Store Employee', '2026-01-24 07:49:24', NULL, 'active', '2026-01-26 23:05:57'),
(28, 'Joshua', NULL, 'Villaresis', '09812361885', 'jkkvvllrrsis@gmail.com', 'Blk 48 Lot 15 Basilan St. Dela Costa 2, Caloocan City, NCR, Third District, Barangay 179 1400, National Capital Region (NCR)', 'Blk 48 Lot 15 Basilan St. Dela Costa 2', 'Caloocan City', 'Barangay 179', 'NCR, Third District', '1400', 'National Capital Region (NCR)', '$2y$10$.8qmx/MndT9W0LRZ93YoNOZqrjpWHeLHUJhxqiwE0jaVgvSv3n8aC', 'Customer', '2026-01-26 05:00:47', NULL, 'active', '2026-01-26 05:01:19'),
(29, 'Joshua', NULL, 'Villaresis', '09812361885', 'villaresisjoshuaariola@gmail.com', 'Phase 4 Bagong Silang, Caloocan City, NCR, Third District, Barangay 115 1428, National Capital Region (NCR)', 'Phase 4 Bagong Silang', 'Caloocan City', 'Barangay 115', 'NCR, Third District', '1428', 'National Capital Region (NCR)', '$2y$10$B4wCOO7KCfGY8cXCayugW.3rlQMlwbVdvmb02zJBkr4DwVqwZluF2', 'Customer', '2026-01-26 05:21:20', NULL, 'active', NULL),
(30, 'Joshua', NULL, 'Villaresis', '09812361885', 'ksnjoshvllrsis@gmail.com', 'Phase 4 Bagong Silang, Caloocan City, NCR, Third District, Barangay 115 1428, National Capital Region (NCR)', 'Phase 4 Bagong Silang', 'Caloocan City', 'Barangay 115', 'NCR, Third District', '1428', 'National Capital Region (NCR)', '$2y$10$phhk7m.X1MnvEeMehgLs.eTpG7l2LseCDy/PPkdSwUV.9s.BGf9l.', 'Customer', '2026-01-26 05:22:12', NULL, 'active', '2026-01-26 23:12:38'),
(31, 'Sherwin', NULL, 'Gloriane', '09955115582', 'glorianelectanasherwin@gmail.com', 'Phase 4 Package 4 Lot 3 Block 16 Bagong Silang Caloocan City, Caloocan City, NCR, Third District, Barangay 176 1428, National Capital Region (NCR)', 'Phase 4 Package 4 Lot 3 Block 16 Bagong Silang Caloocan City', 'Caloocan City', 'Barangay 176', 'NCR, Third District', '1428', 'National Capital Region (NCR)', '$2y$10$9qcC2WHT14.jGdYH/mtasuJnbY8/Poefb.Gi88irKBOSNFh3u/j6K', 'Customer', '2026-01-26 17:58:24', NULL, 'active', '2026-01-26 21:41:17'),
(32, 'hwjsnsa', NULL, 'jwjwnss', '09812361885', 'joshvillaresis@gmail.com', 'hwhwsjnsa, Quezon City, NCR, Second District, Bagong Lipunan Ng Crame 1400, National Capital Region (NCR)', 'hwhwsjnsa', 'Quezon City', 'Bagong Lipunan Ng Crame', 'NCR, Second District', '1400', 'National Capital Region (NCR)', '$2y$10$sc3KobQKTEGNdC9L/c.dmeyotEDWxH0gnL1flVyTPMfaK7v9Ec4NS', 'Customer', '2026-01-26 20:06:53', NULL, 'active', '2026-01-27 22:19:44'),
(33, 'Skipskip', NULL, 'Moe', '09652881465', 'lainemangahas@gmail.com', 'Champaca, Caloocan City, NCR, Third District, Barangay 177 1400, National Capital Region (NCR)', 'Champaca', 'Caloocan City', 'Barangay 177', 'NCR, Third District', '1400', 'National Capital Region (NCR)', '$2y$10$tSIVDiV1XfwblKPIzmjQZO6QSxivMdaPhqiI/xSB0phzgSIuwn7/S', 'Customer', '2026-01-27 10:38:32', NULL, 'active', '2026-01-27 10:43:39');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `admin_notifications`
--
ALTER TABLE `admin_notifications`
  ADD PRIMARY KEY (`Notification_ID`),
  ADD KEY `fk_notifications_order` (`Order_ID`),
  ADD KEY `fk_notifications_user` (`User_ID`),
  ADD KEY `idx_is_read` (`Is_Read`),
  ADD KEY `idx_created_at` (`Created_At`),
  ADD KEY `idx_activity_type` (`Activity_Type`);

--
-- Indexes for table `categories`
--
ALTER TABLE `categories`
  ADD PRIMARY KEY (`Category_ID`),
  ADD UNIQUE KEY `unique_category_name` (`category_name`);

--
-- Indexes for table `customer_feedback`
--
ALTER TABLE `customer_feedback`
  ADD PRIMARY KEY (`Feedback_ID`),
  ADD KEY `fk_feedback_delivery` (`Delivery_ID`);

--
-- Indexes for table `customer_notifications`
--
ALTER TABLE `customer_notifications`
  ADD PRIMARY KEY (`Notification_ID`),
  ADD KEY `fk_customer_notifications_user` (`User_ID`),
  ADD KEY `fk_customer_notifications_order` (`Order_ID`),
  ADD KEY `idx_is_read` (`Is_Read`),
  ADD KEY `idx_created_at` (`Created_At`),
  ADD KEY `idx_activity_type` (`Activity_Type`);

--
-- Indexes for table `deliveries`
--
ALTER TABLE `deliveries`
  ADD PRIMARY KEY (`Delivery_ID`) USING BTREE,
  ADD KEY `fk_deliveries_vehicle` (`Vehicle_ID`),
  ADD KEY `fk_deliveries_driver` (`Driver_ID`),
  ADD KEY `fk_deliveries_order` (`Order_ID`);

--
-- Indexes for table `delivery_drivers`
--
ALTER TABLE `delivery_drivers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_delivery_driver` (`Delivery_ID`,`Driver_ID`),
  ADD KEY `Driver_ID` (`Driver_ID`);

--
-- Indexes for table `delivery_vehicles`
--
ALTER TABLE `delivery_vehicles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_delivery_vehicle` (`Delivery_ID`,`Vehicle_ID`),
  ADD KEY `Vehicle_ID` (`Vehicle_ID`);

--
-- Indexes for table `driver_notifications`
--
ALTER TABLE `driver_notifications`
  ADD PRIMARY KEY (`Notification_ID`),
  ADD KEY `idx_driver_id` (`Driver_ID`),
  ADD KEY `idx_is_read` (`Is_Read`),
  ADD KEY `idx_created_at` (`Created_At`),
  ADD KEY `idx_activity_type` (`Activity_Type`);

--
-- Indexes for table `fleet`
--
ALTER TABLE `fleet`
  ADD PRIMARY KEY (`Vehicle_ID`) USING BTREE;

--
-- Indexes for table `orders`
--
ALTER TABLE `orders`
  ADD PRIMARY KEY (`Order_ID`) USING BTREE,
  ADD KEY `User_ID` (`User_ID`) USING BTREE,
  ADD KEY `fk_orders_employee` (`Employee_ID`),
  ADD KEY `fk_orders_approved_by` (`approved_by`);

--
-- Indexes for table `order_availability_slots`
--
ALTER TABLE `order_availability_slots`
  ADD PRIMARY KEY (`slot_id`),
  ADD UNIQUE KEY `unique_order_slot` (`order_id`,`slot_number`),
  ADD KEY `idx_order_id` (`order_id`),
  ADD KEY `idx_availability_date` (`availability_date`);

--
-- Indexes for table `order_settings`
--
ALTER TABLE `order_settings`
  ADD PRIMARY KEY (`setting_key`);

--
-- Indexes for table `password_reset_tokens`
--
ALTER TABLE `password_reset_tokens`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `token` (`token`),
  ADD KEY `idx_email` (`email`),
  ADD KEY `idx_token` (`token`),
  ADD KEY `idx_expires_at` (`expires_at`);

--
-- Indexes for table `products`
--
ALTER TABLE `products`
  ADD PRIMARY KEY (`Product_ID`),
  ADD KEY `fk_products_category` (`category_id`);

--
-- Indexes for table `product_reviews`
--
ALTER TABLE `product_reviews`
  ADD PRIMARY KEY (`Review_ID`),
  ADD UNIQUE KEY `unique_order_product_user` (`Order_ID`,`Product_ID`,`User_ID`),
  ADD KEY `fk_product_reviews_order` (`Order_ID`),
  ADD KEY `fk_product_reviews_product` (`Product_ID`),
  ADD KEY `fk_product_reviews_user` (`User_ID`);

--
-- Indexes for table `product_variations`
--
ALTER TABLE `product_variations`
  ADD PRIMARY KEY (`Variation_ID`),
  ADD KEY `Product_ID` (`Product_ID`);

--
-- Indexes for table `transactions`
--
ALTER TABLE `transactions`
  ADD PRIMARY KEY (`Transaction_ID`),
  ADD KEY `fk_transactions_order` (`Order_ID`);

--
-- Indexes for table `transaction_items`
--
ALTER TABLE `transaction_items`
  ADD PRIMARY KEY (`Item_ID`),
  ADD KEY `Product_ID` (`Product_ID`),
  ADD KEY `fk_transaction_items_order` (`Order_ID`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`User_ID`) USING BTREE,
  ADD UNIQUE KEY `email` (`email`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `admin_notifications`
--
ALTER TABLE `admin_notifications`
  MODIFY `Notification_ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=104;

--
-- AUTO_INCREMENT for table `categories`
--
ALTER TABLE `categories`
  MODIFY `Category_ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=19;

--
-- AUTO_INCREMENT for table `customer_feedback`
--
ALTER TABLE `customer_feedback`
  MODIFY `Feedback_ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `customer_notifications`
--
ALTER TABLE `customer_notifications`
  MODIFY `Notification_ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=217;

--
-- AUTO_INCREMENT for table `deliveries`
--
ALTER TABLE `deliveries`
  MODIFY `Delivery_ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=96;

--
-- AUTO_INCREMENT for table `delivery_drivers`
--
ALTER TABLE `delivery_drivers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=37;

--
-- AUTO_INCREMENT for table `delivery_vehicles`
--
ALTER TABLE `delivery_vehicles`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=32;

--
-- AUTO_INCREMENT for table `driver_notifications`
--
ALTER TABLE `driver_notifications`
  MODIFY `Notification_ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT for table `fleet`
--
ALTER TABLE `fleet`
  MODIFY `Vehicle_ID` int(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- AUTO_INCREMENT for table `orders`
--
ALTER TABLE `orders`
  MODIFY `Order_ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=112;

--
-- AUTO_INCREMENT for table `order_availability_slots`
--
ALTER TABLE `order_availability_slots`
  MODIFY `slot_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=73;

--
-- AUTO_INCREMENT for table `password_reset_tokens`
--
ALTER TABLE `password_reset_tokens`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=26;

--
-- AUTO_INCREMENT for table `products`
--
ALTER TABLE `products`
  MODIFY `Product_ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=90;

--
-- AUTO_INCREMENT for table `product_reviews`
--
ALTER TABLE `product_reviews`
  MODIFY `Review_ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `product_variations`
--
ALTER TABLE `product_variations`
  MODIFY `Variation_ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=18;

--
-- AUTO_INCREMENT for table `transactions`
--
ALTER TABLE `transactions`
  MODIFY `Transaction_ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=96;

--
-- AUTO_INCREMENT for table `transaction_items`
--
ALTER TABLE `transaction_items`
  MODIFY `Item_ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=116;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `User_ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=34;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `customer_feedback`
--
ALTER TABLE `customer_feedback`
  ADD CONSTRAINT `fk_feedback_delivery` FOREIGN KEY (`Delivery_ID`) REFERENCES `deliveries` (`Delivery_ID`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `deliveries`
--
ALTER TABLE `deliveries`
  ADD CONSTRAINT `fk_deliveries_driver` FOREIGN KEY (`Driver_ID`) REFERENCES `users` (`User_ID`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_deliveries_order` FOREIGN KEY (`Order_ID`) REFERENCES `orders` (`Order_ID`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_deliveries_vehicle` FOREIGN KEY (`Vehicle_ID`) REFERENCES `fleet` (`Vehicle_ID`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `delivery_drivers`
--
ALTER TABLE `delivery_drivers`
  ADD CONSTRAINT `delivery_drivers_ibfk_1` FOREIGN KEY (`Delivery_ID`) REFERENCES `deliveries` (`Delivery_ID`) ON DELETE CASCADE,
  ADD CONSTRAINT `delivery_drivers_ibfk_2` FOREIGN KEY (`Driver_ID`) REFERENCES `users` (`User_ID`) ON DELETE CASCADE;

--
-- Constraints for table `delivery_vehicles`
--
ALTER TABLE `delivery_vehicles`
  ADD CONSTRAINT `delivery_vehicles_ibfk_1` FOREIGN KEY (`Delivery_ID`) REFERENCES `deliveries` (`Delivery_ID`) ON DELETE CASCADE,
  ADD CONSTRAINT `delivery_vehicles_ibfk_2` FOREIGN KEY (`Vehicle_ID`) REFERENCES `fleet` (`Vehicle_ID`) ON DELETE CASCADE;

--
-- Constraints for table `orders`
--
ALTER TABLE `orders`
  ADD CONSTRAINT `fk_orders_approved_by` FOREIGN KEY (`approved_by`) REFERENCES `users` (`User_ID`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_orders_employee` FOREIGN KEY (`Employee_ID`) REFERENCES `users` (`User_ID`),
  ADD CONSTRAINT `orders_ibfk_1` FOREIGN KEY (`User_ID`) REFERENCES `users` (`User_ID`),
  ADD CONSTRAINT `orders_ibfk_2` FOREIGN KEY (`User_ID`) REFERENCES `users` (`User_ID`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `order_availability_slots`
--
ALTER TABLE `order_availability_slots`
  ADD CONSTRAINT `order_availability_slots_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`Order_ID`) ON DELETE CASCADE;

--
-- Constraints for table `products`
--
ALTER TABLE `products`
  ADD CONSTRAINT `fk_products_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`Category_ID`) ON UPDATE CASCADE;

--
-- Constraints for table `product_reviews`
--
ALTER TABLE `product_reviews`
  ADD CONSTRAINT `fk_product_reviews_order` FOREIGN KEY (`Order_ID`) REFERENCES `orders` (`Order_ID`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_product_reviews_product` FOREIGN KEY (`Product_ID`) REFERENCES `products` (`Product_ID`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_product_reviews_user` FOREIGN KEY (`User_ID`) REFERENCES `users` (`User_ID`) ON DELETE CASCADE;

--
-- Constraints for table `product_variations`
--
ALTER TABLE `product_variations`
  ADD CONSTRAINT `product_variations_ibfk_1` FOREIGN KEY (`Product_ID`) REFERENCES `products` (`Product_ID`),
  ADD CONSTRAINT `product_variations_ibfk_2` FOREIGN KEY (`Product_ID`) REFERENCES `products` (`Product_ID`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `transactions`
--
ALTER TABLE `transactions`
  ADD CONSTRAINT `fk_transactions_order` FOREIGN KEY (`Order_ID`) REFERENCES `orders` (`Order_ID`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `transaction_items`
--
ALTER TABLE `transaction_items`
  ADD CONSTRAINT `fk_transaction_items_order` FOREIGN KEY (`Order_ID`) REFERENCES `orders` (`Order_ID`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `transaction_items_ibfk_2` FOREIGN KEY (`Product_ID`) REFERENCES `products` (`Product_ID`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
