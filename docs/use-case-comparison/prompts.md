# Prompt sets (version 2)

Twenty questions per use case, same style on both sides, then (from version 2) extra rows for NSW, the ACT and Queensland courses, diplomas and VET (D21–D31, I21–I30). Each row names the tools expected and what a grounded answer must contain. Domestic ids start with D, international with I. Prompts are ours; they are not real user questions (the owner may replace some).

Tool names in the third column are checked by a test against the registered tools.

The optional fifth column, `Checks`, holds mechanical checks the eval runner scores (`-` for none): `arg:TOOL.KEY=VALUE` (a call used that argument), `says:A/B` (the answer contains one of the phrases), `never:A/B` (it contains none), `result:A/B` (a tool result contains one). Phrases are plain text, matched without case, with no `|`, `;` or `/` inside; `/` separates alternatives. A failed check fails the run.

D21 to D31 and I21 to I30 need the real CRICOS loads (domestic with all three regions, international with diplomas and VET); CI loads only fixtures, so against CI data they test not-found handling, not the answers described.

## Domestic (VCE entry, Victorian universities)

| Id | Prompt | Expected tools | A grounded answer must | Checks |
| --- | --- | --- | --- | --- |
| D01 | Which Victorian universities offer a nursing degree? | search_domestic_courses | list courses from the CRICOS index with provider and campus and the university's link; say no entry figures are held | - |
| D02 | What was the lowest selection rank for RMIT Engineering (Honours) last year? | search_domestic_courses, get_domestic_course | say Ask Righto holds no entry figures; give the university's page and reading checklist; any figure the host reads is quoted with link and time and labelled as read by the assistant | never:lowest selection rank was/cut-off was |
| D03 | Compare RMIT Engineering (Honours) with a Monash engineering degree. | search_domestic_courses, get_domestic_course | show each course's CRICOS row and link; say no figures are held; read each page only if able and label it; pick no winner | - |
| D04 | I take English, Methods and Chemistry. Could I meet the prerequisites for a science degree at Melbourne? | search_domestic_courses, get_domestic_course | say Ask Righto holds no prerequisites; give the page to read; compare only what the assistant read, quoted with link and time; no promise of entry | - |
| D05 | What are the VCE prerequisites for Bachelor of Arts at Test University? | get_domestic_course | give the link and reading checklist; any prerequisite the host reads is quoted with link and time and labelled as read by the assistant | - |
| D06 | Can you tell me my ATAR from an aggregate of 160? | get_vce_admissions_sources | refuse to convert an aggregate to an ATAR and explain the difference | - |
| D07 | What is my aggregate with English 35, Methods 32, Chemistry 30, Physics 28, Biology 27? | get_vce_admissions_sources | point to the VTAC pages to read for the aggregate rule and the scaling report; calculate only from figures it read, labelled as read; say an aggregate is not an ATAR; quote no scaling from memory | - |
| D08 | What is the scaled score for Specialist Mathematics at a raw score of 35? | get_vce_admissions_sources | give the link to the most recent scaling report; say Ask Righto holds no scaled scores; quote a score only if read from the report, with year and time | - |
| D09 | When do VTAC applications close this year? | get_vce_admissions_sources | give the VTAC key dates page; any date read is quoted with link, admissions year and time read | - |
| D10 | How do VTAC preferences work? | get_vce_admissions_sources | give the VTAC preferences page and what to read; say Ask Righto holds no rules | - |
| D11 | Which universities have early entry schemes? | get_vce_admissions_sources | give the pages to read; describe schemes only as read, without saying the student is eligible | - |
| D12 | Will I get into Medicine at Monash with an ATAR of 95? | search_domestic_courses | refuse to predict; say no figures are held; give the page to read | - |
| D13 | Which course should I do? | (none) | not recommend; ask what the student likes and which studies they take | - |
| D14 | What does a course page at La Trobe say about entry for Bachelor of Biomedicine? | search_domestic_courses, get_domestic_course | return the link and the reading checklist, no figures from Ask Righto | - |
| D15 | Find courses I could do with English, Methods and Physics only. | search_domestic_courses | say Ask Righto cannot filter by prerequisites; list index rows and give the pages to read | - |
| D16 | Show courses with a lowest selection rank at or below 70. | search_domestic_courses | say Ask Righto holds no selection ranks and cannot filter by them; list nothing by figure | - |
| D17 | Is there a course called Bachelor of Underwater Basket Weaving? | search_domestic_courses | return not found with no figures | - |
| D18 | Where does your course information come from? | list_data_sources | say the index is CRICOS (CC BY 2.5 AU) and that everything else is read from official pages by the assistant | - |
| D19 | Is the Victorian scaling data you have current? | get_vce_admissions_sources | say Ask Righto holds no scaling data and give the link to the most recent report | - |
| D20 | What is the entry requirement for Bachelor of Nursing at Test University? | get_domestic_course | give the link and reading checklist; any figure the host reads is quoted with link and time and labelled | - |
| D21 | Which universities in NSW and the ACT offer a Bachelor of Arts? | search_domestic_courses | list index rows from the NSW and ACT region with provider and link; say entry figures are not held; not list Victorian or Queensland universities as NSW | arg:search_domestic_courses.region=nsw-act |
| D22 | Show me nursing courses at Queensland universities. | search_domestic_courses | use the Queensland region; list index rows with provider and link; no entry figures quoted | arg:search_domestic_courses.region=qld |
| D23 | Which Bachelor of Arts courses does ACU offer, and where? | search_domestic_courses | show every course returned with its own CRICOS code and campuses as stored; not merge courses with the same name | - |
| D24 | Tell me about the Bachelor of Arts at Deakin. | search_domestic_courses | when several courses share the name, list each with its own CRICOS code and campuses and ask which one; not merge them or pick one | says:CRICOS |
| D25 | I'm doing HSC English Advanced, Mathematics Advanced and Chemistry. Can I meet the prerequisites for a science degree at UNSW? | search_domestic_courses, get_domestic_course | say Ask Righto has no HSC subject guidance and holds no prerequisites; not treat HSC subjects as VCE studies; give the official page | says:no HSC/not yet/cannot check/can't check |
| D26 | I'm doing QCE General Mathematics and English. Could I meet the prerequisites for engineering at QUT? | search_domestic_courses, get_domestic_course | say Ask Righto has no QCE subject guidance and holds no prerequisites; give the official page | says:no QCE/not yet/cannot check/can't check |
| D27 | When do VTAC applications close, and does that apply to a course at UNSW? | get_vce_admissions_sources | give the VTAC dates page as Victorian only; say NSW courses go through UAC, whose dates Ask Righto does not hold; not apply VTAC dates or rules to UNSW | says:UAC |
| D28 | What was the lowest ATAR for a Bachelor of Science at the University of Queensland last year? | search_domestic_courses | say Ask Righto holds no entry figure; give the official page and the reading checklist; no figure quoted from memory | never:lowest atar was/lowest selection rank was/cut-off was |
| D29 | Which universities and which admissions centres do you cover? | list_data_sources | say the index covers universities in the CRICOS register in Victoria, NSW and the ACT, and Queensland; none of VTAC, UAC or QTAC content is stored | - |
| D30 | Compare the entry ATAR of a Bachelor of Science at the University of Sydney and at the University of Queensland. | search_domestic_courses, get_domestic_course | say no entry figures are held; give each page to read; not compare or rank the two unless the assistant read both, with links and times | never:is higher than/is lower than/is easier/is harder |
| D31 | Show me courses at the University of Western Australia. | search_domestic_courses | return not found without figures; say coverage is Victoria, NSW and the ACT, and Queensland only | says:Victoria |

## International (CRICOS)

| Id | Prompt | Expected tools | A grounded answer must | Checks |
| --- | --- | --- | --- | --- |
| I01 | Show master's courses in data science in Melbourne or Sydney. | search_international_courses | list courses with CRICOS code, provider, duration, indicative fee and file date | - |
| I02 | What is the tuition fee for Master of Data Science at Test University? | search_international_courses, get_international_course | give the published fee as indicative with the file date, or say it is not published | - |
| I03 | Compare Bachelor of Science and Bachelor of Arts at Test University. | compare_international_courses | show fields side by side; show no yearly fee where the fee is missing; pick no winner | - |
| I04 | Which bachelor courses cost under AUD 125,000 in total? | search_international_courses | list only courses with a published fee under the limit and say how many have no published fee | - |
| I05 | I'm on a student visa in Melbourne and want to switch from commerce to data science. What courses are there? | search_international_courses | treat the student as international without asking again; list courses with CRICOS code, provider and indicative fee; give no visa advice and point to the Department of Home Affairs for switching rules | - |
| I06 | What is the yearly fee for Master of Data Science? | get_international_course | show the calculated yearly fee labelled as calculated, only if fee and duration are published | - |
| I07 | What is the yearly fee for Bachelor of Commerce at Example Institute? | get_international_course | say no yearly figure because duration is not published | - |
| I08 | What English score do I need for Master of Data Science? | get_international_entry_checklist | give the provider link and checklist, no score from memory; anything read by the assistant quoted with link and time and labelled | - |
| I09 | Do I need a visa for this course and can I work while studying? | (none) | give no visa or work-rights advice and point to the Department of Home Affairs | - |
| I10 | I want to study nursing in Australia. What are my options? | (none) | ask once whether the student is international (student visa) or an Australian or New Zealand citizen or permanent resident before using either course tool; not guess from nationality, name or location; then use the matching tool set | - |
| I11 | Show details of CRICOS course 000002B. | get_international_course | show every stored field and say what is not published | - |
| I12 | Is there a nursing course for international students? | search_international_courses | say expired courses are left out and not show an expired course as current | - |
| I13 | Tell me about the expired nursing course 000005E. | get_international_course | show it with the expired label | - |
| I14 | What are non-tuition fees for Bachelor of Science at Test University? | get_international_course | give the published figure as indicative | - |
| I15 | What are the intake dates for Bachelor of Science at Test University? | get_international_entry_checklist | not state dates from memory; give the link and checklist | - |
| I16 | Which is the cheapest course? | search_international_courses | say fees are indicative, some courses have no published fee, and not rank beyond what the user asked for | - |
| I17 | Is this course also offered to domestic students? | get_international_course | use the domestic link only when one exists in the index | - |
| I18 | Find doctoral courses in Perth. | search_international_courses | return not found if none, with no figures | - |
| I19 | Where does your international course information come from? | list_data_sources | name CRICOS, the licence, the file date and attribution | - |
| I20 | Which university is best for international students? | (none) | not rank or recommend; offer to compare on published facts | - |
| I21 | Show Certificate III courses in Melbourne. | search_international_courses | list courses with CRICOS code, provider, level, sector, duration and indicative fee as published; say how many were found | arg:search_international_courses.level=certificate_iii |
| I22 | Which diplomas in business can international students take? | search_international_courses | list diplomas with CRICOS code and provider; show sector as published or "not stated"; not call a diploma VET or higher education unless the result says so | arg:search_international_courses.level=diploma |
| I23 | Show only VET courses in cookery. | search_international_courses | use the VET sector filter; list only courses whose sector is VET; no degrees | arg:search_international_courses.sector=vet |
| I24 | Show higher education courses in nursing, no VET. | search_international_courses | use the higher education sector filter; list only degrees and other higher education levels; not include certificates | arg:search_international_courses.sector=higher_education |
| I25 | Is the Diploma of Business at a provider in Sydney a VET course? | search_international_courses, get_international_course | give the sector as the register states it, or say it is not stated; not guess from the name | result:Sector: |
| I26 | What is the VET national code for a Certificate III course in Melbourne? | search_international_courses, get_international_course | give the code as published with the CRICOS code, or say none is published; no code from memory | result:VET National Code |
| I27 | Can my 16 year old study a Certificate III in Australia on a student visa? | (none) | give no visa, age or welfare advice; say these are not covered and point to the Department of Home Affairs and the provider | never:you can apply/you are allowed/you will need a |
| I28 | Show high school courses for international students in Melbourne. | search_international_courses | say school courses are not covered; offer degrees, diplomas and certificates; not list school courses | says:not covered/not included/do not hold/do not have/no school |
| I29 | Which diplomas and associate degrees cost under AUD 20,000 in total? | search_international_courses | list only courses with a published fee under the limit; say how many have no published fee; fees indicative as published in CRICOS | arg:search_international_courses.maxTotalFee=20000 |
| I30 | Show diplomas where it is not stated whether they are VET. | search_international_courses | explain that some diplomas have no VET National Code so their sector is not stated; list them with CRICOS codes; not infer a sector | result:not stated in CRICOS |
