// Isolated browser regression: no Next server, credentials, or live API calls.
// Run: PLAYWRIGHT_MODULE=/path/to/playwright node test/browser/adminDecisionFeedback.cjs
// Optional: CHROMIUM_EXECUTABLE_PATH=/path/to/chromium
const { build } = require('esbuild');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const http = require('node:http');
const assert = require('node:assert/strict');
const root = require('node:path').resolve(__dirname, '../..');
const fixture = `
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import Feedback, { AdminQueueRefresh } from '${root}/src/components/admin/AdminDecisionFeedback';
import Control from '${root}/src/components/admin/AdminDecisionControl';
import Bulk from '${root}/src/components/admin/AdminBulkReview';
const rows = [1,2].map(n => ({id:'application_test_'+n, legalName:'Applicant '+n, reference:'REF'+n, institution:'Example university'}));
function App() {
 const [server, setServer] = useState({}); window.updateServer = setServer;
 return <Feedback>
  <AdminQueueRefresh/>
  <Bulk rows={rows.filter(row=>!server[row.id] || server[row.id].decision==='PENDING')}/>
  {['desktop','mobile'].map(view=><div key={view} data-view={view}>{rows.map(row=><div key={row.id} data-row={row.id}>
   <Control applicationId={row.id} applicantName={row.legalName} reference={row.reference}
    decision="PENDING" decisionReason={null} decidedAt={null} decidedBy={null} {...server[row.id]}/>
  </div>)}</div>)}
 </Feedback>;
}
createRoot(document.getElementById('root')).render(<App/>);
`;
(async () => {
 const bundle = await build({stdin:{contents:fixture, resolveDir:root, loader:'tsx'},bundle:true,write:false,jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},plugins:[{
  name:'hold-refresh',setup(b){b.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'link-test'}));b.onLoad({filter:/.*/,namespace:'link-test'},()=>({contents:'export default function Link(){return null}'}));b.onResolve({filter:/^next\/navigation$/},()=>({path:'router',namespace:'test'})); b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const useRouter = () => ({ refresh: () => { window.refreshCount = (window.refreshCount || 0) + 1; } });'}));}
 }]});
 const server = http.createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/bundle.js'?'application/javascript':'text/html'); res.end(req.url==='/bundle.js'?bundle.outputFiles[0].text:'<div id="root"></div><script src="/bundle.js"></script>');});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser = await chromium.launch({headless:true, ...(process.env.CHROMIUM_EXECUTABLE_PATH ? {executablePath:process.env.CHROMIUM_EXECUTABLE_PATH} : {}),args:['--no-sandbox']});
 const page = await browser.newPage();
 const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('BROWSER:',e.message)});page.setDefaultTimeout(5000);
 const base=`http://127.0.0.1:${server.address().port}`;
 let behavior='success', pending, calls=[];
 await page.route('**/api/admin/**',async route=>{
  if(route.request().url().endsWith('/session')) return route.fulfill({json:{csrfToken:'test'}});
  const body=route.request().postDataJSON();calls.push(body);
  if(behavior==='hold') { pending=route; return; }
  if(behavior==='failure') return route.fulfill({status:500,json:{success:false,error:'Save failed. Try again.'}});
  if(behavior==='conflict') return route.fulfill({status:409,json:{success:false,error:'Already decided by another reviewer.',currentDecision:'REJECTED'}});
  return route.fulfill({json:{success:true,decision:body.decision,message:'Decision saved.'}});
 });
 const row=(view='desktop',n=1)=>page.locator('[data-view="'+view+'"] [data-row="application_test_'+n+'"]');
 async function reset(mode='success'){behavior=mode;calls=[];pending=null;await page.goto(base);await row().getByRole('button',{name:'Approve Applicant 1',exact:true}).waitFor();}
 async function approve(){await row().getByRole('button',{name:'Approve Applicant 1',exact:true}).click();await row().getByRole('button',{name:'Confirm approval',exact:true}).click();}
 async function decided(label,n=1){for(const view of ['desktop','mobile']){await row(view,n).getByText(label,{exact:true}).waitFor();assert.equal(await row(view,n).getByRole('button').count(),0);assert.equal(await row(view,n).getByText('Pending review',{exact:true}).count(),0);}}
 try {
  await reset('hold'); await approve();
  await row().getByRole('button',{name:'Saving…'}).waitFor();
  assert.equal(await row().getByText('Pending review',{exact:true}).count(),1);
  assert.equal(await row().getByText('Approved',{exact:true}).count(),0);
  assert.equal(calls.length,1);
  // Repeated submit events cannot issue another request while the first is in flight.
  await row().locator('form').evaluate(form=>{form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
  assert.equal(calls.length,1);
  await pending.fulfill({json:{success:true,decision:'APPROVED',message:'Registration approved.'}});
  await decided('Approved');await page.getByRole('button',{name:'Review 1 pending',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.refreshCount||0),0);
  await page.getByRole('button',{name:'Refresh list',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.refreshCount),1);
  console.log('PASS: approval updates both views without rereading the queue; explicit refresh works; duplicate submits blocked');
  await page.evaluate(()=>window.updateServer({application_test_1:{decision:'REJECTED',decisionReason:'Corrected after additional review.',decidedBy:'Second reviewer',decidedAt:'2026-10-11T12:00:00Z'}}));
  await decided('Not approved'); await row().getByText(/by Second reviewer/).waitFor();assert.equal(await row().getByText('Registration approved.',{exact:true}).count(),0);
  console.log('PASS: refreshed server decision and metadata supersede local confirmation');
  await reset();await row().getByRole('button',{name:'Reject Applicant 1',exact:true}).click();
  await row().locator('textarea').fill('Eligibility could not be verified.');await row().getByRole('button',{name:'Confirm rejection',exact:true}).click();
  await decided('Not approved');assert.equal(await page.evaluate(()=>window.refreshCount||0),0);assert.equal(calls[0].reason,'Eligibility could not be verified.');
  console.log('PASS: rejection immediately updates both views');
  await reset('failure');await approve();await row().getByRole('alert').waitFor();assert.equal(await row().getByText('Pending review',{exact:true}).count(),1);assert.equal(await page.evaluate(()=>window.refreshCount||0),0);
  behavior='success';await row().getByRole('button',{name:'Confirm approval',exact:true}).click();await decided('Approved');assert.equal(calls.length,2);
  console.log('PASS: failed save stays pending, reports error, and can be retried');
  await reset('conflict');await approve();await decided('Not approved');await row().getByRole('status').getByText('Already decided by another reviewer.').waitFor();
  console.log('PASS: conflict displays the server outcome, not the attempted approval');
  await reset();await page.getByRole('button',{name:'Review 2 pending'}).click();
  await page.getByRole('button',{name:'Select visible pending',exact:true}).click();
  await page.locator('textarea').first().fill('Reviewed all eligibility evidence.');
  await page.getByRole('button',{name:'Review batch before saving'}).click();
  await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Confirm approval',exact:true}).click();
  await decided('Approved',1);await decided('Approved',2);assert.equal(await page.evaluate(()=>window.refreshCount||0),0);assert.deepEqual(calls[0].applicationIds,['application_test_1','application_test_2']);
  assert.equal(await page.getByRole('button',{name:/Review \d+ pending/}).count(),0);
  console.log('PASS: bulk success updates all rows and clears pending batch choices before refresh');
  assert.deepEqual(errors,[]);
 } finally { await browser.close();await new Promise(r=>server.close(r)); }
})().catch(e=>{console.error(e);process.exit(1)});
