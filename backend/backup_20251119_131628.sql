mysqldump: [Warning] Using a password on the command line interface can be insecure.
Warning: A partial dump from a server that has GTIDs will by default include the GTIDs of all transactions, even those that changed suppressed parts of the database. If you don't want to restore GTIDs, pass --set-gtid-purged=OFF. To make a complete dump, pass --all-databases --triggers --routines --events. 
Warning: A dump from a server that has GTIDs enabled will by default include the GTIDs of all transactions, even those that were executed during its extraction and might not be represented in the dumped data. This might result in an inconsistent data dump. 
In order to ensure a consistent backup of the database, pass --single-transaction or --lock-all-tables or --source-data. 
-- MySQL dump 10.13  Distrib 9.5.0, for macos15.7 (arm64)
--
-- Host: localhost    Database: sixsoft_hrm
-- ------------------------------------------------------
-- Server version	9.5.0

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
SET @MYSQLDUMP_TEMP_LOG_BIN = @@SESSION.SQL_LOG_BIN;
SET @@SESSION.SQL_LOG_BIN= 0;

--
-- GTID state at the beginning of the backup 
--

SET @@GLOBAL.GTID_PURGED=/*!80000 '+'*/ '83ae96f0-c3fe-11f0-b0b2-59a84048a76c:1-878';

--
-- Table structure for table `_prisma_migrations`
--

DROP TABLE IF EXISTS `_prisma_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `_prisma_migrations` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `checksum` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `finished_at` datetime(3) DEFAULT NULL,
  `migration_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `logs` text COLLATE utf8mb4_unicode_ci,
  `rolled_back_at` datetime(3) DEFAULT NULL,
  `started_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `applied_steps_count` int unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `_prisma_migrations`
--

LOCK TABLES `_prisma_migrations` WRITE;
/*!40000 ALTER TABLE `_prisma_migrations` DISABLE KEYS */;
INSERT INTO `_prisma_migrations` VALUES ('1c436ec6-dfed-4679-bac3-f8e63a46febf','8a3d64c3498e6fd62b5b4d032ef77a282c9ed33672c29b9e7654cb02487f0159','2025-11-18 16:06:10.710','20251118160610_add_bank_and_emergency_info',NULL,NULL,'2025-11-18 16:06:10.686',1),('56f43bb5-e5e1-499e-a881-3b3f54e11d56','ae9bacbbedff363126c7ca79f2af8404a38b602b899c39a3bcd54a9764bf2bd3','2025-11-18 21:50:37.607','20251118215037_add_gdpr_compliance',NULL,NULL,'2025-11-18 21:50:37.600',1),('9761aaed-971a-4f29-a2e5-b123f605fa82','99d5be60bca39a124cd47f2bce4b4a073491a507b47969fc8c50890d061a205e','2025-11-17 21:50:11.976','20251117215011_init',NULL,NULL,'2025-11-17 21:50:11.809',1),('deb3d6f4-9afd-423e-b940-7adfc5483ee8','4deb85deb538f9f91758bc97b0f35f5dfe8329ab5d669e13292f7954b1c6aac7','2025-11-19 09:32:00.293','20251119093200_add_document_expiry',NULL,NULL,'2025-11-19 09:32:00.283',1);
/*!40000 ALTER TABLE `_prisma_migrations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `AuditLog`
--

DROP TABLE IF EXISTS `AuditLog`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `AuditLog` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int DEFAULT NULL,
  `userEmail` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entityId` int DEFAULT NULL,
  `details` text COLLATE utf8mb4_unicode_ci,
  `ipAddress` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `userAgent` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `timestamp` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=102 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `AuditLog`
--

LOCK TABLES `AuditLog` WRITE;
/*!40000 ALTER TABLE `AuditLog` DISABLE KEYS */;
INSERT INTO `AuditLog` VALUES (1,NULL,'admin@test.com','LOGIN_FAILED','User',NULL,'Invalid email','::1','node','2025-11-18 22:01:37.884'),(2,1,'admin@example.com','LOGIN_SUCCESS','User',1,NULL,'::1','node','2025-11-18 22:03:47.209'),(3,1,'admin@example.com','LOGIN_FAILED','User',1,'Invalid password','::1','node','2025-11-18 22:03:47.286'),(4,1,'admin@example.com','READ','AuditLog',NULL,'{\"count\":3}','::1','node','2025-11-18 22:03:47.294'),(5,1,'admin@example.com','CREATE','Employee',6,'{\"firstName\":\"Test\",\"lastName\":\"GDPR\",\"email\":\"test-gdpr-1763503427326@example.com\"}','::1','node','2025-11-18 22:03:47.331'),(6,1,'admin@example.com','DATA_EXPORT','Employee',6,'{\"type\":\"Subject Access Request\"}','::1','node','2025-11-18 22:03:47.354'),(7,1,'admin@example.com','CONSENT_GIVEN','DataConsent',1,'{\"consentType\":\"data_processing\",\"employeeId\":6}','::1','node','2025-11-18 22:03:47.360'),(8,1,'admin@example.com','DATA_EXPORT','Employee',6,'{\"type\":\"Subject Access Request\"}','::1','node','2025-11-18 22:03:47.366'),(9,1,'admin@example.com','UPDATE','Employee',6,'{\"updatedFields\":[\"jobTitle\"]}','::1','node','2025-11-18 22:03:47.374'),(10,1,'admin@example.com','DELETE','Employee',6,'{\"deletedEmployee\":\"Test GDPR\"}','::1','node','2025-11-18 22:03:47.379'),(11,1,'admin@example.com','READ','AuditLog',NULL,'{\"count\":10}','::1','node','2025-11-18 22:03:47.383'),(12,3,'wonderfull@gmail.com','READ','Employee',5,'{\"selfAccess\":true}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-18 22:04:21.080'),(13,1,'admin@example.com','LOGIN_SUCCESS','User',1,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-18 22:04:53.235'),(14,1,'admin@example.com','READ','Employee',NULL,'{\"count\":4}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-18 22:04:53.356'),(15,1,'admin@example.com','READ','AuditLog',NULL,'{\"count\":14}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-18 22:05:05.623'),(16,1,'admin@example.com','READ','Employee',NULL,'{\"count\":4}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-18 22:05:24.271'),(17,1,'admin@example.com','READ','Employee',NULL,'{\"count\":4}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-18 22:05:28.236'),(18,1,'admin@example.com','READ','Employee',NULL,'{\"count\":4}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-18 22:05:29.092'),(19,1,'admin@example.com','READ','Employee',NULL,'{\"count\":4}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-18 22:05:30.937'),(20,1,'admin@example.com','READ','Employee',NULL,'{\"count\":4}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-18 22:05:33.049'),(21,1,'admin@example.com','READ','Employee',NULL,'{\"count\":4}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-18 22:05:34.419'),(22,1,'admin@example.com','READ','Employee',NULL,'{\"count\":4}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-18 22:05:37.348'),(23,1,'admin@example.com','READ','Employee',NULL,'{\"count\":4}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-18 22:05:39.094'),(24,1,'admin@example.com','READ','Employee',NULL,'{\"count\":4}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-18 22:05:41.027'),(25,1,'admin@example.com','READ','AuditLog',NULL,'{\"count\":24}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-18 22:05:42.470'),(26,1,'admin@example.com','READ','AuditLog',NULL,'{\"count\":25}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-18 22:08:03.892'),(27,1,'admin@example.com','READ','AuditLog',NULL,'{\"count\":26}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-18 22:20:55.644'),(28,1,'admin@example.com','READ','AuditLog',NULL,'{\"count\":27}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-18 22:27:40.803'),(29,1,'admin@example.com','LOGIN_SUCCESS','User',1,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 08:53:02.150'),(30,1,'admin@example.com','READ','Employee',NULL,'{\"count\":4}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 08:53:02.299'),(31,1,'admin@example.com','READ','Employee',NULL,'{\"count\":4}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 08:53:23.595'),(32,1,'admin@example.com','READ','Employee',NULL,'{\"count\":4}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 08:53:25.573'),(33,1,'admin@example.com','READ','Employee',NULL,'{\"count\":4}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 08:53:36.931'),(34,1,'admin@example.com','READ','Employee',NULL,'{\"count\":4}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 08:53:51.846'),(35,1,'admin@example.com','READ','Employee',NULL,'{\"count\":4}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 08:54:19.510'),(36,1,'admin@example.com','READ','Employee',NULL,'{\"count\":4}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 08:55:51.957'),(37,1,'admin@example.com','READ','Employee',NULL,'{\"count\":4}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 08:56:14.494'),(38,1,'admin@example.com','READ','Employee',NULL,'{\"count\":4}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 08:56:46.648'),(39,1,'admin@example.com','READ','Employee',NULL,'{\"count\":4}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 08:56:55.556'),(40,1,'admin@example.com','READ','AuditLog',NULL,'{\"count\":39}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 08:56:59.048'),(41,1,'admin@example.com','READ','AuditLog',NULL,'{\"count\":0}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 08:58:12.887'),(42,1,'admin@example.com','READ','AuditLog',NULL,'{\"count\":41}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 08:58:13.899'),(43,1,'admin@example.com','READ','Employee',NULL,'{\"count\":4}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 08:58:21.550'),(44,1,'admin@example.com','READ','Employee',NULL,'{\"count\":4}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 08:58:24.969'),(45,1,'admin@example.com','READ','Employee',NULL,'{\"count\":4}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 08:59:46.062'),(46,1,'admin@example.com','READ','Employee',NULL,'{\"count\":4}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 09:00:11.973'),(47,1,'admin@example.com','READ','Employee',NULL,'{\"count\":4}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 09:18:01.939'),(48,1,'admin@example.com','READ','Employee',NULL,'{\"count\":4}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 09:18:01.959'),(49,1,'admin@example.com','READ','Employee',NULL,'{\"count\":4}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 09:18:47.944'),(50,1,'admin@example.com','READ','Employee',NULL,'{\"count\":4}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 09:18:49.311'),(51,1,'admin@example.com','READ','Employee',NULL,'{\"count\":4}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 10:31:32.258'),(52,1,'admin@example.com','READ','Employee',NULL,'{\"count\":4}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 10:31:38.050'),(53,1,'admin@example.com','READ','Employee',NULL,'{\"count\":4}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 10:31:47.717'),(54,1,'admin@example.com','READ','Employee',NULL,'{\"count\":4}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 10:32:49.809'),(55,1,'admin@example.com','READ','Employee',NULL,'{\"count\":4}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 10:33:01.708'),(56,1,'admin@example.com','READ','Employee',NULL,'{\"count\":4}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 10:35:09.337'),(57,1,'admin@example.com','READ','Employee',NULL,'{\"count\":4}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 10:35:44.325'),(58,1,'admin@example.com','READ','Employee',NULL,'{\"count\":4}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 12:38:24.859'),(59,1,'admin@example.com','READ','Employee',NULL,'{\"count\":4}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 12:38:38.490'),(60,1,'admin@example.com','READ','Employee',NULL,'{\"count\":4}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 12:38:45.090'),(61,1,'admin@example.com','READ','Employee',NULL,'{\"count\":4}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 12:39:09.123'),(62,1,'admin@example.com','READ','Employee',NULL,'{\"count\":4}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 12:40:56.245'),(63,1,'admin@example.com','READ','Employee',NULL,'{\"count\":4}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 12:44:32.965'),(64,1,'admin@example.com','READ','Employee',NULL,'{\"count\":4}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 12:45:23.006'),(65,1,'admin@example.com','READ','Employee',NULL,'{\"count\":4}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 12:45:27.716'),(66,1,'admin@example.com','READ','Employee',NULL,'{\"count\":4}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 12:45:28.757'),(67,1,'admin@example.com','READ','Employee',NULL,'{\"count\":4}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 12:46:20.221'),(68,1,'admin@example.com','LOGIN_SUCCESS','User',1,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 12:57:25.828'),(69,1,'admin@example.com','READ','Employee',NULL,'{\"count\":7}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 12:57:26.120'),(70,1,'admin@example.com','READ','Employee',NULL,'{\"count\":7}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 12:58:05.285'),(71,1,'admin@example.com','READ','Employee',NULL,'{\"count\":7}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 12:58:14.194'),(72,1,'admin@example.com','READ','Employee',NULL,'{\"count\":7}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 12:58:33.503'),(73,1,'admin@example.com','READ','Employee',NULL,'{\"count\":7}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 12:58:36.692'),(74,1,'admin@example.com','READ','Employee',NULL,'{\"count\":7}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 12:58:40.292'),(75,1,'admin@example.com','READ','Employee',NULL,'{\"count\":7}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 12:58:41.243'),(76,1,'admin@example.com','READ','AuditLog',NULL,'{\"count\":50}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 13:00:48.533'),(77,1,'admin@example.com','READ','AuditLog',NULL,'{\"count\":1}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 13:00:58.780'),(78,1,'admin@example.com','READ','AuditLog',NULL,'{\"count\":50}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 13:01:02.774'),(79,1,'admin@example.com','READ','Employee',NULL,'{\"count\":1}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 13:09:36.283'),(80,1,'admin@example.com','READ','Employee',NULL,'{\"count\":1}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 13:09:41.887'),(81,1,'admin@example.com','READ','Employee',NULL,'{\"count\":1}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 13:09:42.560'),(82,1,'admin@example.com','READ','Employee',NULL,'{\"count\":1}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 13:09:44.009'),(83,1,'admin@example.com','READ','Employee',NULL,'{\"count\":1}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 13:09:44.783'),(84,1,'admin@example.com','READ','AuditLog',NULL,'{\"count\":50}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 13:09:51.122'),(85,1,'admin@example.com','READ','Employee',NULL,'{\"count\":1}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 13:10:33.113'),(86,1,'admin@example.com','READ','Employee',NULL,'{\"count\":1}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 13:10:46.218'),(87,1,'admin@example.com','READ','Employee',NULL,'{\"count\":1}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 13:11:00.997'),(88,1,'admin@example.com','READ','Employee',NULL,'{\"count\":1}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 13:11:01.592'),(89,1,'admin@example.com','READ','AuditLog',NULL,'{\"count\":50}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 13:11:06.847'),(90,1,'admin@example.com','READ','Employee',NULL,'{\"count\":1}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 13:11:07.841'),(91,1,'admin@example.com','READ','Employee',NULL,'{\"count\":1}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 13:11:10.833'),(92,1,'admin@example.com','READ','Employee',NULL,'{\"count\":1}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 13:11:11.434'),(93,1,'admin@example.com','READ','Employee',NULL,'{\"count\":1}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 13:11:13.212'),(94,1,'admin@example.com','READ','Employee',NULL,'{\"count\":1}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 13:11:14.034'),(95,1,'admin@example.com','READ','Employee',NULL,'{\"count\":1}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 13:14:02.508'),(96,1,'admin@example.com','READ','Employee',NULL,'{\"count\":1}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 13:14:24.187'),(97,1,'admin@example.com','LOGIN_SUCCESS','User',1,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 13:14:41.105'),(98,1,'admin@example.com','READ','Employee',NULL,'{\"count\":1}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 13:14:41.266'),(99,1,'admin@example.com','READ','Employee',NULL,'{\"count\":1}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 13:14:47.936'),(100,1,'admin@example.com','READ','Employee',NULL,'{\"count\":1}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 13:14:50.360'),(101,1,'admin@example.com','READ','Employee',NULL,'{\"count\":1}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2025-11-19 13:14:50.781');
/*!40000 ALTER TABLE `AuditLog` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `DataConsent`
--

DROP TABLE IF EXISTS `DataConsent`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `DataConsent` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employeeId` int NOT NULL,
  `consentType` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `consentGiven` tinyint(1) NOT NULL DEFAULT '0',
  `consentDate` datetime(3) DEFAULT NULL,
  `withdrawnDate` datetime(3) DEFAULT NULL,
  `ipAddress` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `version` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `DataConsent`
--

LOCK TABLES `DataConsent` WRITE;
/*!40000 ALTER TABLE `DataConsent` DISABLE KEYS */;
INSERT INTO `DataConsent` VALUES (1,6,'data_processing',1,'2025-11-18 22:03:47.358',NULL,'::1','1.0','2025-11-18 22:03:47.358','2025-11-18 22:03:47.358');
/*!40000 ALTER TABLE `DataConsent` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Document`
--

DROP TABLE IF EXISTS `Document`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Document` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employeeId` int NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `path` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `uploadedAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `expiryDate` datetime(3) DEFAULT NULL,
  `type` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `Document_employeeId_fkey` (`employeeId`),
  CONSTRAINT `Document_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=67 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Document`
--

LOCK TABLES `Document` WRITE;
/*!40000 ALTER TABLE `Document` DISABLE KEYS */;
/*!40000 ALTER TABLE `Document` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Employee`
--

DROP TABLE IF EXISTS `Employee`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Employee` (
  `id` int NOT NULL AUTO_INCREMENT,
  `firstName` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `lastName` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phoneNumber` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `niNumber` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `jobTitle` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `employeeType` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'EMPLOYEE',
  `department` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `startDate` datetime(3) DEFAULT NULL,
  `endDate` datetime(3) DEFAULT NULL,
  `accountNumber` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bankName` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `emergencyContactAddress` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `emergencyContactName` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `emergencyContactPhone` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `emergencyContactRelation` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sortCode` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `Employee_email_key` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=42 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Employee`
--

LOCK TABLES `Employee` WRITE;
/*!40000 ALTER TABLE `Employee` DISABLE KEYS */;
INSERT INTO `Employee` VALUES (41,'Test','Employee','test@timesheets.com',NULL,NULL,'Developer','EMPLOYEE',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);
/*!40000 ALTER TABLE `Employee` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `GoogleAccount`
--

DROP TABLE IF EXISTS `GoogleAccount`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `GoogleAccount` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `refreshToken` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `accessToken` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `scope` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `expiry` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `GoogleAccount_userId_key` (`userId`),
  CONSTRAINT `GoogleAccount_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `GoogleAccount`
--

LOCK TABLES `GoogleAccount` WRITE;
/*!40000 ALTER TABLE `GoogleAccount` DISABLE KEYS */;
/*!40000 ALTER TABLE `GoogleAccount` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `LeaveRequest`
--

DROP TABLE IF EXISTS `LeaveRequest`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `LeaveRequest` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employeeId` int NOT NULL,
  `type` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `startDate` datetime(3) NOT NULL,
  `endDate` datetime(3) NOT NULL,
  `status` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `reason` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `LeaveRequest_employeeId_fkey` (`employeeId`),
  CONSTRAINT `LeaveRequest_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `LeaveRequest`
--

LOCK TABLES `LeaveRequest` WRITE;
/*!40000 ALTER TABLE `LeaveRequest` DISABLE KEYS */;
/*!40000 ALTER TABLE `LeaveRequest` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Project`
--

DROP TABLE IF EXISTS `Project`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Project` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `Project_code_key` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Project`
--

LOCK TABLES `Project` WRITE;
/*!40000 ALTER TABLE `Project` DISABLE KEYS */;
/*!40000 ALTER TABLE `Project` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Sponsorship`
--

DROP TABLE IF EXISTS `Sponsorship`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Sponsorship` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employeeId` int NOT NULL,
  `visaType` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `casNumber` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sponsorLicenseNumber` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `startDate` datetime(3) NOT NULL,
  `endDate` datetime(3) DEFAULT NULL,
  `complianceNotes` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `Sponsorship_employeeId_fkey` (`employeeId`),
  CONSTRAINT `Sponsorship_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=32 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Sponsorship`
--

LOCK TABLES `Sponsorship` WRITE;
/*!40000 ALTER TABLE `Sponsorship` DISABLE KEYS */;
/*!40000 ALTER TABLE `Sponsorship` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Timesheet`
--

DROP TABLE IF EXISTS `Timesheet`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Timesheet` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employeeId` int NOT NULL,
  `projectId` int DEFAULT NULL,
  `date` datetime(3) NOT NULL,
  `hours` double NOT NULL,
  `notes` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `Timesheet_employeeId_fkey` (`employeeId`),
  KEY `Timesheet_projectId_fkey` (`projectId`),
  CONSTRAINT `Timesheet_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `Timesheet_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=105 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Timesheet`
--

LOCK TABLES `Timesheet` WRITE;
/*!40000 ALTER TABLE `Timesheet` DISABLE KEYS */;
INSERT INTO `Timesheet` VALUES (100,41,NULL,'2025-11-20 00:00:00.000',6,NULL);
/*!40000 ALTER TABLE `Timesheet` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `User`
--

DROP TABLE IF EXISTS `User`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `User` (
  `id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'USER',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `User_email_key` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `User`
--

LOCK TABLES `User` WRITE;
/*!40000 ALTER TABLE `User` DISABLE KEYS */;
INSERT INTO `User` VALUES (1,'admin@example.com','$2a$10$5DQ5gw5k7ciPkwDIZ5xGteuiPVvebX/EbBpBant8d35iojAgiCmAe','Admin User','ADMIN','2025-11-17 21:51:10.934'),(2,'manager@example.com','$2a$10$5DQ5gw5k7ciPkwDIZ5xGteuiPVvebX/EbBpBant8d35iojAgiCmAe','Manager User','MANAGER','2025-11-17 21:51:10.946'),(3,'wonderfull@gmail.com','$2a$10$A8IP4Jyqt.vC5m8mTgWQ3.ZINUCrOvpIRxRzhz93Q8azYXOwcMcUu','kiran','USER','2025-11-18 20:36:25.477');
/*!40000 ALTER TABLE `User` ENABLE KEYS */;
UNLOCK TABLES;
SET @@SESSION.SQL_LOG_BIN = @MYSQLDUMP_TEMP_LOG_BIN;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-11-19 13:16:28
