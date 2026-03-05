<?php
// SmartSpend v5 — Auth Helper (PHP 5.6+ compatible)

if (session_status() === PHP_SESSION_NONE) {
    ini_set('session.cookie_lifetime', 86400 * 30);
    ini_set('session.cookie_httponly', 1);
    ini_set('session.use_strict_mode', 1);
    session_start();
}

function isLoggedIn() {
    return !empty($_SESSION['ss_user_id']);
}

function currentUser() {
    return array(
        'id'       => isset($_SESSION['ss_user_id'])    ? $_SESSION['ss_user_id']    : 0,
        'name'     => isset($_SESSION['ss_user_name'])  ? $_SESSION['ss_user_name']  : '',
        'email'    => isset($_SESSION['ss_user_email']) ? $_SESSION['ss_user_email'] : '',
        'is_admin' => isset($_SESSION['ss_is_admin'])   ? $_SESSION['ss_is_admin']   : false,
    );
}

function requireLogin() {
    if (!isLoggedIn()) {
        header('Location: ../login.php');
        exit();
    }
}

function requireLoginRoot() {
    if (!isLoggedIn()) {
        header('Location: login.php');
        exit();
    }
}

function uid() {
    return (int)(isset($_SESSION['ss_user_id']) ? $_SESSION['ss_user_id'] : 0);
}
