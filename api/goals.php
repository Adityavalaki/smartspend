<?php
require_once '../includes/db.php';
switch(method()){
case 'GET':
    $rows=$pdo->query("SELECT * FROM ss_goals ORDER BY created_at DESC")->fetchAll();
    foreach($rows as &$r){ $r['target_amount']=(float)$r['target_amount']; $r['saved_amount']=(float)$r['saved_amount']; }
    resp(['goals'=>$rows]); break;
case 'POST':
    $d=body();
    if(empty($d['name'])||empty($d['target_amount'])||empty($d['target_date'])) resp(['error'=>'name,target_amount,target_date required'],422);
    $stmt=$pdo->prepare("INSERT INTO ss_goals(name,target_amount,saved_amount,target_date) VALUES(?,?,?,?)");
    $stmt->execute([q($d['name']),(float)$d['target_amount'],(float)($d['saved_amount']??0),$d['target_date']]);
    $id=$pdo->lastInsertId(); $row=$pdo->query("SELECT * FROM ss_goals WHERE id=$id")->fetch();
    $row['target_amount']=(float)$row['target_amount']; $row['saved_amount']=(float)$row['saved_amount'];
    resp(['status'=>'created','goal'=>$row],201); break;
case 'PUT':
    $id=(int)($_GET['id']??0); if(!$id) resp(['error'=>'id required'],422); $d=body();
    $pdo->prepare("UPDATE ss_goals SET saved_amount=? WHERE id=?")->execute([(float)$d['saved_amount'],$id]);
    resp(['status'=>'updated']); break;
case 'DELETE':
    $id=(int)($_GET['id']??0); if(!$id) resp(['error'=>'id required'],422);
    $pdo->prepare("DELETE FROM ss_goals WHERE id=?")->execute([$id]); resp(['status'=>'deleted']); break;
default: resp(['error'=>'Method not allowed'],405);
}
