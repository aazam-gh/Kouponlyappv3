"""Isolated local Postgres integration tests, including concurrent requests and real resets."""
import concurrent.futures
import json
import os
import subprocess
import uuid
import sys
from pathlib import Path
from urllib.parse import urlparse

url = os.environ['KPN_TEST_DATABASE_URL']
parsed = urlparse(url)
if parsed.hostname not in ('localhost', '127.0.0.1') or parsed.path != '/benefits_v2':
    raise SystemExit('Use the isolated local benefits_v2 database only')

def sql(statement, error=None):
    r = subprocess.run(['psql', url, '-XAt', '-v', 'ON_ERROR_STOP=1', '-c', statement], capture_output=True, text=True)
    if error:
        assert r.returncode and error in r.stderr, r.stderr
        return
    assert r.returncode == 0, r.stderr
    return r.stdout.strip().splitlines()[-1] if r.stdout.strip() else None

def rpc(statement, uid=None, error=None):
    return sql(f"set request.jwt.claim.sub='{uid or alice}'; {statement}", error)

def benefits(uid=None):
    return json.loads(rpc('select kouponly_account_benefits()', uid))

def redeem(branch, offer=None, mutation=None, round_id=None, uid=None, error=None, bill='100'):
    return rpc(f"select kouponly_redeem_coupon('{offer or shared}','{round_id or current_round}','{mutation or uuid.uuid4()}',{bill},null,{('null' if branch is None else chr(39)+branch+chr(39))})", uid, error)

if '--setup' in sys.argv:
    assert sql("select count(*) from pg_tables where schemaname='public'") == '0', 'Setup requires an empty fixture database'
    root = Path(__file__).resolve().parents[1]
    files = [root/'tests/bootstrap_subscription_fixture.sql'] + [root/'migrations'/name for name in (
        '20261009090000_kouponly_subscription_invites.sql',
        '20261009093000_kouponly_referral_lock_order.sql',
        '20261009120000_free_rajagiri_mvp.sql',
        '20261009140000_short_coupon_receipts.sql',
        '20261013100000_offer_level_coupon_slots.sql',
        '20261013110000_allow_non_school_signup.sql',
        '20261014120000_any_email_referral_benefits.sql',
        '20261014150000_coupon_bill_amount.sql',
    )] + [root/'tests/branch_coupon_fixture.sql', root/'migrations/20261031120000_branch_coupon_slots.sql']
    for path in files:
        result = subprocess.run(['psql',url,'-X','-v','ON_ERROR_STOP=1','-f',str(path)],capture_output=True,text=True)
        assert result.returncode == 0, (path,result.stderr)

alice, bob, friend = [str(uuid.uuid4()) for _ in range(3)]
vendor = 'branch-qa-' + alice
shared, restricted, other = [vendor + suffix for suffix in ('-shared', '-restricted', '-other')]
try:
    for uid in (alice, bob, friend):
        sql(f"insert into auth.users(id,email,email_confirmed_at) values('{uid}','branch-{uid}@example.com',now())")
    sql(f'''insert into kouponly_vendors(id,name,status,catalogue_deal_id,locations) values('{vendor}','Branch QA','Active',900097,'[{{"id":"a","name":"Branch A"}},{{"id":"b","name":"Branch B"}},{{"id":"c","name":"Branch C"}}]')''')
    for offer in (shared, restricted, other):
        scope = '{"branchIds":["a"]}' if offer == restricted else '{}'
        sql(f'''insert into kouponly_offers(id,vendor_id,title,active,redemption_mode,payload,discount_type,discount_value) values('{offer}','{vendor}','25% off',true,'inStore','{scope}','percentage',25)''')
    current_round = benefits()['subscription']['roundId']
    redeem(None, error='BRANCH_REQUIRED')
    redeem('foreign', error='BRANCH_UNAVAILABLE')
    redeem('b', restricted, error='OFFER_UNAVAILABLE_AT_BRANCH')
    redeem('a', bill='-1', error='INVALID_BILL_AMOUNT')
    assert sql(f"select count(*) from redemptions where user_id='{alice}'") == '0'
    mutation = str(uuid.uuid4())
    first = json.loads(redeem('a', mutation=mutation))
    assert first['branchId'] == 'a' and first['branchName'] == 'Branch A'
    assert first['estimatedSavings'] == 25 and first['payableAmount'] == 75
    assert json.loads(redeem('a', mutation=mutation)) == first
    redeem('b', mutation=mutation, error='IDEMPOTENCY_MISMATCH')
    redeem('a', error='OFFER_ALREADY_USED')
    redeem('b'); redeem('c'); redeem('a', restricted); redeem('a', other)
    assert len(benefits()['usedOfferBranches']) == 5
    redeem('a', uid=bob, round_id=benefits(bob)['subscription']['roundId'])
    sql(f"insert into redemptions(user_id,redemption_id,round_id,period_id,vendor_id,offer_id,branch_id,consumed_at,mode,status,offer_snapshot) select user_id,'index-check',round_id,period_id,vendor_id,offer_id,branch_id,consumed_at,mode,status,offer_snapshot from redemptions where redemption_id='{first['id']}'", 'kouponly_offer_branch_redemption_once_idx')
    print('PASS branch isolation, offer isolation, student isolation, scope validation, money, replay and mismatch')
    # Existing five-argument clients cannot silently pick a branch.
    rpc(f"select kouponly_redeem_coupon('{shared}','{current_round}','{uuid.uuid4()}',100,null)", error='BRANCH_REQUIRED')
    sql(f"update kouponly_offers set active=false where id='{other}'")
    redeem('b', other, error='OFFER_UNAVAILABLE')
    sql(f"update kouponly_offers set active=true where id='{other}'")
    # A real referral claim opens a fresh round and restores every branch.
    invite = benefits()['inviteCode']
    rpc(f"select kouponly_claim_code('{invite}','{uuid.uuid4()}')", friend)
    refreshed = benefits()
    assert refreshed['subscription']['roundId'] != current_round and refreshed['usedOfferBranches'] == []
    old_round = current_round
    current_round = refreshed['subscription']['roundId']
    redeem('b', round_id=old_round, error='ROUND_CHANGED')
    assert json.loads(redeem('a', mutation=mutation, round_id=old_round)) == first
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        futures = [pool.submit(redeem, 'b', mutation=str(uuid.uuid4())) for _ in range(8)]
        results = []
        for future in futures:
            try: results.append(future.result())
            except AssertionError as e: assert 'OFFER_ALREADY_USED' in str(e)
    assert len(results) == 1
    retry = str(uuid.uuid4())
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        receipts = list(pool.map(lambda _: redeem('a', mutation=retry), range(6)))
    assert len(set(receipts)) == 1
    print('PASS real referral refresh, stale rounds, historical replay, eight simultaneous redemptions, six simultaneous retries')
    # Month rollover: move the existing period into last month; the real allocator makes this month's round.
    period = refreshed['subscription']['periodId']
    sql(f"update kouponly_subscription_periods set starts_at=starts_at-interval '1 month',ends_at=starts_at,provider_period_key='qa-old-month' where id='{period}'")
    month = benefits()
    assert month['subscription']['roundId'] != current_round and month['usedOfferBranches'] == []
    current_round = month['subscription']['roundId']
    redeem('a'); redeem('b'); redeem('c')
    # Branchless historical usage must not become three unearned coupons after migration.
    sql(f"update redemptions set branch_id=null where user_id='{alice}' and round_id='{current_round}' and branch_id='a'")
    sql(f"delete from redemptions where user_id='{alice}' and round_id='{current_round}' and branch_id in ('b','c')")
    for branch in ('a','b','c'): redeem(branch, error='OFFER_ALREADY_USED')
    print('PASS monthly allocator reset and conservative historical usage')
    # Single-location legacy calls choose the sole branch; no-location vendors keep one default slot.
    sql(f'''update kouponly_vendors set locations='[{{"id":"a","name":"Branch A"}}]' where id='{vendor}' ''')
    result=json.loads(redeem(None, other))
    assert result['branchId']=='a'
    sql(f"update kouponly_vendors set locations='[]' where id='{vendor}'")
    assert json.loads(redeem('', restricted))['branchId']==''
    redeem('', restricted, error='OFFER_ALREADY_USED')
    sql("set request.jwt.claim.sub=''; select kouponly_redeem_coupon('x',gen_random_uuid(),gen_random_uuid(),100,null,'a')", 'Authentication required')
    assert sql("select has_function_privilege('anon','kouponly_redeem_coupon(text,uuid,uuid,numeric,numeric,text)','execute')")=='f'
    sql(f"update kouponly_offers set discount_type='buy1get1' where id='{other}'")
    bogo=json.loads(rpc(f"select kouponly_redeem_coupon('{other}','{current_round}','{uuid.uuid4()}',100,40,'')"))
    assert bogo['estimatedSavings']==40 and bogo['payableAmount']==60
    print('PASS single/no-location compatibility, BOGO calculation and anonymous access denied')
finally:
    for uid in (alice,bob,friend): sql(f"delete from auth.users where id='{uid}'")
    sql(f"delete from kouponly_offers where vendor_id='{vendor}'; delete from kouponly_vendors where id='{vendor}'")
