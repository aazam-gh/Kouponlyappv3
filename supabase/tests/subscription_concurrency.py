"""Run against an isolated fixture database, never production: KPN_TEST_DATABASE_URL required."""
import concurrent.futures
import json
import os
import subprocess
import uuid
from urllib.parse import urlparse

url = os.environ.get('KPN_TEST_DATABASE_URL')
if not url or urlparse(url).hostname not in ('localhost', '127.0.0.1') or urlparse(url).path != '/benefits_v2':
    raise SystemExit('Use the isolated local benefits_v2 database only.')

def sql(statement, check=True):
    result = subprocess.run(['psql', url, '-XAt', '-v', 'ON_ERROR_STOP=1', '-c', statement], capture_output=True, text=True)
    if check and result.returncode:
        raise AssertionError(result.stderr)
    return result

def rpc(uid, statement):
    return sql(f"set request.jwt.claim.sub='{uid}'; {statement}", False)

alice, bob = str(uuid.uuid4()), str(uuid.uuid4())
setup = f"""
insert into auth.users(id,email,created_at,email_confirmed_at) values ('{alice}','concurrent-{alice}@example.test',now(),now()),('{bob}','concurrent-{bob}@example.test',now(),now());
insert into realx_vendors(id,name,status,catalogue_deal_id,category_id) values ('concurrent-{alice}','Concurrency vendor','Active',900010,(select id from realx_categories where active limit 1));
insert into realx_offers(id,vendor_id,title,active,redemption_mode,sort_order) values ('concurrent-{alice}','concurrent-{alice}','Test coupon',true,'inStore',0);
"""
sql(setup)
try:
    for uid in (alice, bob):
        event = json.dumps({'provider':'test','eventId':uid,'userId':uid,'type':'paid','subscriptionId':uid,'periodKey':uid,'startsAt':'2020-01-01T00:00:00Z','endsAt':'2090-01-01T00:00:00Z'})
        sql("select kouponly_apply_billing_event('" + event + "'::jsonb)")
    round_id = sql(f"select id from kouponly_coupon_rounds where user_id='{alice}' and closed_at is null").stdout.strip()
    def redeem(_):
        return rpc(alice, f"select kouponly_redeem_coupon('concurrent-{alice}','{round_id}','{uuid.uuid4()}')")
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(redeem, range(8)))
    assert sum(r.returncode == 0 for r in results) == 1, [(r.returncode,r.stderr) for r in results]
    assert all(r.returncode == 0 or 'VENDOR_ALREADY_USED' in r.stderr for r in results)
    assert sql(f"select count(*) from redemptions where user_id='{alice}'").stdout.strip() == '1'
    print('PASS: eight simultaneous redemptions consume exactly one coupon')

    code='KPN-CONCURRENT-'+uuid.uuid4().hex[:10].upper()
    sql(f"insert into kouponly_vouchers(code_digest,label,ends_at,max_claims) values(encode(extensions.digest('{code}','sha256'),'hex'),'Concurrency',now()+interval '1 day',1)")
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        futures=[pool.submit(rpc,uid,f"select kouponly_claim_code('{code}','{uuid.uuid4()}')") for uid in (alice,bob)]
        results=[f.result() for f in futures]
    assert sum('"status": "rewarded"' in r.stdout for r in results) == 1, results
    assert sum('VOUCHER_EXHAUSTED' in r.stdout for r in results) == 1, results
    print('PASS: simultaneous voucher claims respect the global one-claim limit')

    same_mutation=str(uuid.uuid4())
    new_round=sql(f"select id from kouponly_coupon_rounds where user_id='{alice}' and closed_at is null").stdout.strip()
    # If Bob won the voucher, use a fresh server-controlled reward to reset Alice.
    if new_round == round_id:
        period=sql(f"select id from kouponly_subscription_periods where user_id='{alice}'").stdout.strip()
        sql(f"select kouponly_open_reward_round('{alice}','{period}','voucher','concurrency-test-refresh')")
        new_round=sql(f"select id from kouponly_coupon_rounds where user_id='{alice}' and closed_at is null").stdout.strip()
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        results=list(pool.map(lambda _: rpc(alice,f"select kouponly_redeem_coupon('concurrent-{alice}','{new_round}','{same_mutation}')"),range(5)))
    assert all(r.returncode == 0 for r in results)
    assert len({r.stdout for r in results}) == 1
    assert sql(f"select count(*) from redemptions where user_id='{alice}'").stdout.strip() == '2'
    print('PASS: five simultaneous retries return one receipt and consume once')

    # Terminal referral reads must not acquire a second account lock inside a mutation.
    sql(f"insert into referral_uses(referred_user_id,inviter_user_id,status) values ('{alice}','{bob}','rewarded'),('{bob}','{alice}','rewarded')")
    def locked_read(uid):
        return rpc(uid, f"begin; set local statement_timeout='3s'; select kouponly_lock_account('{uid}'); select pg_sleep(0.15); select kouponly_account_benefits(); commit;")
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        results=list(pool.map(locked_read,(alice,bob)))
    assert all(r.returncode == 0 for r in results), [r.stderr for r in results]
    print('PASS: simultaneous mutations with terminal referrals avoid cross-account deadlocks')

finally:
    # Only the exact fixture accounts/vendors created by this script are removed.
    sql(f"delete from auth.users where id in ('{alice}','{bob}'); delete from realx_offers where id='concurrent-{alice}'; delete from realx_vendors where id='concurrent-{alice}'; delete from kouponly_vouchers where label='Concurrency' and code_digest=encode(extensions.digest('{code if 'code' in locals() else ''}','sha256'),'hex');")
