<?php
require_once '../includes/db.php';
$uid = uid();

switch(method()){
case 'GET':
    $w=['user_id=?']; $p=[$uid];
    if(!empty($_GET['month'])&&!empty($_GET['year'])){ $w[]='MONTH(tx_date)=?'; $p[]=(int)$_GET['month']; $w[]='YEAR(tx_date)=?'; $p[]=(int)$_GET['year']; }
    if(!empty($_GET['type'])&&in_array($_GET['type'],['expense','income'])){ $w[]='type=?'; $p[]=$_GET['type']; }
    if(!empty($_GET['pay_mode'])&&validMode($_GET['pay_mode'])){ $w[]='pay_mode=?'; $p[]=$_GET['pay_mode']; }
    if(!empty($_GET['search'])){ $w[]='(category LIKE ? OR description LIKE ?)'; $p[]='%'.$_GET['search'].'%'; $p[]='%'.$_GET['search'].'%'; }
    $lim=min((int)($_GET['limit']??2000),10000); $off=(int)($_GET['offset']??0);
    $ws=implode(' AND ',$w);
    $stmt=$pdo->prepare("SELECT * FROM ss_transactions WHERE $ws ORDER BY tx_date DESC,id DESC LIMIT $lim OFFSET $off");
    $stmt->execute($p); $rows=$stmt->fetchAll();
    foreach($rows as &$r){ $r['amount']=(float)$r['amount']; $r['recurring']=(bool)(int)$r['recurring']; }
    $s=$pdo->prepare("SELECT
        COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END),0) AS total_income,
        COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END),0) AS total_expense,
        COUNT(*) AS total_count,
        COALESCE(SUM(CASE WHEN pay_mode='cash' AND type='expense' THEN amount ELSE 0 END),0) AS cash_expense,
        COALESCE(SUM(CASE WHEN pay_mode!='cash' AND type='expense' THEN amount ELSE 0 END),0) AS digital_expense,
        COALESCE(SUM(CASE WHEN pay_mode='cash' AND type='income' THEN amount ELSE 0 END),0) AS cash_income,
        COALESCE(SUM(CASE WHEN pay_mode!='cash' AND type='income' THEN amount ELSE 0 END),0) AS digital_income
        FROM ss_transactions WHERE $ws");
    $s->execute($p); $totals=$s->fetch();
    foreach($totals as &$v) $v=(float)$v;
    resp(['transactions'=>$rows,'totals'=>$totals]);
    break;

case 'POST':
    $d=body();
    if(empty($d['amount'])||empty($d['category'])||empty($d['type'])||empty($d['date'])) resp(['error'=>'required fields missing'],422);
    if((float)$d['amount']<=0) resp(['error'=>'Amount must be positive'],422);
    if(!in_array($d['type'],['income','expense'])) resp(['error'=>'Invalid type'],422);
    $pm=isset($d['pay_mode'])&&validMode($d['pay_mode'])?$d['pay_mode']:'cash';
    $stmt=$pdo->prepare("INSERT INTO ss_transactions(user_id,amount,category,type,pay_mode,tx_date,description,recurring) VALUES(?,?,?,?,?,?,?,?)");
    $stmt->execute([$uid,round((float)$d['amount'],2),q($d['category']),$d['type'],$pm,$d['date'],q($d['description']??''),(int)(bool)($d['recurring']??false)]);
    $id=$pdo->lastInsertId();
    $row=$pdo->query("SELECT * FROM ss_transactions WHERE id=$id")->fetch();
    $row['amount']=(float)$row['amount']; $row['recurring']=(bool)(int)$row['recurring'];
    resp(['status'=>'created','transaction'=>$row],201);
    break;

case 'DELETE':
    $id=(int)($_GET['id']??0);
    if(!$id) resp(['error'=>'id required'],422);
    $pdo->prepare("DELETE FROM ss_transactions WHERE id=? AND user_id=?")->execute([$id,$uid]);
    resp(['status'=>'deleted']);
    break;

default: resp(['error'=>'Method not allowed'],405);
}
