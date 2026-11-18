"""Integration test against a disposable local preview (never production)."""
import urllib.request as u, urllib.error, json, http.cookiejar, uuid, concurrent.futures, pathlib
base='http://127.0.0.1:5173'
a=u.build_opener(u.HTTPCookieProcessor(http.cookiejar.CookieJar()));a.open(base+'/signin-with-chatgpt?return_to=/').read()
def call(path,body=None,method=None):
 try:
  r=a.open(u.Request(base+path,data=json.dumps(body).encode() if body is not None else None,method=method,headers={'Content-Type':'application/json','Origin':base}));return r.status,json.load(r)
 except urllib.error.HTTPError as e:
  raw=e.read()
  try:return e.code,json.loads(raw)
  except:return e.code,raw.decode()[:300]
def stock(id):return next(x['stock'] for x in call('/api/products')[1]['products'] if x['id']==id)
def product(name,quantity):
 p=dict(id=str(uuid.uuid4()),name=name,category='Other',cost=10,markup=20,stock=quantity,visible=True,sample=False)
 assert call('/api/products',p)[0]==200;return p['id']
def order(items):
 code,q=call('/api/order',{'submissionKey':str(uuid.uuid4()),'items':[{'id':id,'quantity':n} for id,n in items],'expectedTotal':sum(n*12 for _,n in items)})
 assert code==200,(code,q);assert q['whatsappUrl'].startswith('https://wa.me/14844674166?')
 return next(x for x in call('/api/orders')[1]['orders'] if x['number']==q['reference'])
def status(o,s):
 code,r=call('/api/orders/'+o['id'],{'revision':o['revision'],'status':s},'PATCH');assert code==200,(code,r);return r
p=product('Stock test',10);o=order([(p,3)]);o=status(o,'completed');assert stock(p)==7
o=status(o,'completed');assert stock(p)==7
for s in ['new','cancelled','deleted']:
 o=status(o,s);assert stock(p)==10
 o=status(o,'new');o=status(o,'completed');assert stock(p)==7
o=status(o,'new');assert stock(p)==10
# Concurrent competing orders cannot oversell, and an insufficient multi-line order changes nothing.
p2=product('Low stock test',2);bad=order([(p,2),(p2,3)])
code,result=call('/api/orders/'+bad['id'],{'revision':bad['revision'],'status':'completed'},'PATCH');assert code==409,(code,result)
assert stock(p)==10 and stock(p2)==2
one=order([(p,7)]);two=order([(p,7)])
with concurrent.futures.ThreadPoolExecutor() as pool:
 results=list(pool.map(lambda o:call('/api/orders/'+o['id'],{'revision':o['revision'],'status':'completed'},'PATCH'),[one,two]))
assert sorted(r[0] for r in results)==[200,409],results
assert stock(p)==3
winner=next(r[1] for r in results if r[0]==200);winner=status(winner,'cancelled');assert stock(p)==10
# Removing a product keeps its row for later stock restoration.
x=product('Deleted stock test',5);d=order([(x,2)]);d=status(d,'completed');assert stock(x)==3
assert call('/api/products',{'id':x},'DELETE')[0]==200
d=status(d,'new')
# PDF and customer message use the same destination.
code,pdf=call('/api/orders/'+o['id']+'/proforma',{});assert code==200 and pdf['whatsappUrl'].startswith('https://wa.me/14844674166?')
pathlib.Path('work/pdfs').mkdir(parents=True,exist_ok=True)
pathlib.Path('work/pdfs/stock-update.pdf').write_bytes(a.open(pdf['pdfUrl']).read())
print('PASS: deduct once; reopen/cancel/delete restore; insufficient stock rolls back all lines; concurrent completions cannot oversell; removed products can reverse; new WhatsApp destination.')
