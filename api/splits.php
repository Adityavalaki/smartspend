<?php
require_once '../includes/db.php';
switch(method()){
case 'GET':
    $splits=$pdo->query("SELECT s.*,GROUP_CONCAT(sp.name,'::',sp.amount ORDER BY sp.id SEPARATOR '||') AS pd FROM ss_splits s LEFT JOIN ss_split_people sp ON s.id=sp.split_id GROUP BY s.id ORDER BY s.created_at DESC")->fetchAll();
    foreach($splits as &$s){
        $s['total_amount']=(float)$s['total_amount']; $s['people']=[];
        if($s['pd']){ foreach(explode('||',$s['pd']) as $p){ [$n,$a]=explode('::',$p); $s['people'][]=['name'=>$n,'amount'=>(float)$a]; } }
        unset($s['pd']);
    }
    resp(['splits'=>$splits]); break;
case 'POST':
    $d=body();
    if(empty($d['description'])||empty($d['total_amount'])||empty($d['people'])) resp(['error'=>'description,total_amount,people required'],422);
    if(count($d['people'])<2) resp(['error'=>'At least 2 people'],422);
    $pdo->beginTransaction();
    try {
        $pdo->prepare("INSERT INTO ss_splits(description,total_amount,split_date) VALUES(?,?,?)")->execute([q($d['description']),(float)$d['total_amount'],date('Y-m-d')]);
        $sid=$pdo->lastInsertId(); $ps=$pdo->prepare("INSERT INTO ss_split_people(split_id,name,amount) VALUES(?,?,?)");
        foreach($d['people'] as $p) $ps->execute([$sid,q($p['name']),(float)$p['amount']]);
        $pdo->commit(); resp(['status'=>'created','id'=>(int)$sid],201);
    } catch(Exception $e){ $pdo->rollBack(); resp(['error'=>$e->getMessage()],500); }
    break;
case 'DELETE':
    $id=(int)($_GET['id']??0); if(!$id) resp(['error'=>'id required'],422);
    $pdo->prepare("DELETE FROM ss_splits WHERE id=?")->execute([$id]); resp(['status'=>'deleted']); break;
default: resp(['error'=>'Method not allowed'],405);
}
