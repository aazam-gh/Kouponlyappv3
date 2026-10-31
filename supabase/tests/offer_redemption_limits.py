"""Run after the branch-coupon fixture and offer-limit migration, against local benefits_v2 only."""
import concurrent.futures
import json
import os
import subprocess
import uuid
from urllib.parse import urlparse

url=os.environ['KPN_TEST_DATABASE_URL']
p=urlparse(url)
if p.hostname not in ('localhost','127.0.0.1') or p.path!='/benefits_v2':
    raise SystemExit('Use isolated local benefits_v2 only')

def sql(statement,error=None):
    r=subprocess.run(['psql',url,'-XAt','-v','ON_ERROR_STOP=1','-c',statement],capture_output=True,text=True)
    if error:
        assert r.returncode and error in r.stderr,r.stderr
        return
    assert r.returncode==0,r.stderr
    return r.stdout.strip().splitlines()[-1] if r.stdout.strip() else None

def redeem(uid,mutation,offer=None,bill='100'):
    return sql(f"set request.jwt.claim.sub='{uid}'; select kouponly_redeem_coupon('{offer or shared}',(kouponly_account_benefits()->'subscription'->>'roundId')::uuid,'{mutation}',{bill},null,'{['a','b','c'][users.index(uid)%3]}')")

users=[str(uuid.uuid4()) for _ in range(105)]
vendor='capacity-'+str(uuid.uuid4())
shared,unlimited,window=[vendor+s for s in ('-shared','-unlimited','-window')]
mutations={u:str(uuid.uuid4()) for u in users}
try:
    values=','.join(f"('{u}','capacity-{u}@example.com',now())" for u in users)
    sql(f"insert into auth.users(id,email,email_confirmed_at) values {values}")
    sql(f'''insert into kouponly_vendors(id,name,status,catalogue_deal_id,locations) values('{vendor}','Capacity QA','Active',900096,'[{{"id":"a"}},{{"id":"b"}},{{"id":"c"}}]')''')
    for offer,limit in [(shared,100),(unlimited,None),(window,2)]:
        payload=json.dumps({'redemptionLimit':limit})
        sql(f'''insert into kouponly_offers(id,vendor_id,title,active,redemption_mode,discount_type,discount_value,payload) values('{offer}','{vendor}','25% off',true,'inStore','percentage',25,'{payload}')''')
    for invalid in ('0','-1','1.5','2147483648','"abc"'):
        r=subprocess.run(['psql',url,'-XAt','-v','ON_ERROR_STOP=1','-c',f"update kouponly_offers set payload=jsonb_build_object('redemptionLimit','{invalid}'::jsonb) where id='{window}'"],capture_output=True,text=True)
        assert r.returncode,invalid
    sql(f"update kouponly_offers set redemption_count=0 where id='{shared}'")
    sql(f"update kouponly_offers set redemption_count=50 where id='{shared}'", 'server-managed')
    # Validation failures and rolled-back transactions must not reserve capacity.
    try: redeem(users[0],str(uuid.uuid4()),bill='-1'); raise AssertionError('Invalid bill accepted')
    except AssertionError as e: assert 'INVALID_BILL_AMOUNT' in str(e)
    assert sql(f"select redemption_count from kouponly_offers where id='{shared}'")=='0'
    sql(f"begin; set request.jwt.claim.sub='{users[0]}'; select kouponly_redeem_coupon('{shared}',(kouponly_account_benefits()->'subscription'->>'roundId')::uuid,gen_random_uuid(),100,null,'a'); rollback;")
    assert sql(f"select redemption_count from kouponly_offers where id='{shared}'")=='0'
    def attempt(uid):
        try: return uid,json.loads(redeem(uid,mutations[uid]))
        except AssertionError as e:
            assert 'OFFER_EXHAUSTED' in str(e),str(e)
            return uid,None
    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool:
        results=list(pool.map(attempt,users))
    winners=[(u,r) for u,r in results if r]
    assert len(winners)==100,len(winners)
    assert sql(f"select redemption_count from kouponly_offers where id='{shared}'")=='100'
    sql(f"update kouponly_offers set redemption_count=0 where id='{shared}'", 'server-managed')
    assert sql(f"select count(*) from redemptions where offer_id='{shared}'")=='100'
    assert sql(f"select redemption_limit from kouponly_offers where id='{shared}'")=='100'
    uid,receipt=winners[0]
    assert json.loads(redeem(uid,mutations[uid]))==receipt
    # A real referral refresh opens a new personal round but cannot replenish shared capacity.
    rejected=next(u for u,r in results if not r)
    invite=sql(f"set request.jwt.claim.sub='{uid}'; select kouponly_account_benefits()->>'inviteCode'")
    sql(f"set request.jwt.claim.sub='{rejected}'; select kouponly_claim_code('{invite}',gen_random_uuid())")
    try: redeem(uid,str(uuid.uuid4())); raise AssertionError('Referral bypassed cap')
    except AssertionError as e: assert 'OFFER_EXHAUSTED' in str(e)
    # Raising the cap provides exactly one extra redemption; editing other fields keeps the count.
    sql(f'''update kouponly_offers set title='Edited',payload='{{"redemptionLimit":101}}' where id='{shared}' ''')
    assert sql(f"select redemption_count from kouponly_offers where id='{shared}'")=='100'
    redeem(rejected,str(uuid.uuid4()))
    assert sql(f"select redemption_count from kouponly_offers where id='{shared}'")=='101'
    sql(f'''update kouponly_offers set payload='{{"redemptionLimit":99}}' where id='{shared}' ''')
    # Unlimited offers remain independent of an exhausted offer.
    for u in users[:3]: redeem(u,str(uuid.uuid4()),unlimited)
    assert sql(f"select redemption_count from kouponly_offers where id='{unlimited}'")=='3'
    # Validity edits recount the actual period; monthly rollover does not clear total usage.
    redeem(users[0],str(uuid.uuid4()),window)
    sql(f"update kouponly_offers set starts_at=now()+interval '1 hour',ends_at=now()+interval '2 hours' where id='{window}'")
    assert sql(f"select redemption_count from kouponly_offers where id='{window}'")=='0'
    sql(f"update kouponly_offers set starts_at=null,ends_at=null where id='{window}'")
    assert sql(f"select redemption_count from kouponly_offers where id='{window}'")=='1'
    period=sql(f"set request.jwt.claim.sub='{uid}'; select kouponly_account_benefits()->'subscription'->>'periodId'")
    sql(f"update kouponly_subscription_periods set starts_at=starts_at-interval '1 month',ends_at=starts_at,provider_period_key='capacity-old-month' where id='{period}'")
    try: redeem(uid,str(uuid.uuid4())); raise AssertionError('Month bypassed cap')
    except AssertionError as e: assert 'OFFER_EXHAUSTED' in str(e)
    sql(f'''update kouponly_offers set payload='{{"redemptionLimit":null}}' where id='{shared}' ''')
    redeem(uid,str(uuid.uuid4()))
    print('PASS: 105 concurrent requests stop at 100; replay, rollback, validation, referral/month resets, unlimited offers, limit edits and validity recounts')
finally:
    for u in users: sql(f"delete from auth.users where id='{u}'")
    assert sql(f"select coalesce(sum(redemption_count),0) from kouponly_offers where vendor_id='{vendor}'")=='0'
    sql(f"delete from kouponly_offers where vendor_id='{vendor}'; delete from kouponly_vendors where id='{vendor}'")
