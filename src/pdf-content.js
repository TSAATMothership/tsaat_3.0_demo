/* PDF-only narrative. Walkthroughs, roles and definitions come from the current workbook. */
function handbookContent(get, model) {
  const preferredOrder = [
    'scope', 'navigate', 'tables', 'govern-end', 'explore-end', 'cmdb', 'shadow',
    'govern-soft', 'explore-soft', 'govern-vuln', 'explore-vuln', 'topology', 'exports'
  ];
  const topicOrder = preferredOrder.filter(id => model.topics[id]);
  for (const id of Object.keys(model.topics)) {
    if (!topicOrder.includes(id)) topicOrder.push(id);
  }
  return {
    title: 'TSAAT User Guide',
    subtitle: 'A practical handbook for understanding your cyber terrain',
    tagline: 'Choose a scope. Follow the records. Explain the next step.',
    intro: 'Your cyber terrain includes the devices, software, networks and services you look after. TSAAT brings their recorded details together so you can see what is known, spot missing information and decide what needs checking. This handbook takes you from your first selection to a report someone else can use. Keep it beside the app, or go straight to the topic that answers your question.',
    topicOrder,
    roadmap: {
      title: 'From a question to a useful answer',
      intro: 'A large total is only a starting point. The useful story is what was counted, where it came from and what someone should do next. Follow this route when you are new to TSAAT; later, use the topic pages as a reference.',
      steps: [
        {
          title: 'Choose the boundary',
          body: 'Decide which networks or ICT systems you need to review. Check the security domains and the snapshot TSAAT actually loaded. These choices give every result its context.'
        },
        {
          title: 'Read the overview',
          body: 'Use Governance to find the main patterns and gaps. Keep device counts, software installations and vulnerability observations separate: they describe different things.'
        },
        {
          title: 'Follow the records',
          body: 'Use Discovery to find the rows behind a result. Check the item, source and dates. Open its recorded details or relationships when they help answer your question.'
        },
        {
          title: 'Share a clear next step',
          body: 'Choose the report or spreadsheet that matches the question. Explain the selection and date, say what remains uncertain, and name the person or team who can check it.'
        }
      ],
      tip: 'The guide explains what the records show. A missing field or an empty result is a reason to investigate; it is not proof that a device, vulnerability or relationship does not exist.'
    },
    topicExtras: {
      scope: {
        eyebrow: 'Start with context',
        question: 'Which part of the cyber terrain does this result describe?',
        tip: 'Before comparing two reports, line up their network or system selection, security domains and snapshot dates. Different boundaries can explain different totals.',
        tryIt: 'When sharing a finding, put its selection and snapshot beside the count so the reader can understand it without reopening TSAAT.',
        diagram: 'scope'
      },
      navigate: {
        eyebrow: 'Find the right view',
        question: 'Do you need an overview, a list of records or a map of links?',
        tip: 'A role guide suggests a way to work. Persona controls what you can see in the app. Treat a hidden action as a navigation issue before assuming that its data is missing.',
        tryIt: 'Keep the name of the screen in your notes. It helps a colleague follow the same route when they check your finding.',
        diagram: 'flow'
      },
      tables: {
        eyebrow: 'Make the evidence manageable',
        question: 'What does one row represent, and why is it in this list?',
        tip: 'A short filtered list can be useful, but it describes only the selected group. Make the filter choices part of your explanation, especially when sharing a surprising total.',
        tryIt: 'Use the same filters when checking a result again. If the count changes, compare the snapshot and filters before interpreting the difference.',
        diagram: 'records'
      },
      'govern-end': {
        eyebrow: 'Know the devices',
        question: 'How much do the records tell you about the endpoints?',
        tip: 'Keep three follow-ups separate: identifying a device, refreshing its discovery record and deciding which tools should check it. Each may need a different owner.',
        tryIt: 'Describe a coverage result as a proportion of required checks. Avoid turning it into a claim that the same proportion of devices is secure.',
        diagram: 'coverage'
      },
      'explore-end': {
        eyebrow: 'Check the device record',
        question: 'Which detail needs checking on this particular endpoint?',
        tip: 'A name helps you recognise a device; its ID helps someone find the exact record. Include the ID when you ask an owner to check a missing or old detail.',
        tryIt: 'Keep the source and last discovery date with the field you are questioning. This gives the receiving team a clear place to begin.',
        diagram: 'records'
      },
      cmdb: {
        eyebrow: 'Look behind the name',
        question: 'Are you reading the right item at the right snapshot?',
        tip: 'In the practice lab, Open CMDB record is disabled. The recorded details remain available inside TSAAT, and Explore Topology can still open the item\'s relationships when that action is available.',
        tryIt: 'Describe the exact field or link that needs checking. An empty field tells you what is missing from the record, but does not explain why it is missing.',
        diagram: 'records'
      },
      shadow: {
        eyebrow: 'Follow an unfamiliar address',
        question: 'Which address was seen, and which device saw it?',
        tip: 'For an ARP Table result, the named endpoint is the observer. Keep its identity separate from the unknown IP address when discussing ownership or system membership.',
        tryIt: 'Use the observation date when asking the network owner to compare an address with their records. The date helps them check the right point in time.',
        diagram: 'network'
      },
      'govern-soft': {
        eyebrow: 'Understand the software picture',
        question: 'Which products or missing details deserve a closer look?',
        tip: 'Several versions of a product may be expected. The summary helps you find a question for the product owner; it does not answer whether every version is supported.',
        tryIt: 'Separate a question about the software itself from a question about data collection. A missing version may need better evidence before it needs a software change.',
        diagram: 'records'
      },
      'explore-soft': {
        eyebrow: 'Connect software to a device',
        question: 'Where was this software recorded, and which version was found?',
        tip: 'Product name, version, file path and endpoint ID work together. Keeping them together helps the owner distinguish installations that share a similar name.',
        tryIt: 'Ask the owner to confirm whether the recorded version and location are expected before treating a difference as a fault.',
        diagram: 'flow'
      },
      'govern-vuln': {
        eyebrow: 'Read the reported weaknesses',
        question: 'How serious are the recorded findings, and how complete is the evidence?',
        tip: 'Read severity alongside the affected software, version and source. A headline helps set review priorities, while the underlying records help an owner judge whether the finding applies.',
        tryIt: 'Keep the finding and the collection gap in separate sentences. This makes clear what has been reported and what still needs checking.',
        diagram: 'risk'
      },
      'explore-vuln': {
        eyebrow: 'Check a specific finding',
        question: 'Can another person find this observation and understand its limits?',
        tip: 'A repeated CVE code is not automatically a duplicate row. Keep the endpoint, software and source with each observation until you understand why the records repeat.',
        tryIt: 'When asking for follow-up, include the recorded action as something to check. The presence of an action in the table does not show that it has been completed.',
        diagram: 'risk'
      },
      topology: {
        eyebrow: 'Follow the recorded links',
        question: 'Which items are connected in the records, and what does each link mean?',
        tip: 'A graph makes a chain easier to see. Read the relationship type and environment before explaining what the chain means for a service or system.',
        tryIt: 'Keep the starting item and graph mode with any captured path. A different starting point or mode can show a different part of the recorded relationships.',
        diagram: 'network'
      },
      exports: {
        eyebrow: 'Make the handover useful',
        question: 'Does the download contain the evidence the next person needs?',
        tip: 'Use a briefing for the overall picture, an Excel file for matching inventory rows, and an impact report for traced relationships. Name the question before choosing the format.',
        tryIt: 'Open the downloaded file before sharing it. Add a short note saying what it covers, what still needs checking and who should act next.',
        diagram: 'flow'
      }
    },
    practice: {
      title: get('lab.title'),
      intro: 'The practice lab lets you use the TSAAT screens with included sample data. It runs in a separate browser window and does not connect to an operational installation. Use it alongside the walkthroughs in this handbook.',
      steps: [
        {
          title: 'Open the lab from the guide',
          body: 'Open the interactive user guide, select Practice lab and choose ' + get('lab.open') + '. The app opens immediately; there is no name or email form.'
        },
        {
          title: 'Read the starting context',
          body: 'Check the selected network, security domains and Snapshot before using any counts. The lab includes eight weekly sample snapshots, so its dates describe sample history.'
        },
        {
          title: 'Use the normal screens',
          body: 'Follow the relevant walkthrough to read summaries, filter records, open CMDB details or trace relationships. You can download Excel files and PDF reports from the supported app controls.'
        },
        {
          title: 'Reset or finish',
          body: 'Reset practice clears selections and returns to the starting view. Close the practice window when finished. Each window has its own practice state; downloaded files stay wherever you saved them.'
        }
      ],
      notes: [
        {
          title: 'Everything needed is included',
          body: 'The sample views and reports work offline. You do not need to install software, start a server or connect a database. The sample evidence is read-only.'
        },
        {
          title: 'Start every new window with the button',
          body: 'Opening the separate app HTML file or copying an opened app address into a fresh tab does not start a session. If a popup is blocked, allow popups for the guide and use its launch button again.'
        },
        {
          title: 'External CMDB records stay closed',
          body: 'Open CMDB record is disabled in the practice lab. You can still read the included CMDB details and use the available Explore Topology action. General instructions about external CMDB records apply outside the practice edition.'
        }
      ]
    },
    troubleExtras: [
      {
        title: 'The practice window does not appear',
        body: 'Allow popups for the interactive guide, then use the practice launch button again. The PDF cannot start the app; launch it from the guide in your browser.'
      },
      {
        title: 'An app address shows a launch notice',
        body: 'Return to Practice lab in the interactive guide and use the launch button. Each opened app address belongs to its particular window and cannot start a new session in another tab.'
      },
      {
        title: 'Open CMDB record is disabled',
        body: 'This is expected in the practice edition. Read the included Field and Value entries, or choose Explore Topology when available. You do not need an external CMDB connection to continue using the lab.'
      },
      {
        title: 'A public CVE page will not open offline',
        body: 'The included sample records work offline, but a link to a public CVE website needs that website to be reachable. You can keep reviewing the recorded code, software, source and detection date inside TSAAT.'
      }
    ],
    closing: {
      title: 'Leave a finding someone else can check',
      body: 'A useful handover says what you reviewed, which snapshot you used, what the evidence shows and what remains uncertain. Include the exact items or rows that need attention, then give a person or team a clear next step. That turns a screen full of data into work someone can act on.'
    }
  };
}
