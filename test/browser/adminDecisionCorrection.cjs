// Isolated browser regression: no Next server, credentials, or live API calls.
// Run: PLAYWRIGHT_MODULE=/path/to/playwright CHROMIUM_EXECUTABLE_PATH=/path/to/chrome node test/browser/adminDecisionCorrection.cjs
const { build } = require('esbuild');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const http = require('node:http');
const assert = require('node:assert/strict');
const root = require('node:path').resolve(__dirname, '../..');
const fixture = `
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import Workspace from '${root}/src/components/admin/AdminDecisionWorkspace';
import { buildEmailMessage, emailJob } from '${root}/src/lib/email/messages';
const defaults = {applicationId:'application_correction_test', applicantName:'Test applicant', email:'student@example.com', emailSiteUrl:'https://ascent.example.com', reference:'ASC-TEST', currentDecision:'REJECTED', currentReason:'Previous internal reason', decidedAt:'2026-10-11T12:00:00Z', decidedBy:'admin@example.com', revision:7, decisionChangesAllowed:true, canRetryEmail:true, decisionEmail:{status:'PENDING',configured:true,attempts:0,lastError:null,canRetry:true}};
window.expectedPreview = decision => buildEmailMessage({...emailJob('DECISION', defaults.applicationId),decision,previous_decision:'REJECTED'}, {reference:defaults.reference}, defaults.emailSiteUrl);
function App() {
 const [props,setProps] = useState(defaults); window.updateServer = patch => setProps(value=>({...value,...patch}));
 return <Workspace {...props}/>;
}
createRoot(document.getElementById('root')).render(<App/>);
`;
(async () => {
 const bundle = await build({stdin:{contents:fixture,resolveDir:root,loader:'tsx'},bundle:true,write:false,jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},plugins:[{name:'test-router',setup(b){b.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'link-test'}));b.onLoad({filter:/.*/,namespace:'link-test'},()=>({contents:'export default function Link(){return null}'}));b.onResolve({filter:/^next\/navigation$/},()=>({path:'router',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const useRouter = () => ({refresh:()=>{window.refreshCount=(window.refreshCount||0)+1}});'}));}}]});
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/bundle.js'?'application/javascript':'text/html');res.end(req.url==='/bundle.js'?bundle.outputFiles[0].text:'<div id="root"></div><script src="/bundle.js"></script>');});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH}:{}),args:['--no-sandbox']});
 const page=await browser.newPage();page.setDefaultTimeout(5000);
 const errors=[];page.on('pageerror',error=>{errors.push(error.message);console.error('BROWSER:',error.message);});
 const base=`http://127.0.0.1:${server.address().port}`;
 let calls=[],mode='success',pending;
 await page.route('**/api/admin/**',async route=>{
  if(route.request().url().endsWith('/session'))return route.fulfill({json:{csrfToken:'test-csrf'}});
  calls.push({url:route.request().url(),body:route.request().postDataJSON(),headers:route.request().headers()});
  if(mode==='hold'){pending=route;return;}
  if(mode==='conflict')return route.fulfill({status:409,json:{success:false,error:'This decision changed. Refresh and review it again.'}});
  return route.fulfill({json:{success:true,emailStatus:'QUEUED'}});
 });
 async function reset(nextMode='success'){mode=nextMode;calls=[];pending=null;await page.goto(base);await page.getByRole('button',{name:'Change decision',exact:true}).waitFor();}
 async function choose(label='Approve'){await page.getByRole('button',{name:'Change decision',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Reject',exact:true}).count(),0);await page.getByRole('button',{name:label,exact:true}).click();}
 try {
  await reset('hold');await choose();
  await page.getByText('To: student@example.com',{exact:true}).waitFor();
  await page.getByText('This changes rejected to approved and appends a permanent audit event.',{exact:true}).waitFor();
  const preview=await page.evaluate(()=>window.expectedPreview('APPROVED'));
  assert.equal(await page.locator('pre').innerText(),preview.text);
  assert.match(preview.text,/replaces our earlier rejection decision/);
  assert.match(preview.text,/https:\/\/ascent.example.com\/register\/status/);
  await page.getByRole('button',{name:'Confirm approve',exact:true}).click();assert.equal(calls.length,0);
  await page.getByLabel('Internal reason (required)',{exact:true}).fill('Private eligibility evidence reviewed.');
  assert.equal((await page.locator('pre').innerText()).includes('Private eligibility'),false);
  await page.getByRole('button',{name:'Confirm approve',exact:true}).click();
  await page.getByRole('button',{name:'Saving…'}).waitFor();
  await page.locator('form').evaluate(form=>{form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
  assert.equal(calls.length,1);assert.equal(calls[0].body.expectedRevision,7);assert.equal(calls[0].body.expectedDecision,'REJECTED');assert.equal(calls[0].body.reason,'Private eligibility evidence reviewed.');
  await pending.fulfill({json:{success:true,emailStatus:'QUEUED'}});
  await page.getByRole('status').getByText('Decision saved. Applicant email queued; check the email status below.',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.refreshCount),1);
  console.log('PASS: exact correction preview, private required reason, revision guard and duplicate-submit protection');

  await reset('conflict');await choose('Waitlist');await page.getByLabel('Internal reason (required)',{exact:true}).fill('New evidence requires a waitlist.');await page.getByRole('button',{name:'Confirm waitlist',exact:true}).click();
  await page.getByRole('status').getByText('This decision changed. Refresh and review it again.',{exact:true}).waitFor();assert.equal(await page.locator('form').count(),0);assert.equal(await page.getByText('Decision saved.',{exact:true}).count(),0);assert.equal(await page.evaluate(()=>window.refreshCount),1);
  console.log('PASS: stale correction closes confirmation and refreshes without claiming a save');

  await reset();await choose();await page.getByLabel('Internal reason (required)',{exact:true}).fill('Reason entered against previous revision.');
  await page.evaluate(()=>window.updateServer({revision:9}));await page.getByRole('button',{name:'Change decision',exact:true}).waitFor();assert.equal(await page.locator('form').count(),0);
  console.log('PASS: refreshed revision discards stale confirmation even when the outcome returns to rejected');

  await reset();await page.getByRole('button',{name:'Refresh email status',exact:true}).click();assert.equal(calls.length,0);assert.equal(await page.evaluate(()=>window.refreshCount),1);
  await page.getByRole('button',{name:'Retry due email',exact:true}).click();await page.getByRole('status').waitFor();assert.equal(calls.length,1);assert.match(calls[0].url,/\/decision\/email$/);assert.deepEqual(calls[0].body,{expectedRevision:7});assert.equal(calls[0].headers['x-csrf-token'],'test-csrf');
  await page.evaluate(()=>window.updateServer({canRetryEmail:false}));assert.equal(await page.getByRole('button',{name:'Retry due email',exact:true}).count(),0);
  await page.evaluate(()=>window.updateServer({canRetryEmail:true,decisionEmail:{status:'REVIEW',configured:true,attempts:1,lastError:'provider_timeout',canRetry:false}}));await page.getByText('Delivery needs review. An owner must check the provider record before any resend.',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Retry due email',exact:true}).count(),0);
  await page.evaluate(()=>window.updateServer({decisionEmail:{status:'SENT',configured:true,attempts:1,lastError:null,canRetry:false}}));await page.getByText('Accepted by email provider',{exact:true}).waitFor();await page.getByText('The provider accepted the email. Inbox delivery is not confirmed.',{exact:true}).waitFor();
  console.log('PASS: explicit refresh, owner retry without decision mutation, uncertain-delivery guard and accurate sent status');

  await page.evaluate(()=>window.updateServer({decisionChangesAllowed:false}));await page.getByText('Decisions cannot be changed for withdrawn or deleted registrations.',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Change decision',exact:true}).count(),0);
  console.log('PASS: inactive registration blocks decision correction');
  assert.deepEqual(errors,[]);
 } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exit(1)});
