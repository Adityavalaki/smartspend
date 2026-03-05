<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(); }

if (!isLoggedIn()) {
    http_response_code(401);
    echo json_encode(array('error' => 'Not authenticated'));
    exit();
}

try {
    $pdo = new PDO(
        "mysql:host=".DB_HOST.";port=".DB_PORT.";dbname=".DB_NAME.";charset=utf8mb4",
        DB_USER, DB_PASS,
        array(PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES=>false)
    );
} catch (PDOException $e) {
    http_response_code(503);
    echo json_encode(array('error'=>'DB unavailable'));
    exit();
}

function resp($d, $c=200) { http_response_code($c); echo json_encode($d, JSON_UNESCAPED_UNICODE); exit(); }
function body() { return json_decode(file_get_contents('php://input'),true) ?: array(); }
function method() { return $_SERVER['REQUEST_METHOD']; }
function q($s) { return htmlspecialchars(trim($s), ENT_QUOTES, 'UTF-8'); }
function validMode($m) { return in_array($m, array('cash','upi','credit_card','debit_card','net_banking'), true); }
