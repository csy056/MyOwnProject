import fs from 'node:fs';
import { Story } from 'inkjs';
const json = fs.readFileSync('src/story/story.json', 'utf8');
function josa(w, k){const l=w.charCodeAt(w.length-1);const j=(l>=0xac00&&l<=0xd7a3)?(l-0xac00)%28:0;const h=j!==0;return w+({eun:h?'은':'는',i:h?'이':'가',eul:h?'을':'를',wa:h?'과':'와',ro:(h&&j!==8)?'으로':'로',a:h?'아':'야'}[k]??'');}
const [,, ch, route, seed, ...sets] = process.argv;
let s = Number(seed); const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
const st = new Story(json); st.BindExternalFunction('josa', josa, true);
const v = st.variablesState;
v.$('route', route); v.$('dome_name','수원시'); v.$('area_name','수원시'); v.$('area_kind','city');
while (st.canContinue) st.Continue();
v.$('chapter', Number(ch)); v.$('clues', 6); v.$('trust', 5);
for (const kv of sets) { const [k,val]=kv.split('='); v.$(k, isNaN(Number(val)) ? (val==='true'?true:val==='false'?false:val) : Number(val)); }
st.ChoosePathString('main_story');
let n=0;
while (n < 40) {
  while (st.canContinue) { const t = st.Continue(); const tags = st.currentTags; if (tags.length) console.log('  #', tags.join(' | ')); if (t.trim()) console.log(t.trim()); }
  const cs = st.currentChoices; if (!cs.length) break;
  if (cs.some(c=>c.text.includes('이야기를 따라간다'))) break;
  const F=(process.env.F||"").split(",").filter(Boolean).map(Number); const i = (n < F.length) ? F[n] : Math.floor(rnd()*cs.length);
  console.log('>> [' + cs.map(c=>c.text).join(' / ') + '] => ' + cs[i].text);
  st.ChooseChoiceIndex(i); n++;
}
