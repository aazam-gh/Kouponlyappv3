"""Local isolated fixture only: verifies concurrent redemption, retries, and referral caps."""
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

users = [str(uuid.uuid4()) for _ in range(7)]
alice, *friends = users
vendor = 'mvp-concurrent-' + alice
try:
    for uid in users:
        sql(f"insert into auth.users(id,email,email_confirmed_at) values('{uid}','mvp-concurrent-{uid}@example.com',now())")
    sql(f"insert into realx_vendors(id,name,status,catalogue_deal_id) values('{vendor}','Concurrency','Active',900098)")
    sql(f"insert into realx_offers(id,vendor_id,title,active,redemption_mode,sort_order) values('{vendor}','{vendor}','Coupon',true,'inStore',0)")
    benefits = json.loads(rpc(alice, "select kouponly_account_benefits()").stdout.splitlines()[-1])
    round_id = benefits['subscription']['roundId']
    code = benefits['inviteCode']
    def redeem(_):
        return rpc(alice, f"select kouponly_redeem_coupon('{vendor}','{round_id}','{uuid.uuid4()}',250.00)")
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(redeem, range(8)))
    assert sum(r.returncode == 0 for r in results) == 1, [(r.returncode, r.stderr) for r in results]
    assert all(r.returncode == 0 or 'OFFER_ALREADY_USED' in r.stderr for r in results)
    print('PASS: eight concurrent redemptions consume exactly once')
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        results = list(pool.map(lambda uid: rpc(uid, f"select kouponly_claim_code('{code}','{uuid.uuid4()}')"), friends))
    assert all(r.returncode == 0 for r in results), [r.stderr for r in results]
    claims = [json.loads(r.stdout.splitlines()[-1]) for r in results]
    assert sum(c.get('status') == 'rewarded' for c in claims) == 3, claims
    assert sum(c.get('status') == 'ineligible' for c in claims) == 3, claims
    assert sql(f"select count(*) from kouponly_reward_grants where user_id='{alice}'").stdout.strip() == '3'
    print('PASS: six simultaneous friends grant exactly three refreshes')
    round_id = json.loads(rpc(alice, "select kouponly_account_benefits()").stdout.splitlines()[-1])['subscription']['roundId']
    mutation = str(uuid.uuid4())
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        results = list(pool.map(lambda _: rpc(alice, f"select kouponly_redeem_coupon('{vendor}','{round_id}','{mutation}',250.00)"), range(5)))
    assert all(r.returncode == 0 for r in results), [r.stderr for r in results]
    assert len({r.stdout for r in results}) == 1
    assert sql(f"select count(*) from redemptions where user_id='{alice}'").stdout.strip() == '2'
    print('PASS: five concurrent retries return the same unique receipt')
finally:
    for uid in users:
        sql(f"delete from auth.users where id='{uid}'", False)
    sql(f"delete from realx_offers where id='{vendor}'; delete from realx_vendors where id='{vendor}'", False)
