import {worlds, apps} from './registry.js';

export const categories = ['music', 'creative', 'research', 'utility', 'client', 'experiment'];
export const statusLabels = {'live-verified':'Live verified', preview:'Preview', planned:'Planned', unknown:'Unverified deploy', 'source-only':'Source only'};
export const privacyLabels = {'local-files':'Files stay on device', 'local-backup':'Local files · optional Drive backup', 'public-source':'Public source repository'};

// Only individually reviewed public records are searchable. No Notion ingestion.
export function isPublic(record) {
  return record.visibility === 'public' && record.editorialState === 'published';
}
export const musicTasks = [
  {id:'action:bpm',name:'Find key & BPM',description:'Quick tempo and key estimates.',href:'/JonaAudio/#quick',tags:['bpm','key','tempo','analyze']},
  {id:'action:tune',name:'Plan a tuning setup',description:'Choose a scale and audition reference notes.',href:'/JonaAudio/#studio/tune',tags:['autotune','tune','scale','pitch']},
  {id:'action:sample',name:'Find a sample',description:'Listen, mark regions and inspect sample candidates.',href:'/JonaAudio/#studio/sample',tags:['sample','loop','region','chop']},
  {id:'action:engineer',name:'Inspect a mix',description:'Measure levels, spectrum and headroom.',href:'/JonaAudio/#studio/engineer',tags:['engineer','mix','levels','headroom']},
  {id:'action:compare',name:'Compare two tracks',description:'A/B reference listening and measurement.',href:'/JonaAudio/#studio/compare',tags:['compare','reference','ab']},
  {id:'action:video',name:'Make a music video',description:'Open the RhythmCut video editor preview.',href:'/rhythmcut/',tags:['video','rhythm','takes','shots']}
].map(r=>({...r,publicId:r.id,kind:'action',visibility:'public',editorialState:'published'}));
export const paths = [
  {id:'listen',name:'Listen',description:'Enter the music world.',href:'/music/'},
  {id:'make',name:'Make something',description:'Find a tool for your next idea.',href:'/apps/'},
  {id:'hire',name:'Hire / collaborate',description:'Explore the work and connect.',href:'/work/#contact'},
  {id:'explore',name:'Explore connections',description:'Start with the public Atlas map.',href:'/atlas/'}
];
export const publicIndex = [...worlds, ...apps, ...musicTasks].filter(isPublic);

export function normalize(value) {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
}
export function searchRecords(records, query='', {category='all',status='all'}={}) {
  const tokens=normalize(query).split(' ').filter(Boolean);
  return records.filter(isPublic).filter(r=>
    (category==='all'||r.categories?.includes(category)||r.category===category) &&
    (status==='all'||r.status===status) &&
    tokens.every(token=>normalize([r.name,r.description,r.subtitle,...(r.tags||[])].join(' ')).includes(token))
  );
}
