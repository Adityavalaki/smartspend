<?php
require_once __DIR__ . '/includes/auth.php';
$_SESSION = array();
session_destroy();
header('Location: login.php');
exit();
