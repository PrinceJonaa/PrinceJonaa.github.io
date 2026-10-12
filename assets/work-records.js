// Deliberately authored public records. No private workspace or media ingestion.
const published = {visibility:'public', editorialState:'published'};

export const services = [
  {
    ...published, publicId:'service:mix-master', kind:'service', id:'mix-master', slug:'mix-master',
    name:'Music mixing & mastering', description:'A scoped mix or master for an artist-approved release, with deliverables and revisions agreed in a written quote.',
    href:'/services/#mix-master', tags:['music','mix','master','audio','release','quote'],
    deliverables:['The mix or master formats listed in the quote','Alternate versions only when included in the quote','A review and revision process agreed before work begins'],
    inputs:['A project brief and reference tracks','Organized stems or a stereo mix, as appropriate','Release-format requirements and confirmation of media rights'],
    exclusions:['Recording, beat production and stem repair unless expressly included','Distribution, playlist placement and guaranteed commercial results'],
    revisions:'The written quote sets the number and scope of revision rounds; changed direction or new source material may require a new quote.',
    pricing:'Written quote only', turnaround:'Schedule agreed in the written quote'
  },
  {
    ...published, publicId:'service:music-video', kind:'service', id:'music-video', slug:'music-video',
    name:'Music video & creative editing', description:'Plan and edit an artist video or release visual from an agreed creative brief and cleared media.',
    href:'/services/#music-video', tags:['video','music video','edit','visual','release','quote'],
    deliverables:['An edit with the runtime, aspect ratios and export formats listed in the quote','Titles, captions or social cutdowns only when included','An agreed review and revision process'],
    inputs:['An approved song and creative brief','Cleared footage, artwork and credits','Target platforms, runtime and delivery requirements'],
    exclusions:['Filming, travel, cast, locations and licensed assets unless expressly included','Automatic song-to-video results or guaranteed audience growth'],
    revisions:'Review rounds and changes to the agreed cut are scoped in the written quote; reshoots and new concepts are separate work.',
    pricing:'Written quote only', turnaround:'Schedule agreed in the written quote'
  },
  {
    ...published, publicId:'service:web-software', kind:'service', id:'web-software', slug:'web-software',
    name:'Websites & software', description:'Artist websites, public product interfaces and focused software workflows with a defined handoff and acceptance scope.',
    href:'/services/#web-software', tags:['web','software','website','artist','frontend','engineering','quote'],
    deliverables:['The pages, features and integrations listed in the quote','A responsive interface and agreed acceptance checks','Source, deployment or handoff materials as specified'],
    inputs:['The problem, audience and required user actions','Approved copy, branding and content','Integration requirements and an authorized access plan'],
    exclusions:['Hosting, domains, subscriptions, commerce fees and ongoing support unless included','Unscoped integrations, legal copy and guaranteed revenue'],
    revisions:'The quote defines review rounds and acceptance criteria; new features or ongoing maintenance require an explicit scope.',
    pricing:'Written quote only', turnaround:'Schedule agreed in the written quote'
  }
];

export const caseStudies = [
  {
    ...published, publicId:'case:jonaaudio', kind:'caseStudy', id:'jonaaudio', slug:'jonaaudio',
    name:'JonaAudio: engineering a local audio workspace',
    description:'M1–M6 audio analysis, on-demand measurements, WAV export and session relinking, with explicit browser and device evidence limits.',
    href:'/work/cases/jonaaudio/', tags:['audio','engineering','Web Audio','worker','BPM','key','testing','M6'],
    evidenceStatus:'verified-with-limits', context:'An artist needs one local workspace to inspect audio, plan a tuning setup, mark samples and compare references.',
    contribution:'Prince Jona / Intervised: application engineering and release validation in the public Universe repository.',
    artifacts:[{label:'Open JonaAudio',href:'/JonaAudio/'},{label:'M6 evidence ledger',href:'https://github.com/PrinceJonaa/PrinceJonaa.github.io/blob/main/JonaAudio/docs/M6.md'}],
    outcomes:['39 focused regression tests recorded for the M6 release','Chromium imported synthetic stereo WAVs, downloaded a worker-generated WAV and restored/relinked session metadata','A numeric-channel worker transfer bug was fixed and covered by regression'],
    stack:['JavaScript modules','Web Audio API','Web Workers','IndexedDB','PCM16 WAV export','Node + Playwright'],
    attribution:'Engineering evidence concerns the application. Artist recordings and their rights are separate; no private audio is published.',
    limits:['Physical iPhone/Safari remains pending','Long original MP3/M4A app imports remain pending','Ground-truth BPM/key accuracy and listening fidelity remain unmeasured']
  },
  {
    ...published, publicId:'case:universe', kind:'caseStudy', id:'universe', slug:'universe',
    name:'Universe: discovery without disturbing the tools',
    description:'A shared public catalog, keyboard search, task routes and careful returns to local creative editors.',
    href:'/work/cases/universe/', tags:['web','discovery','accessibility','catalog','local storage','frontend'],
    evidenceStatus:'verified-with-limits', context:'A growing collection of creative tools needs an understandable front door while existing projects stay recoverable.',
    contribution:'Prince Jona / Intervised: public discovery shell, catalog integration, responsive navigation and compatibility validation.',
    artifacts:[{label:'Browse applications',href:'/apps/'},{label:'S0/S1 release ledger',href:'https://github.com/PrinceJonaa/PrinceJonaa.github.io/blob/main/docs/universe/S0-S1.md'}],
    outcomes:['S0/S1 release records 45/45 Node checks, including 39 JonaAudio regressions','Chromium exercised search, keyboard focus, filters and six responsive widths','Editor returns preserve the editing tab/frame or await JonaAudio metadata saves'],
    stack:['Static HTML + CSS','JavaScript modules','Public record catalog','IndexedDB-aware navigation','Node + Playwright','GitHub Pages'],
    attribution:'Discovery and hosting integration by Prince Jona / Intervised. Craft editors retain upstream Storytold attribution and licenses.',
    limits:['Emulated viewports do not establish physical-device acceptance','RhythmCut remains a pinned older preview; newer source patches are not represented as live']
  },
  {
    ...published, publicId:'case:heartz4sale', kind:'caseStudy', id:'heartz4sale', slug:'heartz4sale',
    name:'Heartz4Sale: an artist web presence',
    description:'Public-facing artist website work for Hbkrevenge, with a clear distinction between a published site and unmeasured business outcomes.',
    href:'/work/cases/heartz4sale/', tags:['artist','client','website','releases','merch','fans'],
    evidenceStatus:'public-site', context:'An artist needs a public place for identity, releases, merchandise and show-related discovery.',
    contribution:'Prince Jona / Intervised: artist website contribution identified in the existing public Work portfolio.',
    artifacts:[{label:'Visit Heartz4Sale',href:'https://heartz4sale.com'},{label:'Public shows route',href:'https://heartz4sale.com/shows'}],
    outcomes:['A public artist website and shows route are available','The public site presents a subscription entry for release, merch and show updates'],
    stack:['Public web interface','JavaScript-rendered route and media content','Exact production stack not independently established here'],
    attribution:'Hbkrevenge is the artist and owner of the presented brand/content. Web engineering contribution: Prince Jona / Intervised.',
    limits:['No conversion, revenue or audience-growth statistics are asserted','Subscription delivery, checkout and administrative systems are not validated by this case']
  },
  {
    ...published, publicId:'case:song-to-video', kind:'caseStudy', id:'song-to-video', slug:'song-to-video',
    name:'Song → analysis → video: evidence pending',
    description:'The end-to-end creative proof remains pending until an approved song, analysis decisions and a playable final export can be documented together.',
    href:'/work/cases/song-to-video/', tags:['song','analysis','video','pending','workflow','demo'],
    evidenceStatus:'pending', context:'A complete creative workflow must show the relationship between a cleared source song, analysis decisions and a real video export.',
    contribution:'Current public tools provide parts of the workflow. A cleared end-to-end example has not been established.',
    artifacts:[{label:'Explore audio analysis',href:'/JonaAudio/#quick'},{label:'Open RhythmCut preview',href:'/rhythmcut/'}],
    outcomes:['No approved end-to-end song-to-analysis-to-video result is published'],
    stack:['JonaAudio audio-analysis workspace','Pinned RhythmCut video preview'],
    attribution:'Source song, footage and collaborator credits must be approved before a completed example is published.',
    limits:['No synthetic demonstration is represented as a commercial result','Source permissions, traceable analysis decisions and final-export validation are pending']
  }
];
