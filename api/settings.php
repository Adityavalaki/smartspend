<?php
require_once '../includes/db.php';
switch(method()){
case 'GET':
    $rows=$pdo->query("SELECT setting_key,setting_value FROM ss_settings")->fetchAll();
    $s=[]; foreach($rows as $r) $s[$r['setting_key']]=$r['setting_value'];
    resp(['settings'=>$s]); break;
case 'POST':
    $d=body(); $stmt=$pdo->prepare("INSERT INTO ss_settings(setting_key,setting_value) VALUES(?,?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value),updated_at=NOW()");
    foreach($d as $k=>$v) $stmt->execute([$k,$v]);
    resp(['status'=>'saved']); break;
default: resp(['error'=>'Method not allowed'],405);
}
