<?php
require_once '../includes/db.php'; $uid=uid();
$action=$_GET['action']??'summary';
$month=(int)($_GET['month']??date('n'));
$year=(int)($_GET['year']??date('Y'));
$budget=(float)($_GET['budget']??5000);
switch($action){
case 'summary':
    $stmt=$pdo->prepare("SELECT type,pay_mode,SUM(amount) AS total FROM ss_transactions WHERE user_id=? AND MONTH(tx_date)=? AND YEAR(tx_date)=? GROUP BY type,pay_mode"); $stmt->execute([$uid,$month,$year]); $rows=$stmt->fetchAll();
    $monthly=['income'=>0,'expense'=>0,'cash_expense'=>0,'digital_expense'=>0,'cash_income'=>0,'digital_income'=>0];
    foreach($rows as $r){ $monthly[$r['type']]+=(float)$r['total']; if($r['type']==='expense') $monthly[$r['pay_mode']==='cash'?'cash_expense':'digital_expense']+=(float)$r['total']; else $monthly[$r['pay_mode']==='cash'?'cash_income':'digital_income']+=(float)$r['total']; }
    $stmt=$pdo->prepare("SELECT category,SUM(amount) AS total FROM ss_transactions WHERE user_id=? AND MONTH(tx_date)=? AND YEAR(tx_date)=? AND type='expense' GROUP BY category ORDER BY total DESC"); $stmt->execute([$uid,$month,$year]);
    $cats=array_map(function($r){ return array('category'=>$r['category'],'total'=>(float)$r['total']); }, $stmt->fetchAll());
    resp(['monthly'=>$monthly,'categories'=>$cats]); break;
case 'insights':
    $stmt=$pdo->prepare("SELECT COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END),0) AS exp, COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END),0) AS inc FROM ss_transactions WHERE user_id=? AND MONTH(tx_date)=? AND YEAR(tx_date)=?"); $stmt->execute([$uid,$month,$year]); $t=$stmt->fetch(); $exp=(float)$t['exp']; $inc=(float)$t['inc'];
    $pct=$budget>0?($exp/$budget*100):0; $ins=[];
    if($pct>=100) $ins[]=['type'=>'danger','icon'=>'🚨','title'=>'Budget Exceeded!','text'=>'Overspent by ₹'.number_format($exp-$budget,0)];
    elseif($pct>=80) $ins[]=['type'=>'warning','icon'=>'⚠️','title'=>'Budget Warning','text'=>round($pct,0).'% used'];
    else $ins[]=['type'=>'success','icon'=>'✅','title'=>'On Track','text'=>round($pct,0).'% of budget used'];
    if($inc>0){ $rate=($inc-$exp)/$inc*100; $ins[]=['type'=>$rate>=20?'success':'info','icon'=>'💰','title'=>'Savings: '.round($rate,0).'%','text'=>$rate>=20?'Great saving habits!':'Target 20%+ savings.']; }
    resp(['insights'=>$ins]); break;
case 'forecast':
    $dim=(int)date('t',mktime(0,0,0,$month,1,$year)); $td=(int)date('j');
    $stmt=$pdo->prepare("SELECT COALESCE(SUM(amount),0) FROM ss_transactions WHERE user_id=? AND MONTH(tx_date)=? AND YEAR(tx_date)=? AND type='expense'"); $stmt->execute([$uid,$month,$year]); $sf=(float)$stmt->fetchColumn();
    $avg=$td>0?$sf/$td:0; resp(['total_so_far'=>$sf,'daily_average'=>round($avg,2),'forecast'=>round($avg*$dim,2),'days_elapsed'=>$td,'days_in_month'=>$dim]); break;
case 'monthly_report':
    $months=[];
    for($i=5;$i>=0;$i--){ $m=$month-$i; $y=$year; if($m<=0){$m+=12;$y--;} $stmt=$pdo->prepare("SELECT COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END),0) AS exp, COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END),0) AS inc FROM ss_transactions WHERE user_id=? AND MONTH(tx_date)=? AND YEAR(tx_date)=?"); $stmt->execute([$uid,$m,$y]); $row=$stmt->fetch(); $months[]=['label'=>date('M y',mktime(0,0,0,$m,1,$y)),'expense'=>(float)$row['exp'],'income'=>(float)$row['inc']]; }
    resp(['months'=>$months]); break;
default: resp(['error'=>'Unknown action'],400);
}
