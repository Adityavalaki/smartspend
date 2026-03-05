<?php
require_once '../includes/db.php';
$action=$_GET['action']??'get';

switch(method()){
case 'GET':
    if($action==='transfers'){
        $rows=$pdo->query("SELECT * FROM ss_transfers ORDER BY tx_date DESC,created_at DESC LIMIT 100")->fetchAll();
        foreach($rows as &$r) $r['amount']=(float)$r['amount'];
        resp(['transfers'=>$rows]);
    } else {
        $rows=$pdo->query("SELECT * FROM ss_wallets ORDER BY name")->fetchAll();
        $wallets=[];
        foreach($rows as $r) $wallets[$r['name']]=(float)$r['balance'];
        $m=(int)date('n'); $y=(int)date('Y');
        $stmt=$pdo->prepare("SELECT
            COALESCE(SUM(CASE WHEN pay_mode='cash' AND type='expense' THEN amount ELSE 0 END),0) AS cash_out,
            COALESCE(SUM(CASE WHEN pay_mode!='cash' AND type='expense' THEN amount ELSE 0 END),0) AS digital_out,
            COALESCE(SUM(CASE WHEN pay_mode='cash' AND type='income' THEN amount ELSE 0 END),0) AS cash_in,
            COALESCE(SUM(CASE WHEN pay_mode!='cash' AND type='income' THEN amount ELSE 0 END),0) AS digital_in
            FROM ss_transactions WHERE MONTH(tx_date)=? AND YEAR(tx_date)=?");
        $stmt->execute([$m,$y]); $monthly=$stmt->fetch();
        foreach($monthly as &$v) $v=(float)$v;
        resp(['wallets'=>$wallets,'monthly'=>$monthly]);
    }
    break;

case 'POST':
    $d=body();
    if($action==='set_balance'){
        $w=in_array($d['wallet']??'',['cash','digital'])?$d['wallet']:null;
        if(!$w) resp(['error'=>'wallet required'],422);
        $bal=round((float)($d['balance']??0),2);
        if($bal<0) resp(['error'=>'Balance cannot be negative'],422);
        $pdo->prepare("UPDATE ss_wallets SET balance=? WHERE name=?")->execute([$bal,$w]);
        resp(['status'=>'updated','wallet'=>$w,'balance'=>$bal]);

    } elseif($action==='transfer'){
        $from=$d['from']??''; $to=$d['to']??'';
        $amt=round((float)($d['amount']??0),2);
        if(!in_array($from,['cash','digital'])||!in_array($to,['cash','digital'])) resp(['error'=>'Invalid wallets'],422);
        if($from===$to) resp(['error'=>'Cannot transfer to same wallet'],422);
        if($amt<=0) resp(['error'=>'Amount must be positive'],422);
        $bal=(float)$pdo->query("SELECT balance FROM ss_wallets WHERE name='$from'")->fetchColumn();
        if($bal<$amt) resp(['error'=>"Insufficient $from balance (available: $bal)"],422);
        $pdo->beginTransaction();
        try {
            $pdo->prepare("UPDATE ss_wallets SET balance=balance-? WHERE name=?")->execute([$amt,$from]);
            $pdo->prepare("UPDATE ss_wallets SET balance=balance+? WHERE name=?")->execute([$amt,$to]);
            $pdo->prepare("INSERT INTO ss_transfers(from_wallet,to_wallet,amount,note,tx_date) VALUES(?,?,?,?,?)")
                ->execute([$from,$to,$amt,q($d['note']??''),date('Y-m-d')]);
            $pdo->commit();
            resp(['status'=>'transferred','from'=>$from,'to'=>$to,'amount'=>$amt]);
        } catch(Exception $e){ $pdo->rollBack(); resp(['error'=>$e->getMessage()],500); }
    }
    break;

default: resp(['error'=>'Method not allowed'],405);
}
